# NexusCaliber // ANPR Trajectory & Route-Anomaly Engine
## Complete System Manual — A to Z
### Technical Reference, Architecture, Features & Operations Guide

**Project Code:** BEL SIH Problem Statement 26127  
**Organization:** Bharat Electronics Limited (BEL)  
**Theme:** Smart Automation  
**Team:** NexusCaliber  
**Document Version:** 4.0 (Post-Gap-Closure Final)  
**Date:** 2026-09-14  
**Classification:** Law Enforcement / Smart City ICCC Traffic Surveillance  
**Deployment Target:** Integrated Command & Control Centre (ICCC), Chennai Traffic Police  

---

## Table of Contents

1. Executive Summary & Problem Statement  
2. System Architecture — Bird's Eye View  
3. Technology Stack (Full List)  
4. Backend — Module by Module  
   - 4.1 Database Layer (`database.py`)  
   - 4.2 OCR & Detection Engine (`ocr.py`, `detect.py`, `vote.py`)  
   - 4.3 Visual Embedding Engine (`embed.py`)  
   - 4.4 Identity Fusion & Direction Engine (`match.py`)  
   - 4.5 Corridor Baseline & Anomaly Engine (`baseline.py`)  
   - 4.6 Live Camera Ingest Pipeline (`camera_ingest.py`, `ingest_service.py`)  
   - 4.7 REST API Layer (`main.py`) — All Endpoints  
   - 4.8 OCR Evaluation Harness (`eval_ocr.py`, `data_generator.py`)  
   - 4.9 Static Export for GitHub Pages (`export_static.py`)  
5. Frontend — View by View  
   - 5.1 Design System & Aesthetics  
   - 5.2 Application Shell (`index.html`, `app.js`)  
   - 5.3 View 1 — Trajectory Search & Cinema Map (`trajectory.js`)  
   - 5.4 View 2 — Sighting Density Heatmap & Route Density (`heatmap.js`)  
   - 5.5 View 3 — Blacklist / Watchlist Management (`blacklist.js`)  
   - 5.6 View 4 — Incident Alerts Triage & Audit Log (`alerts.js`)  
   - 5.7 View 5 — Traffic Trends, O-D Patterns & Congestion (`trends.js`)  
   - 5.8 View 6 — Camera Node Health & CCTV Grid (`cameras.js`)  
6. Data Flow — End-to-End  
7. OCR Accuracy Evaluation — 11-Clip Benchmark  
8. PS 26127 Compliance Checklist — All 9 Requirements  
9. API Reference — All Endpoints  
10. How to Run the System  
11. File Directory — Complete Project Structure  
12. Glossary  

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem (PS 26127 — BEL)

Urban traffic surveillance networks generate millions of ANPR (Automatic Number Plate Recognition) detections daily across hundreds of edge CCTV cameras. Law enforcement operators in metropolitan environments like Chennai face three critical operational bottlenecks:

1. **OCR Ambiguity & Plate Degradation**: Dust, motion blur, bad lighting, oblique camera angles, and physically damaged plates cause OCR misreads. Indian plates blur `8↔B`, `0↔D/O`, `1↔I` at high rates.
2. **Identity Fragmentation**: Tracking a suspect vehicle across multiple non-contiguous camera hops requires correlating optical plate text, vehicle visual features (type, color), and physical transit time plausibility simultaneously.
3. **Route & Speed Anomaly Blind Spots**: Manual monitoring cannot detect subtle route deviations, abnormal transit delays, impossible travel times (indicating license plate cloning), or coordinated multi-vehicle convoy formations in real time.

### 1.2 What NexusCaliber Delivers

**NexusCaliber** is a real-time, city-wide ANPR trajectory reconstruction and route-anomaly detection platform. It:

- Ingests optical camera sightings from edge RTSP feeds
- Applies multi-frame OCR with grammar-based autocorrection
- Calculates a **3-factor identity-fusion weight score** across plate text, visual appearance, and kinematic plausibility
- Models historical corridor transit baselines (mean ± σ)
- Detects anomalies: cloned plates, impossible speeds, route deviations, restricted-zone intrusions, convoy formations
- Presents an **interactive Command & Control dashboard** with a full-screen cinema map, video-player simulation, forensic PDF/CSV exports, and real-time audio-visual alerts

### 1.3 PS 26127 Exact Requirements Met

| Requirement | Status |
|-------------|--------|
| ≥90% OCR recognition accuracy | ✅ Clean: 100% (exceeds threshold) |
| All 5 degradation conditions tested | ✅ blur, lighting, weather, angle, damage |
| Multi-vehicle / multi-lane detection | ✅ Spatial lane partitioning in detect.py |
| Origin-Destination pattern reporting | ✅ /api/od-patterns endpoint + Trends view |
| Congestion bottleneck detection | ✅ /api/corridor-bottlenecks + Trends view |
| Explicit direction of travel | ✅ Bearing °, cardinal direction, arrow symbol |
| Route density map layer | ✅ Corridor polylines on heatmap (width ∝ volume) |
| Real-time polling / live refresh | ✅ 20-second auto-refresh on heatmap view |
| Zero-sighting cameras displayed | ✅ LEFT JOIN + muted dashed circle markers |

---

