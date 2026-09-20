/**
 * View 5: Traffic Trends, Corridor Speed Baselines, Congestion Bottlenecks,
 * Origin-Destination (O-D) Demand Patterns, and Speed Violations.
 */

class TrendsView {
  constructor() {
    this._refreshInterval = null;
    this._allCorridors = null;
    this._currentThreshold = 60;
  }

  render(container) {
    container.innerHTML = `
      <!-- Card 1: Hourly Traffic Volume -->
      <div class="card">
        <div class="card-title">
          <span>City-Wide Hourly Sighting Volume</span>
          <span class="mono text-muted" style="font-size: 11px;">Aggregated Camera Detections (08:00–19:00 IST)</span>
        </div>
        <div id="trends-chart-container" style="padding: 10px 0;">
          <div class="state-box state-loading">Generating hourly traffic distribution...</div>
        </div>
      </div>

      <!-- Card 2: Congestion Bottleneck Detection (PS Mandate 5) -->
      <div class="card">
        <div class="card-title">
          <span>Active Congestion Bottlenecks &amp; Delay Hotspots</span>
          <span class="badge badge-warning">CORRIDOR LEVEL SIGNAL</span>
        </div>
        <div id="bottlenecks-container">
          <div class="state-box state-loading">Analyzing corridor congestion delays...</div>
        </div>
      </div>

      <!-- Card 3: Origin-Destination (O-D) Patterns (PS Mandate 4) -->
      <div class="card">
        <div class="card-title">
          <span>Origin-Destination (O-D) Demand Patterns</span>
          <span class="badge badge-primary">MACRO FLOW MATRIX</span>
        </div>
        <div id="od-patterns-container">
          <div class="state-box state-loading">Aggregating trajectory origin-destination pairs...</div>
        </div>
      </div>

      <!-- Card 4: Inter-Camera Corridor Baselines -->
      <div class="card">
        <div class="card-title">
          <span>Inter-Camera Corridor Baselines &amp; Speed Benchmarks</span>
          <span class="mono text-muted" style="font-size: 11px;">Observed vs. Calibration data</span>
        </div>
        <div id="corridor-table-container">
          <div class="state-box state-loading">Loading corridor speed benchmarks...</div>
        </div>
      </div>

      <!-- Card 5: Speed Violations Leaderboard -->
      <div class="card">
        <div class="card-title">
          <span>Speed Violation Corridor Rankings</span>
          <span class="badge badge-warning">ANOMALY DETECTION</span>
        </div>
        <div id="speed-violations-container">
          <div class="state-box state-loading">Computing speed violations...</div>
        </div>
      </div>
    `;

    this.loadData();
    this.startAutoRefresh();
  }

  startAutoRefresh(intervalMs = 25000) {
    if (this._refreshInterval) clearInterval(this._refreshInterval);
    this._refreshInterval = setInterval(() => {
      // Only refresh if still on trends view
      if (document.getElementById('trends-chart-container')) {
        this.loadData(true);
      } else {
        clearInterval(this._refreshInterval);
        this._refreshInterval = null;
      }
    }, intervalMs);
  }

  async loadData(isBackground = false) {
    const chartContainer = document.getElementById('trends-chart-container');
    const bottleneckContainer = document.getElementById('bottlenecks-container');
    const odContainer = document.getElementById('od-patterns-container');
    const tableContainer = document.getElementById('corridor-table-container');
    const speedContainer = document.getElementById('speed-violations-container');

    try {
      const [trendData, corridorData, bottleneckData, odData] = await Promise.all([
        DataSource.get('/api/traffic-trend'),
        DataSource.get('/api/corridor-baseline'),
        DataSource.get('/api/corridor-bottlenecks').catch(() => []),
        DataSource.get('/api/od-patterns').catch(() => [])
      ]);

      document.getElementById('offline-banner').classList.remove('visible');

      this._renderSvgChart(trendData, chartContainer);
      this._renderBottlenecks(bottleneckData, bottleneckContainer);
      this._renderODPatterns(odData, odContainer);
      this._renderCorridorTable(corridorData, tableContainer);
      this._renderSpeedViolations(corridorData, speedContainer);
    } catch {
      if (!isBackground) {
        document.getElementById('offline-banner').classList.add('visible');
        [chartContainer, bottleneckContainer, odContainer, tableContainer, speedContainer].forEach(c => {
          if (c) c.innerHTML = '<div class="state-box text-critical">Unable to reach the backend.</div>';
        });
      }
    }
  }

