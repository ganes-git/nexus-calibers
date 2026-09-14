/**
 * View 1: Trajectory Search & Per-Hop Evidence Breakdown.
 * Implements:
 * - Chronological multi-camera Leaflet route
 * - Per-hop table with plate/visual/transit/composite scores
 * - Unconfirmed plate visual fallback indication
 * - Route anomaly badges with expandable inline evidence
 */

class TrajectoryView {
  constructor() {
    this.map = null;
    this.polyline = null;
    this.markersLayer = null;
  }

  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Trajectory Query & Forensic Reconstruction</div>
        <form id="traj-form" class="form-row">
          <input type="text" id="traj-query" class="input-text" placeholder="e.g. TN09CB1234 or sighting ID" style="min-width: 260px;" required />
          <button type="submit" class="btn-action">Search Trajectory</button>
          <div style="display: flex; gap: 6px; align-items: center; margin-left: auto;">
            <span class="text-muted" style="font-size: 11px;">Demos:</span>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;" onclick="window.trajectoryView.searchPreset('TN09CB1234')">Normal (TN09CB1234)</button>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;" onclick="window.trajectoryView.searchPreset('KA03MD5522')">Anomaly (KA03MD5522)</button>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;" onclick="window.trajectoryView.searchPreset('TN01AZ7788')">Unconfirmed Plate (TN01AZ7788)</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Spatial Path Map</span>
          <span id="traj-meta" class="mono text-muted" style="font-size: 12px;"></span>
        </div>
        <div id="traj-map" class="map-container"></div>
      </div>

      <div class="card">
        <div class="card-title">Per-Hop Identity-Fusion Evidence Trail</div>
        <div id="traj-table-container">
          <div class="state-box">Enter a license plate or sighting ID above to reconstruct trajectory.</div>
        </div>
      </div>
    `;

    document.getElementById("traj-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("traj-query").value.trim();
      if (q) this.executeSearch(q);
    });

    this._initMap();
  }

  _initMap() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    const mapEl = document.getElementById("traj-map");
    if (!mapEl || !window.L) return;

    // Anchor at Chennai Central junction cluster
    this.map = L.map("traj-map", {
      attributionControl: false
    }).setView([13.0450, 80.2450], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  searchPreset(plate) {
    const input = document.getElementById("traj-query");
    if (input) {
      input.value = plate;
      this.executeSearch(plate);
    }
  }

  async executeSearch(query) {
    const tableContainer = document.getElementById("traj-table-container");
    const metaEl = document.getElementById("traj-meta");
    tableContainer.innerHTML = '<div class="state-box state-loading">Querying sightings and calculating per-hop fusion scores...</div>';
    if (metaEl) metaEl.textContent = "";

    const role = window.appState ? window.appState.role : "operator";

    try {
      const data = await window.dataSource.getTrajectory(query, role);
      window.appRouter.hideOfflineBanner();

      if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div class="state-box">No trajectory found for this query.</div>';
        if (this.markersLayer) this.markersLayer.clearLayers();
        if (this.polyline) {
          this.map.removeLayer(this.polyline);
          this.polyline = null;
        }
        return;
      }

      this._renderMapTrajectory(data);
      this._renderTable(data, tableContainer);
      if (metaEl) {
        metaEl.textContent = `Hops: ${data.length} | First: ${data[0].timestamp.replace("T", " ")} | Last: ${data[data.length - 1].timestamp.replace("T", " ")}`;
      }
    } catch (err) {
      window.appRouter.showOfflineBanner();
      tableContainer.innerHTML = '<div class="state-box text-critical">Unable to reach the backend — check your connection.</div>';
    }
  }

  _renderMapTrajectory(hops) {
    if (!this.map) this._initMap();
    if (!this.map) return;

    this.markersLayer.clearLayers();
    if (this.polyline) {
      this.map.removeLayer(this.polyline);
      this.polyline = null;
    }

    const latlngs = [];
    hops.forEach((hop, idx) => {
      const pos = [hop.lat, hop.lon];
      latlngs.push(pos);

      const isAnomaly = hop.anomaly_badge;
      const markerColor = isAnomaly ? "#C98A1E" : "#2F5233";

      // Custom plain circular marker matching design contract
      const marker = L.circleMarker(pos, {
        radius: 7,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.9,
        weight: 2
      });

      marker.bindPopup(`
        <div style="font-family: ui-monospace, monospace; font-size: 11px;">
          <strong>Hop #${idx + 1}: ${hop.camera_id}</strong><br/>
          Sighting #${hop.sighting_id}<br/>
          Plate: ${hop.plate_text || "(unconfirmed)"}<br/>
          Time: ${hop.timestamp.replace("T", " ")}<br/>
          Composite: ${(hop.composite_score * 100).toFixed(1)}%<br/>
          ${hop.anomaly_detail ? `<span style="color:#B3262A;">${hop.anomaly_detail}</span>` : ""}
        </div>
      `);
      this.markersLayer.addLayer(marker);
    });

    if (latlngs.length > 1) {
      this.polyline = L.polyline(latlngs, {
        color: "#2F5233",
        weight: 3,
        dashArray: "4, 4"
      }).addTo(this.map);
    }

    this.map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
  }

  _renderTable(hops, container) {
    let rowsHtml = "";
    hops.forEach((h, idx) => {
      const hasAnomaly = h.anomaly_badge;
      const isUnconfirmed = h.plate_unconfirmed;

      const plateBadge = isUnconfirmed
        ? '<span class="badge badge-warning">PLATE UNCONFIRMED</span>'
        : `<span class="mono">${h.plate_text || "-"}</span>`;

      const statusBadge = hasAnomaly
        ? '<span class="badge badge-warning">ANOMALY</span>'
        : '<span class="badge badge-primary">NORMAL</span>';

      rowsHtml += `
        <tr class="expandable-row ${hasAnomaly ? 'highlighted' : ''}" onclick="window.trajectoryView.toggleDetail(${idx})">
          <td class="mono">#${idx + 1}</td>
          <td class="mono font-bold">${h.camera_id}</td>
          <td class="mono">${h.timestamp.replace("T", " ")}</td>
          <td>${plateBadge}</td>
          <td class="mono">${(h.plate_score * 100).toFixed(1)}%</td>
          <td class="mono">${(h.visual_score * 100).toFixed(1)}%</td>
          <td class="mono">${(h.transit_score * 100).toFixed(1)}%</td>
          <td class="mono font-bold">${(h.composite_score * 100).toFixed(1)}%</td>
          <td>${statusBadge}</td>
        </tr>
        <tr id="hop-detail-${idx}" style="display: none;">
          <td colspan="9">
            <div class="reason-detail">
              <strong>Evidence Breakdown:</strong> ${h.explanation}<br/>
              ${h.distance_km > 0 ? `<span>Distance: ${h.distance_km} km | Speed: ${h.speed_kmh} km/h</span><br/>` : ""}
              ${h.anomaly_detail ? `<strong class="text-critical">Deviation Details:</strong> ${h.anomaly_detail}` : ""}
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
              <th>Hop</th>
              <th>Camera</th>
              <th>Timestamp</th>
              <th>Plate</th>
              <th>Plate Score</th>
              <th>Visual Sim</th>
              <th>Transit Score</th>
              <th>Composite</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  toggleDetail(idx) {
    const el = document.getElementById(`hop-detail-${idx}`);
    if (el) {
      el.style.display = (el.style.display === "none") ? "table-row" : "none";
    }
  }
}

window.trajectoryView = new TrajectoryView();
