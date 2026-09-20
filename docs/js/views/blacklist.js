/**
 * View 3: Blacklist Interrogation + Watchlist Management.
 * Tabs: [Check Plate] | [Manage Watchlist (Supervisor only)]
 */

class BlacklistView {
  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Enforcement Blacklist Verification</div>
        <form id="blacklist-form" class="form-row">
          <input type="text" id="bl-input" class="input-text"
            placeholder="Enter license plate (e.g. TN07AX4521)" style="min-width: 280px;" required />
          <button type="submit" class="btn-action">Run Blacklist Check</button>
        </form>
        <div style="display: flex; gap: 6px; align-items: center; margin-top: 10px; flex-wrap: wrap;">
          <span class="text-muted" style="font-size: 11px;">Test cases:</span>
          <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;"
            onclick="window.BlacklistView.checkPlate('TN07AX4521')">Wanted Vehicle (TN07AX4521)</button>
          <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;"
            onclick="window.BlacklistView.checkPlate('KA01AB9999')">Impound Notice (KA01AB9999)</button>
          <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;"
            onclick="window.BlacklistView.checkPlate('TN09CB1234')">Clean Vehicle (TN09CB1234)</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Verification Outcome</div>
        <div id="blacklist-result-container">
          <div class="state-box">Enter a license plate above to query national and city-wide watchlists.</div>
        </div>
      </div>

      <!-- Watchlist Management (Supervisor only) -->
      <div id="watchlist-mgmt-mount"></div>
    `;

    document.getElementById('blacklist-form').addEventListener('submit', e => {
      e.preventDefault();
      const plate = document.getElementById('bl-input').value.trim();
      if (plate) this.executeCheck(plate);
    });

    this._renderWatchlistManagement();
  }

  checkPlate(plate) {
    const input = document.getElementById('bl-input');
    if (input) input.value = plate;
    this.executeCheck(plate);
  }

  async executeCheck(plate) {
    const container = document.getElementById('blacklist-result-container');
    container.innerHTML = '<div class="state-box state-loading">Interrogating blacklist database and registering audit log...</div>';
    const role = document.getElementById('role-selector')?.value || 'operator';
    try {
      const res = await DataSource.get(`/api/blacklist/check?plate=${encodeURIComponent(plate)}&role=${role}`);
      document.getElementById('offline-banner').classList.remove('visible');
      if (res.match && res.entry) {
        container.innerHTML = `
          <div style="border: 1px solid var(--accent-critical); border-left: 5px solid var(--accent-critical);
                      background-color: var(--accent-critical-light); padding: 16px; border-radius: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span class="badge badge-critical" style="font-size: 12px;">CRITICAL // BLACKLIST HIT</span>
              <span class="mono text-muted" style="font-size: 11px;">Added: ${res.entry.added_on}</span>
            </div>
            <div class="mono" style="font-size: 20px; font-weight: 700; color: var(--accent-critical); margin-bottom: 8px;">
              ${res.entry.plate_text}
            </div>
            <div style="font-size: 13px; color: var(--text-primary); margin-bottom: 12px;">
              <strong>Watchlist Cause on File:</strong><br/>${this._esc(res.entry.reason)}
            </div>
            <div>
              <button class="btn-action" style="font-size: 11px; padding: 5px 12px;"
                onclick="window.BlacklistView.trackPlate('${this._esc(res.entry.plate_text)}')">
                🛰️ Reconstruct 24H Trajectory for ${this._esc(res.entry.plate_text)}
              </button>
            </div>
          </div>`;
      } else {
        container.innerHTML = `
          <div style="border: 1px solid var(--border-color); background-color: var(--surface-color);
                      padding: 16px; border-radius: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge badge-primary">NO WATCHLIST MATCH</span>
                <span class="mono" style="font-weight:700;">${plate.toUpperCase()}</span>
              </div>
              <button class="btn-secondary" style="font-size: 11px; padding: 3px 8px;"
                onclick="window.BlacklistView.trackPlate('${plate.toUpperCase()}')">
                🛰️ Search Sightings
              </button>
            </div>
            <div class="text-muted" style="font-size: 13px;">
              No records found matching this registration in active crime watchlists or impound registries.
            </div>
          </div>`;
      }
    } catch {
      document.getElementById('offline-banner').classList.add('visible');
      container.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
    }
  }

  trackPlate(plate) {
    if (window.App) {
      window.App.navigateTo('trajectory');
      setTimeout(() => {
        const inp = document.getElementById('plate-query-input');
        if (inp) {
          inp.value = plate;
          inp.dispatchEvent(new Event('input'));
        }
        document.getElementById('btn-search-plate')?.click();
      }, 120);
    }
  }

  async _renderWatchlistManagement() {
    const mount = document.getElementById('watchlist-mgmt-mount');
    if (!mount) return;
    const role = document.getElementById('role-selector')?.value || 'operator';

    mount.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>Watchlist Registry</span>
          ${role === 'supervisor'
            ? '<span class="badge badge-primary">SUPERVISOR — EDIT ENABLED</span>'
            : '<span class="badge badge-muted">READ-ONLY</span>'}
        </div>
        <div id="watchlist-table-container">
          <div class="state-box state-loading">Loading watchlist...</div>
        </div>
        ${role === 'supervisor' ? this._addForm() : ''}
      </div>
    `;

