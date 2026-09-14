# NexusCaliber // ANPR Trajectory & Route-Anomaly Engine
## Complete System Architecture, Technical Specification & Operations Manual (A to Z)
**Project Code:** BEL PS 26127  
**Classification:** Law Enforcement / Smart City ICCC Traffic Surveillance  
**Deployment Target:** Integrated Command and Control Centre (ICCC), Chennai Traffic Police  
**Version:** 3.7.0 (Production Release)  

---

## 1. Executive Summary & Mission Overview

### 1.1 Purpose & Problem Statement
Urban traffic surveillance networks generate millions of optical Automatic Number Plate Recognition (ANPR) detections daily across hundreds of edge CCTV cameras. In metropolitan environments like Chennai, law enforcement operators face three critical operational bottlenecks:
1. **OCR Ambiguity & Plate Degradation**: Dust, motion blur, bad lighting, and non-standard fonts cause OCR misreads (e.g., confusing `8` with `B`, `0` with `D` or `O`, `1` with `I`).
2. **Identity Fragmentation**: Tracking suspect vehicles across multiple non-contiguous camera hops requires correlating optical plate text, vehicle visual features (type, color), and physical transit time plausibility.
3. **Route & Speed Anomaly Blind Spots**: Manual monitoring cannot detect subtle route deviations, abnormal transit delays, impossible travel times (indicating license plate cloning), or coordinated multi-vehicle convoy formations.

### 1.2 The NexusCaliber Solution
**NexusCaliber** is a real-time, city-wide ANPR trajectory reconstruction and route-anomaly detection platform. It ingests optical camera sightings from edge RTSP feeds, calculates a **3-factor identity-fusion weight score**, models historical corridor baselines, detects anomalies using statistical deviation algorithms, and presents an interactive Command & Control dashboard featuring full-screen cinema map playback and forensic PDF/CSV exports.