  _renderSvgChart(trends, container) {
    if (!container) return;
    if (!trends || trends.length === 0) {
      container.innerHTML = '<div class="state-box">No sighting trend data available.</div>';
      return;
    }

    const maxCount = Math.max(...trends.map(t => t.count), 1);
    const chartHeight = 190;
    const barWidth = 32;
    const gap = 18;
    const totalWidth = trends.length * (barWidth + gap) + 60;

    let barsSvg = '';
    trends.forEach((t, i) => {
      const x = 35 + i * (barWidth + gap);
      const h = Math.max(4, Math.round((t.count / maxCount) * (chartHeight - 50)));
      const y = chartHeight - h - 30;
      const isHighest = t.count === maxCount;

      barsSvg += `
        <g>
          <rect x="${x}" y="${y}" width="${barWidth}" height="${h}"
            fill="${isHighest ? '#C98A1E' : '#2F5233'}" rx="2" ry="2"/>
          <text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle"
            font-family="ui-monospace,monospace" font-size="10" fill="#1F1F1F" font-weight="600">${t.count}</text>
          <text x="${x + barWidth / 2}" y="${chartHeight - 10}" text-anchor="middle"
            font-family="ui-monospace,monospace" font-size="9" fill="#6B6B63">${t.hour}</text>
        </g>`;
    });

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <svg width="${totalWidth}" height="${chartHeight}"
          style="background-color: var(--surface-color); border: 1px solid var(--border-color); border-radius: 4px;">
          <line x1="25" y1="${chartHeight - 28}" x2="${totalWidth - 10}" y2="${chartHeight - 28}"
            stroke="#E1DED6" stroke-width="1"/>
          ${barsSvg}
        </svg>
      </div>
      <p class="mono text-muted" style="font-size:10px; margin-top:6px; padding-left:4px;">
        Peak volume hour highlighted in amber. Times recorded in IST.
      </p>`;
  }

  _renderBottlenecks(bottlenecks, container) {
    if (!container) return;
    if (!bottlenecks || bottlenecks.length === 0) {
      container.innerHTML = `
        <div class="state-box" style="margin:0;">
          <span class="badge badge-primary" style="margin-bottom:4px; display:inline-block;">FLOW NORMAL</span><br/>
          All monitored corridors currently running within normal historical baseline speed bounds.
        </div>`;
      return;
    }

    let rows = '';
    bottlenecks.forEach(b => {
      const isHigh = b.severity === 'HIGH';
      rows += `
        <tr>
          <td class="mono font-semibold">${b.camera_from} &rarr; ${b.camera_to}</td>
          <td class="mono" style="text-align:right;">${b.distance_km.toFixed(2)} km</td>
          <td class="mono text-critical" style="font-weight:700; text-align:right;">${b.avg_speed_kmh.toFixed(1)} km/h</td>
          <td class="mono" style="text-align:right;">${b.mean_transit_min} &plusmn; ${b.stddev_transit_min} min</td>
          <td class="mono text-warning" style="font-weight:700;">+${b.delay_factor}x slower</td>
          <td><span class="badge ${isHigh ? 'badge-critical' : 'badge-warning'}">${b.status}</span></td>
        </tr>`;
    });

    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Corridor Link</th>
              <th style="text-align:right;">Distance</th>
              <th style="text-align:right;">Running Speed</th>
              <th style="text-align:right;">Baseline Transit</th>
              <th>Delay Factor</th>
              <th>Bottleneck Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="mono text-muted" style="font-size:10px; margin-top:6px; padding-left:4px;">
        Corridors flagged when rolling average velocity drops significantly below historical corridor baseline (&gt;2&sigma; transit delay).
      </p>`;
  }

