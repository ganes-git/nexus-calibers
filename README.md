# City-Wide ANPR Trajectory & Route-Anomaly Engine

**PS ID:** 26127  
**Organization:** Bharat Electronics Limited (BEL)  
**Theme:** Smart Automation  
**Team:** NexusCaliber  

---

## 1. Executive Summary

A comprehensive software platform for city-wide automated license plate recognition (ANPR), spatial-temporal trajectory reconstruction, and statistical route-anomaly alerting across distributed traffic camera networks. 

Built to eliminate the operational silos of legacy surveillance networks, the system introduces:
- **Resilient Identity-Fusion Tracking:** Tracks vehicles across multi-camera corridors even when license plates are degraded, occluded, or unreadable by adaptively falling back on visual appearance embeddings and corridor transit-time plausibility.
- **Explainable Statistical Route-Anomaly Detection:** Learns normal inter-camera transit dynamics ($\mu, \sigma$) directly from traffic flow and automatically flags journeys that deviate by $>3.0\sigma$, stating exact baseline comparisons and numbers rather than black-box flags.
- **Five Incident Alert Categories:** Real-time detection of cloned plates, impossible urban transit speeds, active crime blacklist matches, restricted-zone incursions, and statistical route anomalies.
- **Dual-Mode Architecture:** Serves live real-time querying and background scanning via a Python FastAPI backend, while providing a zero-ops, zero-cost frozen static deployment for public review.

---

## 2. System Architecture

```
Camera Feeds (8 Chennai Junction Nodes: CAM_01 - CAM_08)
   │
   ▼
[Detection & Crop Engine] (detect.py)
   │
   ├──► [Multi-Frame OCR Engine] (ocr.py + vote.py) ──► Plate Text / Unconfirmed Flag
   │
   └──► [Visual Re-ID Embedding] (embed.py) ────────► 64-d Normalized Feature Vector
            │
            ▼
   [Identity-Fusion Matching Engine] (match.py)
   Plate Similarity + Visual Cosine Sim + Transit Plausibility
            │
            ▼
   [Corridor Baseline & Anomaly Engine] (baseline.py)
   Normal Transit Dynamics (μ ± σ) & Statistical Anomaly Alerts
            │
            ▼
   [SQLite Database] (anpr.db)
   sightings · blacklist · restricted_zones · corridor_baseline · alerts · audit_log
            │
            ▼
   [FastAPI Backend Layer] (main.py)
   11 REST Endpoints · Role-Gated Audit Logging · Unseen Alert Polling
            │
            ▼
   [Frontend Operations Dashboard] (HTML / Vanilla CSS / JS)
   Trajectory Search · Density Heatmap · Blacklist · Alerts + Audit Log · Trends
```

---

## 3. Measured OCR Accuracy & Evaluation

Evaluated against a recorded ground truth dataset of 8 virtual-camera video clips (6 clean conditions, 2 deliberately adversarial conditions):

- **Clean Condition Exact Match Accuracy:** **100.0%** (6/6 clips with exact character-level match)
- **Adversarial Clip 1 (`clip_07`, blurred/mud-occluded plate):** Safely rejected low-confidence character noise and marked plate as `(unconfirmed)`, successfully triggering appearance + transit identity-fusion fallback.
- **Adversarial Clip 2 (`clip_08`, low-contrast night lighting):** Safely rejected noise without character hallucination.
- **Overall Exact Match (incl. Adversarial):** **75.0%** (6/8 clips)
- **Mean Character-Level Similarity:** **75.0%**
- **Evaluation Artifact:** `backend/data/eval_results.json`

---

## 4. Identity-Fusion Engine

- **Shipped Version:** **Adaptive Multi-Signal Fusion Engine (Weighted-Combination with Degraded-State Weight Reallocation)**
- **Formula:**
  - Standard state (plate confirmed):
    $$S = 0.50 \cdot S_{plate} + 0.30 \cdot S_{vis} + 0.20 \cdot S_{transit}$$
  - Degraded state (plate unconfirmed):
    $$S = 0.65 \cdot S_{vis} + 0.35 \cdot S_{transit}$$
- **Result:** Trajectories maintain unbroken continuity through obscured camera views with an explainable `"PLATE UNCONFIRMED"` badge.

---

## 5. Five Active Alert Categories

1. **`clone`**: Flags identical plates sighted at distant cameras with physically impossible transit speed ($>200$ km/h) or contradictory visual appearance similarity ($<45\%$).
2. **`impossible_transit`**: Flags inter-camera transit exceeding the maximum 140 km/h urban safety threshold.
3. **`blacklist`**: Interrogates sightings against national crime watchlists and impound registries.
4. **`zone_deviation`**: Detects unauthorized vehicle penetration into high-security or pedestrian geofences (e.g. Marina Promenade Pedestrian Heritage Zone).
5. **`route_anomaly`**: Statistical detection of journeys deviating by $>3.0\sigma$ from corridor baselines.

---

## 6. Verification Gates Passed (Part 3)

- **CHECK 1 (Functional Walkthrough):** PASSED across all five views, per-hop breakdown, Leaflet route rendering, role toggle, and global audio/toast notifications.
- **CHECK 2 (Zero Console Errors):** PASSED with **0 console errors** and **0 uncaught exceptions** across automated headless browser tests.
- **CHECK 3 (Design Contract Audit):** PASSED with **0 gradients, 0 blue/purple colors, 0 border-radius > 4px, 0 box-shadows, 0 bounce curves**.
- **CHECK 4 (Screenshots):** PASSED with 6 screenshots saved in `docs/screenshots/`.

---

## 7. Local Quickstart

### Prerequisites
- Python 3.10+ (tested with Python 3.13)
- Required packages: `fastapi`, `uvicorn`, `opencv-python`, `pillow`, `rapidocr-onnxruntime`, `numpy`, `playwright`

### Run Live Backend & Dashboard
```bash
# 1. Initialize DB and ingest demo dataset
py -3.13 backend/ingest_all.py

# 2. Start FastAPI application
py -3.13 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# 3. Access operations console in browser
http://127.0.0.1:8000/
```

### Run Static GitHub Pages Copy Locally
```bash
py -3.13 -m http.server 8008 --directory docs
# Open http://127.0.0.1:8008/
```

---

## 8. Closing Build Log Entry

- **Architecture:** Dual-mode (FastAPI + SQLite live backend, pre-rendered static snapshot in `/docs` for GitHub Pages).
- **Design System:** Strictly compliant with `DESIGN.md` (Neutral off-white `#FAFAF8`, dark forest green `#2F5233`, amber `#C98A1E`, red `#B3262A`).
- **Tested & Verified:** Automated Playwright suite verified zero console errors and full feature coverage.
