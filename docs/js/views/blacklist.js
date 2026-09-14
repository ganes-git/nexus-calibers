/**
 * View 3: Blacklist Interrogation & Registration Check.
 * Checks a license plate against the enforcement blacklist.
 * States:
 * - Empty
 * - Loading
 * - Match: Critical accent border/text (#B3262A) with stored cause and registration date
 * - No Match: Clean, muted confirmation (deliberately not styled as an error)
 * - Error/Unreachable: Plain failure banner
 */

class BlacklistView {
  render(container) {
    container.innerHTML = `
      <div class="card" style="max-width: 680px;">
        <div class="card-title">Enforcement Blacklist Verification</div>
        <form id="blacklist-form" class="form-row">
          <input type="text" id="bl-input" class="input-text" placeholder="Enter license plate (e.g. TN07AX4521)" style="min-width: 280px;" required />
          <button type="submit" class="btn-action">Run Blacklist Check</button>
          <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px; width: 100%;">
            <span class="text-muted" style="font-size: 11px;">Test cases:</span>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.blacklistView.checkPlate('TN07AX4521')">Wanted Vehicle (TN07AX4521)</button>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.blacklistView.checkPlate('KA01AB9999')">Impound Notice (KA01AB9999)</button>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.blacklistView.checkPlate('TN09CB1234')">Clean Vehicle (TN09CB1234)</button>
          </div>
        </form>
      </div>

      <div class="card" style="max-width: 680px;">
        <div class="card-title">Verification Outcome</div>
        <div id="blacklist-result-container">
          <div class="state-box">Enter a license plate above to query national and city-wide watchlists.</div>
        </div>
      </div>
    `;

    document.getElementById("blacklist-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const plate = document.getElementById("bl-input").value.trim();
      if (plate) this.checkPlate(plate);
    });
  }

  checkPlate(plate) {
    const input = document.getElementById("bl-input");
    if (input) input.value = plate;
    this.executeCheck(plate);
  }

  async executeCheck(plate) {
    const container = document.getElementById("blacklist-result-container");
    container.innerHTML = '<div class="state-box state-loading">Interrogating blacklist database and registering audit log...</div>';

    const role = window.appState ? window.appState.role : "operator";

    try {
      const res = await window.dataSource.checkBlacklist(plate, role);
      window.appRouter.hideOfflineBanner();

      if (res.match && res.entry) {
        container.innerHTML = `
          <div style="border: 1px solid var(--accent-critical); border-left: 5px solid var(--accent-critical); background-color: #F7E6E7; padding: 16px; border-radius: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span class="badge badge-critical" style="font-size: 12px;">CRITICAL // BLACKLIST HIT</span>
              <span class="mono text-muted" style="font-size: 11px;">Added: ${res.entry.added_on}</span>
            </div>
            <div class="mono" style="font-size: 18px; font-weight: 700; color: var(--accent-critical); margin-bottom: 6px;">
              ${res.entry.plate_text}
            </div>
            <div style="font-size: 13px; color: var(--text-primary);">
              <strong>Watchlist Cause on File:</strong><br/>
              ${res.entry.reason}
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="border: 1px solid var(--border-color); background-color: var(--surface-color); padding: 16px; border-radius: 4px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span class="badge badge-primary">NO WATCHLIST MATCH</span>
              <span class="mono font-bold">${plate.toUpperCase()}</span>
            </div>
            <div class="text-muted" style="font-size: 13px;">
              No records found matching this registration in active crime watchlists or impound registries.
            </div>
          </div>
        `;
      }
    } catch (err) {
      window.appRouter.showOfflineBanner();
      container.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
    }
  }
}

window.blacklistView = new BlacklistView();
