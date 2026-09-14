/**
 * View 1: Trajectory Search, Full-Screen Cinema Map, Video-Player Simulation,
 * Real-Time Bottom Telemetry HUD & Forensic Reconstruction.
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
    this._isFullscreen = false;
  }

  render(container) {
    container.innerHTML = `
      <!-- Hidden evidence header (shown only in print) -->
      <div id="print-evidence-header" style="display:none;">
        <div class="print-title">ANPR Evidence Report — City ICCC Chennai</div>
        <div class="print-subtitle mono" id="print-evidence-meta"></div>
      </div>

      <!-- Card 1: Search Form -->
      <div class="card" style="margin-bottom: 14px;">
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
          
          <!-- Item 13: Load Demo Scenario Dropdown -->
          <div style="display: flex; gap: 6px; align-items: center; margin-left: auto; flex-wrap: wrap;">
            <label for="demo-scenario-select" class="mono text-muted" style="font-size: 11px; font-weight: 600;">Load Demo Scenario:</label>
            <select id="demo-scenario-select" class="input-text" style="padding: 4px 8px; font-size: 11px; min-width: 200px;"
              onchange="if(this.value){ window.TrajectoryView.searchPreset(this.value); }">
              <option value="">-- Select Pre-Baked Case --</option>
              <option value="TN09CB1234">1. Normal Transit (TN09CB1234)</option>
              <option value="KA03MD5522">2. Route Anomaly (KA03MD5522)</option>
              <option value="TN07AX4521">3. Blacklist Wanted Hit (TN07AX4521)</option>
              <option value="TN01AZ7788">4. Unconfirmed Sighting (TN01AZ7788)</option>
              <option value="TN22CY3311">5. Speed Anomaly (TN22CY3311)</option>
            </select>
          </div>
        </form>
      </div>

      <!-- Card 2: Full-Width Map with Video Player Controls & Fullscreen Cinema Mode -->
      <div class="card" style="margin-bottom: 14px;">
        <div class="card-title">
          <span>Spatial Path Map &amp; Full-Spectrum Simulation</span>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span id="traj-meta" class="mono text-muted" style="font-size: 11px;"></span>
            <button id="btn-fullscreen-toggle" type="button" class="btn-action" style="font-size:11px; padding:4px 10px;"
              onclick="window.TrajectoryView.toggleFullscreen()">⛶ Fullscreen Map</button>
          </div>
        </div>

        <!-- Video Player & Map Wrapper -->
        <div id="traj-player-wrapper" class="traj-player-wrapper">
          
          <!-- Video-Style Playback Toolbar -->
          <div id="traj-video-bar" class="traj-video-bar" style="display:none;">
            <button id="btn-sim-play" type="button" class="btn-player btn-player-play" onclick="window.TrajectoryView.togglePlay()">▶ Play</button>
            <button type="button" class="btn-player" title="Previous Hop" onclick="window.TrajectoryView.stepHop(-1)">⏮</button>
            <button type="button" class="btn-player" title="Next Hop" onclick="window.TrajectoryView.stepHop(1)">⏭</button>
            <button type="button" class="btn-player" title="Reset to Start" onclick="window.TrajectoryView.resetSim()">⏹</button>
            
            <div class="scrubber-container">
              <span class="mono text-muted" style="font-size:11px;">Hop:</span>
              <input id="sim-scrubber" class="sim-timeline-slider" type="range" min="0" max="0" value="0"
                oninput="window.TrajectoryView.scrubTo(this.value)" />
              <span id="sim-hop-label" class="mono" style="font-size:11px; font-weight:700; min-width:45px; color:#fff;">1 / 1</span>
            </div>

            <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
              <span class="mono text-muted" style="font-size:11px;">Speed:</span>
              <select id="sim-speed-select" class="input-text" style="padding:2px 6px; font-size:11px; background:#222; color:#fff; border-color:#444;"
                onchange="window.TrajectoryView.setSpeed(this.value)">
                <option value="1500">0.75x</option>
                <option value="1000">1x (Normal)</option>
                <option value="600" selected>2x (Fast)</option>
                <option value="300">4x (Rapid)</option>
              </select>

              <button type="button" id="btn-fs-inner" class="btn-player" style="margin-left:4px;"
                onclick="window.TrajectoryView.toggleFullscreen()">⛶ Fullscreen</button>
            </div>
          </div>

          <!-- Leaflet Map Container -->
          <div id="traj-map" class="map-container" style="height: 520px; margin-bottom: 0;"></div>

          <!-- Live Bottom Telemetry HUD Overlay ("Flight Recorder") -->
          <div id="traj-bottom-hud" class="traj-bottom-hud" style="display:none;">
            <div style="display:flex; flex-direction:column; gap:2px; min-width:220px;">
              <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#A49F93; font-family:var(--font-mono);">
                📍 Active Transit Corridor
              </div>
              <div id="hud-leg-title" style="font-size:13px; font-weight:700; color:#fff; font-family:var(--font-mono);">
                Origin Hop #1
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-family:var(--font-mono); font-size:12px;">
              <div style="background:rgba(255,255,255,0.08); padding:4px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.12);">
                <span style="color:#A49F93; font-size:10px;">TARGET:</span> <strong id="hud-plate-val" style="color:#fff;">—</strong>
              </div>
              <div style="background:rgba(255,255,255,0.08); padding:4px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.12);">
                <span style="color:#A49F93; font-size:10px;">SPEED:</span> <strong id="hud-speed-val" style="color:#fff;">—</strong>
              </div>
              <div style="background:rgba(255,255,255,0.08); padding:4px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.12);">
                <span style="color:#A49F93; font-size:10px;">DIST:</span> <strong id="hud-dist-val" style="color:#fff;">—</strong>
              </div>
              <div style="background:rgba(255,255,255,0.08); padding:4px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.12);">
                <span style="color:#A49F93; font-size:10px;">TIME:</span> <span id="hud-time-val" style="color:#fff;">—</span>
              </div>
            </div>

            <div id="hud-status-badge" style="font-family:var(--font-mono); font-size:11px; font-weight:700; padding:4px 10px; border-radius:3px; background:#2F5233; color:#fff; white-space:nowrap;">
              🟢 NORMAL
            </div>
          </div>

        </div>
      </div>

      <!-- Card 3: Evidence Trail Table -->
      <div class="card">
        <div class="card-title">
          <span>Per-Hop Identity-Fusion Evidence Trail</span>
          <div class="toolbar-row" style="margin-bottom:0;">
            <button class="btn-secondary" id="btn-export-evidence" type="button"
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

    // Handle Escape key to exit fullscreen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isFullscreen) {
        this.toggleFullscreen();
      }
    });

    this._initMap();
  }

  _initMap() {
    if (this.map) { this.map.remove(); this.map = null; }
    const mapEl = document.getElementById('traj-map');
    if (!mapEl || !window.L) return;

    this.map = L.map('traj-map', {
      attributionControl: false,
      scrollWheelZoom: true,
      keyboard: false
    }).setView([13.0450, 80.2450], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  toggleFullscreen() {
    const wrapper = document.getElementById('traj-player-wrapper');
    const btnTop = document.getElementById('btn-fullscreen-toggle');
    const btnInner = document.getElementById('btn-fs-inner');
    if (!wrapper) return;

    this._isFullscreen = !this._isFullscreen;
    wrapper.classList.toggle('fullscreen-mode', this._isFullscreen);

    const btnText = this._isFullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen Map';
    if (btnTop) btnTop.textContent = btnText;
    if (btnInner) btnInner.textContent = this._isFullscreen ? '✕ Exit' : '⛶ Fullscreen';

    // Invalidate map size so Leaflet resizes instantly
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        if (this._lastData && this._lastData.length > 0) {
          const latlngs = this._lastData.map(h => [h.lat, h.lon]);
          this.map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], animate: false });
        }
      }
    }, 120);
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
    tableContainer.innerHTML = '<div class="state-box state-loading">Executing multi-node sighting query &amp; computing identity fusion weights...</div>';
    if (metaEl) metaEl.textContent = '';

    const role = document.getElementById('role-selector')?.value || 'operator';
    this._lastQuery = query.toUpperCase();

    try {
      const data = await DataSource.get(`/api/trajectory?query=${encodeURIComponent(query)}&role=${role}`);
      document.getElementById('offline-banner').classList.remove('visible');

      if (!data || data.length === 0) {
        tableContainer.innerHTML = `
          <div class="state-box">
            <div style="font-size:16px;">⚠️</div>
            <strong>No Sighting Records Found</strong>
            <span class="mono text-muted" style="font-size:11px;">No optical detections or transit timestamps were registered for "${query}".</span>
          </div>`;
        if (this.markersLayer) this.markersLayer.clearLayers();
        if (this.polyline) { this.map.removeLayer(this.polyline); this.polyline = null; }
        if (this.simMarker) { this.map.removeLayer(this.simMarker); this.simMarker = null; }
        document.getElementById('traj-video-bar').style.display = 'none';
        document.getElementById('traj-bottom-hud').style.display = 'none';
        return;
      }

      this._lastData = data;
      if (window.App) window.App.pushRecentSearch(query);

      this._renderMapTrajectory(data);
      this._renderTable(data, tableContainer);
      this._setupSimulationControls(data);
      this.updateSimPosition(0);

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
        radius: 8, color, fillColor: color, fillOpacity: 0.9, weight: 2, keyboard: false
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
      `, { autoPan: false });
      marker.hopIndex = idx;
      this.markersLayer.addLayer(marker);
    });

    if (latlngs.length > 1) {
      this.polyline = L.polyline(latlngs, { color: '#2F5233', weight: 3.5, dashArray: '6, 6', opacity: 0.85 }).addTo(this.map);
    }
    this.map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], animate: false });
  }

  _setupSimulationControls(hops) {
    const videoBar = document.getElementById('traj-video-bar');
    const bottomHud = document.getElementById('traj-bottom-hud');
    const scrubber = document.getElementById('sim-scrubber');
    const hopLabel = document.getElementById('sim-hop-label');
    if (!videoBar || hops.length <= 1) {
      if (videoBar) videoBar.style.display = 'none';
      if (bottomHud) bottomHud.style.display = 'none';
      return;
    }
    videoBar.style.display = 'flex';
    if (bottomHud) bottomHud.style.display = 'flex';
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
    if (btn) btn.textContent = '⏸ Pause';

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
    if (btn) btn.textContent = '▶ Play';
  }

  stepHop(delta) {
    if (!this._lastData) return;
    this.stopSim();
    let nextIdx = this._simIndex + delta;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= this._lastData.length) nextIdx = this._lastData.length - 1;
    this._simIndex = nextIdx;
    this.updateSimPosition(this._simIndex);
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

    // Update Bottom Telemetry HUD Details
    this._updateBottomHUD(idx, hop);

    // Highlight row in table (pure CSS color highlight, absolutely no scroll triggering)
    document.querySelectorAll('.expandable-row').forEach((r, rIdx) => {
      if (rIdx === idx) {
        r.style.backgroundColor = '#E2DDD3';
      } else {
        r.style.backgroundColor = '';
      }
    });

    // Create or move animated vehicle icon
    if (!this.simMarker) {
      const carIcon = L.divIcon({
        className: 'sim-car-pulse',
        html: '<div style="background:#2F5233; color:#fff; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:15px; box-shadow:0 0 0 4px rgba(47,82,51,0.35); border:2px solid #fff;">🚗</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      this.simMarker = L.marker(pos, { icon: carIcon, zIndexOffset: 1000, keyboard: false }).addTo(this.map);
    } else {
      this.simMarker.setLatLng(pos);
    }
  }

  _updateBottomHUD(idx, hop) {
    const bottomHud = document.getElementById('traj-bottom-hud');
    const legTitle = document.getElementById('hud-leg-title');
    const plateVal = document.getElementById('hud-plate-val');
    const speedVal = document.getElementById('hud-speed-val');
    const distVal = document.getElementById('hud-dist-val');
    const timeVal = document.getElementById('hud-time-val');
    const statusBadge = document.getElementById('hud-status-badge');

    if (!bottomHud || !legTitle) return;
    bottomHud.style.display = 'flex';

    const vtype = (hop.vehicle_type || 'CAR').toUpperCase();
    const plate = hop.plate_text || '(unconfirmed)';

    if (idx === 0) {
      legTitle.textContent = `Hop #1 (Origin): ${hop.camera_id}`;
      distVal.textContent = `0.0 km (Start)`;
      speedVal.textContent = `Initial Sighting`;
      timeVal.textContent = hop.timestamp.replace('T', ' ').substring(11, 19);
    } else {
      const prev = this._lastData[idx - 1];
      legTitle.textContent = `Hop #${idx} ➔ Hop #${idx + 1} : ${prev.camera_id} ➔ ${hop.camera_id}`;
      distVal.textContent = hop.distance_km > 0 ? `${hop.distance_km.toFixed(2)} km` : '—';
      speedVal.textContent = hop.speed_kmh ? `${hop.speed_kmh.toFixed(1)} km/h` : '—';

      const tPrev = prev.timestamp.substring(11, 19);
      const tCur = hop.timestamp.substring(11, 19);
      timeVal.textContent = `${tPrev} ➔ ${tCur}`;
    }

    plateVal.textContent = `[${vtype}] ${plate}`;

    if (hop.anomaly_badge) {
      bottomHud.classList.add('hud-anomaly');
      statusBadge.style.background = '#B3262A';
      statusBadge.textContent = `⚠️ ANOMALY: ${hop.anomaly_detail || 'Route Deviation'}`;
    } else {
      bottomHud.classList.remove('hud-anomaly');
      statusBadge.style.background = '#2F5233';
      statusBadge.textContent = `🟢 NORMAL (${(hop.composite_score * 100).toFixed(1)}%)`;
    }
  }

  focusHopOnMap(idx) {
    if (!this._lastData || !this._lastData[idx] || !this.map) return;
    const hop = this._lastData[idx];
    this.map.panTo([hop.lat, hop.lon], { animate: true });
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
        ? '<span class="badge badge-warning">UNCONFIRMED</span>'
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
          <td>
            <button class="btn-secondary" type="button" style="font-size:10px; padding:2px 6px; font-family:var(--font-mono);"
              onclick="event.stopPropagation(); window.TrajectoryView.focusHopOnMap(${idx})">🎯 Pan</button>
          </td>
        </tr>
        <tr id="hop-detail-${idx}" style="display:none;">
          <td colspan="9">
            <div class="reason-detail">
              <strong>Evidence Breakdown:</strong> ${h.explanation}<br/>
              ${h.distance_km > 0 ? `Distance: ${h.distance_km} km &nbsp;|&nbsp; Speed: ${speedCell}<br/>` : ''}
              Plate Match: ${(h.plate_score * 100).toFixed(1)}% &nbsp;|&nbsp;
              Visual Sim: ${(h.visual_score * 100).toFixed(1)}% &nbsp;|&nbsp;
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
              <th>Time</th>
              <th>Plate</th>
              <th>Vehicle</th>
              <th>Speed</th>
              <th>Score</th>
              <th>Status</th>
              <th>Focus</th>
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
