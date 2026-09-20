/**
 * View 2: City-Wide Sighting Density Heatmap, Corridor Route Densities & Restricted Zones Overlay.
 * Strictly complies with design contract:
 * - Green density circles (#2F5233) scaling by sighting frequency (single-hue green scale).
 * - Muted standby circles for zero-sighting camera edge cases (#6B655B).
 * - Corridor Route Density polylines connecting camera nodes scaled by sample transit volume.
 * - Dashed critical accent circles (#B3262A) for restricted zones.
 * - Layer toggles and live periodic refresh.
 */

class HeatmapView {
  constructor() {
    this.map = null;
    this.cameraLayer = null;
    this.routeLayer = null;
    this.zoneLayer = null;
    this._pollTimer = null;
    this._showPoints = true;
    this._showRoutes = true;
    this._showZones = true;
  }

  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>Camera Sighting Density & Corridor Route Densities</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:11px; font-family:var(--font-mono); cursor:pointer; display:flex; align-items:center; gap:4px;">
              <input type="checkbox" id="toggle-points" checked onchange="window.HeatmapView.toggleLayer('points', this.checked)"> ● Point Density
            </label>
            <label style="font-size:11px; font-family:var(--font-mono); cursor:pointer; display:flex; align-items:center; gap:4px;">
              <input type="checkbox" id="toggle-routes" checked onchange="window.HeatmapView.toggleLayer('routes', this.checked)"> ▬ Route Density
            </label>
            <label style="font-size:11px; font-family:var(--font-mono); cursor:pointer; display:flex; align-items:center; gap:4px;">
              <input type="checkbox" id="toggle-zones" checked onchange="window.HeatmapView.toggleLayer('zones', this.checked)"> ⬡ Geofences
            </label>
          </div>
        </div>
        <div id="heatmap-map" class="map-container" style="height: 440px;"></div>
      </div>