```
+----------------------------------------------------------------------------------------------------+
|                                    NEXUSCALIBER SYSTEM TOPOLOGY                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [Edge CCTV Cameras] ---> [RTSP Streams]                                                           |
|                                |                                                                   |
|                                v                                                                   |
|                    [Camera Ingest Workers]                                                         |
|                    * Threaded Frame Grabbing (OpenCV)                                              |
|                    * OCR Character Grammar Engine                                                  |
|                    * HSV Vehicle Color Classifier                                                  |
|                    * LRU Stream Deduplicator                                                       |
|                                |                                                                   |
|                                v (SQLite / anpr.db)                                                |
|                                                                                                    |
|                    [NexusCaliber Core Backend]                                                     |
|                    * 3-Factor Identity Fusion (Levenshtein + Cosine Visual + Haversine Kinematics) |
|                    * Corridor Baseline Speed & Transit Modeling                                    |
|                    * Convoy Formation & Plate Clone Detectors                                      |
|                    * Supervisor Audit Trail & Role Gating                                          |
|                                |                                                                   |
|                                v (REST API / WebSocket Polling)                                    |
|                                                                                                    |
|                    [Tactical Operator Frontend]                                                    |
|                    * Full-Screen Cinema Surveillance Map (Leaflet)                                 |
|                    * Video-Player Playback & Live Scrubber Timeline                                |
|                    * Real-Time Bottom Telemetry HUD ("Flight Recorder")                            |
|                    * Density Heatmaps, Watchlist Triage, KPI HUD & Live Ticker                     |
|                    * Web Audio Alert Engine & Global Toast Notifications                           |
|                    * RFC 4180 CSV & Print-Ready PDF Evidence Export                                |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Complete Technology Stack

| Layer | Technologies / Libraries | Specific Version & Purpose |
|---|---|---|
| **Backend Runtime** | Python 3.11+ / Python 3.13 | High-concurrency async runtime for web APIs and mathematical modeling |
| **Web API Framework** | FastAPI + Uvicorn + Starlette | Asynchronous ASGI framework for REST endpoints, middleware, and streaming |
| **Database & Storage** | SQLite 3 + WAL Mode + Thread-safe Connections | Persistent relational storage for sightings, cameras, alerts, baselines, audit logs |
| **Computer Vision / OCR** | OpenCV (`cv2`), EasyOCR, PyYAML | Video capture, frame preprocessing, bounding box extraction, deep optical OCR |
| **Spatial & Mathematics** | Haversine Formula, NumPy, SciPy (IQR/Z-Score) | Great-circle distance calculations, physical velocity constraints, statistical outlier detection |
| **Frontend UI Core** | HTML5, Vanilla JavaScript (ES2022+), CSS3 Variables | Zero external frontend build dependencies, high-performance tactical dashboard |
| **Spatial GIS Mapping** | Leaflet.js 1.9.4 + OpenStreetMap Tiles | Interactive GIS mapping, circle markers, polyline trajectories, tile rendering |
| **Heatmap Engine** | Leaflet.heat (Custom Heat Canvas Renderer) | Kernel density estimation for spatial sighting hotspots |
| **Typography** | Plus Jakarta Sans & JetBrains Mono | Tactical command-center UI typography and high-legibility monospace alphanumeric data |
| **Audio Alerting** | HTML5 Web Audio API (`AudioContext`) | Procedural audio sound synthesizer for multi-tone tactical alarm beeps |
| **Forensic Export** | Native CSS Paged Media (`print.css`), RFC 4180 CSV | Court-admissible print-ready PDF forensic exports and structured CSV data exports |
| **Document Generation**| ReportLab 4.x | Automated production of publication-quality system documentation in PDF format |

---

## 3. Backend Architecture & Core Modules

### 3.1 Data Architecture & Schema (`backend/database.py`)
The SQLite relational database (`anpr.db`) implements a schema optimized with indexes on optical search keys and timestamps:

1. **`cameras`**: Node ID (`CAM-ANNA-001`), location name, GPS coordinates (`lat`, `lon`), zone (`Central`, `North`, `South`, `West`), status (`ONLINE`, `DEMO`, `OFFLINE`).
2. **`sightings`**: Unique sighting ID, camera ID, UTC timestamp, plate text, OCR confidence (`0.0 - 1.0`), visual vector embedding (`16-dim float array`), vehicle type (`CAR`, `BUS`, `TRUCK`, `2W`, `AUTO`, `UNKNOWN`), vehicle color (`WHITE`, `BLACK`, `SILVER`, `RED`, `BLUE`, `YELLOW`), snapshot image path.
3. **`blacklist`**: Watchlist plate registry, offense category (`STOLEN`, `WANTED`, `TRAFFIC_VIOLATOR`, `IMPOUND_NOTICE`, `EXPIRED_PERMIT`), active flag, registered timestamp, registered officer badge ID.
4. **`alerts`**: Incident ID, plate text, sighting ID, alert type (`SPEED_ANOMALY`, `ROUTE_DEVIATION`, `IMPOSSIBLE_TRANSIT`, `BLACKLIST_HIT`, `CONVOY_DETECTED`), severity (`CRITICAL`, `HIGH`, `MEDIUM`), confidence score, timestamp, explanation, acknowledgment status, acknowledged officer badge ID.
5. **`corridor_baselines`**: Origin camera, destination camera, sample size, historical mean transit time (sec), historical mean speed (km/h), standard deviation.
6. **`audit_log`**: Officer role (`operator`, `supervisor`), officer badge ID, action executed, query string, timestamp.

---

### 3.2 The 3-Factor Identity Fusion Algorithm (`backend/match.py`)
When correlating sightings across non-contiguous camera nodes, raw license plate text matching is insufficient due to OCR noise. NexusCaliber computes a composite identity score $S_{\text{composite}} \in [0, 1]$:

$$S_{\text{composite}} = w_{\text{plate}} \cdot S_{\text{plate}} + w_{\text{visual}} \cdot S_{\text{visual}} + w_{\text{transit}} \cdot S_{\text{transit}}$$

Where default production weights are:
$$w_{\text{plate}} = 0.50, \quad w_{\text{visual}} = 0.30, \quad w_{\text{transit}} = 0.20 \quad (\sum w_i = 1.0)$$

```
                                      +------------------------------------+
                                      | 1. OCR Levenshtein Plate Match     |
                                      | Normalized edit distance: 0.0-1.0  |
                                      | Weight: 50%                        |
                                      +-----------------+------------------+
                                                        |
                                                        v
