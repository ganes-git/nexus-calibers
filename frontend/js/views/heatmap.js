/**
 * View 2: City-Wide Sighting Density Heatmap & Restricted Zones Overlay.
 * Strictly complies with design contract:
 * - Green density circles (#2F5233) scaling by sighting frequency (single-hue green scale).
 * - Dashed critical accent circles (#B3262A) for restricted zones.
 * - Zone tooltips and camera breakdown table.
 */

class HeatmapView {
  constructor() {
    this.map = null;
    this.cameraLayer = null;
    this.zoneLayer = null;
  }

  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>Camera Sighting Density & Geofence Overlay</span>
          <span class="mono text-muted" style="font-size: 11px;">Green: High Density | Dashed Red: Restricted Zone</span>
        </div>
        <div id="heatmap-map" class="map-container" style="height: 420px;"></div>
      </div>

      <div class="card">
        <div class="card-title">Camera Observation Statistics & Zone Enclosures</div>
        <div id="heatmap-table-container">
          <div class="state-box state-loading">Loading camera sighting data and zone geometries...</div>
        </div>
      </div>
    `;

    this._initMap();
    this.loadData();
  }

  _initMap() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    const mapEl = document.getElementById("heatmap-map");
    if (!mapEl || !window.L) return;

    this.map = L.map("heatmap-map", { attributionControl: false }).setView([13.0450, 80.2450], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(this.map);

    this.zoneLayer = L.layerGroup().addTo(this.map);
    this.cameraLayer = L.layerGroup().addTo(this.map);
  }

  async loadData() {
    const tableContainer = document.getElementById('heatmap-table-container');
    try {
      const [heatmapData, zonesData] = await Promise.all([
        DataSource.getHeatmap(),
        DataSource.getZones()
      ]);
      document.getElementById('offline-banner').classList.remove('visible');

      this._renderZones(zonesData);
      this._renderCameras(heatmapData);
      this._renderTable(heatmapData, zonesData, tableContainer);
    } catch (err) {
      document.getElementById('offline-banner').classList.add('visible');
      tableContainer.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
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

  _renderCameras(cameras) {
    if (!this.map || !this.cameraLayer) return;
    this.cameraLayer.clearLayers();

    const maxCount = Math.max(...cameras.map(c => c.count), 1);

    cameras.forEach(cam => {
      const ratio = cam.count / maxCount;
      const radius = 10 + ratio * 18;
      const opacity = 0.4 + ratio * 0.55;

      const marker = L.circleMarker([cam.lat, cam.lon], {
        radius: radius,
        color: "#2F5233",
        fillColor: "#2F5233",
        fillOpacity: opacity,
        weight: 2
      });

      marker.bindPopup(`
        <div style="font-family: ui-monospace, monospace; font-size: 11px;">
          <strong>Camera ID: ${cam.camera_id}</strong><br/>
          GPS: ${cam.lat.toFixed(4)}, ${cam.lon.toFixed(4)}<br/>
          Total Sightings: <strong>${cam.count}</strong>
        </div>
      `);

      this.cameraLayer.addLayer(marker);
    });
  }

  _renderTable(cameras, zones, container) {
    let camRows = "";
    cameras.forEach(c => {
      camRows += `
        <tr>
          <td class="mono font-bold">${c.camera_id}</td>
          <td class="mono">${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}</td>
          <td class="mono font-bold" style="text-align: right;">${c.count}</td>
          <td><span class="badge badge-primary">ACTIVE</span></td>
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
