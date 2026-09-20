/**
 * Unified Data Access Module — v2 (Real-World Enhancement Build)
 * Supports dual-hosting mode via STATIC_MODE flag:
 *  - false: Live calls to FastAPI backend on http://127.0.0.1:8000 (or current host)
 *  - true:  Frozen static JSON snapshots for GitHub Pages
 *
 * NEW in v2: Static DataSource singleton exported as window.DataSource
 * (uppercase) for direct use by all views. Old window.dataSource (lowercase)
 * preserved for backward compatibility with any legacy references.
 */

const STATIC_MODE = false;
const API_BASE = (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http') && window.location.origin !== 'null') ? '' : 'http://127.0.0.1:8080';

// ──────────────────────────────────────────────────────────────
// Core HTTP Helpers
// ──────────────────────────────────────────────────────────────
const DataSource = {
  staticMode: STATIC_MODE,
  apiBase: API_BASE,

  async _fetch(endpoint, options = {}) {
    try {
      const url = `${this.apiBase}${endpoint}`;
      const res = await fetch(url, options);
      if (!res.ok) {
        const msg = `HTTP ${res.status} from ${endpoint}`;
        console.warn(`[DataSource] ${msg}`);
        throw new Error(msg);
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      return {};
    } catch (err) {
      console.warn(`[DataSource] Request failed: ${endpoint}`, err.message);
      throw err;
    }
  },

  /** GET */
  async get(endpoint) {
    return this._fetch(endpoint, { method: 'GET' });
  },

  /** POST (no body — params are in the URL) */
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
  // Legacy named methods (preserve backward compat with old views)
  // ──────────────────────────────────────────────────────────────

  async getHealth() {
    if (this.staticMode) return { status: 'ok', mode: 'static' };
    return this.get('/api/health');
  },

  async getTrajectory(query, role = 'operator', dateFrom = null, dateTo = null) {
    if (this.staticMode) {
      try {
        const cleanQ = (query || '').trim().toUpperCase();
        const res = await fetch(`./static_data/trajectory_${cleanQ}.json`);
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    }
    const params = new URLSearchParams({ query, role });
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    return this.get(`/api/trajectory?${params}`);
  },

  async getHeatmap(dateFrom = null, dateTo = null) {
    if (this.staticMode) {
      const res = await fetch('./static_data/heatmap.json'); return res.json();
    }
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    return this.get(`/api/heatmap?${params}`);
  },

  async getZones() {
    if (this.staticMode) { const res = await fetch('./static_data/zones.json'); return res.json(); }
    return this.get('/api/zones');
  },

  async getCorridorBaseline() {
    if (this.staticMode) { const res = await fetch('./static_data/corridor_baseline.json'); return res.json(); }
    return this.get('/api/corridor-baseline');
  },

  async getTrafficTrend(dateFrom = null, dateTo = null) {
    if (this.staticMode) { const res = await fetch('./static_data/traffic_trend.json'); return res.json(); }
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    return this.get(`/api/traffic-trend?${params}`);
  },

  async checkBlacklist(plate, role = 'operator') {
    if (this.staticMode) {
      try {
        const clean = (plate || '').trim().toUpperCase();
        const res = await fetch('./static_data/blacklist.json');
        const list = await res.json();
        const found = list.find(i => i.plate_text.toUpperCase() === clean);
        return { match: !!found, entry: found || null };
      } catch { return { match: false, entry: null }; }
    }
    return this.get(`/api/blacklist/check?plate=${encodeURIComponent(plate)}&role=${role}`);
  },

  async getAlerts() {
    if (this.staticMode) { const res = await fetch('./static_data/alerts.json'); return res.json(); }
    return this.get('/api/alerts');
  },

  async triggerAlertScan() {
    if (this.staticMode) return { alerts_created: 0 };
    return this.post('/api/alerts/scan');
  },

  async getAuditLog() {
    if (this.staticMode) { const res = await fetch('./static_data/audit_log.json'); return res.json(); }
    return this.get('/api/audit-log');
  },

  async getUnseenAlerts(sinceId = 0) {
    if (this.staticMode) return [];
    return this.get(`/api/alerts/unseen?since_id=${sinceId}`);
  },
};

// Export both names for compatibility
window.DataSource = DataSource;
window.dataSource = DataSource; // legacy alias
