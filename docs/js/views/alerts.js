/**
 * View 4: Central Alert Command Center & Role-Gated Search Audit Log.
 * Features:
 * - Real-time alerts table sorted newest first with color-coded severity tiers:
 *   - Critical (#B3262A): clone, blacklist
 *   - Warning (#C98A1E): impossible_transit, zone_deviation, route_anomaly
 * - Filter by alert type
 * - Audit Log section:
 *   - STRICT ROLE-GATING: Completely unmounted from the DOM in Operator mode
 *   - Mounted and populated only when Supervisor mode is selected
 */

class AlertsView {
  constructor() {
    this.alertsData = [];
    this.currentFilter = "all";
  }

  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>Active Incident Alerts</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-secondary" style="font-size: 11px; padding: 4px 8px;" onclick="window.alertsView.rescanAlerts()">Re-Scan Engine</button>
            <button class="btn-action" style="font-size: 11px; padding: 4px 10px;" onclick="window.alertsView.loadAlerts()">Refresh</button>
          </div>
        </div>

        <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;" id="alert-filters">
          <button class="btn-secondary active" style="font-size: 11px; padding: 3px 8px;" onclick="window.alertsView.setFilter('all', this)">All Types</button>
          <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.alertsView.setFilter('clone', this)">Clone</button>
          <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.alertsView.setFilter('impossible_transit', this)">Impossible Transit</button>
          <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.alertsView.setFilter('blacklist', this)">Blacklist</button>
          <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.alertsView.setFilter('zone_deviation', this)">Zone Deviation</button>
          <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.alertsView.setFilter('route_anomaly', this)">Route Anomaly</button>
        </div>

        <div id="alerts-table-container">
          <div class="state-box state-loading">Fetching incident alerts...</div>
        </div>
      </div>

      <!-- Supervisor Role-Gated Audit Log Container -->
      <div id="audit-log-mount-point"></div>
    `;

    this.loadAlerts();
    this.syncAuditLogSection();
  }

  setFilter(type, btn) {
    this.currentFilter = type;
    const filterButtons = document.querySelectorAll("#alert-filters .btn-secondary");
    filterButtons.forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    this._renderAlertsTable();
  }

  async rescanAlerts() {
    const tableContainer = document.getElementById("alerts-table-container");
    if (tableContainer) tableContainer.innerHTML = '<div class="state-box state-loading">Executing city-wide alert scan across all sighting pairs...</div>';
    try {
      await window.dataSource.triggerAlertScan();
      await this.loadAlerts();
    } catch (e) {
      window.appRouter.showOfflineBanner();
    }
  }

  async loadAlerts() {
    const tableContainer = document.getElementById("alerts-table-container");
    if (tableContainer) tableContainer.innerHTML = '<div class="state-box state-loading">Loading alerts...</div>';
    try {
      const data = await window.dataSource.getAlerts();
      window.appRouter.hideOfflineBanner();
      this.alertsData = data || [];
      this._renderAlertsTable();
    } catch (err) {
      window.appRouter.showOfflineBanner();
      if (tableContainer) tableContainer.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
    }
  }

  _renderAlertsTable() {
    const container = document.getElementById("alerts-table-container");
    if (!container) return;

    let filtered = this.alertsData;
    if (this.currentFilter !== "all") {
      filtered = filtered.filter(a => a.alert_type === this.currentFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="state-box">No alerts found matching this filter criteria.</div>';
      return;
    }

    let rowsHtml = "";
    filtered.forEach(a => {
      const isCritical = (a.alert_type === "clone" || a.alert_type === "blacklist");
      const badgeClass = isCritical ? "badge-critical" : "badge-warning";
      const timeStr = a.created_at ? a.created_at.replace("T", " ").substring(0, 19) : "-";

      rowsHtml += `
        <tr id="alert-row-${a.alert_id}">
          <td class="mono font-bold">#${a.alert_id}</td>
          <td><span class="badge ${badgeClass}">${a.alert_type}</span></td>
          <td class="mono" style="font-size: 11px;">
            S#${a.sighting_id_a}${a.sighting_id_b ? ` &rarr; S#${a.sighting_id_b}` : ""}
          </td>
          <td style="font-size: 12px; white-space: normal; line-height: 1.4;">${this._escapeHtml(a.detail_text)}</td>
          <td class="mono text-muted" style="font-size: 11px;">${timeStr}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Alert ID</th>
              <th>Category</th>
              <th>Sightings</th>
              <th>Forensic Detail / Cause</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  /**
   * Strictly role-gates the Audit Log:
   * When role is 'operator', completely unmounts the element from the DOM.
   * When role is 'supervisor', renders the card and fetches audit logs.
   */
  async syncAuditLogSection() {
    const mountPoint = document.getElementById("audit-log-mount-point");
    if (!mountPoint) return;

    const isSupervisor = (window.appState && window.appState.role === "supervisor");

    if (!isSupervisor) {
      // Completely empty the container from the DOM
      mountPoint.innerHTML = "";
      return;
    }

    // Mount Supervisor Audit Log Card
    mountPoint.innerHTML = `
      <div class="card" style="margin-top: 20px;">
        <div class="card-title">
          <span>Supervisor Audit Log // Append-Only Forensic History</span>
          <span class="badge badge-primary">SUPERVISOR CLEARANCE</span>
        </div>
        <div id="audit-table-container">
          <div class="state-box state-loading">Loading operator query logs...</div>
        </div>
      </div>
    `;

    const auditContainer = document.getElementById("audit-table-container");
    try {
      const logs = await window.dataSource.getAuditLog();
      window.appRouter.hideOfflineBanner();
      
      if (!logs || logs.length === 0) {
        auditContainer.innerHTML = '<div class="state-box">No query audit records recorded yet.</div>';
        return;
      }

      let rows = "";
      logs.forEach(l => {
        const timeStr = l.searched_at ? l.searched_at.replace("T", " ").substring(0, 19) : "-";
        rows += `
          <tr>
            <td class="mono font-bold">#${l.log_id}</td>
            <td class="mono"><span class="badge ${l.searched_by === 'supervisor' ? 'badge-primary' : 'badge-muted'}">${l.searched_by}</span></td>
            <td class="mono">${this._escapeHtml(l.searched_query)}</td>
            <td class="mono text-muted" style="font-size: 11px;">${timeStr}</td>
          </tr>
        `;
      });

      auditContainer.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Operator Role</th>
                <th>Query Interrogated</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      window.appRouter.showOfflineBanner();
      auditContainer.innerHTML = '<div class="state-box text-critical">Unable to load audit log from backend.</div>';
    }
  }

  highlightAlert(alertId) {
    const row = document.getElementById(`alert-row-${alertId}`);
    if (row) {
      row.classList.add("highlighted");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => row.classList.remove("highlighted"), 3000);
    }
  }

  _escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }
}

window.alertsView = new AlertsView();