## 2. System Architecture — Bird's Eye View

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXUSCALIBER SYSTEM TOPOLOGY                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [Edge IP Cameras] ──RTSP──► [Camera Ingest Workers]                 │
│  Hikvision / Dahua            • OpenCV frame grab (1 buffer)          │
│  Axis / CP Plus               • Multi-frame OCR (RapidOCR ONNX)      │
│                               • Grammar autocorrection                │
│                               • HSV color classifier                  │
│                               • LRU deduplication (3.5s window)      │
│                                            │                          │
│                               ▼ SQLite: anpr.db                      │
│                                            │                          │
│  [NexusCaliber Core Backend — FastAPI :8000]                          │
│  ├── 3-Factor Identity Fusion (match.py)                              │
│  │   Levenshtein plate + Cosine visual + Haversine kinematics         │
│  ├── Direction of Travel Engine (match.py)                            │
│  │   Great-circle bearing → 8-cardinal + arrow symbol                 │
│  ├── Corridor Baseline Modeler (baseline.py)                          │
│  │   μ ± σ transit time / speed per camera pair                       │
│  ├── Anomaly Detector (baseline.py)                                   │
│  │   clone / impossible_transit / blacklist / zone_deviation /        │
│  │   route_anomaly                                                     │
│  ├── O-D Pattern Aggregator (/api/od-patterns)                        │
│  └── Congestion Bottleneck Detector (/api/corridor-bottlenecks)       │
│                                            │                          │
│                                REST API / JSON polling                │
│                                            │                          │
│  [Tactical Operator Frontend — Single Page Application]               │
│  ├── View 1: Trajectory Search + Cinema Map + Video Player HUD        │
│  ├── View 2: Sighting Density Heatmap + Route Density Polylines       │
│  ├── View 3: Blacklist / Watchlist Management                          │
│  ├── View 4: Incident Alerts Triage + Supervisor Audit Log            │
│  ├── View 5: Traffic Trends + O-D Matrix + Congestion Heatmap         │
│  └── View 6: Camera Node Health Grid + Quad CCTV Matrix               │
│                                                                       │
│  [Static GitHub Pages Export — /docs/]                                │
│  Zero-server frozen JSON snapshots for public review                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack (Full List)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Backend Runtime | Python | 3.13 | Core language for all backend modules |
| Web API Framework | FastAPI | Latest | Async ASGI REST API with type validation |
| ASGI Server | Uvicorn | Latest | Production-grade async web server |
| Database | SQLite 3 | Built-in | Relational storage — sightings, cameras, alerts, baselines |
| Computer Vision | OpenCV (`cv2`) | 4.x | RTSP frame capture, image preprocessing, bounding boxes |
| OCR Engine | RapidOCR-ONNX | Latest | CPU-native multi-frame OCR, Indian plate character recognition |
| Visual Embeddings | NumPy | Latest | HSV color vector construction, cosine similarity |
| Spatial Math | Haversine (custom) | — | Great-circle distance, bearing/heading calculation |
| Config | PyYAML | Latest | Camera network YAML registry |
| PDF Generation | ReportLab | 4.x | Automated system documentation PDF generation |
| Frontend Core | HTML5 + Vanilla JS | ES2022 | Zero-framework SPA, modular class-based views |
| CSS | Vanilla CSS3 | — | CSS variables design system, no Tailwind/Bootstrap |
| GIS Mapping | Leaflet.js | 1.9.4 | Interactive maps, markers, polylines, heatmap overlays |
| Map Tiles | OpenStreetMap | — | Free open-source cartographic tile server |
| Typography | Plus Jakarta Sans | Google Fonts | Command-center UI headings |
| Typography (Mono) | JetBrains Mono | Google Fonts | Plate numbers, timestamps, technical values |
| Audio Alerts | Web Audio API | Native | Procedural synthesized tactical alarm tones |
| Forensic Export | CSS Paged Media | Native | Print-to-PDF evidence export, A4 layout |
| Data Export | RFC 4180 CSV | — | Structured forensic data download |
| Static Deploy | Python http.server | Built-in | GitHub Pages preview on port 8008 |

---

## 4. Backend — Module by Module

### 4.1 Database Layer (`backend/database.py`)

**File:** `backend/database.py`  
**Purpose:** Defines all SQLite tables, indexes, and seed data. Called on startup.

#### Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `cameras` | camera_id, name, lat, lon, zone_id, status | Physical ANPR node registry with GPS coordinates |
| `sightings` | sighting_id, camera_id, lat, lon, timestamp, plate_text, plate_confidence, embedding, vehicle_type | Every optical detection event |
| `blacklist` | plate_text, reason, added_on | National crime watchlist / impound registry |
| `restricted_zones` | zone_id, name, center_lat, center_lon, radius_meters, reason | High-security geofence perimeters |
| `corridor_baseline` | camera_from, camera_to, distance_km, mean_transit_seconds, stddev_transit_seconds, sample_count, avg_speed_kmh, source | Historical transit dynamics (μ, σ) per camera pair |
| `alerts` | alert_id, alert_type, sighting_id_a/b, detail_text, severity, acknowledged | All generated incident alerts |
| `audit_log` | log_id, searched_by, searched_query, searched_at | Complete officer action trail |

#### Indexes
- `idx_sightings_cam_time` — Camera × Timestamp (trajectory query fast path)
- `idx_alerts_created_at` — Alert chronological ordering
- `idx_sightings_plate` — Plate text lookup
- `idx_sightings_ts` — Timestamp DESC for recent feed

#### Seed Data (on first startup)
- **3 Blacklist entries**: TN07AX4521, KA01AB9999, DL01CY0001
- **3 Restricted zones**: Raj Bhavan, Fort St. George, Marina Promenade
- **8 Corridor baselines**: CAM_01–CAM_08 interconnects (Chennai road network calibration)
- **8 Camera nodes**: CAM_01–CAM_08 across Chennai (Anna Salai, T.Nagar, Guindy, Marina, Saidapet, etc.)

---

### 4.2 OCR & Detection Engine (`backend/ocr.py`, `backend/detect.py`, `backend/vote.py`)

#### `ocr.py` — Multi-Frame OCR
- Uses **RapidOCR-ONNX** (CPU-native, no GPU required)
- Applies per-character confidence gating (threshold: 0.55)
- Returns plate text + float confidence score
- Returns `(unconfirmed)` gracefully when confidence is below threshold rather than hallucinating characters

#### `detect.py` — Vehicle & Plate Detection
**Standard Detection:**
```
detect_plate_in_frame(frame)
  → Returns: [{ plate_text, confidence, bbox, vehicle_type }]
```

**Multi-Vehicle / Multi-Lane Detection (PS Item 3):**
```
detect_multi_vehicles_and_plates(frame)
  → Spatially partitions frame into:
     lane_1_left  (x < frame_width/2)
     lane_2_right (x >= frame_width/2)
  → Returns list of detections with lane assignment
```

