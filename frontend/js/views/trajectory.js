/**
 * View 1: Trajectory Search, Evidence Export, Vehicle Type Badge.
 * Enhancements:
 *  - Export PDF button (window.print() with print.css)
 *  - Vehicle type badge on each hop
 *  - Recent search logging via App.pushRecentSearch()
 *  - Uses renamed input ID 'plate-query-input' for quick-access from sidebar
 */

class TrajectoryView {
  constructor() {
    this.map = null;
    this.polyline = null;
    this.markersLayer = null;
    this.simMarker = null;
    this._lastQuery = null;
    this._lastData = null;
    this._simInterval = null;
    this._simIndex = 0;
    this._simSpeed = 1000;
  }

  render(container) {
    container.innerHTML = `
      <!-- Hidden evidence header (shown only in print) -->
      <div id="print-evidence-header" style="display:none;">
        <div class="print-title">ANPR Evidence Report — City ICCC Chennai</div>
        <div class="print-subtitle mono" id="print-evidence-meta"></div>
      </div>

      <div class="card">
        <div class="card-title">Trajectory Query &amp; Forensic Reconstruction</div>
        <form id="traj-form" class="form-row">
          <input type="text" id="plate-query-input" class="input-text" list="target-plate-suggestions"
            placeholder="e.g. TN09CB1234 or sighting ID" style="min-width: 260px;" required />
          <datalist id="target-plate-suggestions">
            <option value="TN09CB1234">Normal Multi-Hop Transit</option>
            <option value="KA03MD5522">Route Anomaly (Speed/Transit Delay)</option>
            <option value="TN01AZ7788">Unconfirmed Plate Sighting</option>
            <option value="TN07AX4521">Wanted Blacklist Vehicle</option>
            <option value="KA01AB9999">Impound Notice Vehicle</option>
          </datalist>
          <button type="submit" id="btn-search-plate" class="btn-action">Search Trajectory</button>
          <div style="display: flex; gap: 6px; align-items: center; margin-left: auto; flex-wrap: wrap;">
            <span class="text-muted" style="font-size: 11px;">Quick Tests:</span>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;"
              onclick="window.TrajectoryView.searchPreset('TN09CB1234')">Normal (TN09CB1234)</button>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;"
              onclick="window.TrajectoryView.searchPreset('KA03MD5522')">Anomaly (KA03MD5522)</button>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;"
              onclick="window.TrajectoryView.searchPreset('TN01AZ7788')">Unconfirmed (TN01AZ7788)</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Spatial Path Map &amp; Real-Time Playback</span>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span id="traj-meta" class="mono text-muted" style="font-size: 11px;"></span>
          </div>
        </div>

        <!-- Interactive Simulation Toolbar -->
        <div id="traj-sim-bar" style="display:none; align-items:center; gap:10px; background:var(--surface-color); padding:8px 12px; border:1px solid var(--border-color); border-radius:5px; margin-bottom:10px; flex-wrap:wrap;">
          <button id="btn-sim-play" class="btn-action" style="font-size:11px; padding:4px 10px;" onclick="window.TrajectoryView.togglePlay()">▶ Play Simulation</button>
          <button class="btn-secondary" style="font-size:11px; padding:4px 8px;" onclick="window.TrajectoryView.resetSim()">⏹ Reset</button>
          
          <div style="display:flex; align-items:center; gap:6px; margin-left:6px;">
            <label for="sim-scrubber" class="mono text-muted" style="font-size:11px;">Hop:</label>
            <input id="sim-scrubber" type="range" min="0" max="0" value="0" style="width:140px; cursor:pointer;" oninput="window.TrajectoryView.scrubTo(this.value)" />
            <span id="sim-hop-label" class="mono" style="font-size:11px; font-weight:700;">1 / 1</span>
          </div>

          <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
            <span class="mono text-muted" style="font-size:11px;">Speed:</span>
            <select id="sim-speed-select" class="input-text" style="padding:2px 6px; font-size:11px;" onchange="window.TrajectoryView.setSpeed(this.value)">
              <option value="1500">1x (Normal)</option>
              <option value="800" selected>2x (Fast)</option>
              <option value="350">4x (Rapid)</option>
            </select>
          </div>
        </div>

        <div id="traj-map" class="map-container"></div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Per-Hop Identity-Fusion Evidence Trail</span>
          <div class="toolbar-row" style="margin-bottom:0;">
            <button class="btn-secondary" id="btn-export-evidence"
              onclick="window.TrajectoryView.exportEvidence()" disabled>
              ⎙ Export Evidence PDF
            </button>
          </div>
        </div>
        <div id="traj-table-container">
          <div class="state-box">Enter a license plate or sighting ID above to reconstruct trajectory.</div>
        </div>
      </div>
    `;

    document.getElementById('traj-form').addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('plate-query-input').value.trim();
      if (q) this.executeSearch(q);
    });

    this._initMap();
  }

  _initMap() {
    if (this.map) { this.map.remove(); this.map = null; }
    const mapEl = document.getElementById('traj-map');
    if (!mapEl || !window.L) return;

    this.map = L.map('traj-map', { attributionControl: false }).setView([13.0450, 80.2450], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  searchPreset(plate) {
    const input = document.getElementById('plate-query-input');
    if (input) { input.value = plate; this.executeSearch(plate); }
  }

  exportEvidence() {
    if (!this._lastData || !this._lastQuery) return;
    const metaEl = document.getElementById('print-evidence-meta');
    if (metaEl) {
      const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      metaEl.textContent = `Plate: ${this._lastQuery} | Hops: ${this._lastData.length} | Exported: ${now} IST`;
    }
    window.print();
  }

  async executeSearch(query) {
    this.stopSim();
    const tableContainer = document.getElementById('traj-table-container');
    const metaEl = document.getElementById('traj-meta');
    tableContainer.innerHTML = '<div class="state-box state-loading">Querying sightings and calculating per-hop fusion scores...</div>';
    if (metaEl) metaEl.textContent = '';

    const role = document.getElementById('role-selector')?.value || 'operator';
    this._lastQuery = query.toUpperCase();

    try {
      const data = await DataSource.get(`/api/trajectory?query=${encodeURIComponent(query)}&role=${role}`);
      document.getElementById('offline-banner').classList.remove('visible');

      if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div class="state-box">No trajectory found for this query.</div>';
        if (this.markersLayer) this.markersLayer.clearLayers();
        if (this.polyline) { this.map.removeLayer(this.polyline); this.polyline = null; }
        document.getElementById('traj-sim-bar').style.display = 'none';
        return;
      }

      this._lastData = data;
      if (window.App) window.App.pushRecentSearch(query);

      this._renderMapTrajectory(data);
      this._renderTable(data, tableContainer);
      this._setupSimulationControls(data);

      if (metaEl) {
        const first = data[0].timestamp.replace('T', ' ').substring(0, 19);
        const last = data[data.length - 1].timestamp.replace('T', ' ').substring(0, 19);
        metaEl.textContent = `Hops: ${data.length} | ${first} → ${last}`;
      }

      const exportBtn = document.getElementById('btn-export-evidence');
      if (exportBtn) exportBtn.disabled = false;

    } catch {
      document.getElementById('offline-banner').classList.add('visible');
      tableContainer.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
    }
  }

  _renderMapTrajectory(hops) {
    if (!this.map) this._initMap();
    if (!this.map) return;
    this.markersLayer.clearLayers();
    if (this.polyline) { this.map.removeLayer(this.polyline); this.polyline = null; }
    if (this.simMarker) { this.map.removeLayer(this.simMarker); this.simMarker = null; }

    const latlngs = [];
    hops.forEach((hop, idx) => {
      const pos = [hop.lat, hop.lon];
      latlngs.push(pos);
      const color = hop.anomaly_badge ? '#C98A1E' : '#2F5233';
      const marker = L.circleMarker(pos, {
        radius: 8, color, fillColor: color, fillOpacity: 0.9, weight: 2
      });
      marker.bindPopup(`
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.5;">
          <strong style="color:${color}; font-size:12px;">Hop #${idx + 1}: ${hop.camera_id}</strong><br/>
          <strong>Plate:</strong> ${hop.plate_text || '(unconfirmed)'}<br/>
          <strong>Vehicle:</strong> ${hop.vehicle_type || 'UNKNOWN'}<br/>
          <strong>Timestamp:</strong> ${hop.timestamp.replace('T', ' ')}<br/>
          <strong>Speed:</strong> ${hop.speed_kmh ? hop.speed_kmh.toFixed(1) + ' km/h' : '—'}<br/>
          <strong>Composite Score:</strong> ${(hop.composite_score * 100).toFixed(1)}%
          ${hop.anomaly_detail ? `<br/><span style="color:#B3262A; font-weight:700;">${hop.anomaly_detail}</span>` : ''}
        </div>
      `);
      marker.hopIndex = idx;
      this.markersLayer.addLayer(marker);
    });

    if (latlngs.length > 1) {
      this.polyline = L.polyline(latlngs, { color: '#2F5233', weight: 3.5, dashArray: '6, 6', opacity: 0.85 }).addTo(this.map);
    }
    this.map.fitBounds(L.latLngBounds(latlngs), { padding: [45, 45] });
  }

  _setupSimulationControls(hops) {
    const simBar = document.getElementById('traj-sim-bar');
    const scrubber = document.getElementById('sim-scrubber');
    const hopLabel = document.getElementById('sim-hop-label');
    if (!simBar || hops.length <= 1) {
      if (simBar) simBar.style.display = 'none';
      return;
    }
    simBar.style.display = 'flex';
    scrubber.max = hops.length - 1;
    scrubber.value = 0;
    this._simIndex = 0;
    hopLabel.textContent = `1 / ${hops.length}`;
  }

  togglePlay() {
    if (this._simInterval) {
      this.stopSim();
    } else {
      this.startSim();
    }
  }

  startSim() {
    if (!this._lastData || this._lastData.length <= 1) return;
    const btn = document.getElementById('btn-sim-play');
    if (btn) btn.textContent = '⏸ Pause Simulation';

    if (this._simIndex >= this._lastData.length - 1) {
      this._simIndex = 0;
    }

    this._simInterval = setInterval(() => {
      this._simIndex++;
      if (this._simIndex >= this._lastData.length) {
        this._simIndex = this._lastData.length - 1;
        this.stopSim();
      }
      this.updateSimPosition(this._simIndex);
    }, this._simSpeed);
  }

  stopSim() {
    if (this._simInterval) {
      clearInterval(this._simInterval);
      this._simInterval = null;
    }
    const btn = document.getElementById('btn-sim-play');
    if (btn) btn.textContent = '▶ Play Simulation';
  }

  resetSim() {
    this.stopSim();
    this._simIndex = 0;
    this.updateSimPosition(0);
  }

  scrubTo(idx) {
    this._simIndex = parseInt(idx, 10);
    this.updateSimPosition(this._simIndex);
  }

  setSpeed(speedMs) {
    this._simSpeed = parseInt(speedMs, 10);
    if (this._simInterval) {
      this.stopSim();
      this.startSim();
    }
  }

  updateSimPosition(idx) {
    if (!this._lastData || !this._lastData[idx] || !this.map) return;
    const hop = this._lastData[idx];
    const pos = [hop.lat, hop.lon];

    const scrubber = document.getElementById('sim-scrubber');
    const hopLabel = document.getElementById('sim-hop-label');
    if (scrubber) scrubber.value = idx;
    if (hopLabel) hopLabel.textContent = `${idx + 1} / ${this._lastData.length}`;

    // Highlight row in table
    document.querySelectorAll('.expandable-row').forEach((r, rIdx) => {
      if (rIdx === idx) {
        r.style.backgroundColor = '#E2DDD3';
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        r.style.backgroundColor = '';
      }
    });

    // Create or move animated vehicle icon
    if (!this.simMarker) {
      const carIcon = L.divIcon({
        className: 'sim-car-pulse',
        html: '<div style="background:#2F5233; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow:0 0 0 4px rgba(47,82,51,0.3); border:2px solid #fff;">🚗</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      this.simMarker = L.marker(pos, { icon: carIcon, zIndexOffset: 1000 }).addTo(this.map);
    } else {
      this.simMarker.setLatLng(pos);
    }

    this.map.panTo(pos);
  }

  focusHopOnMap(idx) {
    if (!this._lastData || !this._lastData[idx] || !this.map) return;
    const hop = this._lastData[idx];
    this.map.setView([hop.lat, hop.lon], 14, { animate: true });
    this.updateSimPosition(idx);
  }

  _renderTable(hops, container) {
    const VTYPE_ICONS = { CAR: '🚗', BUS: '🚌', TRUCK: '🚛', '2W': '🏍️', AUTO: '🛺', UNKNOWN: '🚘' };

    let rowsHtml = '';
    hops.forEach((h, idx) => {
      const hasAnomaly = h.anomaly_badge;
      const isUnconfirmed = h.plate_unconfirmed;
      const vtype = (h.vehicle_type || 'UNKNOWN').toUpperCase();
      const vtypeIcon = VTYPE_ICONS[vtype] || '🚘';

      const plateBadge = isUnconfirmed
        ? '<span class="badge badge-warning">PLATE UNCONFIRMED</span>'
        : `<span class="mono" style="font-weight:700;">${h.plate_text || '—'}</span>`;

      const statusBadge = hasAnomaly
        ? '<span class="badge badge-warning">ANOMALY</span>'
        : '<span class="badge badge-primary">NORMAL</span>';

      const speedCell = h.speed_kmh && h.speed_kmh > 0
        ? `<span class="${h.speed_kmh > 100 ? 'text-critical' : ''}">${h.speed_kmh.toFixed(1)} km/h</span>`
        : '—';

      rowsHtml += `
        <tr class="expandable-row ${hasAnomaly ? 'highlighted' : ''}"
          onmouseenter="window.TrajectoryView.focusHopOnMap(${idx})"
          onclick="window.TrajectoryView.toggleDetail(${idx})">
          <td class="mono">#${idx + 1}</td>
          <td class="mono" style="font-weight:700;">${h.camera_id}</td>
          <td class="mono" style="font-size:11px;">${h.timestamp.replace('T', ' ').substring(0, 19)}</td>
          <td>${plateBadge}</td>
          <td title="${vtype}">${vtypeIcon} <span class="badge badge-muted vtype-badge">${vtype}</span></td>
          <td class="mono">${speedCell}</td>
          <td class="mono">${(h.composite_score * 100).toFixed(1)}%</td>
          <td>${statusBadge}</td>
        </tr>
        <tr id="hop-detail-${idx}" style="display:none;">
          <td colspan="8">
            <div class="reason-detail">
              <strong>Evidence Breakdown:</strong> ${h.explanation}<br/>
              ${h.distance_km > 0 ? `Distance: ${h.distance_km} km &nbsp;|&nbsp; Speed: ${speedCell}<br/>` : ''}
              Plate Match: ${(h.plate_score * 100).toFixed(1)}% &nbsp;|&nbsp;
              Visual Embedding Sim: ${(h.visual_score * 100).toFixed(1)}% &nbsp;|&nbsp;
              Transit Plausibility: ${(h.transit_score * 100).toFixed(1)}%
              ${h.anomaly_detail ? `<br/><strong class="text-critical">Deviation:</strong> ${h.anomaly_detail}` : ''}
            </div>
          </td>
        </tr>`;
    });

    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Hop</th>
              <th>Camera</th>
              <th>Timestamp</th>
              <th>Plate</th>
              <th>Vehicle</th>
              <th>Speed</th>
              <th>Composite</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  toggleDetail(idx) {
    const el = document.getElementById(`hop-detail-${idx}`);
    if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
  }
}

window.TrajectoryView = new TrajectoryView();