      <div class="card">
        <div class="card-title">Camera Observation Statistics & Zone Enclosures</div>
        <div id="heatmap-table-container">
          <div class="state-box state-loading">Loading camera sighting data, corridor baselines, and zone geometries...</div>
        </div>
      </div>
    `;

    this._initMap();
    this.loadData();
    this._startPolling();
  }

  _initMap() {
    if (this.map) {
      try { this.map.remove(); } catch(e) {}
      this.map = null;
    }
    const mapEl = document.getElementById("heatmap-map");
    if (!mapEl || !window.L) return;
    if (mapEl._leaflet_id) {
      delete mapEl._leaflet_id;
    }

    this.map = L.map("heatmap-map", { 
      attributionControl: false,
      scrollWheelZoom: true,
      keyboard: false
    }).setView([13.0450, 80.2450], 12);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
      maxZoom: 18,
      subdomains: ['a', 'b', 'c']
    }).addTo(this.map);

    this.zoneLayer = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.cameraLayer = L.layerGroup().addTo(this.map);

    [0, 50, 150, 300, 600].forEach(delay => {
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, delay);
    });
  }

  _startPolling() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => {
      // Only poll if the heatmap map element is currently in the DOM
      if (document.getElementById("heatmap-map")) {
        this.loadData(true);
      } else {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
    }, 20000);
  }

  toggleLayer(layerName, isVisible) {
    if (!this.map) return;
    if (layerName === 'points' && this.cameraLayer) {
      this._showPoints = isVisible;
      if (isVisible) this.map.addLayer(this.cameraLayer);
      else this.map.removeLayer(this.cameraLayer);
    } else if (layerName === 'routes' && this.routeLayer) {
      this._showRoutes = isVisible;
      if (isVisible) this.map.addLayer(this.routeLayer);
      else this.map.removeLayer(this.routeLayer);
    } else if (layerName === 'zones' && this.zoneLayer) {
      this._showZones = isVisible;
      if (isVisible) this.map.addLayer(this.zoneLayer);
      else this.map.removeLayer(this.zoneLayer);
    }
  }

  async loadData(isBackground = false) {
    const tableContainer = document.getElementById('heatmap-table-container');
    try {
      const [heatmapData, zonesData, baselineData] = await Promise.all([
        DataSource.getHeatmap(),
        DataSource.getZones(),
        DataSource.get('/api/corridor-baseline')
      ]);
      document.getElementById('offline-banner').classList.remove('visible');

      this._renderZones(zonesData);
      this._renderRoutes(baselineData, heatmapData);
      this._renderCameras(heatmapData);
      this._renderTable(heatmapData, zonesData, tableContainer);
    } catch (err) {
      if (!isBackground) {
        document.getElementById('offline-banner').classList.add('visible');
        if (tableContainer) tableContainer.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
      }
    }
  }

  _renderZones(zones) {
    if (!this.map || !this.zoneLayer) return;
    this.zoneLayer.clearLayers();

    zones.forEach(z => {
      const circle = L.circle([z.center_lat, z.center_lon], {
        radius: z.radius_meters,
        color: "#B3262A",
        fillColor: "#B3262A",
        fillOpacity: 0.12,
        weight: 2,
        dashArray: "6, 6"
      });

      circle.bindTooltip(`
        <div style="font-family: system-ui, sans-serif; font-size: 11px;">
          <strong style="color: #B3262A;">RESTRICTED ZONE: ${z.name}</strong><br/>
          Radius: ${z.radius_meters}m<br/>
          ${z.reason ? `Restriction: ${z.reason}` : ""}
        </div>
      `, { sticky: true });

      this.zoneLayer.addLayer(circle);
    });
  }

  _renderRoutes(corridors, cameras) {
    if (!this.map || !this.routeLayer || !corridors || corridors.length === 0) return;
    this.routeLayer.clearLayers();

    // Map camera_id to coords
    const camMap = {};
    cameras.forEach(c => { camMap[c.camera_id] = [c.lat, c.lon]; });

    const maxSample = Math.max(...corridors.map(c => c.sample_count || 1), 1);

    corridors.forEach(c => {
      const p1 = camMap[c.camera_from];
      const p2 = camMap[c.camera_to];
      if (!p1 || !p2) return;

      const ratio = (c.sample_count || 1) / maxSample;
      const weight = Math.max(2, Math.round(2 + ratio * 6));
      const opacity = 0.35 + ratio * 0.55;

      const polyline = L.polyline([p1, p2], {
        color: "#2F5233",
        weight: weight,
        opacity: opacity,
        lineCap: 'round'
      });

      polyline.bindPopup(`
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.5;">
          <strong style="color:#2F5233; font-size:12px;">CORRIDOR ROUTE DENSITY</strong><br/>
          <strong>Path:</strong> ${c.camera_from} ➔ ${c.camera_to}<br/>
          <strong>Sample Volume:</strong> ${c.sample_count} transits<br/>
          <strong>Distance:</strong> ${c.distance_km ? c.distance_km.toFixed(2) + ' km' : '—'}<br/>
          <strong>Avg Speed:</strong> ${c.avg_speed_kmh ? c.avg_speed_kmh.toFixed(1) + ' km/h' : '—'}
        </div>
      `);

      this.routeLayer.addLayer(polyline);
    });
  }

  _renderCameras(cameras) {
    if (!this.map || !this.cameraLayer) return;
    this.cameraLayer.clearLayers();

    const maxCount = Math.max(...cameras.map(c => c.count), 1);

    cameras.forEach(cam => {
      const isZeroSighting = (cam.count === 0);
      const ratio = isZeroSighting ? 0 : cam.count / maxCount;
      const radius = isZeroSighting ? 6 : (10 + ratio * 18);
      const opacity = isZeroSighting ? 0.4 : (0.4 + ratio * 0.55);
      const color = isZeroSighting ? "#6B655B" : "#2F5233";

      const marker = L.circleMarker([cam.lat, cam.lon], {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: opacity,
        weight: isZeroSighting ? 1 : 2,
        dashArray: isZeroSighting ? "3, 3" : undefined
      });

      marker.bindPopup(`
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.5;">
          <strong style="font-size:12px; color:${color};">NODE: ${cam.camera_id}</strong><br/>
          <strong>Coordinates:</strong> ${cam.lat.toFixed(4)}°N, ${cam.lon.toFixed(4)}°E<br/>
          <strong>Sighting Density:</strong> <span style="font-weight:700; color:${color};">${cam.count} detections</span>
          ${isZeroSighting ? '<br/><span class="badge badge-muted" style="margin-top:4px;">STANDBY (0 SIGHTINGS)</span>' : ''}
          <div style="margin-top:8px; display:flex; gap:6px;">
            <button style="font-size:10px; padding:3px 8px; background:#2F5233; color:#fff; border:none; border-radius:3px; cursor:pointer;"
              onclick="window.HeatmapView.inspectCameraSightings('${cam.camera_id}')">
              🛰️ Track Sightings
            </button>
          </div>
        </div>
      `);

      this.cameraLayer.addLayer(marker);
    });
  }

  inspectCameraSightings(camId) {
    if (window.App) {
      window.App.navigateTo('cameras');
      setTimeout(() => {
        const inp = document.getElementById('cam-search-input');
        if (inp) {
          inp.value = camId;
          inp.dispatchEvent(new Event('input'));
        }
      }, 100);
    }
  }

  _renderTable(cameras, zones, container) {
    if (!container) return;
    let camRows = "";
    cameras.forEach(c => {
      const isZero = (c.count === 0);
      const statusBadge = isZero
        ? '<span class="badge badge-muted">STANDBY</span>'
        : '<span class="badge badge-primary">ACTIVE</span>';

      camRows += `
        <tr style="cursor:pointer;" onclick="window.HeatmapView.inspectCameraSightings('${c.camera_id}')">
          <td class="mono font-bold">${c.camera_id}</td>
          <td class="mono">${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}</td>
          <td class="mono font-bold" style="text-align: right;">${c.count}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn-secondary" style="font-size:10px; padding:2px 6px;"
              onclick="event.stopPropagation(); window.HeatmapView.inspectCameraSightings('${c.camera_id}')">
              Inspect Node
            </button>
          </td>
        </tr>
      `;
    });

    let zoneRows = "";
    zones.forEach(z => {
      zoneRows += `
        <tr>
          <td class="mono font-bold">${z.name}</td>
          <td class="mono">${z.center_lat.toFixed(4)}, ${z.center_lon.toFixed(4)}</td>
          <td class="mono" style="text-align: right;">${z.radius_meters} m</td>
          <td><span class="text-muted" style="font-size: 11px;">${z.reason || "Enforced"}</span></td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Camera Node</th>
                <th>Coordinates</th>
                <th style="text-align: right;">Sightings</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${camRows}</tbody>
          </table>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Restricted Perimeter</th>
                <th>Center</th>
                <th style="text-align: right;">Radius</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>${zoneRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }
}

window.heatmapView = new HeatmapView();
window.HeatmapView = window.heatmapView; // alias