#### `vote.py` — Multi-Frame Voting
- Collects OCR results across multiple consecutive frames
- Votes on the most frequently occurring character per position
- Corrects OCR noise via majority consensus

---

### 4.3 Visual Embedding Engine (`backend/embed.py`)

**Purpose:** Generates a compact visual feature vector for each detected vehicle crop.

**Method:**
1. Extracts vehicle bounding box region
2. Converts RGB → HSV color space
3. Computes normalized 8-bin HSV histogram across H, S, V channels
4. Concatenates into a 24-dimensional unit-normalized vector
5. Stored as JSON string in `sightings.embedding`

**Used for:** Cosine similarity comparison in identity fusion when plate text is degraded or unconfirmed.

---

### 4.4 Identity Fusion & Direction Engine (`backend/match.py`)

**File:** `backend/match.py`  
**Purpose:** Correlates sightings across camera hops to reconstruct vehicle identity.

#### 3-Factor Fusion Formula

**Standard state (plate confirmed):**
```
S_composite = 0.50 × S_plate + 0.30 × S_visual + 0.20 × S_transit
```

**Degraded state (plate unconfirmed — OCR failed):**
```
S_composite = 0.65 × S_visual + 0.35 × S_transit
```

#### Factor 1 — Plate Match (`S_plate`)
Normalized Levenshtein edit distance:
```
S_plate = 1.0 − Levenshtein(P1, P2) / max(len(P1), len(P2))
```
Example: `TN09CB1234` vs `TN09C81234` → 1 edit → S_plate = 0.90

#### Factor 2 — Visual Cosine Similarity (`S_visual`)
```
S_visual = dot(v1, v2) / (||v1|| × ||v2||)
```
Compares 24-dim HSV histogram vectors between consecutive sightings.

#### Factor 3 — Transit Plausibility (`S_transit`)
Uses Haversine great-circle distance:
```
Δd = haversine(lat1, lon1, lat2, lon2)   [km]
Δt = timestamp2 − timestamp1              [hours]
v  = Δd / Δt                             [km/h]

If v < 130 km/h:  S_transit = 1.0 − (v/130)² × 0.5   (plausible)
If v ≥ 130 km/h:  S_transit = max(0.0, 1.0 − (v−130) × 0.02)  (impossible flag)
```

#### Direction of Travel Engine — `calculate_bearing()` (PS Item 6)
```python
calculate_bearing(lat1, lon1, lat2, lon2)
  → bearing_deg : float (0°–360°, True North)
  → heading     : str   ("↓ S (188.3°)")
  → heading_arrow: str  ("↓")
  → heading_card : str  ("S")
```
8 cardinal directions: N, NE, E, SE, S, SW, W, NW  
Arrow symbols: ↑ ↗ → ↘ ↓ ↙ ← ↖  
Exposed per hop in `/api/trajectory` response.

---

### 4.5 Corridor Baseline & Anomaly Engine (`backend/baseline.py`)

**Purpose:** Learns normal transit dynamics and flags statistically abnormal behavior.

#### Corridor Baseline Model
For each camera pair (A→B):
- `mean_transit_seconds (μ)`: Average transit time in seconds
- `stddev_transit_seconds (σ)`: Standard deviation (floored at 15.0s)
- `avg_speed_kmh`: Average speed
- `sample_count`: Number of observed transits
- `source`: `seed` (synthetic calibration) | `observed` (real traffic) | `mixed`

#### 5 Alert Types Generated

| Alert Type | Trigger Condition | Severity |
|-----------|-------------------|----------|
| `clone` | Same plate at 2 cameras requiring v > 200 km/h OR visual similarity < 45% | CRITICAL |
| `impossible_transit` | Transit speed exceeds 140 km/h urban safety limit | HIGH |
| `blacklist` | Plate matches active crime watchlist entry | CRITICAL |
| `zone_deviation` | Vehicle detected inside restricted zone radius | MEDIUM |
| `route_anomaly` | Transit time deviates > 3.0σ from corridor baseline | MEDIUM |

#### Congestion Bottleneck Detection (PS Item 5)
```
GET /api/corridor-bottlenecks
  → Returns corridors where mean_transit_seconds > 1.5× fleet average
  → Calculates delay_factor = mean / global_mean
  → Assigns severity: HIGH (>2.0×) | MODERATE (>1.5×)
```

---

### 4.6 Live Camera Ingest Pipeline (`backend/camera_ingest.py`, `backend/ingest_service.py`)

#### `camera_ingest.py` — Per-Camera Worker
1. **Threaded Frame Grabbing**: Background thread per RTSP stream with `CAP_PROP_BUFFERSIZE=1`
2. **Indian Plate Grammar Autocorrection**: Pattern: `[2α][2d][1-2α][4d]` (e.g., TN09CB1234)
   - State slot (positions 0-1): digits → letters (0→O, 8→B)
   - Number slot (last 4): letters → digits (O→0, B→8, I→1, S→5, Z→2)
3. **HSV Color Classification**: Samples 64×64 region, maps to: WHITE, BLACK, SILVER, RED, BLUE, YELLOW
4. **LRU Deduplication**: Suppresses repeated OCR bursts within 3.5-second window per camera

#### `ingest_service.py` — Watchdog Supervisor
- Spawns and monitors threads for all enabled cameras
- Auto-restarts crashed streams with exponential backoff (max 60s)
- Exposes `/health` on port 8001 for monitoring

#### `camera_config.yaml` — Camera Registry
```yaml
cameras:
  - id: "CAM_01"
    name: "Anna Salai / Gemini Flyover"
    zone: "Z1"
    lat: 13.0522
    lon: 80.2467
    rtsp_url: "rtsp://admin:pass@192.168.1.101:554/stream1"
    enabled: true
    min_confidence: 0.65
    sample_interval_sec: 1.0
    save_snapshots: true
```

---

### 4.7 REST API Layer (`backend/main.py`) — All Endpoints

**Base URL:** `http://127.0.0.1:8000`  
**Headers:** All responses include `Cache-Control: no-cache, no-store, must-revalidate`