    await this._loadWatchlist(role);
  }

  _addForm() {
    return `
      <div class="watchlist-add-form">
        <div class="card-title" style="margin-bottom: 0;">Add Plate to Watchlist</div>
        <div class="form-row">
          <input type="text" id="wl-add-plate" class="input-text mono" placeholder="Plate (e.g. MH04AZ1122)"
            style="width: 180px;" maxlength="12" />
          <input type="text" id="wl-add-reason" class="input-text" placeholder="Reason on file"
            style="flex: 1; min-width: 200px;" />
          <button class="btn-action" style="font-size: 12px;" onclick="window.BlacklistView.addPlate()">Add to Watchlist</button>
        </div>
        <div id="wl-add-status" class="mono" style="font-size: 12px; min-height: 18px;"></div>
      </div>`;
  }

  async _loadWatchlist(role) {
    const tc = document.getElementById('watchlist-table-container');
    try {
      const list = await DataSource.get('/api/blacklist');
      if (!list || list.length === 0) {
        tc.innerHTML = '<div class="state-box">No entries in the watchlist.</div>';
        return;
      }
      let rows = '';
      list.forEach(e => {
        rows += `
          <tr>
            <td class="mono" style="font-weight:700;">${this._esc(e.plate_text)}</td>
            <td style="font-size:12px; white-space:normal;">${this._esc(e.reason)}</td>
            <td class="mono text-muted" style="font-size:11px;">${e.added_on}</td>
            <td>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" style="font-size:10px; padding:2px 6px; font-family:var(--font-mono);"
                  onclick="window.BlacklistView.trackPlate('${this._esc(e.plate_text)}')">🛰️ Track</button>
                ${role === 'supervisor'
                  ? `<button class="btn-critical" onclick="window.BlacklistView.removePlate('${this._esc(e.plate_text)}')">Remove</button>`
                  : ''}
              </div>
            </td>
          </tr>`;
      });
      tc.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Plate</th><th>Reason</th><th>Added On</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } catch {
      tc.innerHTML = '<div class="state-box text-critical">Unable to load watchlist.</div>';
    }
  }

  async addPlate() {
    const plate = document.getElementById('wl-add-plate')?.value.trim().toUpperCase();
    const reason = document.getElementById('wl-add-reason')?.value.trim();
    const status = document.getElementById('wl-add-status');
    if (!plate || !reason) {
      if (status) status.textContent = '[ERROR] Both plate and reason are required.';
      return;
    }
    if (status) status.textContent = 'Adding...';
    try {
      await DataSource.post(`/api/blacklist?plate=${encodeURIComponent(plate)}&reason=${encodeURIComponent(reason)}`);
      if (status) { status.textContent = `[OK] ${plate} added to watchlist.`; status.style.color = 'var(--accent-primary)'; }
      document.getElementById('wl-add-plate').value = '';
      document.getElementById('wl-add-reason').value = '';
      await this._loadWatchlist('supervisor');
      if (window.App) window.App.refreshKPIs();
    } catch {
      if (status) { status.textContent = '[ERROR] Failed to add plate.'; status.style.color = 'var(--accent-critical)'; }
    }
  }

  async removePlate(plate) {
    if (!confirm(`Remove '${plate}' from watchlist?`)) return;
    try {
      await DataSource.delete(`/api/blacklist/${encodeURIComponent(plate)}`);
      await this._loadWatchlist('supervisor');
      if (window.App) window.App.refreshKPIs();
    } catch {
      alert('Failed to remove plate from watchlist.');
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

window.BlacklistView = new BlacklistView();