+-----------------------------------+         +---------+----------+         +------------------------------------+
| 2. Visual Cosine Embedding        |         |  IDENTITY FUSION   |         | 3. Physical Transit Plausibility   |
| Vehicle color + type similarity   | ------> |  WEIGHTED SCORER   | <------ | Kinematic velocity plausibility    |
| Weight: 30%                       |         | (Score: 0.0 - 1.0) |         | Weight: 20%                        |
+-----------------------------------+         +---------+----------+         +------------------------------------+
                                                        |
                                                        v
                                      +------------------------------------+
                                      | Identity Match Decision:           |
                                      | >= 0.70 : Confirmed Hop            |
                                      | <  0.70 : Unconfirmed Candidate   |
                                      +------------------------------------+
```

#### Factor Breakdown:
1. **Plate Match ($S_{\text{plate}}$)**: Normalized Levenshtein Edit Distance between optical plate strings:
   $$S_{\text{plate}} = 1.0 - \frac{\text{Levenshtein}(P_1, P_2)}{\max(\text{len}(P_1), \text{len}(P_2))}$$
2. **Visual Embedding Similarity ($S_{\text{visual}}$)**: Cosine similarity between feature embeddings:
   $$S_{\text{visual}} = \frac{\mathbf{v}_1 \cdot \mathbf{v}_2}{\|\mathbf{v}_1\| \|\mathbf{v}_2\|}$$
3. **Transit Plausibility ($S_{\text{transit}}$)**: Evaluates physical kinematics using Haversine distance $\Delta d$ (km) and elapsed time $\Delta t$ (hours):
   $$v = \frac{\Delta d}{\Delta t}$$
   - If $v < 130\text{ km/h}$: $S_{\text{transit}} = 1.0 - \left(\frac{v}{130}\right)^2 \times 0.5$ (physically plausible).
   - If $v \ge 130\text{ km/h}$: $S_{\text{transit}} = \max(0.0, 1.0 - (v - 130) \times 0.02)$ (impossible transit penalty / cloning flag).

---

### 3.3 Statistical Route & Anomaly Engine (`backend/baseline.py`)
1. **Corridor Baseline Speed Modeling**: For every camera pair $(A, B)$, historical transits are aggregated to calculate mean velocity $\mu_v$ and transit time $\mu_t$.
2. **IQR & Z-Score Deviation**: A vehicle hop is flagged as a `ROUTE_ANOMALY` or `SPEED_ANOMALY` if:
   $$v > \mu_v + 2.5 \cdot \sigma_v \quad \text{or} \quad \Delta t > \mu_t + 3.0 \cdot \sigma_t$$
3. **Plate Cloning Detector (`IMPOSSIBLE_TRANSIT`)**: If the same license plate appears at two distinct cameras within a time delta $\Delta t$ requiring a velocity $v > 180\text{ km/h}$, an instant `CRITICAL` severity alert is raised.
4. **Convoy Detection Engine (`CONVOY_DETECTED`)**: Identifies 3 or more distinct vehicles that travel together across 2 or more consecutive camera checkpoints within a 10-minute time window ($\Delta t \le 600\text{s}$).

---

### 3.4 Live Edge Camera Ingestion Pipeline (`backend/camera_ingest.py`)
The edge ingest system connects to real-world RTSP IP camera streams (Hikvision, Dahua, Axis, CP Plus, Uniview) and applies deep vision inference:
1. **Threaded Capture & Frame Debouncing**: Runs background worker threads per camera with frame buffer size set to 1 (`CAP_PROP_BUFFERSIZE = 1`) to eliminate streaming latency.
2. **Indian License Plate Grammar Autocorrection (`correct_ocr_plate_characters`)**:
   - Indian standard plates follow the pattern: `[State: 2 Alpha][RTO: 2 Digit][Series: 1-2 Alpha][Number: 4 Digit]` (e.g., `TN 09 CB 1234`).
   - Automatically repairs common optical character misclassifications based on slot grammar (e.g., converts digit `0` in state code slot to `O`, or letter `B` in number slot to `8`).
3. **HSV Vehicle Color Classifier (`estimate_vehicle_color`)**: Samples the region surrounding the license plate, converts RGB to HSV color space, and maps hue, saturation, and value ranges to discrete tactical color tags (`WHITE`, `BLACK`, `SILVER`, `RED`, `BLUE`, `YELLOW`).
4. **LRU Detection Deduplicator (`DetectionDeduplicator`)**: Thread-safe memory cache that suppresses redundant OCR burst frames of the same vehicle at the same camera within a 3.5-second deduplication window.
5. **Watchdog Supervisor (`backend/ingest_service.py`)**: Multi-thread process manager that monitors camera stream health, auto-restarts failed network streams with exponential backoff, and exposes a JSON health endpoint on port `8001`.

---

## 4. REST API Reference (`backend/main.py`)

All endpoints return strict JSON payloads with headers `Cache-Control: no-cache, no-store, must-revalidate` to prevent stale caching.

| Endpoint | Method | Role Gating | Query / Body Parameters | Response Summary |
|---|---|---|---|---|
| `/api/health` | `GET` | Public | None | `{"status": "ok"}` |
| `/api/stats/summary` | `GET` | Public | None | Sightings today, active alerts, cameras online, watchlisted today |
| `/api/sightings/recent` | `GET` | Public | `limit=6` | Real-time optical sightings ticker feed |
| `/api/trajectory` | `GET` | Operator / Supervisor | `query`, `role`, `date_from`, `date_to` | Array of reconstructed vehicle hops with composite fusion score, speed, distance, anomaly flags |
| `/api/heatmap` | `GET` | Public | `zone`, `hours` | Geographic points array `[lat, lon, intensity]` for heatmap |
| `/api/blacklist` | `GET` | Public | `query` (optional) | Registered watchlist records with offense categories |
| `/api/blacklist` | `POST` | Supervisor | JSON: `{plate_text, offense_category, notes}` | Registers new plate into database with audit log entry |
| `/api/blacklist/{plate}` | `DELETE` | Supervisor | Plate string in URL | Deactivates watchlist status with audit log record |
| `/api/alerts` | `GET` | Public | `limit=50`, `unack_only=false` | Forensic incident alerts with severity tiers and confidence |
| `/api/alerts/unseen` | `GET` | Public | `since_id=0` | Delta alerts for real-time audio beeping and toast popups |
| `/api/alerts/{id}/acknowledge` | `PATCH`| Operator / Supervisor | `id` in URL, `badge_id` in query | Sets alert acknowledgment flag with officer badge ID |
| `/api/traffic-trend` | `GET` | Public | None | Hourly corridor throughput, peak volumes, speed violations |
| `/api/cameras` | `GET` | Public | None | Camera node registry, GPS coordinates, status, daily counts |
| `/api/audit-log` | `GET` | Supervisor Only | `limit=50` | Audit trail of all queries, watchlist edits, and system actions |
| `/api/sightings/ingest` | `POST` | Edge AI / Ingest | JSON sighting payload | Ingests real-time detection from external camera pipeline |
| `/api/sightings/simulate-transit` | `POST` | Operator / Demo | `plate_text`, `corridor_speed_kmh`, `anomaly` | Multi-hop synthetic transit simulator for live demonstrations |
| `/api/export/csv` | `GET` | Public | `dataset=alerts\|cameras\|blacklist` | RFC 4180 compliant CSV forensic export with file download |

---

## 5. Frontend Architecture & Design System

### 5.1 Design Philosophy & Aesthetics
The frontend implements a custom **Tactical ICCC Command & Control** design language:
- **Zero Framework Bloat**: Pure vanilla JavaScript and modular CSS variables with zero external node compilation dependencies.
- **Tactile Physics**: Double-bezel action buttons with active push-down physics (`transform: translateY(1px)`).
- **High-Density Data Display**: Compact, high-contrast tables with sticky headers (`position: sticky; top: 0`) and left-accent hover indicators.
- **Micro-Animations**: Real-time pulsing radar loading sweeps and smooth animated vehicle map markers.
- **Audio-Visual Synergy**: Procedural synthesized Web Audio beeps synchronized with visual alert toast cards.

```
+----------------------------------------------------------------------------------------------------+
|                                    TACTICAL FRONTEND INTERFACE                                     |
+----------------------------------------------------------------------------------------------------+
| [HEADER] NexusCaliber // ANPR Trajectory Engine | Role: Supervisor | Shift: TN-OPS-1042 | Audio: ON|
| [KPI STRIP] Sightings: 1,420 | Active Alerts: 14 | Cameras: 8/8 Online | Watchlisted: 5            |
+------------------------------------+---------------------------------------------------------------+
| SIDEBAR NAVIGATION                 | ACTIVE VIEW CONTAINER                                         |
| 1. 🛰️ Trajectory Search           |                                                               |
| 2. 🗺️ Sighting Heatmap             | [Full-Width Cinema Map & Video Player HUD]                    |
| 3. 🚨 Blacklist Watchlist          | +-----------------------------------------------------------+ |
| 4. ◬ Incident Alerts Triage        | | Leaflet GIS Map Canvas (520px Default / 100vw Fullscreen) | |
| 5. ▦ Traffic Trends & Analytics    | |                                                           | |
| 6. ⊡ Camera Health & CCTV Grid     | | [🚗 Moving Vehicle Marker with Radar Pulse Animation]     | |
|                                    | |                                                           | |
| LIVE SIGHTING TICKER (8s refresh)  | | [📍 BOTTOM TELEMETRY HUD: Leg, Speed, Distance, Status]  | |
| * TN09CB1234 @ CAM-ANNA-001        | +-----------------------------------------------------------+ |
| * KA03MD5522 @ CAM-TNAGAR-002      |                                                               |
| * DL01CA9999 @ CAM-GUINDY-004      | [Per-Hop Identity-Fusion Evidence Trail Data Table]           |
|                                    | | Hop | Camera | Time | Plate | Vehicle | Speed | Score | ACK |
| RECENT SEARCH HISTORY              | | #1  | CAM-01 | 10:14| TN09CB| CAR-WHT | 68km/h| 98.2% | Pan |
| * TN09CB1234 (Normal)              | | #2  | CAM-02 | 10:17| TN09CB| CAR-WHT | 72km/h| 96.5% | Pan |
| * KA03MD5522 (Anomaly)             |                                                               |
+------------------------------------+---------------------------------------------------------------+
```

---

### 5.2 The 6 Operational Views

#### View 1: Trajectory Search & Forensic Reconstruction (`frontend/js/views/trajectory.js`)
- **Interactive Query Engine**: Search by license plate or sighting ID with autocomplete datalist suggestions.
- **Full-Width Spatial Map**: 520px default height rendering Leaflet vector polylines, camera markers, and animated vehicle position.
- **Video-Player Simulation Bar**:
  - Play / Pause (`▶`/`⏸`), Step Backward (`⏮`), Step Forward (`⏭`), Reset (`⏹`).
  - Scrubber Timeline slider for hopping to specific sightings.
  - Multiplier speed selector (`0.75x`, `1x`, `2x`, `4x`).
- **Fullscreen Cinema Surveillance Mode**:
  - `[ ⛶ Fullscreen Map ]` button expands the map across 100vw × 100vh with automatic Leaflet tile re-rendering.
  - Press <kbd>ESC</kbd> or click `[ ✕ Exit Fullscreen ]` to return.
- **Live Bottom Telemetry HUD ("Flight Recorder")**:
  - Sits docked at the bottom of the map view without obscuring the road polyline.
  - Displays real-time Active Transit Corridor (`Hop #1 ➔ Hop #2`), Vehicle Identification, Speed, Distance, Elapsed Time, and High-Contrast Anomaly Status.
