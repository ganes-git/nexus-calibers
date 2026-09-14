/**
 * View 4: Incident Alerts — with severity tiers, ACK workflow, and audit log.
 * Severity mapping:
 *   CRITICAL: clone, blacklist
 *   HIGH:     impossible_transit, convoy
 *   MEDIUM:   zone_deviation, route_anomaly
 */

class AlertsView {
  constructor() {
    this.alertsData = [];
    this.currentFilter = 'all';
    this.severityFilter = 'all';
    this.showUnackedOnly = false;
  }

  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>Active Incident Alerts</span>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="btn-secondary" style="font-size: 11px; padding: 4px 8px;"
              onclick="window.open('/api/export/csv?dataset=alerts', '_blank')" title="Export forensic incident audit CSV">📥 Export CSV</button>
            <button class="btn-secondary" style="font-size: 11px; padding: 4px 8px;"
              onclick="window.AlertsView.testAudio()" title="Test audio alarm alert">🔊 Test Audio</button>
            <button class="btn-secondary" style="font-size: 11px; padding: 4px 8px;"
              onclick="window.AlertsView.acknowledgeAllFiltered()" title="Acknowledge all filtered unacked alerts">⚡ Ack Filtered</button>
            <button class="btn-secondary" style="font-size: 11px; padding: 4px 8px;"
              onclick="window.AlertsView.rescanAlerts()">Re-Scan Engine</button>
            <button class="btn-action" style="font-size: 11px; padding: 4px 10px;"
              onclick="window.AlertsView.loadAlerts()">Refresh</button>
          </div>
        </div>

        <!-- Severity Filter Strip -->
        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap;">
          <span class="mono text-muted" style="font-size: 11px; font-weight: 700;">SEVERITY:</span>
          <button class="filter-btn active" id="sev-all" onclick="window.AlertsView.setSeverityFilter('all', this)">All Severities</button>
          <button class="filter-btn" id="sev-crit" onclick="window.AlertsView.setSeverityFilter('CRITICAL', this)" style="border-color: var(--accent-critical);">🚨 Critical</button>
          <button class="filter-btn" id="sev-high" onclick="window.AlertsView.setSeverityFilter('HIGH', this)" style="border-color: var(--accent-warning);">⚠️ High</button>
          <button class="filter-btn" id="sev-med" onclick="window.AlertsView.setSeverityFilter('MEDIUM', this)">ℹ️ Medium</button>
        </div>

        <!-- Filter Row -->
        <div class="filter-row" id="alert-filters">
          <span class="filter-label">Type:</span>
          <button class="filter-btn active" onclick="window.AlertsView.setFilter('all', this)">All Types</button>
          <button class="filter-btn" onclick="window.AlertsView.setFilter('clone', this)">Clone</button>
          <button class="filter-btn" onclick="window.AlertsView.setFilter('impossible_transit', this)">Impossible Transit</button>
          <button class="filter-btn" onclick="window.AlertsView.setFilter('blacklist', this)">Blacklist Hit</button>
          <button class="filter-btn" onclick="window.AlertsView.setFilter('zone_deviation', this)">Zone Deviation</button>
          <button class="filter-btn" onclick="window.AlertsView.setFilter('route_anomaly', this)">Route Anomaly</button>
          <button class="filter-btn" onclick="window.AlertsView.setFilter('convoy', this)">Convoy</button>
          <span style="margin-left: auto;">
            <label class="filter-label" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="checkbox" id="ack-filter-chk" onchange="window.AlertsView.toggleAckFilter(this.checked)" />
              Unacknowledged only
            </label>
          </span>
        </div>

        <div id="alerts-table-container">
          <div class="state-box state-loading">Fetching incident alerts...</div>
        </div>
      </div>

