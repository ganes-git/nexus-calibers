# BUILD_LOG.md — City-Wide ANPR Trajectory & Route-Anomaly Engine

## System Overview
- **Project Title:** City-Wide ANPR Trajectory & Route-Anomaly Engine
- **PS ID:** 26127 (Bharat Electronics Limited - BEL)
- **Team:** NexusCaliber
- **Date:** 2026-09-14
- **Repository Path:** `c:\Users\ganes\Desktop\PS127`

---

## 1. Measured ANPR / OCR Accuracy
Evaluated against the ground truth dataset of 8 virtual-camera clips (6 clean conditions, 2 deliberately adversarial conditions):

| Metric | Measured Value | Detail |
|---|---|---|
| **Clean Condition Exact Match Accuracy** | **100.0%** (6 / 6 clips) | All standard Indian plates (`TN09CB1234`, `TN07AX4521`, `TN10BE9876`, `KA03MD5522`, `TN22CY3311`, `MH02EZ9012`) recognized with 100% character precision. |
| **Adversarial Clip 1 (`clip_07`)** | **Graceful Fallback (`unconfirmed`)** | Heavily blurred / mud-occluded plate (`TN01AZ7788`). Correctly rejected low confidence character noise and flagged as `(unconfirmed)` plate, successfully triggering visual Re-ID + transit identity fusion. |
| **Adversarial Clip 2 (`clip_08`)** | **Graceful Fallback (`unconfirmed`)** | Low-contrast / night lighting plate (`TN05BK6655`). Correctly rejected low confidence noise without hallucinating characters. |
| **Overall Exact Match (incl. Adversarial)** | **75.0%** (6 / 8 clips) | Measured across all clips. |
| **Mean Character Similarity** | **75.0%** | Normalized Levenshtein similarity across ground truth. |

---

## 2. Identity-Fusion Engine Implementation
- **Version Shipped:** **Adaptive Multi-Signal Fusion Engine (Weighted-Combination with Adaptive Reallocation Fallback)**
- **Mathematical Specification:**
  - $S_{plate} \in [0, 1]$: Levenshtein normalized character similarity.
  - $S_{vis} \in [0, 1]$: Normalized HSV segment distribution + spatial gradient orientation unit vector cosine similarity.
  - $S_{transit} \in [0, 1]$: Road-network transit plausibility calculated against distance and time delta, capped at 150 km/h physical limit.
  - **Standard State (Plate confirmed):**
    $$S_{composite} = 0.50 \cdot S_{plate} + 0.30 \cdot S_{vis} + 0.20 \cdot S_{transit}$$
  - **Degraded / Occluded State (Plate unconfirmed):**
    $$S_{composite} = 0.65 \cdot S_{vis} + 0.35 \cdot S_{transit}$$
- **Trajectory Continuity:** When a vehicle traverses a camera with an occluded plate, the system seamlessly maintains the vehicle trail using visual appearance and corridor transit timing, rendering an inline `"PLATE UNCONFIRMED"` badge with a full breakdown.

---

## 3. Corridor Baseline & Route-Anomaly Engine
- **Corridor Baseline Maintenance:** SQLite `corridor_baseline` table storing distance, $\mu$ (mean transit seconds), $\sigma$ (standard deviation floored to $\ge 15.0$s), sample count, and source (`observed`, `seed`, `mixed`).
- **Data Integrity / Honesty Mechanism:** Synthetic calibration rows are strictly stamped with `source='seed'` and rendered in muted grey with a `"SEED"` badge in the UI.
- **Route Anomaly Scoring:** Evaluates z-score $Z = \frac{|\Delta t - \mu|}{\sigma}$. Deviations where $Z > 3.0$ trigger explainable alerts with exact statistics (e.g., `Expected 580±75s, observed 2460s — deviation +25.07σ`).

---

## 4. Alert Engine Verification (All 5 Types Active)
Verified directly in SQLite and API layer:
1. `clone`: 3 alerts (Contradictory visual identity or simultaneous multi-location transit).
2. `impossible_transit`: 3 alerts (Transit speed exceeds 140 km/h urban safety limit).
3. `blacklist`: 15 alerts (Automatic detection of active criminal / impound registrations).
4. `zone_deviation`: 14 alerts (Spatial geofence penetration within restricted perimeter radius).
5. `route_anomaly`: 86 alerts (Statistical travel time deviation exceeding $3\sigma$ baseline threshold).

---

## 5. Verification Results (Part 3 Hard Gates)

### CHECK 1 — Functional Walkthrough
- **Trajectory Search:** PASSED. Map renders chronological connected polyline; per-hop score breakdown displays plate, visual, transit, and composite scores; anomaly badges expand inline with numerical evidence.
- **Heatmap:** PASSED. Leaflet map renders single-hue green camera density circles (`#2F5233`) and dashed critical accent circles (`#B3262A`) for restricted zones.
- **Blacklist Check:** PASSED. Positive match (`TN07AX4521`) displays critical alert banner with cause on file; negative check displays clean, muted status.
- **Alerts View:** PASSED. All 5 alert types present and color-coded.
- **Role Toggle (Operator vs. Supervisor):** PASSED. In Operator mode, Audit Log is completely unmounted from the DOM. In Supervisor mode, Audit Log mounts and renders query history.
- **Global Toast & Audio Mute:** PASSED. Alert toast appeared on Traffic Trends view; persistent mute toggle silenced Web Audio tone.

### CHECK 2 — Zero Console Errors
- **Automated Headless Test:** PASSED.
- **Console Errors:** **0**
- **Uncaught Exceptions / Rejections:** **0**
- Tested all five views plus deliberate edge cases (nonexistent trajectory plate, clean blacklist plate).

### CHECK 3 — Design Contract Audit
- **Grep Audit on `frontend/`:** PASSED.
- **Gradients:** 0 found.
- **Blue / Indigo / Purple colors:** 0 found.
- **Border radius > 4px:** 0 found.
- **Box shadows:** 0 found.
- **Bounce / spring curves:** 0 found.

### CHECK 4 — Screenshot Verification
Captured into `docs/screenshots/`:
1. `01_trajectory_search.png`: Trajectory search with per-hop table, map polyline, and expanded anomaly explanation.
2. `02_heatmap_view.png`: Density heatmap circles and dashed restricted zone perimeters with summary tables.
3. `03_blacklist_view.png`: Blacklist interrogation showing critical match outcome.
4. `04_alerts_supervisor.png`: Incident alerts command center with Supervisor Audit Log mounted.
5. `05_traffic_trends.png`: Inline SVG hourly sighting volume chart and corridor baseline table.
6. `06_toast_notification.png`: Global alert toast notification mid-display on a different view with mute toggle.

---

## Status: PART 3 COMPLETE — WAITING FOR USER REVIEW
All Part 1 decisions resolved. All Part 2 requirements built. All Part 3 verification checks passed.
Awaiting user review before proceeding to Part 4 (GitHub Push).
