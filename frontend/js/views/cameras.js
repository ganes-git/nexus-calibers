/**
 * View 6: Camera Health Monitor
 * Shows table of all registered cameras with online/offline/demo status,
 * sightings today, last seen timestamp, and zone.
 * Also renders a Leaflet map with color-coded camera pins.
 */

class CamerasView {
  constructor() {
    this.map = null;
    this.markersLayer = null;
  }

  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>Camera Node Status Overview</span>
          <button class="btn-action" style="font-size: 11px; padding: 4px 10px;"
            onclick="window.CamerasView.loadCameras()">Refresh</button>
        </div>
        <div id="cameras-table-container">
          <div class="state-box state-loading">Polling camera registry...</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Camera Network Map</div>
        <div id="cameras-map" class="map-container"></div>
      </div>

      <div class="card">
        <div class="card-title">Live Feed Integration Guide</div>
        <div style="font-size: 13px; line-height: 1.7; color: var(--text-primary);">
          <p style="margin-bottom: 10px;">
            To connect real CCTV/ANPR cameras to this system, follow these steps:
          </p>
          <ol style="margin-left: 18px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;">
            <li>Install dependencies: <code class="mono" style="background:var(--surface-color); padding:1px 5px; border-radius:2px;">pip install opencv-python easyocr pyyaml</code></li>
            <li>Edit <code class="mono" style="background:var(--surface-color); padding:1px 5px; border-radius:2px;">backend/camera_config.yaml</code> — set <strong>enabled: true</strong> and fill in the <strong>rtsp_url</strong> for each camera.</li>
            <li>Start the ingest supervisor: <code class="mono" style="background:var(--surface-color); padding:1px 5px; border-radius:2px;">py -3.13 backend/ingest_service.py</code></li>
            <li>The ingest service writes detections directly to the SQLite database. This dashboard updates automatically.</li>
          </ol>
          <div style="border-left: 3px solid var(--accent-warning); padding: 8px 12px; background: var(--accent-warning-light); border-radius: 0 4px 4px 0;">
            <strong>RTSP URL format:</strong>
            <code class="mono" style="font-size: 12px; display:block; margin-top:4px;">
              rtsp://username:password@192.168.1.XXX:554/stream1
            </code>
            <span class="text-muted" style="font-size:11px;">
              Supported cameras: Hikvision, Dahua, CP Plus, Bosch FLEXIDOME, and any ONVIF-compliant device.
            </span>
          </div>
        </div>
      </div>
    `;

    this._initMap();
    this.loadCameras();
  }

  _initMap() {
    if (this.map) { this.map.remove(); this.map = null; }
    const mapEl = document.getElementById('cameras-map');
    if (!mapEl || !window.L) return;
    this.map = L.map('cameras-map', { attributionControl: false }).setView([13.030, 80.235], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  async loadCameras() {
    const tc = document.getElementById('cameras-table-container');
    try {
      const cameras = await DataSource.get('/api/cameras');
      document.getElementById('offline-banner').classList.remove('visible');
      this._renderTable(cameras, tc);
      this._renderMap(cameras);
    } catch {
      document.getElementById('offline-banner').classList.add('visible');
      if (tc) tc.innerHTML = '<div class="state-box text-critical">Unable to reach the backend.</div>';
    }
  }

  _renderTable(cameras, container) {
    if (!cameras || cameras.length === 0) {
      container.innerHTML = '<div class="state-box">No cameras registered in the system.</div>';
      return;
    }

    let rows = '';
    cameras.forEach(c => {
      const status = (c.status || 'OFFLINE').toUpperCase();
      const dotClass = status === 'ONLINE' ? 'online' : (status === 'DEMO' ? 'demo' : 'offline');
      const badgeClass = status === 'ONLINE' ? 'badge-online' : (status === 'DEMO' ? 'badge-demo' : 'badge-offline');
      const lastSeen = c.last_seen
        ? c.last_seen.replace('T', ' ').substring(0, 19)
        : '—';

      rows += `
        <tr class="cam-status-row">
          <td class="mono">${c.camera_id}</td>
          <td>${c.name}</td>
          <td class="mono text-muted">${c.zone_id || '—'}</td>
          <td>
            <span class="cam-live-dot ${dotClass}"></span>
            <span class="badge ${badgeClass}">${status}</span>
          </td>
          <td class="mono" style="text-align:right; font-weight:700;">${c.sightings_today ?? 0}</td>
          <td class="mono text-muted" style="font-size:11px;">${lastSeen}</td>
          <td class="mono text-muted" style="font-size:11px;">${c.rtsp_url ? '<span class="badge badge-primary" style="font-size:9px;">RTSP SET</span>' : '<span class="badge badge-muted" style="font-size:9px;">NO URL</span>'}</td>
        </tr>`;
    });

    const online = cameras.filter(c => ['ONLINE', 'DEMO'].includes((c.status || '').toUpperCase())).length;
    container.innerHTML = `
      <div style="display:flex; gap:16px; margin-bottom: 12px; font-size:12px; font-family: var(--font-mono);">
        <span><strong>${cameras.length}</strong> <span class="text-muted">TOTAL</span></span>
        <span class="text-primary"><strong>${online}</strong> <span class="text-muted">ACTIVE</span></span>
        <span class="text-critical"><strong>${cameras.length - online}</strong> <span class="text-muted">OFFLINE</span></span>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Camera ID</th>
              <th>Location</th>
              <th>Zone</th>
              <th>Status</th>
              <th style="text-align:right;">Sightings Today</th>
              <th>Last Seen</th>
              <th>Feed</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  _renderMap(cameras) {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    const STATUS_COLORS = { ONLINE: '#2F5233', DEMO: '#C98A1E', OFFLINE: '#B3262A' };

    cameras.forEach(c => {
      if (!c.lat || !c.lon) return;
      const status = (c.status || 'OFFLINE').toUpperCase();
      const color = STATUS_COLORS[status] || '#B3262A';

      const marker = L.circleMarker([c.lat, c.lon], {
        radius: 8, color, fillColor: color, fillOpacity: 0.85, weight: 2
      });
      marker.bindPopup(`
        <div style="font-family: ui-monospace, monospace; font-size: 11px;">
          <strong>${c.camera_id}</strong><br/>
          ${c.name}<br/>
          Zone: ${c.zone_id || '—'}<br/>
          Status: <strong style="color:${color};">${status}</strong><br/>
          Sightings today: ${c.sightings_today ?? 0}
        </div>
      `);
      this.markersLayer.addLayer(marker);
    });
  }
}

window.CamerasView = new CamerasView();