      <!-- Supervisor-only Audit Log -->
      <div id="audit-log-mount-point"></div>
    `;

    this.loadAlerts();
    this.syncAuditLogSection();
  }

  setFilter(type, btn) {
    this.currentFilter = type;
    document.querySelectorAll('#alert-filters .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderAlertsTable();
  }

  setSeverityFilter(sev, btn) {
    this.severityFilter = sev;
    document.querySelectorAll('[id^="sev-"]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderAlertsTable();
  }

  toggleAckFilter(checked) {
    this.showUnackedOnly = checked;
    this._renderAlertsTable();
  }

  testAudio() {
    if (window.AudioAlert) {
      window.AudioAlert.beep('critical');
      if (window.ToastManager) window.ToastManager.show('AUDIO TEST', 'Alert sound triggered at full volume', 'warning');
    }
  }

  trackVehicleFromAlert(plateText) {
    if (!plateText) return;
    if (window.App) {
      window.App.navigateTo('trajectory');
      setTimeout(() => {
        const inp = document.getElementById('plate-query-input');
        if (inp) {
          inp.value = plateText;
          inp.dispatchEvent(new Event('input'));
        }
        document.getElementById('btn-search-plate')?.click();
      }, 120);
    }
  }

  async acknowledgeAllFiltered() {
    const unacked = this.alertsData.filter(a => {
      const matchType = this.currentFilter === 'all' || a.alert_type === this.currentFilter;
      const matchSev = this.severityFilter === 'all' || (a.severity || 'MEDIUM').toUpperCase() === this.severityFilter;
      return matchType && matchSev && !a.acknowledged;
    });

    if (unacked.length === 0) {
      if (window.ToastManager) window.ToastManager.show('NO ALERTS', 'No unacknowledged alerts matching current filter', 'info');
      return;
    }

    const badgeId = window.App ? window.App.getShiftBadgeId() : 'operator';
    for (const a of unacked) {
      try {
        await DataSource.patch(`/api/alerts/${a.alert_id}/acknowledge?acknowledged_by=${encodeURIComponent(badgeId)}`);
        a.acknowledged = 1;
        a.acknowledged_by = badgeId;
      } catch { /* proceed */ }
    }
    this._renderAlertsTable();
    if (window.App) window.App.refreshKPIs();
    if (window.ToastManager) window.ToastManager.show('BATCH ACK', `Acknowledged ${unacked.length} alerts`, 'info');
  }

  async rescanAlerts() {
    const tc = document.getElementById('alerts-table-container');
    if (tc) tc.innerHTML = '<div class="state-box state-loading">Executing city-wide alert scan across all sighting pairs...</div>';
    try {
      await DataSource.post('/api/alerts/scan');
      await this.loadAlerts();
      if (window.App) window.App.refreshKPIs();
    } catch { this._showOffline(tc); }
  }

  async loadAlerts() {
    const tc = document.getElementById('alerts-table-container');
    if (tc) tc.innerHTML = '<div class="state-box state-loading">Loading alerts...</div>';
    try {
      const data = await DataSource.get('/api/alerts');
      this.alertsData = data || [];
      this._renderAlertsTable();
      document.getElementById('offline-banner').classList.remove('visible');
    } catch {
      this._showOffline(tc);
    }
  }

  async acknowledgeAlert(alertId, btn) {
    const badgeId = window.App ? window.App.getShiftBadgeId() : 'operator';
    try {
      btn.disabled = true;
      btn.textContent = '...';
      await DataSource.patch(`/api/alerts/${alertId}/acknowledge?acknowledged_by=${encodeURIComponent(badgeId)}`);
      // Update local state
      const alert = this.alertsData.find(a => a.alert_id === alertId);
      if (alert) { alert.acknowledged = 1; alert.acknowledged_by = badgeId; }
      const row = document.getElementById(`alert-row-${alertId}`);
      if (row) {
        row.classList.add('is-acked');
        btn.textContent = '✓ ACKED';
        btn.classList.add('is-acked');
      }
      if (window.App) window.App.refreshKPIs();
    } catch {
      btn.disabled = false;
      btn.textContent = 'ACK';
    }
  }

  _extractPlate(text) {
    if (!text) return null;
    const match = text.match(/[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2}/);
    return match ? match[0] : null;
  }

  _renderAlertsTable() {
    const container = document.getElementById('alerts-table-container');
    if (!container) return;

    let filtered = this.alertsData;
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(a => a.alert_type === this.currentFilter);
    }
    if (this.severityFilter !== 'all') {
      filtered = filtered.filter(a => (a.severity || 'MEDIUM').toUpperCase() === this.severityFilter);
    }
    if (this.showUnackedOnly) {
      filtered = filtered.filter(a => !a.acknowledged);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="state-box">No alerts found matching the current filters.</div>';
      return;
    }

    let rowsHtml = '';
    filtered.forEach(a => {
      const sev = (a.severity || 'MEDIUM').toUpperCase();
      const badgeClass = sev === 'CRITICAL' ? 'badge-critical' : (sev === 'HIGH' ? 'badge-warning' : 'badge-medium');
      const isAcked = !!a.acknowledged;
      const timeStr = a.created_at ? a.created_at.replace('T', ' ').substring(0, 19) : '—';
      const extractedPlate = this._extractPlate(a.detail_text);
      
      const trackBtn = extractedPlate
        ? `<button class="btn-secondary" style="font-size: 10px; padding: 2px 6px; font-family: var(--font-mono); margin-left: 6px;"
            onclick="event.stopPropagation(); window.AlertsView.trackVehicleFromAlert('${extractedPlate}')" title="Reconstruct trajectory for ${extractedPlate}">🛰️ TRACK</button>`
        : '';

      const ackLabel = isAcked
        ? `<span class="btn-ack is-acked">✓ ${this._escape(a.acknowledged_by || 'ACKED')}</span>`
        : `<button class="btn-ack" onclick="window.AlertsView.acknowledgeAlert(${a.alert_id}, this)">ACK</button>`;

      rowsHtml += `
        <tr id="alert-row-${a.alert_id}" class="${isAcked ? 'is-acked' : ''}">
          <td class="mono">#${a.alert_id}</td>
          <td><span class="badge ${badgeClass}">${sev}</span></td>
          <td><span class="badge badge-muted" style="font-size:10px;">${a.alert_type.replace('_', ' ')}</span></td>
          <td class="mono" style="font-size: 11px;">
            S#${a.sighting_id_a}${a.sighting_id_b ? ` &rarr; S#${a.sighting_id_b}` : ''}
          </td>
          <td class="expandable-row" onclick="window.AlertsView.toggleDetail(${a.alert_id})"
              style="font-size: 12px; white-space: normal; line-height: 1.4; max-width: 380px; cursor: pointer;">
            ${this._escape(a.detail_text.substring(0, 120))}${a.detail_text.length > 120 ? '… <span class="text-muted">[expand]</span>' : ''}
            ${trackBtn}
          </td>
          <td class="mono text-muted" style="font-size: 11px;">${timeStr}</td>
          <td>${ackLabel}</td>
        </tr>
        <tr id="alert-detail-${a.alert_id}" style="display:none;">
          <td colspan="7">
            <div class="reason-detail">
              ${this._escape(a.detail_text)}
              ${extractedPlate ? `<div style="margin-top: 8px;"><button class="btn-action" style="font-size: 11px; padding: 4px 10px;" onclick="window.AlertsView.trackVehicleFromAlert('${extractedPlate}')">🛰️ Reconstruct Full Trajectory for ${extractedPlate}</button></div>` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Alert ID</th>
              <th>Severity</th>
              <th>Type</th>
              <th>Sightings</th>
              <th>Forensic Detail</th>
              <th>Timestamp</th>
              <th>Ack</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  toggleDetail(alertId) {
    const el = document.getElementById(`alert-detail-${alertId}`);
    if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
  }

  async syncAuditLogSection() {
    const mountPoint = document.getElementById('audit-log-mount-point');
    if (!mountPoint) return;
    const role = document.getElementById('role-selector')?.value || 'operator';
    if (role !== 'supervisor') { mountPoint.innerHTML = ''; return; }

    mountPoint.innerHTML = `
      <div class="card" style="margin-top: 4px;">
        <div class="card-title">
          <span>Supervisor Audit Log // Append-Only Forensic History</span>
          <span class="badge badge-primary">SUPERVISOR CLEARANCE</span>
        </div>
        <div id="audit-table-container">
          <div class="state-box state-loading">Loading operator query logs...</div>
        </div>
      </div>
    `;

    const ac = document.getElementById('audit-table-container');
    try {
      const logs = await DataSource.get('/api/audit-log');
      if (!logs || logs.length === 0) {
        ac.innerHTML = '<div class="state-box">No query audit records recorded yet.</div>';
        return;
      }
      let rows = '';
      logs.forEach(l => {
        const ts = l.searched_at ? l.searched_at.replace('T', ' ').substring(0, 19) : '—';
        rows += `
          <tr>
            <td class="mono">#${l.log_id}</td>
            <td class="mono"><span class="badge ${l.searched_by === 'supervisor' ? 'badge-primary' : 'badge-muted'}">${l.searched_by}</span></td>
            <td class="mono">${this._escape(l.searched_query)}</td>
            <td class="mono text-muted" style="font-size:11px;">${ts}</td>
          </tr>`;
      });
      ac.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Log ID</th><th>Role</th><th>Query</th><th>Timestamp</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } catch {
      ac.innerHTML = '<div class="state-box text-critical">Unable to load audit log from backend.</div>';
    }
  }

  _showOffline(container) {
    document.getElementById('offline-banner').classList.add('visible');
    if (container) container.innerHTML = '<div class="state-box text-critical">Unable to reach the backend.</div>';
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

// Singleton exported to global
window.AlertsView = new AlertsView();
