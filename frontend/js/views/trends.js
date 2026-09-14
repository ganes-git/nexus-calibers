/**
 * View 5: Traffic Trends, Corridor Speed Baselines, Speed Violations.
 */

class TrendsView {
  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>City-Wide Hourly Sighting Volume</span>
          <span class="mono text-muted" style="font-size: 11px;">Aggregated Camera Detections (08:00–19:00)</span>
        </div>
        <div id="trends-chart-container" style="padding: 10px 0;">
          <div class="state-box state-loading">Generating hourly traffic distribution...</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Inter-Camera Corridor Baselines &amp; Speed Benchmarks</span>
          <span class="mono text-muted" style="font-size: 11px;">Observed vs. Seed calibration data</span>
        </div>
        <div id="corridor-table-container">
          <div class="state-box state-loading">Loading corridor speed benchmarks...</div>
        </div>
      </div>

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
  }

  async loadData() {
    const chartContainer = document.getElementById('trends-chart-container');
    const tableContainer = document.getElementById('corridor-table-container');
    const speedContainer = document.getElementById('speed-violations-container');

    try {
      const [trendData, corridorData] = await Promise.all([
        DataSource.get('/api/traffic-trend'),
        DataSource.get('/api/corridor-baseline'),
      ]);
      document.getElementById('offline-banner').classList.remove('visible');

      this._renderSvgChart(trendData, chartContainer);
      this._renderCorridorTable(corridorData, tableContainer);
      this._renderSpeedViolations(corridorData, speedContainer);
    } catch {
      document.getElementById('offline-banner').classList.add('visible');
      [chartContainer, tableContainer, speedContainer].forEach(c => {
        if (c) c.innerHTML = '<div class="state-box text-critical">Unable to reach the backend.</div>';
      });
    }
  }

  _renderSvgChart(trends, container) {
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
        Peak hour highlighted in amber. All times IST.
      </p>`;
  }

  _renderCorridorTable(corridors, container) {
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
    if (!corridors || corridors.length === 0) {
      container.innerHTML = '<div class="state-box">No corridor data to analyze.</div>';
      return;
    }

    // Flag corridors where avg_speed > mean + 2*stddev expressed in km/h terms
    // We use avg_speed_kmh as proxy and flag those significantly above 60 km/h urban limit
    const URBAN_LIMIT_KMH = 60;
    const violations = corridors
      .filter(c => c.avg_speed_kmh > URBAN_LIMIT_KMH)
      .sort((a, b) => b.avg_speed_kmh - a.avg_speed_kmh);

    if (violations.length === 0) {
      container.innerHTML = `
        <div class="state-box">
          <span class="badge badge-primary" style="margin-bottom:6px; display:inline-block;">ALL CLEAR</span><br/>
          No corridors exceed the ${URBAN_LIMIT_KMH} km/h urban speed limit baseline.
        </div>`;
      return;
    }

    const maxSpeed = violations[0].avg_speed_kmh;
    let rows = '';
    violations.forEach((c, i) => {
      const pct = Math.round((c.avg_speed_kmh / maxSpeed) * 100);
      const severityClass = c.avg_speed_kmh > 100 ? 'text-critical' : 'text-warning';

      rows += `
        <tr>
          <td class="mono speed-rank">#${i + 1}</td>
          <td class="mono" style="font-weight:700;">${c.camera_from} &rarr; ${c.camera_to}</td>
          <td class="mono ${severityClass}" style="font-weight:700;">${c.avg_speed_kmh.toFixed(1)} km/h</td>
          <td class="mono text-muted">${(c.avg_speed_kmh - URBAN_LIMIT_KMH).toFixed(1)} km/h over limit</td>
          <td class="speed-bar-cell">
            <div class="speed-bar" title="${c.avg_speed_kmh.toFixed(1)} km/h">
              <div class="speed-bar-fill" style="width: ${pct}%;
                background-color: ${c.avg_speed_kmh > 100 ? 'var(--accent-critical)' : 'var(--accent-warning)'};"></div>
            </div>
          </td>
          <td class="mono" style="text-align:right; font-size:11px;">${c.sample_count} obs.</td>
        </tr>`;
    });

    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Corridor</th>
              <th>Avg Speed</th>
              <th>Excess</th>
              <th>Relative Severity</th>
              <th style="text-align:right;">Observations</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="mono text-muted" style="font-size: 10px; margin-top: 6px; padding-left: 4px;">
        Urban speed limit baseline: ${URBAN_LIMIT_KMH} km/h. Red = &gt;100 km/h. Amber = ${URBAN_LIMIT_KMH}–100 km/h.
      </p>`;
  }
}

window.TrendsView = new TrendsView();