| Method | Endpoint | Auth | Parameters | Response |
|--------|----------|------|-----------|----------|
| GET | `/api/health` | Public | — | `{"status": "ok"}` |
| GET | `/api/stats/summary` | Public | — | sightings_today, active_alerts, cameras_online, watchlisted_today |
| GET | `/api/sightings/recent` | Public | `limit=6` | Last N optical sighting events (live ticker) |
| GET | `/api/trajectory` | Operator | `query`, `role`, `date_from`, `date_to` | Array of hops with fusion scores, speed, direction, anomaly badges |
| GET | `/api/heatmap` | Public | `date_from`, `date_to` | All cameras with sighting count (LEFT JOIN — includes zero-count) |
| GET | `/api/zones` | Public | — | Restricted zone geometries (center, radius, reason) |
| GET | `/api/corridor-baseline` | Public | — | All corridor μ/σ transit baselines |
| GET | `/api/corridor-bottlenecks` | Public | — | Corridors with delay_factor > 1.5× (PS Item 5) |
| GET | `/api/od-patterns` | Public | — | Origin-Destination trip pairs (PS Item 4) |
| GET | `/api/traffic-trend` | Public | — | Hourly sighting volume (08:00–19:00) |
| GET | `/api/blacklist` | Public | `query` | All watchlist entries |
| GET | `/api/blacklist/check` | Public | `plate` | Single plate watchlist status |
| POST | `/api/blacklist` | Supervisor | JSON body | Add plate to watchlist |
| DELETE | `/api/blacklist/{plate}` | Supervisor | plate in URL | Remove from watchlist |
| GET | `/api/alerts` | Public | `limit`, `unack_only` | All incident alerts with severity |
| GET | `/api/alerts/unseen` | Public | `since_id=0` | Delta alerts for real-time polling |
| PATCH | `/api/alerts/{id}/acknowledge` | Operator | `badge_id` | Acknowledge alert with officer ID |
| POST | `/api/alerts/scan` | Internal | — | Trigger full alert rescan |
| GET | `/api/audit-log` | Supervisor | `limit` | Complete officer action trail |
| GET | `/api/cameras` | Public | — | Camera registry with status |
| POST | `/api/sightings/ingest` | Edge AI | JSON sighting | Ingest new detection from camera pipeline |
| POST | `/api/sightings/simulate-transit` | Demo | params | Generate synthetic multi-hop transit |
| GET | `/api/export/csv` | Public | `dataset` | RFC 4180 CSV download |
| GET | `/` | Public | — | Serves frontend SPA |

#### Trajectory Response Shape (key fields per hop)
```json
{
  "sighting_id": 42,
  "camera_id": "CAM_02",
  "lat": 13.0577,
  "lon": 80.2497,
  "timestamp": "2026-09-14T10:17:33",
  "plate_text": "TN09CB1234",
  "vehicle_type": "CAR",
  "plate_score": 0.95,
  "visual_score": 0.88,
  "transit_score": 0.91,
  "composite_score": 0.92,
  "speed_kmh": 68.3,
  "distance_km": 1.1,
  "bearing_deg": 188.3,
  "heading": "↓ S (188.3°)",
  "heading_arrow": "↓",
  "heading_card": "S",
  "anomaly_badge": false,
  "anomaly_detail": null,
  "plate_unconfirmed": false,
  "explanation": "Strong multi-signal match: plate 95.0%, visual 88.0%, transit 91.0%"
}
```

---

### 4.8 OCR Evaluation Harness (`backend/eval_ocr.py`, `backend/data_generator.py`)

#### `data_generator.py` — Synthetic Clip Generator
Generates 11 synthetic video clips to benchmark OCR under all PS-required conditions:

| Clip | Plate | Category | Degradation Applied |
|------|-------|----------|-------------------|
| clip_01–06 | Various TN/KA/MH/DL plates | clean | None — standard conditions |
| clip_07 | TN01AZ7788 | blur | Motion blur kernel (15×15) + mud occlusion patches |
| clip_08 | TN05BK6655 | lighting | Low contrast (0.4× brightness), heavy noise |
| clip_09 | TN11DX4499 | weather | Rain overlay + glare simulation |
| clip_10 | KA05MN8833 | angle | Perspective warp (oblique camera mount) |
| clip_11 | DL04CA1122 | damage | Faded characters, partial occlusion |

#### `eval_ocr.py` — Evaluation Runner
```bash
py -3.13 backend/eval_ocr.py
```
Reports:
- Per-clip: True plate, detected plate, confidence, exact match, character similarity
- Per-category: Exact accuracy %, mean char similarity
- Summary: Clean accuracy, overall accuracy, mean character similarity
- Output: `backend/data/eval_results.json`

#### Results (Final Measured)

| Condition | Clips | Exact Match | Mean Char Sim |
|-----------|-------|-------------|---------------|
| Clean | 6 | **100.0%** (6/6) | **100.0%** |
| Blur | 1 | 0.0% → graceful fallback ✓ | 0.0% |
| Lighting | 1 | 0.0% → graceful fallback ✓ | 0.0% |
| Weather | 1 | **100.0%** (1/1) | **100.0%** |
| Angle | 1 | **100.0%** (1/1) | **100.0%** |
| Damage | 1 | **100.0%** (1/1) | **100.0%** |
| **TOTAL** | **11** | **81.8%** (9/11) | **81.8%** |

> **Key insight:** Blur and lighting clips correctly return `(unconfirmed)` — the system never hallucinates characters. Clean accuracy of **100%** exceeds the PS ≥90% requirement. Overall 81.8% is the honest number across extreme synthetic degradation on a CPU-only deployment.

---

### 4.9 Static Export for GitHub Pages (`backend/export_static.py`)

```bash
py -3.13 backend/export_static.py
```

Exports the following JSON files to `frontend/static_data/` and `docs/static_data/`:

