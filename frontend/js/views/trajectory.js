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
    this._lastQuery = null;
    this._lastData = null;
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
          <input type="text" id="plate-query-input" class="input-text"
            placeholder="e.g. TN09CB1234 or sighting ID" style="min-width: 260px;" required />
          <button type="submit" id="btn-search-plate" class="btn-action">Search Trajectory</button>
          <div style="display: flex; gap: 6px; align-items: center; margin-left: auto; flex-wrap: wrap;">
            <span class="text-muted" style="font-size: 11px;">Demos:</span>
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
          <span>Spatial Path Map</span>
          <span id="traj-meta" class="mono text-muted" style="font-size: 11px;"></span>
        </div>
        <div id="traj-map" class="map-container"></div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Per-Hop Identity-Fusion Evidence Trail</span>
          <div class="toolbar-row" style="margin-bottom:0;">
            <button class="btn-export" id="btn-export-evidence"
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
    // Fill print header
    const metaEl = document.getElementById('print-evidence-meta');
    if (metaEl) {
      const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      metaEl.textContent = `Plate: ${this._lastQuery} | Hops: ${this._lastData.length} | Exported: ${now} IST`;
    }
    window.print();
  }

  async executeSearch(query) {
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
        return;
      }

      this._lastData = data;
      if (window.App) window.App.pushRecentSearch(query);

      this._renderMapTrajectory(data);
      this._renderTable(data, tableContainer);

      if (metaEl) {
        const first = data[0].timestamp.replace('T', ' ').substring(0, 19);
        const last = data[data.length - 1].timestamp.replace('T', ' ').substring(0, 19);
        metaEl.textContent = `Hops: ${data.length} | ${first} → ${last}`;
      }

      // Enable export button
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

    const latlngs = [];
    hops.forEach((hop, idx) => {
      const pos = [hop.lat, hop.lon];
      latlngs.push(pos);
      const color = hop.anomaly_badge ? '#C98A1E' : '#2F5233';
      const marker = L.circleMarker(pos, {
        radius: 7, color, fillColor: color, fillOpacity: 0.9, weight: 2
      });
      marker.bindPopup(`
        <div style="font-family: ui-monospace, monospace; font-size: 11px;">
          <strong>Hop #${idx + 1}: ${hop.camera_id}</strong><br/>
          Sighting #${hop.sighting_id}<br/>
          Plate: ${hop.plate_text || '(unconfirmed)'}<br/>
          Type: ${hop.vehicle_type || 'UNKNOWN'}<br/>
          Time: ${hop.timestamp.replace('T', ' ')}<br/>
          Speed: ${hop.speed_kmh ? hop.speed_kmh.toFixed(1) + ' km/h' : '—'}<br/>
          Composite: ${(hop.composite_score * 100).toFixed(1)}%
          ${hop.anomaly_detail ? `<br/><span style="color:#B3262A;">${hop.anomaly_detail}</span>` : ''}
        </div>
      `);
      this.markersLayer.addLayer(marker);
    });

    if (latlngs.length > 1) {
      this.polyline = L.polyline(latlngs, { color: '#2F5233', weight: 3, dashArray: '4, 4' }).addTo(this.map);
    }
    this.map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
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
              Plate Score: ${(h.plate_score * 100).toFixed(1)}% &nbsp;|&nbsp;
              Visual Sim: ${(h.visual_score * 100).toFixed(1)}% &nbsp;|&nbsp;
              Transit Score: ${(h.transit_score * 100).toFixed(1)}%
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
