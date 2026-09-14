/**
 * Unified Data Access Module for City-Wide ANPR Trajectory & Route-Anomaly Engine.
 * Supports dual-hosting mode via STATIC_MODE flag:
 * - false: Live calls to FastAPI backend on http://127.0.0.1:8000 (or current host)
 * - true: Frozen static JSON snapshots for GitHub Pages
 */

const STATIC_MODE = true;
const API_BASE = window.location.origin.includes(":8000") ? "" : "http://127.0.0.1:8000";

class DataSource {
  constructor() {
    this.staticMode = STATIC_MODE;
    this.apiBase = API_BASE;
  }

  async _fetch(endpoint, options = {}) {
    try {
      const url = `${this.apiBase}${endpoint}`;
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[DataSource] Request failed: ${endpoint}`, err.message);
      throw err;
    }
  }

  async getHealth() {
    if (this.staticMode) {
      return { status: "ok", mode: "static" };
    }
    return await this._fetch("/api/health");
  }

  async getTrajectory(query, role = "operator", dateFrom = null, dateTo = null) {
    if (this.staticMode) {
      try {
        const cleanQ = (query || "").trim().toUpperCase();
        // Fetch static trajectory file
        const res = await fetch(`./static_data/trajectory_${cleanQ}.json`);
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    }
    const params = new URLSearchParams({ query, role });
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    return await this._fetch(`/api/trajectory?${params.toString()}`);
  }

  async getHeatmap(dateFrom = null, dateTo = null) {
    if (this.staticMode) {
      const res = await fetch("./static_data/heatmap.json");
      return await res.json();
    }
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    return await this._fetch(`/api/heatmap?${params.toString()}`);
  }

  async getZones() {
    if (this.staticMode) {
      const res = await fetch("./static_data/zones.json");
      return await res.json();
    }
    return await this._fetch("/api/zones");
  }

  async getCorridorBaseline() {
    if (this.staticMode) {
      const res = await fetch("./static_data/corridor_baseline.json");
      return await res.json();
    }
    return await this._fetch("/api/corridor-baseline");
  }

  async getTrafficTrend(dateFrom = null, dateTo = null) {
    if (this.staticMode) {
      const res = await fetch("./static_data/traffic_trend.json");
      return await res.json();
    }
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    return await this._fetch(`/api/traffic-trend?${params.toString()}`);
  }

  async checkBlacklist(plate, role = "operator") {
    if (this.staticMode) {
      try {
        const clean = (plate || "").trim().toUpperCase();
        const res = await fetch("./static_data/blacklist.json");
        const list = await res.json();
        const found = list.find(item => item.plate_text.toUpperCase() === clean);
        return {
          match: !!found,
          entry: found || null
        };
      } catch {
        return { match: false, entry: null };
      }
    }
    const params = new URLSearchParams({ plate, role });
    return await this._fetch(`/api/blacklist/check?${params.toString()}`);
  }

  async getAlerts() {
    if (this.staticMode) {
      const res = await fetch("./static_data/alerts.json");
      return await res.json();
    }
    return await this._fetch("/api/alerts");
  }

  async triggerAlertScan() {
    if (this.staticMode) {
      return { alerts_created: 0 };
    }
    return await this._fetch("/api/alerts/scan", { method: "POST" });
  }

  async getAuditLog() {
    if (this.staticMode) {
      const res = await fetch("./static_data/audit_log.json");
      return await res.json();
    }
    return await this._fetch("/api/audit-log");
  }

  async getUnseenAlerts(sinceId = 0) {
    if (this.staticMode) {
      return []; // Inert in static mode
    }
    return await this._fetch(`/api/alerts/unseen?since_id=${sinceId}`);
  }
}

window.dataSource = new DataSource();