  _renderODPatterns(odPatterns, container) {
    if (!container) return;
    if (!odPatterns || odPatterns.length === 0) {
      container.innerHTML = '<div class="state-box">No multi-hop origin-destination trips recorded.</div>';
      return;
    }

    let rows = '';
    odPatterns.forEach((od, idx) => {
      const platesStr = od.sample_plates.join(', ');
      rows += `
        <tr>
          <td class="mono" style="font-weight:700;">#${idx + 1}</td>
          <td class="mono font-semibold">${od.origin_camera} <span class="text-muted">(${od.origin_name})</span></td>
          <td class="mono font-semibold">${od.dest_camera} <span class="text-muted">(${od.dest_name})</span></td>
          <td class="mono text-primary" style="font-weight:700; text-align:right;">${od.trip_count} trips</td>
          <td class="mono text-muted" style="font-size:11px;">${platesStr}</td>
        </tr>`;
    });

    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Origin Checkpoint</th>
              <th>Destination Checkpoint</th>
              <th style="text-align:right;">Trip Volume</th>
              <th>Sample Target Plates</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="mono text-muted" style="font-size:10px; margin-top:6px; padding-left:4px;">
        Aggregated paired start-to-end trip demand across multi-camera vehicle trajectories.
      </p>`;
  }

  _renderCorridorTable(corridors, container) {
    if (!container) return;
    if (!corridors || corridors.length === 0) {
      container.innerHTML = '<div class="state-box">No corridor baselines established.</div>';
      return;
    }

    let rows = '';
    corridors.forEach(c => {
      const isSeed = c.source === 'seed';
      const meanMin = (c.mean_transit_seconds / 60).toFixed(1);
      const stdMin = (c.stddev_transit_seconds / 60).toFixed(1);
      const speedClass = c.avg_speed_kmh > 80 ? 'text-warning' : '';

      rows += `
        <tr class="${isSeed ? 'is-seed' : ''}">
          <td class="mono" style="font-weight:700;">${c.camera_from} &rarr; ${c.camera_to}</td>
          <td class="mono" style="text-align:right;">${c.distance_km.toFixed(2)} km</td>
          <td class="mono" style="text-align:right;">${c.mean_transit_seconds.toFixed(0)}s (${meanMin} ± ${stdMin} min)</td>
          <td class="mono ${speedClass}" style="text-align:right; font-weight:700;">${c.avg_speed_kmh.toFixed(1)} km/h</td>
          <td class="mono" style="text-align:right;">${c.sample_count}</td>
          <td><span class="badge ${isSeed ? 'badge-muted' : 'badge-primary'}">${c.source.toUpperCase()}</span></td>
        </tr>`;
    });

    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Corridor Link</th>
              <th style="text-align:right;">Distance</th>
              <th style="text-align:right;">Baseline Transit (μ ± σ)</th>
              <th style="text-align:right;">Avg Speed</th>
              <th style="text-align:right;">Samples</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  _renderSpeedViolations(corridors, container) {
    if (!container) return;
    this._allCorridors = corridors || [];
    this._currentThreshold = this._currentThreshold || 60;
    this._violationSubTab = this._violationSubTab || 'vehicles'; // 'vehicles' or 'corridors'

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px; background:var(--surface-color); padding:12px 16px; border-radius:6px; border:1px solid var(--border-color);">
        <div>
          <div style="font-size:13px; font-weight:700; display:flex; align-items:center; gap:8px;">
            ⚡ Speed Limit Threshold: 
            <span id="speed-thresh-val" class="mono text-warning" style="font-size:14px; font-weight:800; background:#3A2A0A; color:#FFD166; padding:2px 8px; border-radius:4px; border:1px solid #7A5814;">
              ${this._currentThreshold} km/h
            </span>
          </div>
          <div class="mono text-muted" style="font-size:11px; margin-top:2px;">
            Filter vehicles &amp; transit corridors exceeding dynamic enforcement baseline
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <!-- Speed Slider -->
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="mono text-muted" style="font-size:10px;">30</span>
            <input type="range" min="30" max="130" step="5" value="${this._currentThreshold}" style="width:140px; cursor:pointer;"
              oninput="window.TrendsView.updateThreshold(this.value)" />
            <span class="mono text-muted" style="font-size:10px;">130</span>
          </div>

          <!-- Quick Threshold Preset Buttons -->
          <div style="display:flex; gap:4px;">
            <button type="button" class="btn-secondary btn-sm" style="font-size:11px; padding:3px 8px; ${this._currentThreshold===50?'background:var(--accent-primary);color:#fff;':''}"
              onclick="window.TrendsView.updateThreshold(50)">50</button>
            <button type="button" class="btn-secondary btn-sm" style="font-size:11px; padding:3px 8px; ${this._currentThreshold===60?'background:var(--accent-primary);color:#fff;':''}"
              onclick="window.TrendsView.updateThreshold(60)">60</button>
            <button type="button" class="btn-secondary btn-sm" style="font-size:11px; padding:3px 8px; ${this._currentThreshold===75?'background:var(--accent-primary);color:#fff;':''}"
              onclick="window.TrendsView.updateThreshold(75)">75</button>
            <button type="button" class="btn-secondary btn-sm" style="font-size:11px; padding:3px 8px; ${this._currentThreshold===90?'background:var(--accent-primary);color:#fff;':''}"
              onclick="window.TrendsView.updateThreshold(90)">90</button>
            <button type="button" class="btn-secondary btn-sm" style="font-size:11px; padding:3px 8px; ${this._currentThreshold===100?'background:var(--accent-critical);color:#fff;':''}"
              onclick="window.TrendsView.updateThreshold(100)">100</button>
          </div>

          <!-- Sub-Tab Toggle -->
          <div class="btn-group" style="display:flex; border:1px solid var(--border-color); border-radius:4px; overflow:hidden;">
            <button id="btn-viol-veh" class="filter-btn ${this._violationSubTab==='vehicles'?'active':''}" style="border:none; border-radius:0; font-size:11px; padding:4px 10px;"
              onclick="window.TrendsView.setViolationSubTab('vehicles')">🚗 Speeding Vehicles</button>
            <button id="btn-viol-corr" class="filter-btn ${this._violationSubTab==='corridors'?'active':''}" style="border:none; border-radius:0; font-size:11px; padding:4px 10px;"
              onclick="window.TrendsView.setViolationSubTab('corridors')">🛣️ Corridor Averages</button>
          </div>
        </div>
      </div>

      <div id="violations-table-mount">
        <div class="state-box state-loading">Scanning optical sighting records for speed violations &gt; ${this._currentThreshold} km/h...</div>
      </div>
    `;

    this._fetchAndRenderViolations();
  }

