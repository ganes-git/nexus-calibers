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

  // Header role selector change listener
  const headerRole = document.getElementById('role-selector');
  if (headerRole) {
    headerRole.addEventListener('change', e => {
      const role = e.target.value;
      if (currentView === 'alerts' && window.AlertsView) {
        window.AlertsView.syncAuditLogSection();
      }
      if (currentView === 'blacklist' && window.BlacklistView) {
        window.BlacklistView._renderWatchlistManagement();
      }
    });
  }
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
// Interactive Command Shortcuts & Hotkeys & Command Palette
// ──────────────────────────────────────────────────────────────
let _cmdPaletteSelectedIndex = 0;
let _cmdPaletteCurrentItems = [];

const COMMAND_ACTIONS = [
  { id: 'view_trajectory', title: 'Go to Trajectory Reconstruction', icon: '◈', meta: 'Press 1', action: () => navigateTo('trajectory') },
  { id: 'view_heatmap', title: 'Go to Sighting Heatmap & Geofences', icon: '◉', meta: 'Press 2', action: () => navigateTo('heatmap') },
  { id: 'view_blacklist', title: 'Go to Blacklist & Watchlist Verification', icon: '◧', meta: 'Press 3', action: () => navigateTo('blacklist') },
  { id: 'view_alerts', title: 'Go to Incident Alerts Triage', icon: '◬', meta: 'Press 4', action: () => navigateTo('alerts') },
  { id: 'view_trends', title: 'Go to Traffic Trends & Analytics', icon: '▦', meta: 'Press 5', action: () => navigateTo('trends') },
  { id: 'view_cameras', title: 'Go to Camera Nodes & Streams', icon: '⊡', meta: 'Press 6', action: () => navigateTo('cameras') },
  { id: 'action_rescan', title: 'Execute City-Wide Incident Alert Scan', icon: '⚡', meta: 'Run full scan', action: () => { navigateTo('alerts'); setTimeout(() => window.AlertsView?.rescanAlerts(), 100); } },
  { id: 'action_mute', title: 'Toggle Alarm Audio Beeps', icon: '🔊', meta: 'Press M', action: () => document.getElementById('btn-mute-toggle')?.click() },
  { id: 'track_normal', title: 'Track Normal Transit (TN09CB1234)', icon: '🛰️', meta: 'Quick target', action: () => { navigateTo('trajectory'); setTimeout(() => window.TrajectoryView?.searchPreset('TN09CB1234'), 100); } },
  { id: 'track_anomaly', title: 'Track Speed Anomaly (KA03MD5522)', icon: '⚠️', meta: 'Incident target', action: () => { navigateTo('trajectory'); setTimeout(() => window.TrajectoryView?.searchPreset('KA03MD5522'), 100); } },
  { id: 'track_blacklist', title: 'Track Wanted Vehicle (TN07AX4521)', icon: '🚨', meta: 'Blacklist target', action: () => { navigateTo('trajectory'); setTimeout(() => window.TrajectoryView?.searchPreset('TN07AX4521'), 100); } },
];

