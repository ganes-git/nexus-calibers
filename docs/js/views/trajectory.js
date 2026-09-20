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
    this.networkPreviewLayer = null;
    this._lastQuery = null;
    this._lastData = null;
    this._simInterval = null;
    this._simIndex = 0;
    this._simSpeed = 1000;
    this._isFullscreen = false;
    this._isNetworkPreview = false;
  }

  render(container) {
    container.innerHTML = `
      <!-- Hidden evidence header (shown only in print) -->
      <div id="print-evidence-header" style="display:none;">
        <div class="print-title">ANPR Evidence Report — City ICCC Chennai</div>
        <div class="print-subtitle mono" id="print-evidence-meta"></div>
      </div>

      <!-- Card 1: Search Form & Quick Scenario Selector -->
      <div class="card" style="margin-bottom: 18px; padding: 18px 22px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 14px;">
          <div class="card-title" style="margin-bottom: 0; font-size: 15px; font-weight: 700;">Trajectory Query &amp; Forensic Reconstruction</div>
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <button type="button" id="btn-city-preview" class="btn-secondary btn-sm"
              onclick="window.TrajectoryView.toggleCityNetworkPreview()" title="Show all camera corridors & city route baseline network on the map"
              style="padding: 7px 14px; font-weight: 500;">
              🗺️ Route Network Preview
            </button>
            <button type="button" class="btn-secondary btn-sm"
              onclick="window.TrajectoryView.simulateLiveTransit()" title="Simulate real-time live 4-hop suspect pursuit"
              style="padding: 7px 14px; font-weight: 500;">
              ⚡ Simulate Live Pursuit
            </button>
            <button type="button" class="btn-secondary btn-sm"
              onclick="window.TrajectoryView.resetToDefault()" title="Reset map to initial view"
              style="padding: 7px 14px; font-weight: 500;">
              🔄 Reset
            </button>
          </div>
        </div>

        <!-- Vehicle Type & Scenario Dropdown Selector -->
        <div style="background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <label for="vehicle-scenario-select" style="font-size: 12px; font-weight: 700; color: var(--text-primary); white-space: nowrap; display: flex; align-items: center; gap: 6px;">
            🚘 Select Vehicle Scenario:
          </label>
          <select id="vehicle-scenario-select" class="input-text" style="flex: 1; min-width: 280px; font-weight: 600; font-family: var(--font-ui); padding: 8px 12px; cursor: pointer; border-radius: 4px;"
            onchange="window.TrajectoryView.onDropdownSelect(this.value)">
            <option value="" disabled>-- Choose a vehicle type & route scenario --</option>
            <optgroup label="🚌 Public Transit &amp; Emergency Vehicles">
              <option value="TN04AB5501">🚌 TN04AB5501 — MTC City Transit Bus (BUS)</option>
              <option value="TN10AM6677">🚑 TN10AM6677 — Emergency Medical Ambulance (AMBULANCE)</option>
            </optgroup>
            <optgroup label="🚛 Heavy &amp; Commercial Goods Vehicles">
              <option value="TN22TR8844">🚛 TN22TR8844 — Heavy Multi-Axle Goods Truck (TRUCK)</option>
              <option value="KA03MD5522">🚚 KA03MD5522 — Freight Lorry [Delay Anomaly] (LORRY)</option>
              <option value="TN05VN2299">🚐 TN05VN2299 — Express Delivery Cargo Van (VAN)</option>
            </optgroup>
            <optgroup label="🏍️ Two-Wheelers &amp; Three-Wheelers">
              <option value="TN07BK3322">🏍️ TN07BK3322 — Commuter Two-Wheeler (MOTORCYCLE)</option>
              <option value="TN01AT4411">🛺 TN01AT4411 — Metro Auto-Rickshaw (AUTO_RICKSHAW)</option>
            </optgroup>
            <optgroup label="🚔 Passenger &amp; Law Enforcement Vehicles">
              <option value="TN02BZ9876">🚔 TN02BZ9876 — Police Patrol Interceptor (SUV)</option>
              <option value="TN09CB1234" selected>🚗 TN09CB1234 — White Sedan [Standard Transit] (CAR)</option>
              <option value="TN22CY3311">🏎️ TN22CY3311 — High-Speed Corridor Breach (CAR)</option>
              <option value="TN07AX4521">🚨 TN07AX4521 — Wanted Blacklist Heavy SUV (SUV)</option>
              <option value="TN01AZ7788">🔍 TN01AZ7788 — Compact Hatchback [Unconfirmed Re-ID] (HATCHBACK)</option>
            </optgroup>
          </select>
        </div>

        <form id="traj-form" class="form-row" style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-bottom: 14px;">
          <div style="position: relative; flex: 1; min-width: 260px;">
            <input type="text" id="plate-query-input" class="input-text mono" list="target-plate-suggestions"
              placeholder="Or enter custom Plate (e.g. TN09CB1234)..." style="width: 100%; text-transform: uppercase; font-weight: 600; padding: 8px 14px;" required />
            <datalist id="target-plate-suggestions">
              <option value="TN04AB5501">Bus — MTC Transit City Bus</option>
              <option value="TN10AM6677">Ambulance — Emergency EMS Unit</option>
              <option value="TN22TR8844">Truck — Heavy Goods Carrier</option>
              <option value="TN07BK3322">Motorcycle — Commuter Bike</option>
              <option value="TN01AT4411">Auto-Rickshaw — 3-Wheeler</option>
              <option value="TN05VN2299">Van — Delivery Utility</option>
              <option value="TN02BZ9876">SUV — Police Interceptor</option>
              <option value="TN09CB1234">Car — Normal Sedan Transit</option>
              <option value="KA03MD5522">Lorry — Route Delay Anomaly</option>
              <option value="TN07AX4521">SUV — Wanted Blacklist Hit</option>
              <option value="TN22CY3311">Car — Speed Corridor Breach</option>
              <option value="TN01AZ7788">Hatchback — Unconfirmed Sighting</option>
            </datalist>
          </div>

          <button type="submit" id="btn-search-plate" class="btn-action" style="padding: 9px 22px; font-size: 13px;">
            🔍 Search Trajectory
          </button>
        </form>

        <!-- Quick Scenario Chips for Instant 1-Click Verification -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--border-color);">
          <span class="mono text-muted" style="font-size: 11px; font-weight: 700; margin-right: 4px;">PRESETS:</span>
          <button type="button" class="btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500;"
            onclick="window.TrajectoryView.searchPreset('TN04AB5501')">
            🚌 Bus (TN04AB5501)
          </button>
          <button type="button" class="btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500;"
            onclick="window.TrajectoryView.searchPreset('TN22TR8844')">
            🚛 Heavy Truck (TN22TR8844)
          </button>
          <button type="button" class="btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500;"
            onclick="window.TrajectoryView.searchPreset('TN07BK3322')">
            🏍️ Bike (TN07BK3322)
          </button>
          <button type="button" class="btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500;"
            onclick="window.TrajectoryView.searchPreset('TN01AT4411')">
            🛺 Auto (TN01AT4411)
          </button>
          <button type="button" class="btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500;"
            onclick="window.TrajectoryView.searchPreset('TN10AM6677')">
            🚑 Ambulance (TN10AM6677)
          </button>
          <button type="button" class="btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500;"
            onclick="window.TrajectoryView.searchPreset('TN05VN2299')">
            🚐 Van (TN05VN2299)
          </button>
          <button type="button" class="btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500; border-color: var(--accent-critical);"
            onclick="window.TrajectoryView.searchPreset('TN07AX4521')">
            🚨 Wanted SUV (TN07AX4521)
          </button>
          <button type="button" class="btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500; border-color: var(--accent-warning);"
            onclick="window.TrajectoryView.searchPreset('KA03MD5522')">
            🚚 Delay Lorry (KA03MD5522)
          </button>
        </div>
      </div>

      <!-- Card 2: Full-Width Map with Video Player Controls & Fullscreen Cinema Mode -->
      <div class="card" style="margin-bottom: 18px; padding: 0; overflow: hidden; min-height: 520px; flex-shrink: 0;">
        <div class="card-title" style="padding: 12px 18px; margin-bottom: 0; border-bottom: 1px solid var(--border-color); background: var(--bg-color);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: 700; font-size: 14px;">Spatial Route Map &amp; Full-Spectrum Simulation</span>
            <span id="traj-meta" class="mono text-muted" style="font-size: 11px;"></span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
            <button id="btn-fullscreen-toggle" type="button" class="btn-secondary btn-sm" style="padding: 6px 14px;"
              onclick="window.TrajectoryView.toggleFullscreen()">⛶ Fullscreen Map</button>
          </div>
        </div>

        <!-- Video Player & Map Wrapper -->
        <div id="traj-player-wrapper" class="traj-player-wrapper" style="position: relative; min-height: 480px; flex-shrink: 0;">
          
          <!-- Video-Style Playback Toolbar (Spacious button gaps) -->
          <div id="traj-video-bar" class="traj-video-bar" style="display:flex; align-items: center; gap: 12px; background: #1F1F1F; padding: 10px 18px; color: #fff;">
            <button id="btn-sim-play" type="button" class="btn-player btn-player-play" style="padding: 6px 16px; font-weight: 700; background: var(--accent-primary); border-color: var(--accent-primary);"
              onclick="window.TrajectoryView.togglePlay()">▶ Play</button>
            <button type="button" class="btn-player" style="padding: 6px 12px;" title="Previous Hop" onclick="window.TrajectoryView.stepHop(-1)">⏮</button>
            <button type="button" class="btn-player" style="padding: 6px 12px;" title="Next Hop" onclick="window.TrajectoryView.stepHop(1)">⏭</button>
            <button type="button" class="btn-player" style="padding: 6px 12px;" title="Reset to Start" onclick="window.TrajectoryView.resetSim()">⏹</button>
            
            <div class="scrubber-container" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 160px; margin: 0 8px;">
              <span class="mono text-muted" style="font-size:11px; color:#A49F93;">Hop:</span>
              <input id="sim-scrubber" class="sim-timeline-slider" type="range" min="0" max="0" value="0"
                style="flex: 1; cursor: pointer;"
                oninput="window.TrajectoryView.scrubTo(this.value)" />
              <span id="sim-hop-label" class="mono" style="font-size:11px; font-weight:700; min-width:45px; color:#fff;">1 / 1</span>
            </div>

            <div style="display:flex; align-items:center; gap:10px; margin-left:auto;">
              <span class="mono text-muted" style="font-size:11px; color:#A49F93;">Speed:</span>
              <select id="sim-speed-select" class="input-text" style="padding: 4px 8px; font-size:11px; background:#2A2A2A; color:#fff; border-color:#444;"
                onchange="window.TrajectoryView.setSpeed(this.value)">
                <option value="1500">0.75x</option>
                <option value="1000">1x (Normal)</option>
                <option value="600" selected>2x (Fast)</option>
                <option value="300">4x (Rapid)</option>
              </select>

              <button type="button" id="btn-fs-inner" class="btn-player" style="margin-left:8px; padding: 6px 12px;"
                onclick="window.TrajectoryView.toggleFullscreen()">⛶ Fullscreen</button>
            </div>
          </div>

          <!-- Leaflet Map Container -->
          <div id="traj-map" class="map-container" style="height: 480px; min-height: 480px; width: 100%; margin-bottom: 0; display: block;"></div>

          <!-- Live Bottom Telemetry HUD Overlay ("Flight Recorder") -->
          <div id="traj-bottom-hud" class="traj-bottom-hud" style="display:none; position: absolute; bottom: 0; left: 0; right: 0; z-index: 1000; background: rgba(22, 24, 22, 0.92); padding: 8px 14px; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display:flex; flex-direction:column; gap:2px; min-width:200px;">
              <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#A49F93; font-family:var(--font-mono);">
                📍 Active Transit Corridor
              </div>
              <div id="hud-leg-title" style="font-size:13px; font-weight:700; color:#fff; font-family:var(--font-mono);">
                Origin Hop #1
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-family:var(--font-mono); font-size:12px;">
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
        <div class="card-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span>Per-Hop Identity-Fusion Evidence Trail</span>
          <div class="toolbar-row" style="margin-bottom:0;">
            <button class="btn-secondary btn-sm" id="btn-export-evidence" type="button"
              onclick="window.TrajectoryView.exportEvidence()" disabled>
              ⎙ Export Evidence PDF
            </button>
          </div>
        </div>
        <div id="traj-table-container">
          <div class="state-box">Enter a license plate or select a scenario above to reconstruct trajectory.</div>
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

    // Auto-load default trajectory (TN09CB1234) on first render so route preview is immediately visible
    setTimeout(() => {
      const input = document.getElementById('plate-query-input');
      const targetQuery = this._lastQuery || 'TN09CB1234';
      if (input) input.value = targetQuery;
      this.executeSearch(targetQuery);
    }, 100);
  }

  _initMap() {
    const mapEl = document.getElementById('traj-map');
    if (!mapEl || !window.L) return;

    if (this.map) {
      try {
        this.map.remove();
      } catch (e) { /* ignore */ }
      this.map = null;
    }

    if (mapEl._leaflet_id) {
      delete mapEl._leaflet_id;
    }

    try {
      this.map = L.map(mapEl, {
        attributionControl: false,
        scrollWheelZoom: true,
        keyboard: false
      }).setView([13.0450, 80.2450], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 18,
        subdomains: ['a', 'b', 'c']
      }).addTo(this.map);
      
      this.networkPreviewLayer = L.layerGroup().addTo(this.map);
      this.markersLayer = L.layerGroup().addTo(this.map);

      // Multi-pass invalidate size to ensure tiles render immediately
      [0, 50, 150, 300, 600].forEach(delay => {
        setTimeout(() => {
          if (this.map) this.map.invalidateSize();
        }, delay);
      });
    } catch (err) {
      console.warn('Trajectory map initialization error:', err);
    }
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

    // Immediate & delayed multi-pass resize to prevent half-blank maps
    const refit = () => {
      if (this.map) {
        this.map.invalidateSize();
        if (this._lastData && this._lastData.length > 0) {
          const latlngs = this._lastData.map(h => [h.lat, h.lon]);
          this.map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], animate: false });
        }
      }
    };

    refit();
    [40, 120, 250, 450].forEach(delay => setTimeout(refit, delay));
  }

  onDropdownSelect(plate) {
    if (!plate) return;
    const input = document.getElementById('plate-query-input');
    if (input) input.value = plate;
    this.executeSearch(plate);
  }

  searchPreset(plate) {
    const input = document.getElementById('plate-query-input');
    const select = document.getElementById('vehicle-scenario-select');
    if (input) input.value = plate;
    if (select) {
      // Find if an option exists with this value
      const opt = select.querySelector(`option[value="${plate}"]`);
      if (opt) select.value = plate;
    }
    this.executeSearch(plate);
  }

  resetToDefault() {
    this.stopSim();
    this.searchPreset('TN09CB1234');
  }

  async simulateLiveTransit() {
    try {
      if (window.ToastManager) window.ToastManager.show('SIMULATION STARTING', 'Generating real-time transit telemetry for DL01CA9999...', 'warning');
      await DataSource.post('/api/sightings/simulate-transit?plate_text=DL01CA9999&corridor_speed_kmh=85&anomaly=true');
      this.searchPreset('DL01CA9999');
      if (window.ToastManager) window.ToastManager.show('SIMULATION ACTIVE', 'Live 4-hop pursuit trajectory rendered for DL01CA9999', 'warning');
    } catch (err) {
      console.warn('Simulation error:', err);
      this.searchPreset('DL01CA9999');
    }
  }

  async toggleCityNetworkPreview() {
    this._isNetworkPreview = !this._isNetworkPreview;
    const btn = document.getElementById('btn-city-preview');
    if (btn) {
      btn.style.backgroundColor = this._isNetworkPreview ? 'var(--accent-primary)' : '';
      btn.style.color = this._isNetworkPreview ? '#fff' : '';
    }

    if (!this.map) this._initMap();
    if (!this.networkPreviewLayer) return;

    this.networkPreviewLayer.clearLayers();

    if (this._isNetworkPreview) {
      try {
        const [cameras, corridors] = await Promise.all([
          DataSource.get('/api/cameras'),
          DataSource.get('/api/corridor-baseline')
        ]);

        const camMap = {};
        cameras.forEach(c => {
          camMap[c.camera_id] = [c.lat, c.lon];
          const marker = L.circleMarker([c.lat, c.lon], {
            radius: 6,
            color: '#1F1F1F',
            fillColor: '#E1DED6',
            fillOpacity: 0.9,
            weight: 2
          });
          marker.bindPopup(`<strong>${c.camera_id}</strong>: ${c.name}<br/>Status: ${c.status.toUpperCase()}`);
          this.networkPreviewLayer.addLayer(marker);
        });

        corridors.forEach(cb => {
          const from = camMap[cb.camera_from];
          const to = camMap[cb.camera_to];
          if (from && to) {
            const line = L.polyline([from, to], {
              color: '#6B6B63',
              weight: 2,
              dashArray: '4, 4',
              opacity: 0.6
            });
            line.bindPopup(`Corridor: ${cb.camera_from} → ${cb.camera_to}<br/>Distance: ${cb.distance_km} km<br/>Avg Speed: ${cb.avg_speed_kmh} km/h`);
            this.networkPreviewLayer.addLayer(line);
          }
        });

        if (window.ToastManager) window.ToastManager.show('NETWORK PREVIEW', 'Loaded 8 city camera nodes & corridor baselines on map', 'normal');
      } catch (err) {
        console.warn('Network preview failed:', err);
      }
    }
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
    if (tableContainer) {
      tableContainer.innerHTML = '<div class="state-box state-loading">Executing multi-node sighting query &amp; computing identity fusion weights...</div>';
    }
    if (metaEl) metaEl.textContent = '';

    const role = document.getElementById('role-selector')?.value || 'operator';
    this._lastQuery = query.toUpperCase();

    try {
      const data = await DataSource.get(`/api/trajectory?query=${encodeURIComponent(query)}&role=${role}`);
      const offBanner = document.getElementById('offline-banner');
      if (offBanner) offBanner.classList.remove('visible');

      if (!data || data.length === 0) {
        if (tableContainer) {
          tableContainer.innerHTML = `
            <div class="state-box">
              <div style="font-size:16px;">⚠️</div>
              <strong>No Sighting Records Found</strong>
              <span class="mono text-muted" style="font-size:11px;">No optical detections or transit timestamps were registered for "${query}".</span>
            </div>`;
        }
        if (this.markersLayer) this.markersLayer.clearLayers();
        if (this.polyline && this.map) { this.map.removeLayer(this.polyline); this.polyline = null; }
        if (this.simMarker && this.map) { this.map.removeLayer(this.simMarker); this.simMarker = null; }
        const vBar = document.getElementById('traj-video-bar');
        const bHud = document.getElementById('traj-bottom-hud');
        if (vBar) vBar.style.display = 'none';
        if (bHud) bHud.style.display = 'none';
        return;
      }

      this._lastData = data;
      if (window.App) window.App.pushRecentSearch(query);

      this._renderMapTrajectory(data);
      if (tableContainer) this._renderTable(data, tableContainer);
      this._setupSimulationControls(data);
      this.updateSimPosition(0);

      if (metaEl) {
        const first = data[0].timestamp.replace('T', ' ').substring(0, 19);
        const last = data[data.length - 1].timestamp.replace('T', ' ').substring(0, 19);
        metaEl.textContent = `Hops: ${data.length} | ${first} → ${last}`;
      }

      const exportBtn = document.getElementById('btn-export-evidence');
      if (exportBtn) exportBtn.disabled = false;

    } catch (err) {
      console.warn('Trajectory query error:', err);
      const offBanner = document.getElementById('offline-banner');
      if (offBanner) offBanner.classList.add('visible');
      if (tableContainer) {
        tableContainer.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
      }
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
      const isAnomaly = hop.anomaly_badge || (hop.speed_kmh && hop.speed_kmh > 75) || hop.timing_anomaly_score > 0.4;
      const color = isAnomaly ? '#C98A1E' : (idx === hops.length - 1 ? '#B3262A' : '#2F5233');

      // Create rich circle marker
      const marker = L.circleMarker(pos, {
        radius: idx === 0 || idx === hops.length - 1 ? 10 : 8,
        color: '#1F1F1F',
        fillColor: color,
        fillOpacity: 0.95,
        weight: 2,
        keyboard: false
      });

      marker.bindPopup(`
        <div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; line-height: 1.5; padding: 2px;">
          <strong style="color:${color}; font-size:12px;">Hop #${idx + 1}: ${hop.camera_id}</strong><br/>
          <strong>Plate:</strong> ${hop.plate_text || '(unconfirmed)'}<br/>
          <strong>Vehicle:</strong> ${hop.vehicle_type || 'CAR'}<br/>
          <strong>Direction:</strong> ${hop.heading_arrow || '•'} ${hop.heading || 'Start'} ${hop.bearing_deg !== null && hop.bearing_deg !== undefined ? `(${hop.bearing_deg}°)` : ''}<br/>
          <strong>Timestamp:</strong> ${hop.timestamp.replace('T', ' ')}<br/>
          <strong>Speed:</strong> ${hop.speed_kmh ? hop.speed_kmh.toFixed(1) + ' km/h' : '—'}<br/>
          <strong>Composite Score:</strong> ${(hop.composite_score * 100).toFixed(1)}%
          ${hop.anomaly_detail ? `<br/><span style="color:#B3262A; font-weight:700;">🚨 ${hop.anomaly_detail}</span>` : ''}
        </div>
      `, { autoPan: false });

      marker.hopIndex = idx;
      this.markersLayer.addLayer(marker);
    });

    if (latlngs.length > 1) {
      this.polyline = L.polyline(latlngs, {
        color: '#2F5233',
        weight: 4,
        dashArray: '8, 6',
        opacity: 0.9
      }).addTo(this.map);
    }

    if (latlngs.length > 0) {
      this.map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], animate: false });
    }
  }

  _setupSimulationControls(hops) {
    const videoBar = document.getElementById('traj-video-bar');
    const bottomHud = document.getElementById('traj-bottom-hud');
    const scrubber = document.getElementById('sim-scrubber');
    const hopLabel = document.getElementById('sim-hop-label');
    if (!videoBar || hops.length <= 1) {
      if (videoBar) videoBar.style.display = 'flex';
      if (bottomHud) bottomHud.style.display = 'flex';
      return;
    }
    videoBar.style.display = 'flex';
    if (bottomHud) bottomHud.style.display = 'flex';
    scrubber.max = hops.length - 1;
    scrubber.value = 0;
    this._simIndex = 0;
    hopLabel.textContent = `1 / ${hops.length}`;
  }

  _calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    let θ = toDeg(Math.atan2(y, x));
    return (θ + 360) % 360;
  }

  _getVehicleSvg(vtype, color, statusClass) {
    const vt = (vtype || 'CAR').toUpperCase();

    if (vt === 'BUS') {
      return `
        <svg viewBox="0 0 36 56" width="38" height="56" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
          <!-- 6 Wheels -->
          <rect x="2.5" y="7" width="4.5" height="9" rx="1.5" fill="#111"/>
          <rect x="29" y="7" width="4.5" height="9" rx="1.5" fill="#111"/>
          <rect x="2.5" y="27" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="29" y="27" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="2.5" y="40" width="4.5" height="9" rx="1.5" fill="#111"/>
          <rect x="29" y="40" width="4.5" height="9" rx="1.5" fill="#111"/>
          <!-- Bus Main Body -->
          <rect x="6" y="2" width="24" height="52" rx="5" fill="${color}" stroke="#FFFFFF" stroke-width="1.2"/>
          <!-- Front Destination LED Display -->
          <rect x="8" y="4" width="20" height="4" rx="1" fill="#FFCC00" stroke="#222" stroke-width="0.5"/>
          <text x="18" y="7" font-size="3" font-family="monospace" font-weight="bold" fill="#000" text-anchor="middle">MTC BUS</text>
          <!-- Front Windshield -->
          <path d="M 8 9 Q 18 7 28 9 L 27 15 Q 18 14 9 15 Z" fill="#1A2530" stroke="#4A6572" stroke-width="0.6"/>
          <!-- AC Unit & Roof Hatches -->
          <rect x="10" y="19" width="16" height="12" rx="2" fill="#E0E0E0" stroke="#777" stroke-width="0.8"/>
          <line x1="12" y1="22" x2="24" y2="22" stroke="#888" stroke-width="0.8"/>
          <line x1="12" y1="25" x2="24" y2="25" stroke="#888" stroke-width="0.8"/>
          <line x1="12" y1="28" x2="24" y2="28" stroke="#888" stroke-width="0.8"/>
          <!-- Roof Escape Hatch -->
          <rect x="12" y="36" width="12" height="7" rx="1.5" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.4)" stroke-width="0.6"/>
          <!-- Side Window Strips -->
          <rect x="6.5" y="16" width="1.5" height="32" rx="0.5" fill="#1A2530"/>
          <rect x="28" y="16" width="1.5" height="32" rx="0.5" fill="#1A2530"/>
          <!-- Rear Glass -->
          <rect x="9" y="50" width="18" height="2" rx="0.5" fill="#1A2530"/>
          <!-- Headlights -->
          <circle cx="8.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <circle cx="27.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <!-- Taillights -->
          <rect x="7" y="52.5" width="4" height="1.5" rx="0.5" fill="#FF3333"/>
          <rect x="25" y="52.5" width="4" height="1.5" rx="0.5" fill="#FF3333"/>
        </svg>`;
    }

    if (vt === 'TRUCK' || vt === 'LORRY') {
      return `
        <svg viewBox="0 0 36 58" width="38" height="58" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
          <!-- Steer Axle Wheels -->
          <rect x="1.5" y="5" width="4.5" height="9" rx="1.5" fill="#111"/>
          <rect x="30" y="5" width="4.5" height="9" rx="1.5" fill="#111"/>
          <!-- Dual Rear Bogie Wheels -->
          <rect x="1.5" y="36" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="30" y="36" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="1.5" y="46" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="30" y="46" width="4.5" height="8" rx="1.5" fill="#111"/>
          <!-- Front Cab -->
          <rect x="6" y="2" width="24" height="16" rx="3" fill="${color}" stroke="#FFFFFF" stroke-width="1.2"/>
          <!-- Cab Windshield & Sun Visor -->
          <path d="M 8 5 Q 18 3 28 5 L 27 10 Q 18 9 9 10 Z" fill="#1A2530" stroke="#4A6572" stroke-width="0.5"/>
          <rect x="8" y="2.5" width="20" height="2" rx="0.5" fill="#222"/>
          <!-- Side Mirrors -->
          <rect x="2.5" y="6" width="3.5" height="3" rx="0.5" fill="#444"/>
          <rect x="30" y="6" width="3.5" height="3" rx="0.5" fill="#444"/>
          <!-- Chassis Articulation Neck -->
          <rect x="14" y="18" width="8" height="4" fill="#222"/>
          <!-- Large Cargo Freight Container -->
          <rect x="5" y="22" width="26" height="34" rx="2" fill="#3D4A41" stroke="#E2DDD3" stroke-width="1.2"/>
          <!-- Container Ribs & Hazard Markings -->
          <line x1="7" y1="28" x2="29" y2="28" stroke="#6B7C6F" stroke-width="1.2"/>
          <line x1="7" y1="35" x2="29" y2="35" stroke="#6B7C6F" stroke-width="1.2"/>
          <line x1="7" y1="42" x2="29" y2="42" stroke="#6B7C6F" stroke-width="1.2"/>
          <line x1="7" y1="49" x2="29" y2="49" stroke="#6B7C6F" stroke-width="1.2"/>
          <!-- Rear Hazard Chevron Strip -->
          <rect x="6" y="54" width="24" height="2" fill="#FFC107"/>
          <!-- Headlights & Taillights -->
          <circle cx="8.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <circle cx="27.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <rect x="6" y="55" width="4" height="1.5" rx="0.5" fill="#FF3333"/>
          <rect x="26" y="55" width="4" height="1.5" rx="0.5" fill="#FF3333"/>
        </svg>`;
    }

    if (vt === 'MOTORCYCLE' || vt === 'BIKE') {
      return `
        <svg viewBox="0 0 32 38" width="34" height="40" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
          <!-- Front Tire & Fork -->
          <rect x="14" y="1" width="4" height="10" rx="2" fill="#111" stroke="#444" stroke-width="0.5"/>
          <!-- Wide Handlebars with Grips & Chrome Mirrors -->
          <path d="M 5 11 Q 16 13 27 11" stroke="#DDDDDD" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <circle cx="5" cy="11" r="1.8" fill="#FFCC00"/>
          <circle cx="27" cy="11" r="1.8" fill="#FFCC00"/>
          <!-- Front Headlight -->
          <ellipse cx="16" cy="6" rx="2.5" ry="1.5" fill="#FFFFA0"/>
          <!-- Gas Tank -->
          <path d="M 12 13 Q 16 11 20 13 L 19 19 Q 16 20 13 19 Z" fill="${color}" stroke="#FFFFFF" stroke-width="0.8"/>
          <!-- Rider Silhouette: Shoulders & Helmet -->
          <ellipse cx="16" cy="24" rx="8.5" ry="3.5" fill="#2C3E50"/>
          <circle cx="16" cy="20" r="5" fill="#1A2530" stroke="#FF5722" stroke-width="1.2"/>
          <path d="M 13 18 Q 16 16 19 18" stroke="#00E5FF" stroke-width="1.4" fill="none"/>
          <!-- Rear Seat & Exhaust -->
          <rect x="13.5" y="26" width="5" height="5" rx="1.5" fill="#222"/>
          <!-- Rear Tire -->
          <rect x="14" y="29" width="4" height="8" rx="2" fill="#111" stroke="#444" stroke-width="0.5"/>
          <!-- Taillight -->
          <rect x="14" y="36.5" width="4" height="1.5" rx="0.5" fill="#FF2222"/>
        </svg>`;
    }

    if (vt === 'AUTO_RICKSHAW' || vt === 'AUTORICKSHAW') {
      return `
        <svg viewBox="0 0 34 40" width="36" height="42" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
          <!-- Single Front Wheel -->
          <rect x="15" y="1" width="4" height="8" rx="2" fill="#111"/>
          <!-- Front Yellow/Black Nose Cowling -->
          <path d="M 10 9 Q 17 5 24 9 L 27 14 L 7 14 Z" fill="#FFB300" stroke="#222" stroke-width="0.8"/>
          <circle cx="17" cy="5" r="2" fill="#FFFFA0"/>
          <!-- Driver Handlebars & Windshield -->
          <line x1="9" y1="12" x2="25" y2="12" stroke="#333" stroke-width="2"/>
          <path d="M 9 14 Q 17 12 25 14" stroke="#81D4FA" stroke-width="1.5" fill="none"/>
          <!-- Dual Rear Wheels -->
          <rect x="2.5" y="25" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="27" y="25" width="4.5" height="8" rx="1.5" fill="#111"/>
          <!-- Iconic Green/Yellow Canopy Hood -->
          <rect x="6" y="15" width="22" height="20" rx="4" fill="#2E7D32" stroke="#FFB300" stroke-width="1.5"/>
          <!-- Canopy Roof Ribs -->
          <line x1="8" y1="21" x2="26" y2="21" stroke="#1B5E20" stroke-width="1.2"/>
          <line x1="8" y1="28" x2="26" y2="28" stroke="#1B5E20" stroke-width="1.2"/>
          <!-- Rear Passenger Bumper & Lights -->
          <rect x="6" y="34.5" width="22" height="2.5" rx="0.5" fill="#111"/>
          <rect x="7" y="35" width="4" height="1.5" fill="#FF2222"/>
          <rect x="23" y="35" width="4" height="1.5" fill="#FF2222"/>
        </svg>`;
    }

    if (vt === 'AMBULANCE') {
      return `
        <svg viewBox="0 0 34 46" width="36" height="48" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
          <!-- 4 Wheels -->
          <rect x="2.5" y="6" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="27" y="6" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="2.5" y="30" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="27" y="30" width="4.5" height="8" rx="1.5" fill="#111"/>
          <!-- Pure White Emergency Vehicle Body -->
          <rect x="6" y="2" width="22" height="41" rx="5" fill="#FFFFFF" stroke="#D32F2F" stroke-width="1.4"/>
          <!-- Front Windshield -->
          <path d="M 8 7 Q 17 5 26 7 L 24 13 Q 17 12 10 13 Z" fill="#1A2530" stroke="#4A6572" stroke-width="0.6"/>
          <!-- Paramedic Red Cross (+) on Roof -->
          <rect x="15" y="22" width="4" height="12" rx="0.5" fill="#D32F2F"/>
          <rect x="11" y="26" width="12" height="4" rx="0.5" fill="#D32F2F"/>
          <!-- Flashing Dual Emergency Strobes (Blue Left, Red Right) -->
          <circle cx="11" cy="15" r="2.5" fill="#00E5FF" class="strobe-blue" stroke="#FFF" stroke-width="0.8"/>
          <circle cx="23" cy="15" r="2.5" fill="#FF1744" class="strobe-red" stroke="#FFF" stroke-width="0.8"/>
          <!-- Paramedic Side Chevron Stripes -->
          <rect x="6.5" y="18" width="1.5" height="23" fill="#D32F2F"/>
          <rect x="26" y="18" width="1.5" height="23" fill="#D32F2F"/>
          <!-- Rear Emergency Doors Line -->
          <line x1="17" y1="36" x2="17" y2="43" stroke="#D32F2F" stroke-width="0.8"/>
          <!-- Headlights & Taillights -->
          <circle cx="8.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <circle cx="25.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <rect x="7" y="42" width="3.5" height="1.5" rx="0.5" fill="#FF1744"/>
          <rect x="23.5" y="42" width="3.5" height="1.5" rx="0.5" fill="#FF1744"/>
        </svg>`;
    }

    if (vt === 'VAN') {
      return `
        <svg viewBox="0 0 32 42" width="34" height="44" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
          <!-- 4 Wheels -->
          <rect x="2" y="6" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="25.5" y="6" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="2" y="27" width="4.5" height="8" rx="1.5" fill="#111"/>
          <rect x="25.5" y="27" width="4.5" height="8" rx="1.5" fill="#111"/>
          <!-- Cargo Van Body -->
          <rect x="6" y="2" width="20" height="37" rx="4" fill="${color}" stroke="#FFFFFF" stroke-width="1.2"/>
          <!-- Windshield -->
          <path d="M 8 7 Q 16 5 24 7 L 23 12 Q 16 11 9 12 Z" fill="#1A2530" stroke="#4A6572" stroke-width="0.6"/>
          <!-- Corrugated Cargo Roof Ribs -->
          <line x1="9" y1="17" x2="23" y2="17" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
          <line x1="9" y1="23" x2="23" y2="23" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
          <line x1="9" y1="29" x2="23" y2="29" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
          <!-- Rear Split Doors -->
          <line x1="16" y1="33" x2="16" y2="39" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>
          <!-- Lights -->
          <circle cx="8.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <circle cx="23.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <rect x="7" y="38" width="3.5" height="1.5" rx="0.5" fill="#FF3333"/>
          <rect x="21.5" y="38" width="3.5" height="1.5" rx="0.5" fill="#FF3333"/>
        </svg>`;
    }

    if (vt === 'SUV') {
      return `
        <svg viewBox="0 0 34 40" width="36" height="42" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
          <!-- Beefy Wide Tires -->
          <rect x="1.5" y="5" width="5" height="8.5" rx="1.5" fill="#111"/>
          <rect x="27.5" y="5" width="5" height="8.5" rx="1.5" fill="#111"/>
          <rect x="1.5" y="24" width="5" height="8.5" rx="1.5" fill="#111"/>
          <rect x="27.5" y="24" width="5" height="8.5" rx="1.5" fill="#111"/>
          <!-- Rugged Wide Chassis Body -->
          <rect x="5" y="2" width="24" height="35" rx="5" fill="${color}" stroke="#FFFFFF" stroke-width="1.3"/>
          <!-- Front Bull Bar -->
          <rect x="8" y="1" width="18" height="2" rx="1" fill="#333"/>
          <!-- Front Windshield -->
          <path d="M 8 8 Q 17 6 26 8 L 24 14 Q 17 13 10 14 Z" fill="#1A2530" stroke="#4A6572" stroke-width="0.6"/>
          <!-- Roof Rails -->
          <line x1="8" y1="13" x2="8" y2="28" stroke="#222" stroke-width="1.6"/>
          <line x1="26" y1="13" x2="26" y2="28" stroke="#222" stroke-width="1.6"/>
          <!-- Sunroof Panel -->
          <rect x="11" y="15" width="12" height="9" rx="1.5" fill="#1A2530" stroke="#4A6572" stroke-width="0.6"/>
          <!-- Emergency Roof Lightbar (If Critical or Police) -->
          ${statusClass === 'critical' ? `
            <rect x="11" y="14" width="12" height="3" rx="1" fill="#FF1744" stroke="#FFF" stroke-width="0.6"/>
            <circle cx="13" cy="15.5" r="1" fill="#00E5FF" class="strobe-blue"/>
            <circle cx="21" cy="15.5" r="1" fill="#FF1744" class="strobe-red"/>
          ` : ''}
          <!-- Rear Glass -->
          <path d="M 9 29 Q 17 28 25 29 L 24 32 Q 17 31 10 32 Z" fill="#1A2530"/>
          <!-- Headlights & Taillights -->
          <circle cx="8.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <circle cx="25.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
          <rect x="6.5" y="35.5" width="4" height="1.5" rx="0.5" fill="#FF3333"/>
          <rect x="23.5" y="35.5" width="4" height="1.5" rx="0.5" fill="#FF3333"/>
        </svg>`;
    }

    // Default: CAR / HATCHBACK / SEDAN
    return `
      <svg viewBox="0 0 32 34" width="34" height="36" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
        <!-- 4 Corner Wheels -->
        <rect x="3" y="5" width="4" height="7" rx="1.5" fill="#111"/>
        <rect x="25" y="5" width="4" height="7" rx="1.5" fill="#111"/>
        <rect x="3" y="21" width="4" height="7" rx="1.5" fill="#111"/>
        <rect x="25" y="21" width="4" height="7" rx="1.5" fill="#111"/>
        <!-- Aerodynamic Car Body -->
        <rect x="6" y="2" width="20" height="29" rx="6" fill="${color}" stroke="#FFFFFF" stroke-width="1.2"/>
        <!-- Front Curved Windshield -->
        <path d="M 8 9 Q 16 7 24 9 L 22 14 Q 16 13 10 14 Z" fill="#1A2530" stroke="#4A6572" stroke-width="0.6"/>
        <!-- Cabin Roof Glass -->
        <rect x="9" y="14" width="14" height="9" rx="2" fill="${color}" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>
        <!-- Rear Windshield -->
        <path d="M 9 24 Q 16 23 23 24 L 22 27 Q 16 26 10 27 Z" fill="#1A2530"/>
        <!-- Status Beacon -->
        <circle cx="16" cy="18" r="2.2" fill="${statusClass === 'critical' ? '#FF2222' : (statusClass === 'warning' ? '#FFFF55' : '#4CAF50')}" stroke="#FFFFFF" stroke-width="0.8"/>
        <!-- Headlights -->
        <circle cx="8.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
        <circle cx="23.5" cy="3.5" r="1.5" fill="#FFFFA0"/>
        <!-- Taillights -->
        <rect x="7" y="29.5" width="4" height="1.5" rx="0.5" fill="#FF3333"/>
        <rect x="21" y="29.5" width="4" height="1.5" rx="0.5" fill="#FF3333"/>
      </svg>`;
  }

  _getVehicleEmoji(vtype) {
    const vt = (vtype || 'CAR').toUpperCase();
    switch (vt) {
      case 'BUS': return '🚌';
      case 'TRUCK': return '🚛';
      case 'LORRY': return '🚚';
      case 'MOTORCYCLE':
      case 'BIKE': return '🏍️';
      case 'AUTO_RICKSHAW':
      case 'AUTORICKSHAW': return '🛺';
      case 'AMBULANCE': return '🚑';
      case 'VAN': return '🚐';
      case 'SUV': return '🚔';
      case 'HATCHBACK': return '🚗';
      default: return '🚗';
    }
  }

  _getVehicleHtml(bearing, statusClass, plate, speedText, vtype = 'CAR') {
    const color = statusClass === 'critical' ? '#B3262A' : (statusClass === 'warning' ? '#C98A1E' : '#2F5233');
    const svgContent = this._getVehicleSvg(vtype, color, statusClass);
    const emoji = this._getVehicleEmoji(vtype);

    return `
      <div class="tactical-vehicle-marker" data-vtype="${vtype}">
        <div class="vehicle-radar-wave ${statusClass}"></div>
        <div class="vehicle-target-tag ${statusClass}">
          <span>${emoji} ${plate}</span>
          ${speedText ? `<span style="color:#A49F93;">· ${speedText}</span>` : ''}
        </div>
        <div class="vehicle-rotator" style="transform: rotate(${Math.round(bearing)}deg);">
          <div class="vehicle-headlights"></div>
          ${svgContent}
        </div>
      </div>
    `;
  }

  togglePlay() {
    if (this._animRunning) {
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

    this._animRunning = true;
    this._playNextSegment();
  }

  _playNextSegment() {
    if (!this._animRunning || !this._lastData) return;

    if (this._simIndex >= this._lastData.length - 1) {
      this.stopSim();
      return;
    }

    const startHop = this._lastData[this._simIndex];
    const endHop = this._lastData[this._simIndex + 1];
    const startPos = [startHop.lat, startHop.lon];
    const endPos = [endHop.lat, endHop.lon];
    const bearing = this._calculateBearing(startHop.lat, startHop.lon, endHop.lat, endHop.lon);

    const isAnomaly = endHop.anomaly_badge || (endHop.speed_kmh && endHop.speed_kmh > 75) || endHop.timing_anomaly_score > 0.4;
    const statusClass = endHop.anomaly_badge ? 'critical' : (isAnomaly ? 'warning' : 'normal');
    const plate = endHop.plate_text || startHop.plate_text || 'TARGET';
    const speedText = endHop.speed_kmh ? `${Math.round(endHop.speed_kmh)} km/h` : '';
    const vtype = endHop.vehicle_type || startHop.vehicle_type || 'CAR';

    const duration = Math.max(300, this._simSpeed);
    const startTime = performance.now();

    const animateFrame = (now) => {
      if (!this._animRunning) return;

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Smooth Ease-in-out progress interpolation
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      const currentLat = startPos[0] + (endPos[0] - startPos[0]) * easeProgress;
      const currentLon = startPos[1] + (endPos[1] - startPos[1]) * easeProgress;
      const currentPos = [currentLat, currentLon];

      // Update vehicle marker position and orientation
      this._renderVehicleAt(currentPos, bearing, statusClass, plate, speedText, vtype);

      // Draw active traveled path line
      this._updateTraveledPath(this._simIndex, currentPos);

      // Realtime HUD transition
      this._updateBottomHUD(this._simIndex, endHop, easeProgress);

      if (progress < 1) {
        this._animFrame = requestAnimationFrame(animateFrame);
      } else {
        this._simIndex++;
        this.updateSimPosition(this._simIndex);
        if (this._simIndex < this._lastData.length - 1) {
          this._playNextSegment();
        } else {
          this.stopSim();
        }
      }
    };

    this._animFrame = requestAnimationFrame(animateFrame);
  }

  _renderVehicleAt(pos, bearing, statusClass, plate, speedText, vtype = 'CAR') {
    if (!this.map) return;

    const vt = (vtype || 'CAR').toUpperCase();
    const needsNewIcon = !this.simMarker || this._currentMarkerVType !== vt || this._currentMarkerStatus !== statusClass;

    if (needsNewIcon) {
      if (this.simMarker) {
        this.map.removeLayer(this.simMarker);
        this.simMarker = null;
      }
      this._currentMarkerVType = vt;
      this._currentMarkerStatus = statusClass;

      const carIcon = L.divIcon({
        className: 'sim-tactical-icon',
        html: this._getVehicleHtml(bearing, statusClass, plate, speedText, vt),
        iconSize: [54, 54],
        iconAnchor: [27, 27]
      });
      this.simMarker = L.marker(pos, { icon: carIcon, zIndexOffset: 2000, keyboard: false }).addTo(this.map);
    } else {
      this.simMarker.setLatLng(pos);
      const iconEl = this.simMarker.getElement();
      if (iconEl) {
        const rotator = iconEl.querySelector('.vehicle-rotator');
        if (rotator) rotator.style.transform = `rotate(${Math.round(bearing)}deg)`;
        const tag = iconEl.querySelector('.vehicle-target-tag');
        const emoji = this._getVehicleEmoji(vt);
        if (tag) tag.innerHTML = `<span>${emoji} ${plate}</span>${speedText ? `<span style="color:#A49F93;">· ${speedText}</span>` : ''}`;
      }
    }
  }

  _updateTraveledPath(currentHopIdx, currentPos) {
    if (!this.map || !this._lastData) return;
    const traveledPoints = [];
    for (let i = 0; i <= currentHopIdx; i++) {
      traveledPoints.push([this._lastData[i].lat, this._lastData[i].lon]);
    }
    if (currentPos) traveledPoints.push(currentPos);

    if (!this._traveledPolyline) {
      this._traveledPolyline = L.polyline(traveledPoints, {
        color: '#1A361E',
        weight: 5,
        opacity: 0.95
      }).addTo(this.map);
    } else {
      this._traveledPolyline.setLatLngs(traveledPoints);
    }
  }

  stopSim() {
    this._animRunning = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
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
    this.stopSim();
    this._simIndex = parseInt(idx, 10);
    this.updateSimPosition(this._simIndex);
  }

  setSpeed(speedMs) {
    this._simSpeed = parseInt(speedMs, 10);
    if (this._animRunning) {
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

    let bearing = 0;
    if (idx < this._lastData.length - 1) {
      const nextHop = this._lastData[idx + 1];
      bearing = this._calculateBearing(hop.lat, hop.lon, nextHop.lat, nextHop.lon);
    } else if (idx > 0) {
      const prevHop = this._lastData[idx - 1];
      bearing = this._calculateBearing(prevHop.lat, prevHop.lon, hop.lat, hop.lon);
    }

    const isAnomaly = hop.anomaly_badge || (hop.speed_kmh && hop.speed_kmh > 75) || hop.timing_anomaly_score > 0.4;
    const statusClass = hop.anomaly_badge ? 'critical' : (isAnomaly ? 'warning' : 'normal');
    const plate = hop.plate_text || 'TARGET';
    const speedText = hop.speed_kmh ? `${Math.round(hop.speed_kmh)} km/h` : '';
    const vtype = hop.vehicle_type || 'CAR';

    this._renderVehicleAt(pos, bearing, statusClass, plate, speedText, vtype);
    this._updateTraveledPath(idx, null);
    this._updateBottomHUD(idx, hop);

    // Highlight active row in table
    document.querySelectorAll('.expandable-row').forEach((r, rIdx) => {
      if (rIdx === idx) {
        r.style.backgroundColor = '#E2DDD3';
      } else {
        r.style.backgroundColor = '';
      }
    });
  }

  focusHopOnMap(idx) {
    if (!this._lastData || !this._lastData[idx] || !this.map) return;
    this.stopSim();
    const hop = this._lastData[idx];
    this.updateSimPosition(idx);
    this.map.setView([hop.lat, hop.lon], 15, { animate: true });

    // Open popup for this marker
    this.markersLayer.eachLayer(layer => {
      if (layer.hopIndex === idx) {
        layer.openPopup();
      }
    });
  }

  _updateBottomHUD(idx, hop, progress = 1) {
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
    const emoji = this._getVehicleEmoji(vtype);
    const plate = hop.plate_text || '(unconfirmed)';
    const dirInfo = hop.heading_arrow ? ` | Heading: ${hop.heading_arrow} ${hop.heading}` : '';

    if (idx === 0) {
      legTitle.textContent = `Hop #1 (Origin Node) · ${hop.camera_id} · ${emoji} ${vtype}`;
    } else {
      const prev = this._lastData[idx - 1];
      legTitle.textContent = `Hop #${idx + 1} (${prev ? prev.camera_id : 'ORIGIN'} → ${hop.camera_id}) · ${emoji} ${vtype}${dirInfo}`;
    }

    if (plateVal) plateVal.textContent = `${emoji} ${plate}`;
    if (speedVal) speedVal.textContent = hop.speed_kmh ? `${hop.speed_kmh.toFixed(1)} km/h` : '—';
    if (distVal) distVal.textContent = hop.distance_km ? `${hop.distance_km.toFixed(2)} km` : '—';
    if (timeVal) timeVal.textContent = hop.timestamp.replace('T', ' ').substring(11, 19);

    if (statusBadge) {
      if (hop.anomaly_badge || hop.timing_anomaly_score > 0.4 || (hop.speed_kmh && hop.speed_kmh > 75)) {
        statusBadge.textContent = '⚠️ ANOMALY';
        statusBadge.style.background = '#C98A1E';
      } else if (idx === this._lastData.length - 1 && this._lastData.length > 1) {
        statusBadge.textContent = '🏁 DESTINATION';
        statusBadge.style.background = '#2F5233';
      } else {
        statusBadge.textContent = '🟢 NORMAL';
        statusBadge.style.background = '#2F5233';
      }
    }
  }

  _renderTable(hops, container) {
    let rowsHtml = '';
    hops.forEach((h, idx) => {
      const ts = h.timestamp.replace('T', ' ');
      const isUnconf = h.plate_unconfirmed || !h.plate_text;
      const plateCell = isUnconf
        ? '<span class="text-muted mono" style="font-style:italic;">(unconfirmed)</span>'
        : `<span class="mono" style="font-weight:700;">${h.plate_text}</span>`;
      const speedCell = h.speed_kmh > 0 ? `${h.speed_kmh.toFixed(1)} km/h` : '—';
      const headingCell = h.heading_arrow ? `${h.heading_arrow} ${h.heading_card || h.heading || ''}` : '• Origin';

      const isAnomaly = h.anomaly_badge || (h.speed_kmh && h.speed_kmh > 75) || h.timing_anomaly_score > 0.4;
      const statusBadge = isAnomaly
        ? `<span class="badge badge-warning" style="font-size:10px;">ANOMALY</span>`
        : `<span class="badge badge-normal" style="font-size:10px;">NORMAL</span>`;

      rowsHtml += `
        <tr class="expandable-row" style="cursor:pointer;" onclick="window.TrajectoryView.toggleDetail(${idx})">
          <td class="mono" style="font-weight:700;">#${idx + 1}</td>
          <td class="mono">${h.camera_id}</td>
          <td class="mono">${ts}</td>
          <td>${plateCell}</td>
          <td>${h.vehicle_type || 'CAR'}</td>
          <td class="mono">${speedCell}</td>
          <td>${headingCell}</td>
          <td class="mono">${(h.composite_score * 100).toFixed(1)}%</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn-secondary" type="button" style="font-size:10px; padding:2px 8px; font-family:var(--font-mono);"
              onclick="event.stopPropagation(); window.TrajectoryView.focusHopOnMap(${idx})">🎯 Focus</button>
          </td>
        </tr>
        <tr id="hop-detail-${idx}" style="display:none; background: var(--surface-color);">
          <td colspan="10" style="padding: 10px 14px;">
            <div class="reason-detail" style="font-family: var(--font-mono); font-size: 11px; line-height: 1.6;">
              <strong>Forensic Evidence Breakdown:</strong> ${h.explanation || 'Optical OCR detection'}<br/>
              ${h.distance_km > 0 ? `Distance: ${h.distance_km} km &nbsp;|&nbsp; Speed: ${speedCell} &nbsp;|&nbsp; Direction: ${h.heading_arrow || ''} ${h.heading || 'N/A'} (${h.bearing_deg !== null && h.bearing_deg !== undefined ? h.bearing_deg + '°' : 'Start'})<br/>` : ''}
              Plate Match: ${(h.plate_score * 100).toFixed(1)}% &nbsp;|&nbsp;
              Visual Sim: ${(h.visual_score * 100).toFixed(1)}% &nbsp;|&nbsp;
              Transit Plausibility: ${(h.transit_score * 100).toFixed(1)}%
              ${h.anomaly_detail ? `<br/><strong class="text-critical">🚨 Incident Alert:</strong> ${h.anomaly_detail}` : ''}
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
              <th>Direction</th>
              <th>Score</th>
              <th>Status</th>
              <th>Map Action</th>
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
