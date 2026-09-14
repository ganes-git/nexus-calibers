# PRD.md — City-Wide ANPR Trajectory & Route-Anomaly Engine

**PS ID:** 26127 | **Organization:** Bharat Electronics Limited (BEL) | **Category:** Software | **Theme:** Smart Automation
**Team:** NexusCaliber

---

## Overview

A software platform that tracks vehicles by license plate across a city-wide camera network, stays on a vehicle's trail even when a plate can't be read by falling back on appearance and travel-time evidence, and — its core differentiator — learns what a normal journey between any two cameras looks like from its own data and automatically flags journeys that don't fit. Built for traffic police, city traffic-management authorities, and transport regulators who currently only have plate-string matching and static blacklist rules to work with.

---

## Problem Statement

As issued by BEL (PS 26127): city CCTV/ANPR networks process feeds in isolated silos, doing basic plate detection without linking data across space and time. This prevents automatic tracking of high-interest vehicles across sectors and limits extraction of city-wide traffic trends from existing camera infrastructure. The required solution has three core functions — a >90%-accuracy OCR engine across degraded real-world conditions, single-plate trajectory reconstruction on a GIS map, and macro traffic analytics (density, origin-destination patterns, congestion bottlenecks, heatmaps) — plus an alert system for blacklisted vehicles **and suspicious route anomalies** (quoted directly from BEL's Expected Solution text).

---

## Target Users & Personas

Only personas implied by the established project context (not invented beyond this):

- **Operator (Traffic Police / Law Enforcement).** Searches a plate or sighting, reviews a trajectory and its per-hop confidence breakdown, responds to real-time alerts. Primary daily user.
- **Supervisor (ICCC / Smart City Authority).** Everything an Operator can do, plus visibility into the append-only search audit log — oversight role, not just usage role.
- **Judiciary / Transport Regulator.** Indirect/downstream user. Doesn't operate the dashboard directly but consumes its output (a trajectory's per-hop evidence trail) as something that must be legally explainable, not just visually convincing.

[NEEDS INPUT: whether additional personas — e.g. a system administrator role for zone/blacklist configuration — are in scope. Not currently implied by anything decided so far; not invented here.]

---

## Competitive Landscape

Researched directly (live search), not from memory. Findings current as of this document.

