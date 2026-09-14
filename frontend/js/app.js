/**
 * app.js — Main Application Controller
 * Handles routing, shift session, KPI polling, live ticker,
 * alert badge count, and recent-search history.
 */

// ──────────────────────────────────────────────────────────────
// Shift Session State
// ──────────────────────────────────────────────────────────────
const ShiftSession = (() => {
  let _badgeId = null;
  let _role = 'operator';

  function start(badgeId, role) {
    _badgeId = badgeId.trim();
    _role = role;
    sessionStorage.setItem('shift_badge', _badgeId);
    sessionStorage.setItem('shift_role', _role);
  }

  function getBadgeId() {
    return _badgeId || sessionStorage.getItem('shift_badge') || 'UNSET';
  }

  function getRole() {
    return _role || sessionStorage.getItem('shift_role') || 'operator';
  }

  function isActive() {
    return !!(getBadgeId() && getBadgeId() !== 'UNSET');
  }

  return { start, getBadgeId, getRole, isActive };
})();

// ──────────────────────────────────────────────────────────────
// Recent Plate Search History
// ──────────────────────────────────────────────────────────────
const RecentSearches = (() => {
  const MAX = 5;
  const KEY = 'anpr_recent_searches';

  function getAll() {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function push(plate) {
    if (!plate) return;
    const existing = getAll().filter(p => p !== plate.toUpperCase());
    const updated = [plate.toUpperCase(), ...existing].slice(0, MAX);
    sessionStorage.setItem(KEY, JSON.stringify(updated));
    render();
  }

  function render() {
    const section = document.getElementById('recent-searches-section');
    const list = document.getElementById('recent-searches-list');
    if (!list) return;
    const items = getAll();
    if (items.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    list.innerHTML = items.map(plate =>
      `<div class="recent-search-item" data-plate="${plate}">${plate}</div>`
    ).join('');
    list.querySelectorAll('.recent-search-item').forEach(el => {
      el.addEventListener('click', () => {
        navigateTo('trajectory');
        // Give the view time to render, then fill in the search input
        setTimeout(() => {
          const inp = document.getElementById('plate-query-input');
          if (inp) {
            inp.value = el.dataset.plate;
            inp.dispatchEvent(new Event('input'));
          }
          const btn = document.getElementById('btn-search-plate');
          if (btn) btn.click();
        }, 120);
      });
    });
  }

  return { push, render };
})();

// ──────────────────────────────────────────────────────────────
// App State
// ──────────────────────────────────────────────────────────────
let currentView = 'trajectory';
let lastSeenAlertId = 0;
let _kpiInterval = null;
let _tickerInterval = null;
let _unackedPollInterval = null;

const VIEW_TITLES = {
  trajectory: 'Trajectory Reconstruction',
  heatmap:    'Sighting Heatmap',
  blacklist:  'Blacklist & Watchlist',
  alerts:     'Incident Alerts',
  trends:     'Traffic Trends & Analytics',
  cameras:    'Camera Health Monitor',
};

// ──────────────────────────────────────────────────────────────
// Routing
// ──────────────────────────────────────────────────────────────
function navigateTo(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  currentView = viewName;

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === viewName);
  });

  document.getElementById('current-view-heading').textContent = VIEW_TITLES[viewName];

  const container = document.getElementById('view-container');
  // Inject or show the correct panel
  switch (viewName) {
    case 'trajectory': window.TrajectoryView.render(container); break;
    case 'heatmap':    window.HeatmapView.render(container);    break;
    case 'blacklist':  window.BlacklistView.render(container);  break;
    case 'alerts':     window.AlertsView.render(container);     break;
    case 'trends':     window.TrendsView.render(container);     break;
    case 'cameras':    window.CamerasView.render(container);    break;
  }
}