- **Per-Hop Identity Evidence Table**: Monospace table with expandable evidence breakdown drawer and `⎙ Export Evidence PDF` generator.

#### View 2: Sighting Heatmap (`frontend/js/views/heatmap.js`)
- Kernel density heatmap powered by Leaflet.heat.
- Dynamic intensity filtering by geographic zones (`All`, `Central`, `North`, `South`, `West`) and time windows (1h, 6h, 24h, 7d).
- Real-time radius and blur sliders for density analysis.

#### View 3: Blacklist / Watchlist Management (`frontend/js/views/blacklist.js`)
- Instant plate hotlist verification.
- Supervisor-gated watchlist registration with offense categorization (`STOLEN`, `WANTED`, `TRAFFIC_VIOLATOR`, `IMPOUND_NOTICE`).
- One-click deletion/removal with instant confirmation dialogs and audit logging.

#### View 4: Incident Alerts Triage & Supervisor Audit Log (`frontend/js/views/alerts.js`)
- Live alerts feed classified by severity: `CRITICAL` (Red), `HIGH` (Amber), `MEDIUM` (Green).
- Acknowledgment workflow: Officers click `[ ACK ]` to acknowledge alerts, automatically tagging their active Badge ID.
- Filter by Severity and Unacknowledged status.
- `[ 🛰️ TRACK ]` button for 1-click jump into full trajectory reconstruction.
- `[ 📥 Export CSV ]` button for forensic incident report download.
- Supervisor-only Audit Log viewer tracking all queries, search terms, and operator actions.