| Product / System | What it does | What's missing relative to this PS | Source |
|---|---|---|---|
| **Chennai ANPR network** (Smart City + Traffic Police) | Plate-string matching, e-challan generation, blacklist alerts, live control-room monitoring | Plate-only identity — no fallback when a plate is unreadable; no route-anomaly detection; alerting is static-rule only | Established in earlier project research. **Exact camera counts / tender figures not independently re-verified in this pass — cite cautiously if quoted live.** |
| **Coimbatore CCTV + CCTNS facial recognition** | GIS-based spatial CCTV analytics; facial recognition tied to the national crime database | Same plate-only/rule-only gap; facial recognition ≠ vehicle appearance fusion | Established in earlier project research; not re-verified this pass. |
| **Hikvision AcuSense / AcuSearch** | On-camera/NVR deep-learning classifier (person/vehicle/other) cutting false alarms up to ~90%; AcuSearch on VPRO NVRs does forensic attribute search (vehicle, colour, time window) across recorded footage, ~300,000 targets/day/channel | Manual, operator-initiated search — not automatically fused into a live per-sighting match score; no plate-text integration; no statistical route-anomaly detection | netviewcctv.co.uk (2026 installer guides); hikvision.com |
| **Dahua AcuPick (2.0)** | Automatic cross-camera visual search from a single reference image or drawn attribute filter (vehicle color, type, logo); "cross-camera searching" to track a target across a camera network | Still a *search* tool (retrieve matching footage) — no fusion with plate-text, no travel-time plausibility scoring, no automatic anomaly baseline | dahuasecurity.com; controlex-shop.com; ipcamtalk.com (2024–2026) |
| **BEL's own Smart City / Surveillance Systems catalogue** | Existing shipping product line | Same plate-only gap as the deployed systems above | Established in earlier project research. |
| **Academic: Sun (2014), "Vehicle Anomaly Detection Based on Trajectory Data of ANPR System"** | Per-vehicle anomaly detection from ANPR trajectory data, validated on a real 300+-camera Chinese ANPR deployment over 2 months | Research system — no operator-facing UI, no integration with identity fusion or clone detection, no per-hop explainability | IEEE, verified this project's prior research pass |
| **Academic: "Anomalous Trajectory Detection Between Regions of Interest Based on ANPR System"** (ICCS 2018) | Builds a "standard group" (baseline) vs. "candidate group" (anomaly) between region pairs from ANPR data | Same gap — research-grade, not productized, no explainable per-hop scoring | Springer, verified this project's prior research pass |
| **Homayounfar et al. (2011) / POLARBEAR project** | Statistical (Benford's-Law-based) anomaly detection on ANPR journey patterns; validated on 185 days of real UK police ANPR data (~200M reads); Thales UK was a project partner | Convoy/multi-vehicle correlation focus, not single-vehicle baseline learning; no evidence of commercial productization | kar.kent.ac.uk, verified this project's prior research pass |

**What this project borrows/avoids, explicitly:** the automatic, no-manual-trigger behavior of AcuPick's cross-camera search (borrowed conceptually, but extended to fuse plate text + travel time, which none of the above do); the explainability gap in the academic anomaly-detection work (avoided — every alert in this system states which specific baseline it deviated from and by how much, not a black-box flag).

**Honest framing, carried from this project's own prior internal audit:** the defensible novelty claim is that *no reviewed system combines automatic per-vehicle route-anomaly detection with plate+appearance+timing identity fusion, in one integrated, explainable platform* — not that route-anomaly detection from ANPR data is unprecedented in the research literature. It isn't; see the academic entries above, which should be cited proactively in any presentation of this project, not omitted.

---

## Goals & Non-Goals

**Goals (this MVP):**
- Reconstruct a vehicle's trajectory across the camera network from its plate, surviving unreadable/occluded plates.
- Detect and explain four automatic alert conditions: cloned plate, impossible transit time, restricted-zone entry, statistical route anomaly.
- Provide city-scale descriptive analytics: density heatmaps, per-corridor average speed, hourly traffic trend.
- Present every automated decision (trajectory link, alert) with a stated, checkable reason — never a black-box flag.

**Non-Goals (explicit, decided earlier in this project — do not silently reintroduce):**
- Real edge hardware deployment (architecture is edge-first *by design*, not physically demonstrated).
- Cross-city/cross-vendor data exchange at real scale (schema designed, not implemented).
- Origin-destination pattern identification and predictive congestion forecasting. **⚠ These are explicitly named in the PS's own Expected Solution text and are a real, previously-flagged gap against the requirements — kept as a non-goal for this MVP by prior decision, but this is a risk, not a settled matter. See Open Questions.**
- Full production RBAC, encryption-at-rest, city-scale streaming infrastructure (only a UI-level Operator/Supervisor toggle exists, explicitly not real authentication).
- Polygon-shaped restricted zones (a simple radius check stands in).

---

## User Stories

Every MVP feature below traces to one of these:

1. As an **Operator**, I want to search a plate or sighting and see its full trajectory with a per-hop confidence breakdown, so I can verify a vehicle's movement history before acting on it.
2. As an **Operator**, I want to be alerted immediately — visually and audibly — when a clone, blacklist match, zone violation, or route anomaly fires, so I don't have to continuously watch the dashboard.
3. As an **Operator**, I want a trajectory to continue even when one camera couldn't read the plate, so a single bad frame doesn't break the trail.
4. As a **Supervisor**, I want to see the audit log of every search performed, so I can ensure the system isn't being misused.
5. As a **Supervisor / ICCC Analyst**, I want density heatmaps, corridor average speeds, and hourly sighting trends, so I can understand city-wide traffic patterns.
6. As a **Judiciary / Transport Regulator**, I want every trajectory link's underlying evidence (plate/visual/transit scores) visible on request, so the trail is legally explainable, not just asserted.

---

## MVP Feature List

**Must-have (already built or in active development, per prior project decisions):**
- ANPR/OCR pipeline with multi-frame voting and measured (not assumed) accuracy against ground truth.
- Identity-fusion trajectory matching (plate + visual + transit signals).
- Corridor baseline learning + route-anomaly scoring (the core differentiator).
- Five alert types: clone, impossible_transit, blacklist, zone_deviation, route_anomaly.
- Five dashboard views: Trajectory Search, Heatmap (with restricted-zone overlay), Blacklist Check, Alerts (+ role-gated audit log), Traffic Trends.
- Operator/Supervisor role toggle (explicitly disclosed as UI-only, not real authentication).
- Corridor average speed and hourly traffic-trend chart.

**Must-have, new to this revision (explicitly requested):**
- Audible + visual (toast/popup) alert notifications for all five alert types, with a mute control (see UI-UX.md for exact behavior).
- Zero-console-error requirement for the frontend, enforced as a build/verification gate, not just a style goal (see TRD.md Non-Functional Requirements).

**Stretch (not committed for this MVP):**
- Origin-destination pairing and congestion-bottleneck detection, buildable from the already-collected corridor-baseline data but not yet implemented.

---

## Success Metrics

Only measurable ones — no vanity metrics:

- **OCR accuracy**, measured against ground-truth plates in the demo dataset. [NEEDS INPUT: the measurement script exists in this project's build plan but has not yet been run and reported — no figure exists yet.]
- **Identity-fusion match precision/recall/AUC**, once the likelihood-ratio upgrade and its evaluation script are implemented. [NEEDS INPUT: not yet measured.]
- **Zero unhandled browser-console errors** across all five dashboard views (new requirement, directly checkable).
- **Alert latency** (sighting → alert appearing on screen). [NEEDS INPUT: not yet benchmarked.]

---

## Assumptions & Open Questions

- **[NEEDS INPUT] Team size & skills available** — not established anywhere in this project's prior context.
- **[NEEDS INPUT] Published judging criteria for this round** — not provided; this document does not assume a rubric.
- **[NEEDS INPUT] Timeline before demo** — the build execution plan (separate document) budgets roughly six hours; this PRD does not assume that figure applies to the planning phase itself.
- **Open risk, not a question:** origin-destination pairing and congestion-bottleneck detection are explicitly named in the PS text and are currently non-goals. This was flagged as a genuine gap in a prior independent review of this project and has not been resolved — it should be revisited before final submission, not silently left as-is.
- Competitive-landscape figures for Chennai/Coimbatore specifically (camera counts, tender values) were sourced in earlier project research and were **not** independently re-verified in this document's research pass — flag this if quoting exact numbers live to a panel.

---

## Out of Scope

Real edge hardware · cross-city/cross-vendor data exchange at scale · origin-destination pairing · predictive congestion forecasting · production-grade RBAC/encryption/streaming infrastructure · polygon geofencing · real user authentication (the role toggle is a UI simulation only).