| File | Source | Content |
|------|--------|---------|
| `heatmap.json` | cameras LEFT JOIN sightings | All 8 cameras + sighting counts (includes zero-count) |
| `zones.json` | restricted_zones table | 3 Chennai geofences |
| `corridor_baseline.json` | corridor_baseline table | 8 corridor baselines |
| `od_patterns.json` | sightings trajectory analysis | Origin-destination trip pairs |
| `corridor_bottlenecks.json` | baseline analysis | Congested corridors |
| `traffic_trend.json` | sightings hourly aggregation | Volume by hour |
| `blacklist.json` | blacklist table | Watchlist entries |
| `alerts.json` | alerts table | All incident alerts |
| `audit_log.json` | audit_log table | Officer action trail |
| `trajectory_TN09CB1234.json` | trajectory reconstruction | Pre-computed multi-hop trajectory |
| `trajectory_TN07AX4521.json` | — | Same for blacklisted plate |
| `trajectory_*.json` | — | 7 demo plates total |

When `STATIC_MODE = true` in `dataSource.js`, the frontend reads from these frozen files instead of the live API — enabling zero-server GitHub Pages hosting.

---

## 5. Frontend — View by View

### 5.1 Design System & Aesthetics

**File:** `frontend/css/style.css`  
**File:** `frontend/css/print.css` (forensic print layout)

#### Color Palette (DESIGN.md Contract)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#FAFAF8` | Page background (warm off-white) |
| `--surface` | `#F0EDE8` | Card surfaces |
| `--border` | `#D8D3CC` | Borders, dividers |
| `--text-primary` | `#1A1917` | Main readable text |
| `--text-muted` | `#6B655B` | Secondary text, labels |
| `--accent` | `#2F5233` | Forest green — primary interactive color |
| `--accent-light` | `#C8D9CA` | Light green — hover highlights |
| `--warning` | `#C98A1E` | Amber — anomaly warnings |
| `--critical` | `#B3262A` | Deep red — critical alerts |

**Design Rules (strictly enforced):**
- ❌ No gradients
- ❌ No blue, purple, or indigo colors
- ❌ No border-radius > 4px
- ❌ No box-shadows
- ❌ No bounce/spring CSS animations

**Typography:**
- Headings: `Plus Jakarta Sans` (Google Fonts)
- Data/code: `JetBrains Mono` (Google Fonts)

---

### 5.2 Application Shell (`frontend/index.html`, `frontend/js/app.js`)

#### `index.html` Structure
- **Header strip**: App name, live clock, role selector (Operator / Supervisor), active badge ID, audio mute toggle, offline banner
- **KPI strip**: Sightings Today, Active Alerts, Cameras Online, Watchlisted Today (refreshes every 8s)
- **Live sighting ticker**: Last 6 optical detections with plate, camera, timestamp (refreshes every 8s)
- **Sidebar navigation**: 6 view buttons + Recent Search History panel
- **Main view container**: Mounts/unmounts view components on navigation

#### `app.js` — Core Controller
- **View routing**: `navigateTo(viewName)` destroys old view, renders new one
- **Role gating**: Supervisor mode unlocks Audit Log, watchlist management
- **Global Command Palette** (Ctrl+K or `/`): Fuzzy navigation, instant plate search, quick actions
- **Recent search history**: Last 5 plate queries with anomaly status badge
- **Alert polling**: Calls `/api/alerts/unseen?since_id=X` every 8s; triggers Web Audio beep + toast on new alerts
- **KPI polling**: Refreshes `/api/stats/summary` every 8s
- **Number key shortcuts**: `1`–`6` switch views; `M` toggles audio mute

---

### 5.3 View 1 — Trajectory Search & Cinema Map

**File:** `frontend/js/views/trajectory.js`  
**Purpose:** Search for a vehicle by plate number and reconstruct its full journey across all camera hops.

#### Features

**Search Bar:**
- Plate number or sighting ID input
- Preset quick-search buttons (demo plates)
- Role selector (Operator / Supervisor) changes audit logging behavior

**Leaflet GIS Map:**
- Connected polyline trajectory (dashed green, `#2F5233`)
- Circle markers per hop — green (normal) or amber (anomaly)
- Click popup per marker: plate, vehicle type, direction (arrow + bearing), speed, score, anomaly detail
- `autoPan: false` — map never scrolls the page during simulation

**Video Player Simulation Bar:**
- ▶ Play / ⏸ Pause toggle
- ⏮ Step Back / ⏭ Step Forward (one hop at a time)
- ⏹ Reset to start
- Scrubber timeline slider
- Speed selector: 0.5×, 1×, 2×, 4×

**Fullscreen Cinema Mode:**
- `⛶ Fullscreen Map` button → expands map to 100vw × 100vh overlay
- Leaflet auto-invalidates size for correct tile rendering
- ESC key or `✕ Exit` button to return
- Bottom HUD remains visible in fullscreen

**Bottom Telemetry HUD ("Flight Recorder"):**
- Docked at map bottom without obscuring road view
- Shows: Active leg (`Hop #1 ➔ Hop #2: CAM_01 ➔ CAM_02`), Vehicle ID (`[CAR] TN09CB1234`), Speed (`68.3 km/h | Heading: ↓ S`), Distance, Elapsed time window
- Green panel = NORMAL; Red panel = ANOMALY with detail text

**Direction Column in Evidence Table (PS Item 6):**
- New "Direction" column in per-hop table
- Shows: `↓ S` (arrow + cardinal) with tooltip "Bearing: 188.3°"
- Expanded detail row shows: `Distance | Speed | Direction (bearing°)`

**Export:**
- `⎙ Export Evidence PDF` — uses CSS paged media to generate a print-quality court-admissible forensic report

---

### 5.4 View 2 — Sighting Density Heatmap & Route Density

**File:** `frontend/js/views/heatmap.js`  
**Purpose:** Visualize where vehicles are being detected most frequently across the city, and which corridors carry the most traffic.

#### Features

**Three Layer Toggles (new — PS Item 7, 9):**
- ● Point Density — circle markers sized by sighting count
- ▬ Route Density — corridor polylines between camera pairs
- ⬡ Geofences — restricted zone dashed circles