function toggleCommandPalette() {
  const modal = document.getElementById('cmd-palette-modal');
  if (!modal) return;
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');
  if (isOpening) {
    const input = document.getElementById('cmd-palette-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
    renderCommandPaletteResults('');
  }
}

function renderCommandPaletteResults(query) {
  const container = document.getElementById('cmd-palette-results');
  if (!container) return;
  const q = (query || '').trim().toLowerCase();

  let items = [...COMMAND_ACTIONS];
  if (q) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.meta.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );

    // If query looks like a license plate or camera ID, add instant dynamic jump actions
    if (/^[a-z0-9]{3,}$/i.test(q)) {
      const upper = q.toUpperCase();
      items.unshift({
        id: `dyn_traj_${upper}`,
        title: `Reconstruct Trajectory for "${upper}"`,
        icon: '🛰️',
        meta: 'Jump & Reconstruct',
        action: () => {
          navigateTo('trajectory');
          setTimeout(() => {
            const inp = document.getElementById('plate-query-input');
            if (inp) { inp.value = upper; inp.dispatchEvent(new Event('input')); }
            document.getElementById('btn-search-plate')?.click();
          }, 120);
        }
      });
      items.unshift({
        id: `dyn_bl_${upper}`,
        title: `Verify Blacklist Registry for "${upper}"`,
        icon: '🔍',
        meta: 'Blacklist Check',
        action: () => {
          navigateTo('blacklist');
          setTimeout(() => window.BlacklistView?.checkPlate(upper), 120);
        }
      });
    }
  }

  _cmdPaletteCurrentItems = items;
  _cmdPaletteSelectedIndex = 0;

  if (items.length === 0) {
    container.innerHTML = '<div style="padding:12px; color:var(--text-muted); text-align:center;">No matching commands, plates, or actions found.</div>';
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="cmd-palette-item ${idx === 0 ? 'selected' : ''}" data-index="${idx}" onclick="window.App.execPaletteItem(${idx})">
      <div class="item-title"><span>${item.icon}</span> <span>${item.title}</span></div>
      <div class="item-meta mono">${item.meta}</div>
    </div>
  `).join('');
}

function execPaletteItem(index) {
  const item = _cmdPaletteCurrentItems[index];
  if (item && item.action) {
    toggleCommandPalette();
    item.action();
  }
}

function toggleShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) modal.classList.toggle('hidden');
}

function closeAllModals() {
  document.getElementById('cmd-palette-modal')?.classList.add('hidden');
  document.getElementById('shortcuts-modal')?.classList.add('hidden');
  document.getElementById('cam-hud-modal')?.classList.add('hidden');
}

function initKeyboardShortcuts() {
  const palInput = document.getElementById('cmd-palette-input');
  if (palInput) {
    palInput.addEventListener('input', e => {
      renderCommandPaletteResults(e.target.value);
    });
    palInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (_cmdPaletteCurrentItems.length > 0) {
          _cmdPaletteSelectedIndex = (_cmdPaletteSelectedIndex + 1) % _cmdPaletteCurrentItems.length;
          updatePaletteSelectionVisual();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (_cmdPaletteCurrentItems.length > 0) {
          _cmdPaletteSelectedIndex = (_cmdPaletteSelectedIndex - 1 + _cmdPaletteCurrentItems.length) % _cmdPaletteCurrentItems.length;
          updatePaletteSelectionVisual();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        execPaletteItem(_cmdPaletteSelectedIndex);
      } else if (e.key === 'Escape') {
        closeAllModals();
      }
    });
  }

  window.addEventListener('keydown', e => {
    // Ctrl+K or Cmd+K opens Command Palette anywhere
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }

    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key === 'Escape') {
        e.target.blur();
        closeAllModals();
      }
      return;
    }

    if (e.key === '1') navigateTo('trajectory');
    else if (e.key === '2') navigateTo('heatmap');
    else if (e.key === '3') navigateTo('blacklist');
    else if (e.key === '4') navigateTo('alerts');
    else if (e.key === '5') navigateTo('trends');
    else if (e.key === '6') navigateTo('cameras');
    else if (e.key === '/') {
      e.preventDefault();
      toggleCommandPalette();
    }
    else if (e.key === 'm' || e.key === 'M') {
      document.getElementById('btn-mute-toggle')?.click();
    }
    else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
      toggleShortcutsModal();
    }
    else if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

function updatePaletteSelectionVisual() {
  const items = document.querySelectorAll('#cmd-palette-results .cmd-palette-item');
  items.forEach((el, idx) => {
    el.classList.toggle('selected', idx === _cmdPaletteSelectedIndex);
    if (idx === _cmdPaletteSelectedIndex) {
      el.scrollIntoView({ block: 'nearest' });
    }
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
  toggleShortcutsModal,
  toggleCommandPalette,
  execPaletteItem,
  navigateTo,
};

// ──────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initMuteButton();
  initShiftModal();
  initKeyboardShortcuts();
  RecentSearches.render();

  // Handle hash-based routing on initial load
  const hash = window.location.hash.replace('#', '') || 'trajectory';
  if (VIEW_TITLES[hash]) {
    currentView = hash;
  }

  navigateTo(currentView);
});