// ──────────────────────────────────────────────────────────────
// KPI Strip
// ──────────────────────────────────────────────────────────────
async function refreshKPIs() {
  try {
    const data = await DataSource.get('/api/stats/summary');
    document.getElementById('kpi-sightings-val').textContent = data.sightings_today ?? '—';
    document.getElementById('kpi-alerts-val').textContent = data.active_alerts ?? '—';
    document.getElementById('kpi-cameras-val').textContent =
      `${data.cameras_online ?? '—'}/${data.cameras_total ?? '—'}`;
    document.getElementById('kpi-blacklist-val').textContent = data.blacklist_seen_today ?? '—';

    // Sidebar badge
    const badge = document.getElementById('alert-badge');
    const count = data.active_alerts || 0;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch {
    // silently ignore
  }
}

// ──────────────────────────────────────────────────────────────
// Live Ticker
// ──────────────────────────────────────────────────────────────
async function refreshTicker() {
  try {
    const sightings = await DataSource.get('/api/sightings/recent?limit=6');
    const list = document.getElementById('ticker-items');
    if (!list) return;
    if (!sightings || sightings.length === 0) {
      list.innerHTML = '<div class="ticker-item"><span class="ticker-meta text-muted">No recent sightings</span></div>';
      return;
    }
    list.innerHTML = sightings.map(s => {
      const ts = s.timestamp ? s.timestamp.slice(11, 19) : '—';
      return `
        <div class="ticker-item">
          <div class="ticker-plate">${s.plate_text || '—'}</div>
          <div class="ticker-meta">${s.camera_id} &bull; ${ts}</div>
        </div>`;
    }).join('');
  } catch {
    // silently ignore
  }
}

// ──────────────────────────────────────────────────────────────
// Unacknowledged Alert Polling (for toast + badge)
// ──────────────────────────────────────────────────────────────
async function pollForNewAlerts() {
  try {
    const alerts = await DataSource.get(`/api/alerts/unseen?since_id=${lastSeenAlertId}`);
    if (!alerts || alerts.length === 0) return;

    for (const alert of alerts) {
      const isCritical = (alert.severity || '').toUpperCase() === 'CRITICAL';
      ToastManager.show(
        alert.alert_type.toUpperCase(),
        alert.detail_text,
        isCritical ? 'critical' : 'warning'
      );
      if (!AudioAlert.isMuted()) {
        AudioAlert.beep(isCritical ? 'critical' : 'warning');
      }
    }

    lastSeenAlertId = alerts[alerts.length - 1].alert_id;
    refreshKPIs(); // refresh badge immediately
  } catch {
    // silently ignore
  }
}

// ──────────────────────────────────────────────────────────────
// System Status Check
// ──────────────────────────────────────────────────────────────
async function checkSystemStatus() {
  try {
    await DataSource.get('/api/health');
    document.getElementById('offline-banner').classList.remove('visible');
    document.getElementById('status-dot').classList.remove('offline');
    document.getElementById('status-label').textContent = 'LIVE ENGINE';
  } catch {
    document.getElementById('offline-banner').classList.add('visible');
    document.getElementById('status-dot').classList.add('offline');
    document.getElementById('status-label').textContent = 'DISCONNECTED';
  }
}

// ──────────────────────────────────────────────────────────────
// Role Selector
// ──────────────────────────────────────────────────────────────
function getCurrentRole() {
  return document.getElementById('role-selector')?.value || 'operator';
}

// ──────────────────────────────────────────────────────────────
// Shift Login Modal
// ──────────────────────────────────────────────────────────────
function initShiftModal() {
  const modal = document.getElementById('shift-modal');
  const badgeInput = document.getElementById('badge-input');
  const badgeError = document.getElementById('badge-error');
  const roleSelect = document.getElementById('shift-role-select');
  const btnStart = document.getElementById('btn-start-shift');

  btnStart.addEventListener('click', () => {
    const badgeId = badgeInput.value.trim();
    if (!badgeId) {
      badgeError.style.display = 'block';
      badgeInput.focus();
      return;
    }
    badgeError.style.display = 'none';

    const role = roleSelect.value;
    ShiftSession.start(badgeId, role);

    // Sync role selector in header
    const headerRole = document.getElementById('role-selector');
    if (headerRole) headerRole.value = role;

    // Update shift indicator
    document.getElementById('shift-indicator').style.display = 'flex';
    document.getElementById('shift-label-text').textContent = `${badgeId} · ${role.toUpperCase()}`;
    document.getElementById('session-badge-label').textContent = `${badgeId} [${role}]`;

    // Hide modal
    modal.classList.add('hidden');

    // Start background tasks
    startBackgroundPolling();
  });

  // Enter key submits
  badgeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnStart.click();
  });
}

// ──────────────────────────────────────────────────────────────
// Background Polling
// ──────────────────────────────────────────────────────────────
function startBackgroundPolling() {
  checkSystemStatus();
  refreshKPIs();
  refreshTicker();

  _kpiInterval = setInterval(refreshKPIs, 30000);          // KPI every 30s
  _tickerInterval = setInterval(refreshTicker, 8000);      // Ticker every 8s
  _unackedPollInterval = setInterval(pollForNewAlerts, 20000); // Alerts every 20s
  setInterval(checkSystemStatus, 60000);                   // Health every 60s
}

// ──────────────────────────────────────────────────────────────
// Nav Link Click Handlers
// ──────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.view);
    });
  });
}

// ──────────────────────────────────────────────────────────────
// Mute Button
// ──────────────────────────────────────────────────────────────
function initMuteButton() {
  const btn = document.getElementById('btn-mute-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const muted = AudioAlert.toggleMute();
    btn.textContent = muted ? '[AUDIO: OFF]' : '[AUDIO: ON]';
    btn.classList.toggle('is-muted', muted);
  });
}

// ──────────────────────────────────────────────────────────────
// Exports — used by views
// ──────────────────────────────────────────────────────────────
window.App = {
  getCurrentRole,
  getShiftBadgeId: () => ShiftSession.getBadgeId(),
  pushRecentSearch: (plate) => RecentSearches.push(plate),
  refreshKPIs,
};

// ──────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initMuteButton();
  initShiftModal();
  RecentSearches.render();

  // Handle hash-based routing on initial load
  const hash = window.location.hash.replace('#', '') || 'trajectory';
  if (VIEW_TITLES[hash]) {
    currentView = hash;
  }

  navigateTo(currentView);
});