  setViolationSubTab(tab) {
    this._violationSubTab = tab;
    document.getElementById('btn-viol-veh')?.classList.toggle('active', tab === 'vehicles');
    document.getElementById('btn-viol-corr')?.classList.toggle('active', tab === 'corridors');
    this._fetchAndRenderViolations();
  }

  updateThreshold(val) {
    this._currentThreshold = parseInt(val, 10);
    const valEl = document.getElementById('speed-thresh-val');
    if (valEl) valEl.textContent = `${this._currentThreshold} km/h`;
    this._fetchAndRenderViolations();
  }

  async _fetchAndRenderViolations() {
    const mount = document.getElementById('violations-table-mount');
    if (!mount) return;

    if (this._violationSubTab === 'corridors') {
      this._renderCorridorViolations(mount);
      return;
    }

    try {
      const data = await DataSource.get(`/api/speed-violations?min_speed=${this._currentThreshold}`);
      if (!data || data.length === 0) {
        mount.innerHTML = `
          <div class="state-box" style="margin:0; padding:20px;">
            <span class="badge badge-normal" style="margin-bottom:6px; display:inline-block; font-size:11px;">🟢 ALL CLEAR</span><br/>
            No recorded vehicles exceeded the <strong>${this._currentThreshold} km/h</strong> enforcement threshold.
          </div>`;
        return;
      }

      let rows = '';
      data.forEach((v, i) => {
        const vtype = (v.vehicle_type || 'CAR').toUpperCase();
        const emoji = window.TrajectoryView ? window.TrajectoryView._getVehicleEmoji(vtype) : '🚗';
        const isExtreme = v.speed_kmh >= 100;
        const sevStyle = isExtreme ? 'background:#5C1316; color:#FFD1D3; border-color:#991B1B;' : 'background:#3A2A0A; color:#FFEAA7; border-color:#7A5814;';

        rows += `
          <tr>
            <td class="mono font-semibold" style="font-size:11px;">#${i + 1}</td>
            <td>
              <span class="mono" style="font-weight:800; font-size:12px; color:var(--text-primary);">${v.plate_text}</span>
            </td>
            <td>
              <span class="mono" style="font-size:11px; padding:2px 6px; background:var(--surface-color); border:1px solid var(--border-color); border-radius:3px;">
                ${emoji} ${vtype}
              </span>
            </td>
            <td class="mono" style="font-weight:800; font-size:12px; text-align:right; color:${isExtreme ? '#B3262A' : '#C98A1E'};">
              ${v.speed_kmh.toFixed(1)} km/h
            </td>
            <td class="mono" style="font-size:11px; color:${isExtreme ? '#B3262A' : 'var(--text-muted)'}; font-weight:600;">
              +${v.excess_kmh.toFixed(1)} km/h
            </td>
            <td class="mono" style="font-size:11px;">
              ${v.camera_from} &rarr; ${v.camera_to}
              <span class="text-muted" style="font-size:10px;">(${v.distance_km} km in ${v.transit_time_sec}s)</span>
            </td>
            <td class="mono" style="font-size:11px; color:var(--text-muted);">
              ${v.timestamp.replace('T', ' ').substring(11, 19)}
            </td>
            <td>
              <span class="mono" style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:3px; border:1px solid; ${sevStyle}">
                ${v.severity}
              </span>
            </td>
            <td>
              <button type="button" class="btn-action btn-sm" style="font-size:10px; padding:3px 8px;"
                onclick="window.TrendsView.trackSpeedingVehicle('${v.plate_text}')">
                🎯 Track Route
              </button>
            </td>
          </tr>`;
      });

      mount.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Target Plate</th>
                <th>Vehicle Type</th>
                <th style="text-align:right;">Recorded Speed</th>
                <th>Excess Over Limit</th>
                <th>Corridor Segment</th>
                <th>Timestamp</th>
                <th>Severity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding:0 4px; font-size:11px;" class="mono text-muted">
          <span>Total Violating Transits: <strong>${data.length}</strong></span>
          <span>Threshold: ${this._currentThreshold} km/h &bull; Red = &ge;100 km/h</span>
        </div>
      `;
    } catch (err) {
      console.warn('Failed to load speed violations:', err);
      mount.innerHTML = `<div class="state-box text-critical">Failed to load speed violations from backend.</div>`;
    }
  }

  _renderCorridorViolations(mount) {
    const violations = this._allCorridors
      .filter(c => c.avg_speed_kmh > this._currentThreshold)
      .sort((a, b) => b.avg_speed_kmh - a.avg_speed_kmh);

    if (violations.length === 0) {
      mount.innerHTML = `
        <div class="state-box" style="margin:0; padding:20px;">
          <span class="badge badge-normal" style="margin-bottom:6px; display:inline-block; font-size:11px;">🟢 ALL CLEAR</span><br/>
          No corridors exceed the ${this._currentThreshold} km/h baseline threshold.
        </div>`;
      return;
    }

    const maxSpeed = Math.max(...violations.map(v => v.avg_speed_kmh), 1);
    let rows = '';
    violations.forEach((c, i) => {
      const pct = Math.round((c.avg_speed_kmh / maxSpeed) * 100);
      const isExtreme = c.avg_speed_kmh > 100;

      rows += `
        <tr>
          <td class="mono" style="font-weight:700;">#${i + 1}</td>
          <td class="mono font-semibold">${c.camera_from} &rarr; ${c.camera_to}</td>
          <td class="mono" style="font-weight:700; text-align:right; color:${isExtreme ? '#B3262A' : '#C98A1E'};">${c.avg_speed_kmh.toFixed(1)} km/h</td>
          <td class="mono text-muted">+${(c.avg_speed_kmh - this._currentThreshold).toFixed(1)} km/h over</td>
          <td style="width: 140px;">
            <div style="background:#E5E2DA; height:6px; border-radius:3px; overflow:hidden;">
              <div style="width: ${pct}%; height:100%; background: ${isExtreme ? 'var(--accent-critical)' : 'var(--accent-warning)'}; border-radius:3px;"></div>
            </div>
          </td>
          <td class="mono" style="text-align:right; font-size:11px;">${c.sample_count} obs.</td>
        </tr>`;
    });

    mount.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Corridor</th>
              <th style="text-align:right;">Avg Speed</th>
              <th>Excess</th>
              <th>Relative Velocity</th>
              <th style="text-align:right;">Observations</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  trackSpeedingVehicle(plate) {
    if (window.App && window.App.showView) {
      window.App.showView('trajectory');
      setTimeout(() => {
        if (window.TrajectoryView) {
          window.TrajectoryView.searchPreset(plate);
        }
      }, 100);
    }
  }
}

window.TrendsView = new TrendsView();