#### View 5: Traffic Trends & Speed Violations (`frontend/js/views/trends.js`)
- Hourly volume bar chart visualizing morning and evening traffic peaks across Chennai corridors.
- Speed Violations Leaderboard highlighting top speed offenders with corridor names and recorded velocities.
- Corridor Congestion Index table with live transit time averages.

#### View 6: Camera Node Registry & CCTV Matrix (`frontend/js/views/cameras.js`)
- 8-node camera network grid with live status indicators (`ONLINE`, `DEMO`, `OFFLINE`).
- **🎛️ Quad CCTV Live Stream Viewer**: 4-channel matrix simulating edge RTSP optical feeds with live timestamps and optical bounding boxes.
- Node map with interactive camera pins and coordinate inspector.
- `[ 📥 Export CSV ]` button for camera inventory download.

---

### 5.3 Global Command Palette & Hotkeys (`frontend/js/app.js`)
- Triggered globally via <kbd>Ctrl + K</kbd> or <kbd>/</kbd>.
- Instant fuzzy navigation to any view, quick-action execution (city-wide rescan, mute audio, export CSVs).
- Instant license plate jump: Typing any plate string (e.g. `TN09CB1234`) dynamically generates actions to reconstruct trajectory or verify watchlist status.
- Number keys (<kbd>1</kbd>–<kbd>6</kbd>) switch views instantly.
- Key <kbd>M</kbd> toggles audio alarm mute.

