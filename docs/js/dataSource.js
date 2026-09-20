/**
 * Unified Data Access Module — v3 (Dual-Mode & Auto-Fallback Architecture)
 * Supports live FastAPI backend and zero-cost GitHub Pages static deployment.
 *
 * Auto-detects hosting environment:
 *  - On github.io or when STATIC_MODE is true: seamlessly routes all API calls to ./static_data/*.json
 *  - On localhost / 127.0.0.1: calls live FastAPI backend with automatic graceful fallback to static data
 */

const IS_GITHUB_PAGES = typeof window !== 'undefined' && window.location && (
  window.location.hostname.includes('github.io') ||
  window.location.protocol === 'file:' ||
  window.location.port === '8008'
);

const STATIC_MODE = IS_GITHUB_PAGES;
const API_BASE = (!STATIC_MODE && typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') 
  ? window.location.origin 
  : 'http://127.0.0.1:8000';

const DataSource = {
  staticMode: STATIC_MODE,
  apiBase: API_BASE,

  /**
   * Static route resolver for GitHub Pages / offline hosting
   */
  async _resolveStatic(endpoint, options = {}) {
    const urlObj = new URL(endpoint, 'http://localhost');
    const path = urlObj.pathname;
    const params = urlObj.searchParams;

    // 1. Health check
    if (path === '/api/health') {
      return { status: 'ok', mode: 'static' };
    }

    // 2. Trajectory search
    if (path === '/api/trajectory') {
      const q = (params.get('query') || '').trim().toUpperCase();
      if (!q) return [];
      try {
        const res = await fetch(`./static_data/trajectory_${q}.json`);
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 3. Cameras list
    if (path === '/api/cameras') {
      try {
        const res = await fetch('./static_data/cameras.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 4. Heatmap data
    if (path === '/api/heatmap') {
      try {
        const res = await fetch('./static_data/heatmap.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 5. Restricted zones
    if (path === '/api/zones') {
      try {
        const res = await fetch('./static_data/zones.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 6. Corridor baseline
    if (path === '/api/corridor-baseline') {
      try {
        const res = await fetch('./static_data/corridor_baseline.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 7. Traffic trends
    if (path === '/api/traffic-trend') {
      try {
        const res = await fetch('./static_data/traffic_trend.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 8. Corridor bottlenecks
    if (path === '/api/corridor-bottlenecks') {
      try {
        const res = await fetch('./static_data/corridor_bottlenecks.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 9. OD patterns
    if (path === '/api/od-patterns') {
      try {
        const res = await fetch('./static_data/od_patterns.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 10. Blacklist check
    if (path === '/api/blacklist/check') {
      const plate = (params.get('plate') || '').trim().toUpperCase();
      try {
        const res = await fetch('./static_data/blacklist.json');
        if (res.ok) {
          const list = await res.json();
          const found = list.find(item => (item.plate_text || '').toUpperCase() === plate);
          return { match: !!found, entry: found || null };
        }
      } catch (_) {}
      return { match: false, entry: null };
    }

    // 11. Full blacklist list
    if (path === '/api/blacklist') {
      try {
        const res = await fetch('./static_data/blacklist.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 12. Alerts list
    if (path.startsWith('/api/alerts')) {
      if (path.includes('/unseen')) return [];
      try {
        const res = await fetch('./static_data/alerts.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 13. Audit log
    if (path === '/api/audit-log') {
      try {
        const res = await fetch('./static_data/audit_log.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 14. Stats summary
    if (path === '/api/stats/summary') {
      try {
        const res = await fetch('./static_data/stats_summary.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return { sightings_today: 164, active_alerts: 29, cameras_online: 8, cameras_total: 8, blacklist_seen_today: 1 };
    }

    // 15. Recent sightings
    if (path.startsWith('/api/sightings/recent')) {
      try {
        const res = await fetch('./static_data/sightings_recent.json');
        if (res.ok) return await res.json();
      } catch (_) {}
      return [];
    }

    // 16. Speed violations
    if (path.startsWith('/api/speed-violations')) {
      return [];
    }

    // Default mock response for write actions in static mode
    if (options.method && ['POST', 'PATCH', 'DELETE'].includes(options.method.toUpperCase())) {
      return { status: 'ok', mock: true };
    }

    return {};
  },

  async _fetch(endpoint, options = {}) {
    // If running in static mode, route directly to static snapshots
    if (this.staticMode) {
      return this._resolveStatic(endpoint, options);
    }

    // Live mode: try backend first, with graceful static fallback
    try {
      const url = `${this.apiBase}${endpoint}`;
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      return {};
    } catch (err) {
      // If backend is unreachable or 404, gracefully fall back to static data
      return this._resolveStatic(endpoint, options);
    }
  },

  /** GET */
  async get(endpoint) {
    return this._fetch(endpoint, { method: 'GET' });
  },

  /** POST */
  async post(endpoint, body = null) {
    const opts = { method: 'POST' };
    if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    return this._fetch(endpoint, opts);
  },

  /** PATCH */
  async patch(endpoint, body = null) {
    const opts = { method: 'PATCH' };
    if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    return this._fetch(endpoint, opts);
  },

  /** DELETE */
  async delete(endpoint) {
    return this._fetch(endpoint, { method: 'DELETE' });
  },

  // ──────────────────────────────────────────────────────────────
  // Backward compatibility legacy methods
  // ──────────────────────────────────────────────────────────────
  async getHealth() { return this.get('/api/health'); },
  async getTrajectory(query, role = 'operator', dateFrom = null, dateTo = null) {
    const params = new URLSearchParams({ query, role });
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    return this.get(`/api/trajectory?${params}`);
  },
  async getHeatmap(dateFrom = null, dateTo = null) { return this.get('/api/heatmap'); },
  async getZones() { return this.get('/api/zones'); },
  async getCorridorBaseline() { return this.get('/api/corridor-baseline'); },
  async getTrafficTrend(dateFrom = null, dateTo = null) { return this.get('/api/traffic-trend'); },
  async checkBlacklist(plate, role = 'operator') {
    return this.get(`/api/blacklist/check?plate=${encodeURIComponent(plate)}&role=${role}`);
  },
  async getAlerts() { return this.get('/api/alerts'); },
  async triggerAlertScan() { return this.post('/api/alerts/scan'); },
  async getAuditLog() { return this.get('/api/audit-log'); },
  async getUnseenAlerts(sinceId = 0) { return this.get(`/api/alerts/unseen?since_id=${sinceId}`); },
};

// Export singleton
window.DataSource = DataSource;
window.dataSource = DataSource;