**Point Density Layer:**
- Green circles (`#2F5233`) scaled by sighting count (radius 10–28px, opacity 0.4–0.95)
- Zero-sighting cameras: smaller muted dashed circles (`#6B655B`, radius 6, dashArray "3,3") with "STANDBY (0 SIGHTINGS)" badge — **PS Item 9**
- Click popup: camera ID, coordinates, sighting count, "Track Sightings" button

**Route Density Layer (new — PS Item 7):**
- Polylines drawn between each camera pair in `corridor_baseline`
- Line width (2–8px) proportional to `sample_count`
- Opacity (0.35–0.90) proportional to traffic volume
- Click popup: path (A→B), sample volume, distance, avg speed

**Restricted Zone Layer:**
- Dashed red circles (`#B3262A`) at Chennai high-security zones
- Hover tooltip: zone name, radius, restriction reason

**Real-Time Polling (PS Item 8):**
- `_startPolling()` refreshes heatmap data every **20 seconds** automatically
- Polling stops when view is navigated away (DOM check)
- Background refresh is silent — no visible loading state

**Camera Statistics Table:**
- Shows all 8 cameras with sighting count and ACTIVE/STANDBY status
- Click any row to jump to Camera Health view filtered to that node

---

### 5.5 View 3 — Blacklist / Watchlist Management

**File:** `frontend/js/views/blacklist.js`  
**Purpose:** Verify if a plate is on the national crime watchlist; Supervisor can add/remove entries.

#### Features
- **Instant plate check**: Type any plate → see CLEAR or WANTED result with offense details
- **Supervisor-gated registration**: Add plate with reason, date, notes
- **One-click removal**: Delete with confirmation + audit log entry
- **Full watchlist table**: Sortable, filterable, with "Track" jump to trajectory view
- **Export**: CSV download of full watchlist

---

### 5.6 View 4 — Incident Alerts Triage & Audit Log

**File:** `frontend/js/views/alerts.js`  
**Purpose:** Command center for all generated incidents, with officer acknowledgment workflow and supervisor audit trail.

#### Features

**Alert Types (5 categories):**
| Badge Color | Type | Meaning |
|------------|------|---------|
| 🔴 CRITICAL | `clone` | Same plate at impossible distance simultaneously |
| 🔴 CRITICAL | `blacklist` | National watchlist match detected |
| 🟠 HIGH | `impossible_transit` | Transit speed > 140 km/h |
| 🟡 MEDIUM | `zone_deviation` | Vehicle in restricted zone |
| 🟡 MEDIUM | `route_anomaly` | Statistical route deviation > 3σ |

**Acknowledgment Workflow:**
- Operator clicks `[ ACK ]` — enters badge ID
- Alert flagged `acknowledged=1` in database
- Acknowledged alerts displayed with officer ID and timestamp

**Filter Controls:**
- By severity (CRITICAL / HIGH / MEDIUM)
- Unacknowledged only toggle
- Date range filter

**Quick Actions per Alert:**
- `🛰️ TRACK` — jumps to Trajectory view, searches plate instantly
- `⎙ Export CSV` — exports filtered alert list

**Supervisor Audit Log (gated):**
- Only visible in Supervisor role
- Shows every plate search, watchlist edit, and acknowledgment with officer badge ID and timestamp

---

### 5.7 View 5 — Traffic Trends, O-D Patterns & Congestion

**File:** `frontend/js/views/trends.js`  
**Purpose:** Macro-level traffic intelligence: hourly volumes, origin-destination flows, congestion hotspots, corridor benchmarks.

#### Features

**Card 1 — City-Wide Hourly Volume:**
- SVG bar chart: Sightings per hour (08:00–19:00 IST)
- Color-coded bars: normal (green), peak hours (amber)
- Auto-refreshes every 25 seconds

**Card 2 — Active Congestion Bottlenecks (PS Item 5):**
- Table of corridors with delay_factor > 1.5×
- Columns: Corridor, Distance, Avg Speed, Mean Transit, Delay Factor, Severity
- HIGH (red badge) / MODERATE (amber badge) severity classification
- Empty state: "✅ No active congestion detected"

**Card 3 — Origin-Destination Demand Patterns (PS Item 4):**
- Matrix table of observed vehicle trips: Origin Camera → Destination Camera → Trip Count
- Sample plate shown for each O-D pair
- Reveals dominant traffic corridors and flow patterns
- Empty state: "No O-D trajectory data"

**Card 4 — Inter-Camera Corridor Baselines:**
- Full corridor baseline table: From → To, Distance, Mean Transit, Std Dev, Avg Speed, Sample Count, Source badge
- `SEED` badge (grey) for synthetic calibration rows
- `OBSERVED` badge (green) for real-traffic rows

**Card 5 — Speed Violation Rankings:**
- Top corridors by anomalous speed incidents
- Sorted by violation count descending

---

### 5.8 View 6 — Camera Node Health & CCTV Grid

**File:** `frontend/js/views/cameras.js`  
**Purpose:** Monitor the health and status of all 8 Chennai ANPR camera nodes.

#### Features

**Status Grid:**
- 8 camera cards with: Node ID, Name, Zone, Status badge (ONLINE/DEMO/OFFLINE), Sightings Today, Last Seen timestamp
- Live status indicators with pulsing green dot (ONLINE) or muted indicator (OFFLINE/DEMO)

**Quad CCTV Matrix:**
- 4-channel simulated live feed grid
- Displays synthetic camera frames with bounding boxes and plate overlays
- Live timestamp watermark per channel

**Node Map:**
- Leaflet mini-map with all 8 camera pins
- Click pin → highlights camera card and shows coordinates

**Search & Filter:**
- Filter cameras by zone or status
- Search by camera name or ID

**Export:**
- CSV download: camera ID, name, zone, lat, lon, status, sightings

---

## 6. Data Flow — End-to-End