---

## 6. Real-World Camera Deployment Guide

To deploy NexusCaliber with live IP cameras in a municipal surveillance network:

```
+-------------------+           +-------------------------+           +----------------------+
| 1. IP Cameras     |  RTSP     | 2. Edge Ingest Service  |  SQLite   | 3. NexusCaliber Core |
| Hikvision / Dahua | --------> | camera_ingest.py        | --------> | backend/main.py      |
| H.264 / H.265     |           | EasyOCR + Grammar Engine|           | FastAPI Engine (:8000|
+-------------------+           +-------------------------+           +----------------------+
```

### Step 1: Install Edge Vision Dependencies
```bash
pip install opencv-python easyocr pyyaml
```

### Step 2: Configure Camera Network (`backend/camera_config.yaml`)
Edit the YAML registry to add your camera RTSP endpoints and GPS coordinates:
```yaml
cameras:
  - id: "CAM-ANNA-001"
    name: "Anna Nagar Roundtana North"
    zone: "Central"
    lat: 13.0850
    lon: 80.2100
    rtsp_url: "rtsp://admin:Password123@192.168.1.101:554/Streaming/Channels/101"
    enabled: true
    min_confidence: 0.65
    sample_interval_sec: 1.0
    save_snapshots: true
```

### Step 3: Launch Background Ingest Service
```bash
py -3.13 backend/ingest_service.py
```
The supervisor process will start independent worker threads for each enabled camera, monitor stream health, automatically reconnect on network drops, and write detections directly into `anpr.db`.

