/**
 * View 5: Macro Traffic Trends & Corridor Speed Baselines.
 * Features:
 * - Pure inline SVG hourly sighting distribution chart (no third-party chart libs)
 * - Corridor baseline table with explicit visual de-emphasis for seeded calibration rows
 */

class TrendsView {
  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>City-Wide Hourly Sighting Volume</span>
          <span class="mono text-muted" style="font-size: 11px;">Aggregated Camera Detections (08:00 - 19:00)</span>
        </div>
        <div id="trends-chart-container" style="padding: 10px 0;">
          <div class="state-box state-loading">Generating hourly traffic distribution...</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Inter-Camera Corridor Baselines & Speed Benchmarks</span>
          <span class="mono text-muted" style="font-size: 11px;">Observed Real Data vs Synthetic Calibration Seeds</span>
        </div>
        <div id="corridor-table-container">
          <div class="state-box state-loading">Loading corridor speed benchmarks...</div>
        </div>
      </div>
    `;

    this.loadData();
  }

  async loadData() {
    const chartContainer = document.getElementById("trends-chart-container");
    const tableContainer = document.getElementById("corridor-table-container");

    try {
      const [trendData, corridorData] = await Promise.all([
        window.dataSource.getTrafficTrend(),
        window.dataSource.getCorridorBaseline()
      ]);
      window.appRouter.hideOfflineBanner();

      this._renderSvgChart(trendData, chartContainer);
      this._renderCorridorTable(corridorData, tableContainer);
    } catch (err) {
      window.appRouter.showOfflineBanner();
      if (chartContainer) chartContainer.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
      if (tableContainer) tableContainer.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
    }
  }

  _renderSvgChart(trends, container) {
    if (!trends || trends.length === 0) {
      container.innerHTML = '<div class="state-box">No sighting trend data available.</div>';
      return;
    }

    const maxCount = Math.max(...trends.map(t => t.count), 1);
    const chartHeight = 180;
    const barWidth = 32;
    const gap = 20;
    const totalWidth = trends.length * (barWidth + gap) + 40;

    let barsSvg = "";
    trends.forEach((t, i) => {
      const x = 30 + i * (barWidth + gap);
      const h = Math.round((t.count / maxCount) * (chartHeight - 40));
      const y = chartHeight - h - 25;

      barsSvg += `
        <g class="chart-bar-group">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="#2F5233" rx="2" ry="2" />
          <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#1F1F1F" font-weight="600">${t.count}</text>
          <text x="${x + barWidth / 2}" y="${chartHeight - 8}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#6B6B63">${t.hour}</text>
        </g>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <svg width="${totalWidth}" height="${chartHeight}" style="background-color: var(--surface-color); border: 1px solid var(--border-color); border-radius: 4px;">
          <!-- Baseline axis -->
          <line x1="20" y1="${chartHeight - 24}" x2="${totalWidth - 10}" y2="${chartHeight - 24}" stroke="#E1DED6" stroke-width="1" />
          ${barsSvg}
        </svg>
      </div>
    `;
  }

  _renderCorridorTable(corridors, container) {
    if (!corridors || corridors.length === 0) {
      container.innerHTML = '<div class="state-box">No corridor baselines established.</div>';
      return;
    }

    let rows = "";
    corridors.forEach(c => {
      const isSeed = (c.source === "seed");
      const meanMinutes = (c.mean_transit_seconds / 60.0).toFixed(1);
      const stdMinutes = (c.stddev_transit_seconds / 60.0).toFixed(1);

      rows += `
        <tr class="${isSeed ? 'is-seed' : ''}">
          <td class="mono font-bold">${c.camera_from} &rarr; ${c.camera_to}</td>
          <td class="mono" style="text-align: right;">${c.distance_km.toFixed(2)} km</td>
          <td class="mono" style="text-align: right;">${c.mean_transit_seconds.toFixed(0)}s (${meanMinutes} ± ${stdMinutes} min)</td>
          <td class="mono font-bold" style="text-align: right;">${c.avg_speed_kmh.toFixed(1)} km/h</td>
          <td class="mono" style="text-align: right;">${c.sample_count}</td>
          <td>
            <span class="badge ${isSeed ? 'badge-muted' : 'badge-primary'}">
              ${c.source.toUpperCase()}
            </span>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Corridor Link</th>
              <th style="text-align: right;">Road Distance</th>
              <th style="text-align: right;">Baseline Transit (μ ± σ)</th>
              <th style="text-align: right;">Average Speed</th>
              <th style="text-align: right;">Samples</th>
              <th>Data Source</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }
}

window.trendsView = new TrendsView();
