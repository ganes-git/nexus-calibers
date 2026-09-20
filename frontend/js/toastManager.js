/**
 * Global Alert Toast & Tactical Floating Notification Manager.
 * Operates across all views.
 * Listens for unseen alerts and triggers multi-shade audio alarms and floating HUDs.
 */

class ToastManager {
  constructor() {
    this.container = null;
    this.lastSeenAlertId = 0;
    this.shownAlertIds = new Set();
    this.pollInterval = null;
    this._activeFloatingAlert = null;
  }

  init() {
    this.container = document.getElementById("toast-container");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "toast-container";
      document.body.appendChild(this.container);
    }
    this.startPolling();
  }

  startPolling(intervalMs = 4000) {
    if (this.pollInterval) clearInterval(this.pollInterval);
    
    // Initial fetch to prime lastSeenAlertId without triggering flood of sounds for old alerts
    this._primeInitialAlerts().then(() => {
      this.pollInterval = setInterval(() => this.checkUnseenAlerts(), intervalMs);
    });
  }

  async _primeInitialAlerts() {
    try {
      if (window.dataSource && window.dataSource.staticMode) return;
      const alerts = await DataSource.get('/api/alerts');
      if (Array.isArray(alerts) && alerts.length > 0) {
        for (const a of alerts) {
          if (a.alert_id > this.lastSeenAlertId) {
            this.lastSeenAlertId = a.alert_id;
          }
          this.shownAlertIds.add(a.alert_id);
        }
      }
    } catch (e) {
      // Ignored during init
    }
  }

  async checkUnseenAlerts() {
    if (window.dataSource && window.dataSource.staticMode) return;
    try {
      const newAlerts = await DataSource.get(`/api/alerts?unseen_since=${this.lastSeenAlertId}`);
      if (Array.isArray(newAlerts) && newAlerts.length > 0) {
        for (const alert of newAlerts) {
          if (!this.shownAlertIds.has(alert.alert_id)) {
            this.shownAlertIds.add(alert.alert_id);
            if (alert.alert_id > this.lastSeenAlertId) {
              this.lastSeenAlertId = alert.alert_id;
            }
            this.showAlert(alert);
          }
        }
      }
    } catch (e) {
      // Network failure handled by offline banner
    }
  }

  showAlert(alert) {
    const isCritical = (alert.alert_type === "blacklist" || alert.alert_type === "clone" || alert.severity === "critical" || alert.severity === "high");
    
    // 1. Play tone scaled to alert level
    if (window.audioAlertManager) {
      window.audioAlertManager.playAlertTone(isCritical ? 'critical' : 'warning');
    }

    // 2. If it's a serious/critical alert, pop the Floating Tactical Alert HUD
    if (isCritical) {
      this.showFloatingSeriousAlert(alert);
    }

    // 3. Always show in standard stacking toasts
    this.showToast(alert);
  }

  /**
   * High-Urgency Floating Tactical HUD Banner for Critical Alerts
   */
  showFloatingSeriousAlert(alert) {
    // Remove previous floating alert if any
    const existing = document.getElementById('floating-serious-alert');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'floating-serious-alert';
    banner.className = 'floating-alert-hud';
    banner.setAttribute('role', 'alertdialog');

    const plate = alert.plate_text || alert.detail_text.match(/[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}/)?.[0] || 'CRITICAL TARGET';
    const alertType = (alert.alert_type || 'INCIDENT').toUpperCase();

    banner.innerHTML = `
      <div class="floating-alert-inner">
        <div class="floating-alert-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="pulsing-siren-dot"></span>
            <strong style="font-size:13px; letter-spacing:0.05em; font-family:var(--font-mono); color:#FFF;">
              🚨 HIGH PRIORITY INTERCEPT // ${alertType}
            </strong>
          </div>
          <button type="button" class="btn-player" style="padding:2px 8px; font-size:12px; background:transparent; border:none; color:#AAA;"
            onclick="document.getElementById('floating-serious-alert')?.remove()">✕</button>
        </div>

        <div class="floating-alert-content">
          <div style="font-size:16px; font-weight:800; font-family:var(--font-mono); color:#FFD1D3; margin-bottom:4px;">
            TARGET: <span style="color:#FFF; background:#7A1417; padding:2px 8px; border-radius:3px;">${plate}</span>
          </div>
          <div style="font-size:12px; line-height:1.5; color:#F5EBEB;">
            ${this._escapeHtml(alert.detail_text)}
          </div>
        </div>

        <div class="floating-alert-actions">
          <button type="button" class="btn-action" style="padding:6px 14px; font-size:11px; background:#B3262A; border-color:#FF6B6B; font-weight:700;"
            onclick="window.ToastManager.trackAlertOnMap('${plate}', ${alert.alert_id})">
            🎯 Track On Map
          </button>
          <button type="button" class="btn-secondary btn-sm" style="padding:6px 12px; font-size:11px; color:#FFF; border-color:#7A1417;"
            onclick="window.audioAlertManager?.playAlertTone('critical')">
            🔊 Replay Siren
          </button>
          <button type="button" class="btn-secondary btn-sm" style="padding:6px 12px; font-size:11px;"
            onclick="document.getElementById('floating-serious-alert')?.remove()">
            Acknowledge
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Auto-dismiss after 12 seconds if not interacted
    setTimeout(() => {
      if (banner && banner.parentNode) banner.remove();
    }, 12000);
  }

  trackAlertOnMap(plate, alertId) {
    const existing = document.getElementById('floating-serious-alert');
    if (existing) existing.remove();

    if (window.App && window.App.showView) {
      window.App.showView('trajectory');
      setTimeout(() => {
        if (window.TrajectoryView) {
          window.TrajectoryView.searchPreset(plate);
        }
      }, 100);
    }
  }

  showToast(alert) {
    if (!this.container) {
      this.container = document.getElementById("toast-container") || document.body;
    }

    const isCritical = (alert.alert_type === "clone" || alert.alert_type === "blacklist" || alert.severity === "critical");
    const isWarning = (alert.alert_type === "speed" || alert.alert_type === "route_delay" || alert.severity === "warning");

    const toast = document.createElement("div");
    // Multi-shade class gradation
    toast.className = `toast ${isCritical ? "toast-shade-critical" : (isWarning ? "toast-shade-warning" : "toast-shade-info")}`;
    toast.setAttribute("role", "alert");
    toast.dataset.alertId = alert.alert_id;

    const timeStr = alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : "";

    toast.innerHTML = `
      <div class="toast-header">
        <div class="toast-title">
          <span class="badge ${isCritical ? "badge-critical" : "badge-warning"}">${(alert.alert_type || 'ALERT').toUpperCase()}</span>
          <span>#${alert.alert_id}</span>
        </div>
        <div style="display: flex; align-items: center; gap:6px;">
          <span class="toast-time mono">${timeStr}</span>
          <button class="toast-close" title="Dismiss">&times;</button>
        </div>
      </div>
      <div class="toast-body">${this._escapeHtml(alert.detail_text)}</div>
    `;

    // Click handler to jump to alerts view
    toast.addEventListener("click", (e) => {
      if (e.target.classList.contains("toast-close")) {
        e.stopPropagation();
        this._removeToast(toast);
        return;
      }
      if (window.App && window.App.showView) {
        window.App.showView("alerts");
      }
      this._removeToast(toast);
    });

    this.container.appendChild(toast);

    // Auto dismiss after 7 seconds
    setTimeout(() => {
      this._removeToast(toast);
    }, 7000);
  }

  _removeToast(toast) {
    if (toast && toast.parentNode) {
      toast.style.opacity = "0";
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 150);
    }
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }
}

window.ToastManager = new ToastManager();
window.toastManager = window.ToastManager;