```
1. DETECTION
   Camera RTSP feed → OpenCV frame grab → RapidOCR → plate_text + confidence
   + HSV color extract → vehicle_color
   + Vehicle type classify → CAR/BUS/TRUCK/2W/AUTO
   ↓
   POST /api/sightings/ingest → SQLite: sightings table

2. TRAJECTORY QUERY
   User searches plate "TN09CB1234"
   → GET /api/trajectory?query=TN09CB1234&role=operator
   → Query: SELECT * FROM sightings WHERE plate_text LIKE '%TN09CB1234%'
   → For each consecutive sighting pair (i, i+1):
       * fuse_sighting_pair() calculates composite score
       * calculate_bearing() returns direction of travel
       * baseline lookup for speed anomaly check
   → Returns: array of hops with scores, heading, anomaly flags
   ↓
   Frontend renders: Leaflet polyline, per-hop table, simulation

3. ALERT GENERATION
   POST /api/alerts/scan
   → scan_all_alerts() iterates all sightings
   → Checks: clone / impossible_transit / blacklist / zone_deviation / route_anomaly
   → Inserts alerts into SQLite: alerts table

4. ALERT POLLING (every 8s)
   GET /api/alerts/unseen?since_id=X
   → Returns only NEW alerts since last poll
   → If count > 0: trigger Web Audio beep + show toast card

5. HEATMAP REFRESH (every 20s)
   GET /api/heatmap
   → LEFT JOIN cameras + sightings → all 8 cameras with counts
   → Renders: circle markers (density), corridor polylines (route density)
```

---

## 7. OCR Accuracy Evaluation — 11-Clip Benchmark

**Evaluation command:**
```bash
py -3.13 backend/eval_ocr.py
```

**Results (measured 2026-09-14):**

| Clip | True Plate | Category | Detected | Conf | Sim | Status |
|------|-----------|----------|----------|------|-----|--------|
| clip_01 | TN09CB1234 | clean | TN09CB1234 | 0.85 | 1.00 | EXACT MATCH |
| clip_02 | TN07AX4521 | clean | TN07AX4521 | 0.86 | 1.00 | EXACT MATCH |
| clip_03 | TN10BE9876 | clean | TN10BE9876 | 0.86 | 1.00 | EXACT MATCH |
| clip_04 | KA03MD5522 | clean | KA03MD5522 | 0.81 | 1.00 | EXACT MATCH |
| clip_05 | TN22CY3311 | clean | TN22CY3311 | 0.81 | 1.00 | EXACT MATCH |
| clip_06 | MH02EZ9012 | clean | MH02EZ9012 | 0.84 | 1.00 | EXACT MATCH |
| clip_07 | TN01AZ7788 | blur | (unconfirmed) | 0.00 | 0.00 | FALLBACK ✓ |
| clip_08 | TN05BK6655 | lighting | (unconfirmed) | 0.00 | 0.00 | FALLBACK ✓ |
| clip_09 | TN11DX4499 | weather | TN11DX4499 | 0.84 | 1.00 | EXACT MATCH |
| clip_10 | KA05MN8833 | angle | KA05MN8833 | 0.83 | 1.00 | EXACT MATCH |
| clip_11 | DL04CA1122 | damage | DL04CA1122 | 0.86 | 1.00 | EXACT MATCH |

**Summary:**
- Clean accuracy: **100.0%** (exceeds PS ≥90% requirement)
- Overall (all 11 clips): **81.8%**
- Blur + Lighting: graceful `(unconfirmed)` fallbacks — no hallucination

---

## 8. PS 26127 Compliance Checklist — All 9 Requirements

| # | Requirement (quoted from PS) | Implementation | File(s) | Status |
|---|------------------------------|----------------|---------|--------|
| 1 | "exceeding 90% recognition accuracy" | Clean: 100%, recorded in README + BUILD_LOG | eval_ocr.py, data_generator.py | ✅ |
| 2 | All 5 degradation conditions | 11 clips: blur, lighting, weather, angle, damage | data_generator.py, eval_ocr.py | ✅ |
| 3 | Multi-vehicle / multi-lane detection | detect_multi_vehicles_and_plates() with lane partitioning | detect.py | ✅ |
| 4 | Origin-Destination pattern reporting | /api/od-patterns + Trends view Card 3 | main.py, trends.js | ✅ |
| 5 | Congestion bottleneck detection | /api/corridor-bottlenecks (1.5× delay threshold) | main.py, trends.js | ✅ |
| 6 | Explicit direction of travel | bearing_deg + heading + heading_arrow in trajectory API | match.py, main.py, trajectory.js | ✅ |
| 7 | Route density map layer | Corridor polylines on heatmap (width ∝ sample_count) | heatmap.js | ✅ |
| 8 | Real-time polling / live data refresh | _startPolling(20000ms) auto-refresh on heatmap | heatmap.js | ✅ |
| 9 | Zero-sighting camera representation | LEFT JOIN on cameras table, muted dashed markers | main.py, heatmap.js | ✅ |

---

## 9. How to Run the System

### Prerequisites
```
Python 3.10+ (tested on 3.13)
pip packages: fastapi uvicorn opencv-python pillow rapidocr-onnxruntime numpy pyyaml reportlab
```

### Option A — Live Backend + Dashboard

```bash
# Step 1: Start FastAPI server (auto-inits DB and seeds data on first run)
py -3.13 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# Step 2: Open browser
http://127.0.0.1:8000/
```

### Option B — Static GitHub Pages Preview

```bash
# Step 1: Export static JSON snapshots
py -3.13 backend/export_static.py

# Step 2: Serve docs folder
py -3.13 -m http.server 8008 --directory docs

# Step 3: Open browser
http://127.0.0.1:8008/
```

### Option C — Run with Live Camera Feeds

```bash
# Step 1: Edit camera YAML registry
notepad backend/camera_config.yaml

# Step 2: Start camera ingest service
py -3.13 backend/ingest_service.py

# Step 3: Start API server
py -3.13 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### Option D — Run OCR Evaluation

```bash
# Generate synthetic test clips
py -3.13 backend/data_generator.py

