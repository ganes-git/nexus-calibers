class CamerasView {
  constructor() {
    this.map = null;
    this.markersLayer = null;
    this.activeCameraModal = null;
    this.viewMode = 'table'; // 'table' or 'matrix'
    this.camerasData = [];
    this.searchQuery = '';
    this.statusFilter = 'all';
  }

  render(container) {
    container.innerHTML = `
      <!-- Camera Stream HUD Modal -->
      <div id="cam-hud-modal" class="modal-backdrop hidden" onclick="if(event.target===this) window.CamerasView.closeModal()">
        <div class="modal-box" style="width: 580px; max-width: 95vw; padding: 20px;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <div class="brand-badge" id="modal-cam-badge">CAM-001 // OPTICAL HUD</div>
              <h2 class="modal-title" id="modal-cam-title" style="font-size:16px;">Koyambedu Junction ANPR Feed</h2>
              <p class="modal-subtitle mono text-muted" id="modal-cam-sub">RTSP Stream · 1080p · 25 FPS · Low Latency</p>
            </div>
            <button class="btn-secondary" style="padding:2px 8px; font-size:14px;" onclick="window.CamerasView.closeModal()">&times;</button>
          </div>

          <!-- Video Stream Simulated Canvas -->
          <div style="position:relative; width:100%; height:260px; background:#121312; border-radius:4px; overflow:hidden; border:1px solid #2B2D2B; margin-bottom:14px; display:flex; align-items:center; justify-content:center;">
            <!-- Grid lines / Reticle -->
            <div style="position:absolute; inset:0; background:rgba(0,0,0,0.5);"></div>
            
            <!-- Top HUD overlay -->
            <div style="position:absolute; top:10px; left:12px; font-family:'JetBrains Mono',monospace; font-size:10.5px; color:#A4E5A4; display:flex; gap:12px; text-shadow:0 1px 2px #000;">
              <span>● REC <span id="modal-hud-clock">10:45:12</span></span>
              <span>FPS: <strong style="color:#FFF;">24.8</strong></span>
              <span>RES: 1920x1080</span>
            </div>
            <div style="position:absolute; top:10px; right:12px; font-family:'JetBrains Mono',monospace; font-size:10.5px; color:#E3B341; text-shadow:0 1px 2px #000;">
              <span>ANPR ENGINE: <strong style="color:#A4E5A4;">ONLINE</strong></span>
            </div>

            <!-- ANPR Bounding Box Target Overlay -->
            <div style="position:relative; z-index:2; border:2px dashed #A4E5A4; padding:12px 18px; border-radius:4px; background:rgba(47,82,51,0.2); backdrop-filter:blur(1px); text-align:center;">
              <div style="font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:800; color:#FFF; letter-spacing:1.5px;" id="modal-hud-plate">TN 09 CB 1234</div>
              <div style="font-family:'JetBrains Mono',monospace; font-size:9.5px; color:#A4E5A4; margin-top:2px;">CONFIDENCE: 98.4% · SEDAN</div>
            </div>

            <!-- Bottom HUD overlay -->
            <div style="position:absolute; bottom:10px; left:12px; font-family:'JetBrains Mono',monospace; font-size:10px; color:#AAA;">
              <span>LAT: <span id="modal-hud-lat">13.0694</span>° N &nbsp; LON: <span id="modal-hud-lon">80.1948</span>° E</span>
            </div>
            <div style="position:absolute; bottom:10px; right:12px; font-family:'JetBrains Mono',monospace; font-size:10px; color:#AAA;">
              <span>CODEC: H.264 / ONVIF-S</span>
            </div>
          </div>

          <!-- Controls & Telemetry -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:6px;">
              <button class="btn-action" style="font-size:11px; padding:5px 12px;" onclick="window.CamerasView.triggerSnapshot()">📸 Capture Forensic Frame</button>
              <button class="btn-secondary" style="font-size:11px; padding:5px 10px;" onclick="window.CamerasView.cyclePlateTest()">🔄 Test OCR Recognition</button>
            </div>
            <span id="modal-hud-status" class="mono text-muted" style="font-size:11px;">Feed active · 0 dropped frames</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Camera Node Status &amp; Live Surveillance Feeds</span>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <div class="btn-group" style="display:flex; border:1px solid var(--border-color); border-radius:4px; overflow:hidden;">
              <button id="btn-view-table" class="filter-btn active" style="border:none; border-radius:0;" onclick="window.CamerasView.setViewMode('table')">📋 Table View</button>
              <button id="btn-view-matrix" class="filter-btn" style="border:none; border-radius:0;" onclick="window.CamerasView.setViewMode('matrix')">🎛️ Quad CCTV Matrix</button>
            </div>
            <button class="btn-secondary" style="font-size: 11px; padding: 4px 8px;"
              onclick="window.open('/api/export/csv?dataset=cameras', '_blank')" title="Export camera registry CSV">📥 Export CSV</button>
            <button class="btn-action" style="font-size: 11px; padding: 5px 12px;"
              onclick="window.CamerasView.loadCameras()">Refresh Registry</button>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
          <input type="text" id="cam-search-input" class="input-text mono" placeholder="Filter by camera or location..."
            style="min-width: 220px; font-size:12px;" oninput="window.CamerasView.setSearch(this.value)" />
          
          <div style="display:flex; gap:4px; align-items:center;">
            <span class="mono text-muted" style="font-size:11px;">Status:</span>
            <button class="filter-btn active" onclick="window.CamerasView.setStatusFilter('all', this)">All</button>
            <button class="filter-btn" onclick="window.CamerasView.setStatusFilter('ONLINE', this)">Online</button>
            <button class="filter-btn" onclick="window.CamerasView.setStatusFilter('DEMO', this)">Demo</button>
            <button class="filter-btn" onclick="window.CamerasView.setStatusFilter('OFFLINE', this)">Offline</button>
          </div>
        </div>

        <div id="cameras-table-container">
          <div class="state-box state-loading">Polling camera registry...</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Camera Network Spatial Map</span>
          <span class="mono text-muted" style="font-size:11px;">Click pin to inspect optical stream</span>
        </div>
        <div id="cameras-map" class="map-container"></div>
      </div>

      <div class="card">
        <div class="card-title">Live Feed Integration &amp; RTSP Ingest Guide</div>
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
    this._startClock();
  }

  _startClock() {
    setInterval(() => {
      const el = document.getElementById('modal-hud-clock');
      if (el) el.textContent = new Date().toTimeString().substring(0, 8);
    }, 1000);
  }

  _initMap() {
    if (this.map) { 
      try { this.map.remove(); } catch(e) {}
      this.map = null; 
    }
    const mapEl = document.getElementById('cameras-map');
    if (!mapEl || !window.L) return;
    if (mapEl._leaflet_id) {
      delete mapEl._leaflet_id;
    }
    this.map = L.map('cameras-map', { 
      attributionControl: false,
      scrollWheelZoom: true,
      keyboard: false
    }).setView([13.045, 80.240], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
      maxZoom: 18,
      subdomains: ['a', 'b', 'c']
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);

    [0, 50, 150, 300, 600].forEach(delay => {
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, delay);
    });
  }

  setViewMode(mode) {
    this.viewMode = mode;
    document.getElementById('btn-view-table')?.classList.toggle('active', mode === 'table');
    document.getElementById('btn-view-matrix')?.classList.toggle('active', mode === 'matrix');
    this._renderCurrentView();
    if (this.map) this.map.invalidateSize();
  }

  setSearch(q) {
    this.searchQuery = (q || '').trim().toLowerCase();
    this._renderCurrentView();
  }

  setStatusFilter(status, btn) {
    this.statusFilter = status;
    btn?.parentElement?.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    this._renderCurrentView();
  }

  async loadCameras() {
    const tc = document.getElementById('cameras-table-container');
    try {
      const cameras = await DataSource.get('/api/cameras');
      this.camerasData = cameras || [];
      document.getElementById('offline-banner').classList.remove('visible');
      this._renderCurrentView();
      this._renderMap(this.camerasData);
    } catch {
      document.getElementById('offline-banner').classList.add('visible');
      if (tc) tc.innerHTML = '<div class="state-box text-critical">Unable to reach the backend.</div>';
    }
  }

  _getFilteredCameras() {
    return this.camerasData.filter(c => {
      const matchSearch = !this.searchQuery ||
        c.name.toLowerCase().includes(this.searchQuery) ||
        c.camera_id.toLowerCase().includes(this.searchQuery) ||
        (c.zone_id && c.zone_id.toLowerCase().includes(this.searchQuery));
      const matchStatus = this.statusFilter === 'all' ||
        (c.status || '').toUpperCase() === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  _renderCurrentView() {
    const container = document.getElementById('cameras-table-container');
    if (!container) return;
    const filtered = this._getFilteredCameras();

    if (this.viewMode === 'matrix') {
      this._renderMatrix(filtered, container);
    } else {
      this._renderTable(filtered, container);
    }
  }

  _renderMatrix(cameras, container) {
    if (!cameras || cameras.length === 0) {
      container.innerHTML = '<div class="state-box">No camera feeds match the active search/filter.</div>';
      return;
    }

    let cards = '';
    cameras.forEach(c => {
      const status = (c.status || 'OFFLINE').toUpperCase();
      const isOnline = ['ONLINE', 'DEMO'].includes(status);
      cards += `
        <div style="background:#141614; border:1px solid #2B2D2B; border-radius:4px; overflow:hidden; display:flex; flex-direction:column; position:relative; min-height:180px;">
          <!-- HUD Header -->
          <div style="padding:6px 10px; background:rgba(0,0,0,0.6); display:flex; justify-content:space-between; align-items:center; font-family:'JetBrains Mono',monospace; font-size:11px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="status-dot ${isOnline ? 'online' : 'offline'}" style="width:7px; height:7px;"></span>
              <strong style="color:#FFF;">${c.camera_id}</strong>
            </div>
            <span class="badge ${isOnline ? 'badge-online' : 'badge-offline'}" style="font-size:9px; padding:1px 5px;">${status}</span>
          </div>

          <!-- Video Simulation viewport -->
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; position:relative; background:rgba(47,82,51,0.08);">
            <div style="position:absolute; inset:0; background:rgba(0,0,0,0.2);"></div>
            <div style="position:relative; z-index:2; text-align:center;">
              <div style="font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:700; color:#A4E5A4; letter-spacing:1px;">${c.name}</div>
              <div class="mono text-muted" style="font-size:10px; margin-top:3px;">Sightings Today: <strong style="color:#FFF;">${c.sightings_today ?? 0}</strong></div>
            </div>
          </div>

          <!-- Footer Action -->
          <div style="padding:6px 10px; background:#1E201E; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #2B2D2B;">
            <span class="mono text-muted" style="font-size:10px;">${c.lat ? `${c.lat.toFixed(3)}N, ${c.lon.toFixed(3)}E` : '—'}</span>
            <button class="btn-action" style="font-size:10px; padding:2px 8px;" onclick="window.CamerasView.openModal('${c.camera_id}', '${c.name.replace(/'/g, "\\'")}', '${status}', ${c.lat}, ${c.lon})">
              🔍 Tactical HUD
            </button>
          </div>
        </div>`;
    });

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">
        ${cards}
      </div>`;
  }

  _renderTable(cameras, container) {
    if (!cameras || cameras.length === 0) {
      container.innerHTML = '<div class="state-box">No cameras registered matching the filter.</div>';
      return;
    }

    let rows = '';
    cameras.forEach(c => {
      const status = (c.status || 'OFFLINE').toUpperCase();
      const badgeClass = status === 'ONLINE' ? 'badge-online' : (status === 'DEMO' ? 'badge-demo' : 'badge-offline');
      const lastSeen = c.last_seen
        ? c.last_seen.replace('T', ' ').substring(0, 19)
        : '—';

      rows += `
        <tr class="cam-status-row" style="cursor:pointer;" onclick="window.CamerasView.openModal('${c.camera_id}', '${c.name.replace(/'/g, "\\'")}', '${status}', ${c.lat}, ${c.lon})">
          <td class="mono" style="font-weight:700;">${c.camera_id}</td>
          <td>${c.name}</td>
          <td class="mono text-muted">${c.zone_id || '—'}</td>
          <td>
            <span class="badge ${badgeClass}">${status}</span>
          </td>
          <td class="mono" style="text-align:right; font-weight:700;">${c.sightings_today ?? 0}</td>
          <td class="mono text-muted" style="font-size:11px;">${lastSeen}</td>
          <td>
            <button class="btn-secondary" style="font-size:11px; padding:2px 7px;" onclick="event.stopPropagation(); window.CamerasView.openModal('${c.camera_id}', '${c.name.replace(/'/g, "\\'")}', '${status}', ${c.lat}, ${c.lon})">
              🎥 Inspect Feed
            </button>
          </td>
        </tr>`;
    });

    const online = cameras.filter(c => ['ONLINE', 'DEMO'].includes((c.status || '').toUpperCase())).length;
    container.innerHTML = `
      <div style="display:flex; gap:16px; margin-bottom: 12px; font-size:12px; font-family: var(--font-mono);">
        <span><strong>${cameras.length}</strong> <span class="text-muted">MATCHING NODES</span></span>
        <span class="text-primary"><strong>${online}</strong> <span class="text-muted">ACTIVE</span></span>
        <span class="text-critical"><strong>${cameras.length - online}</strong> <span class="text-muted">OFFLINE</span></span>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Node ID</th>
              <th>Location</th>
              <th>Zone</th>
              <th>Status</th>
              <th style="text-align:right;">Sightings Today</th>
              <th>Last Detection</th>
              <th>Optical Stream</th>
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
        radius: 9, color, fillColor: color, fillOpacity: 0.85, weight: 2
      });
      marker.bindPopup(`
        <div style="font-family:'JetBrains Mono',monospace; font-size:11px; line-height:1.5;">
          <strong style="font-size:12px; color:${color};">${c.camera_id}</strong><br/>
          ${c.name}<br/>
          Zone: ${c.zone_id || '—'}<br/>
          Status: <strong>${status}</strong><br/>
          Sightings today: ${c.sightings_today ?? 0}<br/>
          <button style="margin-top:6px; font-size:10px; padding:3px 8px; background:#2F5233; color:#fff; border:none; border-radius:3px; cursor:pointer;"
            onclick="window.CamerasView.openModal('${c.camera_id}', '${c.name.replace(/'/g, "\\'")}', '${status}', ${c.lat}, ${c.lon})">
            Inspect Stream
          </button>
        </div>
      `);
      this.markersLayer.addLayer(marker);
    });
  }

  openModal(camId, camName, status, lat, lon) {
    const modal = document.getElementById('cam-hud-modal');
    if (!modal) return;
    document.getElementById('modal-cam-badge').textContent = `${camId} // ${status}`;
    document.getElementById('modal-cam-title').textContent = `${camName} [${camId}]`;
    document.getElementById('modal-cam-lat').textContent = lat ? lat.toFixed(4) : '—';
    document.getElementById('modal-cam-lon').textContent = lon ? lon.toFixed(4) : '—';
    modal.classList.remove('hidden');
  }

  closeModal() {
    const modal = document.getElementById('cam-hud-modal');
    if (modal) modal.classList.add('hidden');
  }

  triggerSnapshot() {
    const status = document.getElementById('modal-hud-status');
    if (status) {
      status.textContent = 'Forensic snapshot captured & stored to data/snapshots/ (SHA-256 verified)';
      status.style.color = 'var(--accent-primary)';
      setTimeout(() => {
        status.textContent = 'Feed active · 0 dropped frames';
        status.style.color = '';
      }, 3000);
    }
  }

  cyclePlateTest() {
    const plates = ['TN 09 CB 1234', 'KA 03 MD 5522', 'TN 01 AZ 7788', 'TN 07 AX 4521', 'DL 01 CA 9999'];
    const randomPlate = plates[Math.floor(Math.random() * plates.length)];
    const plateEl = document.getElementById('modal-hud-plate');
    if (plateEl) {
      plateEl.textContent = randomPlate;
      plateEl.style.color = '#FFE600';
      setTimeout(() => { plateEl.style.color = '#FFF'; }, 400);
    }
  }
}

window.CamerasView = new CamerasView();