---

## 7. Verification & Quality Assurance Suite (`run_verification.py`)

The automated Playwright end-to-end verification script validates all critical functional paths:
1. **View 1 Trajectory Search**: Executes preset search, verifies map polyline, validates per-hop table, confirms video player controls and bottom telemetry HUD.
2. **View 2 Sighting Heatmap**: Verifies Leaflet.heat rendering, zone filter changes, radius/blur sliders.
3. **View 3 Blacklist Check**: Tests watchlist query, supervisor-gated plate registration, duplicate check, plate deletion.
4. **View 4 Incident Alerts & Audit Log**: Tests severity filter, alert acknowledgment, verifies audit log invisibility for Operator and visibility for Supervisor.
5. **View 5 Traffic Trends**: Verifies volume bar charts, speed violation table ranking.
6. **Global Audio & Toast Alerts**: Verifies procedural audio synthesizer, mute toggle state, and toast popup triggers.
7. **Deliberate Edge Cases**: Nonexistent plates, clean watchlist checks, malformed inputs.
8. **Browser Console Health**: Asserts `0 Console Errors` and `0 Uncaught Exceptions`.

---

## 8. Summary of System Assets & File Directory

```
PS127/
├── backend/
│   ├── main.py                # FastAPI REST application, middleware, and route handlers
│   ├── database.py            # SQLite schema, tables, indices, and seed data
│   ├── match.py               # 3-factor identity fusion algorithm and kinematics
│   ├── baseline.py            # Corridor speed baselines, anomaly detection, convoy clustering
│   ├── camera_ingest.py       # Threaded RTSP capture, EasyOCR, grammar auto-fix, color classifier
│   ├── ingest_service.py      # Watchdog supervisor process for multi-camera streams
│   └── camera_config.yaml     # Production camera network registry and RTSP endpoints
├── frontend/
│   ├── index.html             # Main dashboard UI, Command Palette, KPI strip, script loader
│   ├── css/
│   │   ├── style.css          # Tactical design system, Video Player HUD, Fullscreen styles
│   │   └── print.css          # Forensic print stylesheet for PDF evidence exports
│   └── js/
│       ├── app.js             # Core controller, routing, Command Palette, role gating
│       ├── dataSource.js      # Resilient HTTP client and network error handler
│       ├── audioAlert.js      # Procedural Web Audio API sound synthesizer
│       ├── toastManager.js    # Global tactical alert toast notifications
│       └── views/
│           ├── trajectory.js  # Trajectory query, Fullscreen Cinema Map, Video Player & HUD
│           ├── heatmap.js     # Sighting density heatmap and zone filters
│           ├── blacklist.js   # Watchlist registry management and hotlist check
│           ├── alerts.js      # Incident alerts triage, acknowledgment, supervisor audit log
│           ├── trends.js      # Traffic volume trends and speed violations leaderboard
│           └── cameras.js     # Camera node health grid, Quad CCTV matrix, CSV export
├── docs/
│   ├── index.html             # Static documentation viewer on port 8008
│   └── screenshots/           # Verification screenshots across all 6 views
├── run_verification.py        # Automated Playwright test and verification suite
└── SYSTEM_MANUAL_A_TO_Z.md    # Complete system architecture and operations manual
```

---
*End of Specification — NexusCaliber ANPR Trajectory & Route-Anomaly Engine (BEL PS 26127)*
