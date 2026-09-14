/**
 * Global Alert Toast & Notification Manager.
 * Operates across all 5 views.
 * Listens for unseen alerts via short-interval polling.
 * Triggers audio alert and displays dismissible, stacking toasts.
 * Clicking toast navigates to Alerts view and highlights row.
 */

class ToastManager {
  constructor() {
    this.container = null;
    this.lastSeenAlertId = 0;
    this.shownAlertIds = new Set();
    this.pollInterval = null;
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
      if (window.dataSource.staticMode) return;
      const alerts = await window.dataSource.getAlerts();
      if (Array.isArray(alerts) && alerts.length > 0) {
        // Find max alert_id
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
    if (window.dataSource.staticMode) return;
    try {
      const newAlerts = await window.dataSource.getUnseenAlerts(this.lastSeenAlertId);
      if (Array.isArray(newAlerts) && newAlerts.length > 0) {
        for (const alert of newAlerts) {
          if (!this.shownAlertIds.has(alert.alert_id)) {
            this.shownAlertIds.add(alert.alert_id);
            if (alert.alert_id > this.lastSeenAlertId) {
              this.lastSeenAlertId = alert.alert_id;
            }
            this.showToast(alert);
          }
        }
      }
    } catch (e) {
      // Network failure handled by offline banner
    }
  }

  showToast(alert) {
    // Play single tone once
    if (window.audioAlertManager) {
      window.audioAlertManager.playAlertTone();
    }

    if (!this.container) return;

    const toast = document.createElement("div");
    const isCritical = (alert.alert_type === "clone" || alert.alert_type === "blacklist");
    toast.className = `toast ${isCritical ? "toast-critical" : "toast-warning"}`;
    toast.setAttribute("role", "alert");
    toast.dataset.alertId = alert.alert_id;

    const timeStr = alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : "";

    toast.innerHTML = `
      <div class="toast-header">
        <div class="toast-title">
          <span class="badge ${isCritical ? "badge-critical" : "badge-warning"}">${alert.alert_type}</span>
          <span>Alert #${alert.alert_id}</span>
        </div>
        <div style="display: flex; align-items: center;">
          <span class="toast-time">${timeStr}</span>
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
      if (window.appRouter) {
        window.appRouter.navigateTo("alerts", { highlightAlertId: alert.alert_id });
      }
      this._removeToast(toast);
    });

    this.container.appendChild(toast);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      this._removeToast(toast);
    }, 6000);
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

window.toastManager = new ToastManager();