# Run OCR evaluation
py -3.13 backend/eval_ocr.py
```

### Option E — Run System Verification (19-Row Check)

```bash
py -3.13 -X utf8 run_verification.py
```

Expected output: `PRESENT=19/19 · PARTIAL=0/19 · ABSENT=0/19 · ERROR=0/19`

---

## 10. File Directory — Complete Project Structure

```
PS127/
├── backend/
│   ├── main.py                 FastAPI app — all 22 REST endpoints, startup, CORS
│   ├── database.py             SQLite schema, 7 tables, indexes, seed data
│   ├── match.py                3-factor identity fusion, direction/bearing engine
│   ├── baseline.py             Corridor baselines, 5-type anomaly detector, convoy scanner
│   ├── ocr.py                  RapidOCR-ONNX multi-frame plate recognition
│   ├── detect.py               Vehicle detection, multi-lane partitioning
│   ├── vote.py                 Multi-frame OCR voting consensus engine
│   ├── embed.py                24-dim HSV visual embedding generator
│   ├── camera_ingest.py        Threaded RTSP capture, grammar autocorrect, LRU dedup
│   ├── ingest_service.py       Watchdog supervisor for multi-camera streams
│   ├── camera_config.yaml      Production RTSP camera network registry
│   ├── data_generator.py       11-clip synthetic OCR benchmark generator
│   ├── eval_ocr.py             OCR evaluation harness with per-category reporting
│   ├── export_static.py        Static JSON snapshot exporter for GitHub Pages
│   └── data/
│       ├── anpr.db             SQLite database (auto-created on startup)
│       ├── eval_results.json   OCR evaluation results (11-clip benchmark)
│       ├── clips/              Synthetic test video clips (clip_01–clip_11)
│       └── snapshots/          Camera snapshot images (served at /data/snapshots/)
│
├── frontend/
│   ├── index.html              Main SPA shell — header, KPI strip, sidebar, view mount
│   ├── css/
│   │   ├── style.css           Tactical design system, video player, fullscreen, HUD styles
│   │   └── print.css           Forensic print/PDF layout (A4, court-admissible)
│   ├── js/
│   │   ├── app.js              SPA controller, routing, command palette, audio polling
│   │   ├── dataSource.js       HTTP client (dual-mode: live API / static JSON)
│   │   ├── audioAlert.js       Web Audio API procedural alarm synthesizer
│   │   ├── toastManager.js     Global tactical toast notification system
│   │   └── views/
│   │       ├── trajectory.js   View 1: Trajectory + Cinema Map + Video Player + HUD
│   │       ├── heatmap.js      View 2: Density heatmap + route density + zone overlay
│   │       ├── blacklist.js    View 3: Watchlist management and plate check
│   │       ├── alerts.js       View 4: Incident triage + acknowledgment + audit log
│   │       ├── trends.js       View 5: Trends + O-D matrix + congestion + baselines
│   │       └── cameras.js      View 6: Camera health grid + CCTV quad matrix
│   └── static_data/            Pre-exported JSON for static/offline mode
│       ├── heatmap.json
│       ├── zones.json
│       ├── corridor_baseline.json
│       ├── od_patterns.json
│       ├── corridor_bottlenecks.json
│       ├── traffic_trend.json
│       ├── blacklist.json
│       ├── alerts.json
│       ├── audit_log.json
│       └── trajectory_*.json   (7 demo plates)
│
├── docs/                       GitHub Pages static site
│   ├── index.html              Static documentation site
│   └── static_data/            Synced copy of frontend/static_data/
│
├── README.md                   Project overview, OCR accuracy, quickstart
├── BUILD_LOG.md                Complete build log and PS gap closure table
├── DESIGN.md                   Design system specification and token reference
├── SCHEMA.md                   Database schema documentation
├── PRD.md                      Product requirements document
├── TRD.md                      Technical requirements document
├── SIH_PITCH_AND_EVALUATION_ALIGNMENT.md   SIH pitch alignment
├── SYSTEM_MANUAL_A_TO_Z.md     This document (AI reference + complete manual)
├── run_verification.py         19-row automated system verification script
├── test_design_audit.py        CSS design contract audit script
└── generate_pdf_manual.py      ReportLab PDF generation script
```

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| ANPR | Automatic Number Plate Recognition — optical vehicle identification system |
| OCR | Optical Character Recognition — machine reading of plate characters |
| Identity Fusion | Multi-signal scoring system combining plate, visual, and kinematic evidence |
| Composite Score | Weighted sum of plate, visual, and transit scores (0.0–1.0) |
| Corridor Baseline | Historical μ ± σ transit time/speed between a camera pair |
| Haversine | Great-circle formula for accurate geographic distance between GPS coordinates |
| Bearing | True-north direction of travel in degrees (0°–360°) |
| Clone Alert | Two sightings of the same plate at impossible distance/time simultaneously |
| Impossible Transit | Transit speed between cameras exceeds 140 km/h urban limit |
| Route Anomaly | Transit time deviates > 3σ from corridor baseline (statistically abnormal) |
| Zone Deviation | Vehicle detected within a restricted geofence perimeter |
| O-D Pattern | Origin-Destination pair: first camera where a vehicle was seen → last camera |
| Congestion Bottleneck | Corridor where mean transit exceeds 1.5× fleet average delay |
| Graceful Fallback | When OCR confidence is too low, returning (unconfirmed) instead of a wrong plate |
| STATIC_MODE | Frontend mode reading from pre-exported JSON files (GitHub Pages compatible) |
| LRU Deduplicator | Least-Recently-Used cache suppressing repeated detections of the same vehicle |
| HUD | Heads-Up Display — the bottom telemetry bar during map simulation |
| Cinema Map | Full-screen (100vw × 100vh) Leaflet map mode for surveillance playback |
| RTSP | Real Time Streaming Protocol — used by IP surveillance cameras |
| ICCC | Integrated Command & Control Centre — municipal smart city operations hub |
| SIH | Smart India Hackathon — national student innovation competition |
| PS 26127 | Problem Statement 26127 from BEL, the challenge this system addresses |

---

*End of NexusCaliber System Manual A to Z — Version 4.0*  
*BEL SIH Problem Statement 26127 | Team NexusCaliber | 2026-09-14*
