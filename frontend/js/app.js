/**
 * Main Application Router and Global Controller.
 * Coordinates navigation, role toggling, and global status.
 */

window.appState = {
  currentView: "trajectory",
  role: localStorage.getItem("anpr_role") || "operator"
};

class AppRouter {
  constructor() {
    this.viewContainer = null;
    this.headingEl = null;
    this.bannerEl = null;
  }

  init() {
    this.viewContainer = document.getElementById("view-container");
    this.headingEl = document.getElementById("current-view-heading");
    this.bannerEl = document.getElementById("offline-banner");

    // Initialize role selector
    const roleSelect = document.getElementById("role-selector");
    if (roleSelect) {
      roleSelect.value = window.appState.role;
      roleSelect.addEventListener("change", (e) => {
        this.setRole(e.target.value);
      });
    }

    // Initialize audio mute button
    this.updateMuteButtonUI();
    const muteBtn = document.getElementById("btn-mute-toggle");
    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        const isMuted = window.audioAlertManager.toggleMute();
        this.updateMuteButtonUI();
      });
    }

    // Nav click handlers
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const viewId = link.dataset.view;
        if (viewId) this.navigateTo(viewId);
      });
    });

    // Start toast manager
    if (window.toastManager) {
      window.toastManager.init();
    }

    // Initial route
    this.navigateTo(window.appState.currentView);
  }

  setRole(newRole) {
    window.appState.role = newRole;
    localStorage.setItem("anpr_role", newRole);
    console.log(`[AppRouter] Switched role to: ${newRole}`);

    // If currently on Alerts view, re-sync Audit Log
    if (window.appState.currentView === "alerts" && window.alertsView) {
      window.alertsView.syncAuditLogSection();
    }
  }

  updateMuteButtonUI() {
    const muteBtn = document.getElementById("btn-mute-toggle");
    if (!muteBtn || !window.audioAlertManager) return;
    const isMuted = window.audioAlertManager.isMuted;
    if (isMuted) {
      muteBtn.classList.add("is-muted");
      muteBtn.textContent = "[AUDIO: MUTED]";
    } else {
      muteBtn.classList.remove("is-muted");
      muteBtn.textContent = "[AUDIO: ON]";
    }
  }

  showOfflineBanner() {
    if (this.bannerEl) this.bannerEl.classList.add("visible");
  }

  hideOfflineBanner() {
    if (this.bannerEl) this.bannerEl.classList.remove("visible");
  }

  navigateTo(viewId, params = {}) {
    window.appState.currentView = viewId;

    // Update nav links
    document.querySelectorAll(".nav-link").forEach(l => {
      l.classList.toggle("active", l.dataset.view === viewId);
    });

    // Update view container
    if (!this.viewContainer) return;
    this.viewContainer.innerHTML = "";

    const headings = {
      trajectory: "Trajectory Reconstruction & Forensic Evidence",
      heatmap: "City-Wide Sighting Density & Geofence Heatmap",
      blacklist: "Enforcement Blacklist Verification",
      alerts: "Central Incident Command & Audit Oversight",
      trends: "Macro Traffic Trends & Corridor Baselines"
    };

    if (this.headingEl) {
      this.headingEl.textContent = headings[viewId] || "ANPR Operations Console";
    }

    switch (viewId) {
      case "trajectory":
        window.trajectoryView.render(this.viewContainer);
        break;
      case "heatmap":
        window.heatmapView.render(this.viewContainer);
        break;
      case "blacklist":
        window.blacklistView.render(this.viewContainer);
        break;
      case "alerts":
        window.alertsView.render(this.viewContainer);
        if (params.highlightAlertId) {
          setTimeout(() => window.alertsView.highlightAlert(params.highlightAlertId), 300);
        }
        break;
      case "trends":
        window.trendsView.render(this.viewContainer);
        break;
      default:
        window.trajectoryView.render(this.viewContainer);
    }
  }
}

window.appRouter = new AppRouter();

document.addEventListener("DOMContentLoaded", () => {
  window.appRouter.init();
});
