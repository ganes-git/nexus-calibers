# UI-UX.md — City-Wide ANPR Trajectory & Route-Anomaly Engine

Traces to PRD.md user stories and TRD.md components. No invented business goals here.

---

## Design Principles

Grounded in the Competitive Landscape research in PRD.md, plus this project's already-locked design system (not reinvented here):

1. **Automatic over manual, and say why.** Dahua AcuPick's cross-camera search is powerful but manual (a human must pick a reference image). This product's matching and anomaly detection run automatically on every sighting — the UI's job is to surface *why* a match or alert happened (per-hop scores, baseline deviation numbers), not just *that* it happened. This directly addresses the explainability gap found in the academic ANPR-anomaly research reviewed (Sun 2014, ICCS 2018) — those systems don't appear to expose operator-facing reasoning; this one leads with it.
2. **Serious operations tool, not a generic AI product.** Already-locked design contract (from this project's `DESIGN.md`, reused here, not redesigned): background `#FAFAF8`, primary text `#1F1F1F`, muted text `#6B6B63`, border `#E1DED6`, primary accent `#2F5233` (dark forest green), warning accent `#C98A1E` (amber), critical accent `#B3262A` (red). **No blue, indigo, purple, or gradients anywhere, on anything — including the new alert toasts.** Max 4px border-radius. No drop shadows, no glassmorphism, no bounce/spring animation. Monospace font for plate numbers, coordinates, timestamps, scores, IDs.
3. **New in this revision — alerts must interrupt attention without breaking the "serious tool" feel.** A toast + optional short tone, never a blocking modal, never a cutesy sound. This is a control-room tool; alerts should feel like a professional dispatch console, not a mobile app notification.

---

## User Flows

One per PRD user story.

**Flow 1 — Operator searches a trajectory (Story 1, 3, 6)**
Enter plate/sighting ID + date range → submit → map renders the path chronologically → per-hop table appears below with plate/visual/transit/composite scores → any hop with an unreadable plate is labeled "plate unconfirmed" instead of breaking the chain → any hop flagged by the anomaly engine shows a badge → clicking a flagged hop expands the specific reason (e.g. "9±3 min normal, this hop took 41 min").

**Flow 2 — Operator receives and responds to an alert (Story 2)**
Alert fires anywhere in the system → toast appears in a fixed corner across all views (not just the Alerts view) → optional tone plays once → Operator can click the toast to jump directly to that entry in the Alerts view, or dismiss it → toast auto-dismisses after a set duration if ignored, but remains in the Alerts table regardless.

**Flow 3 — Supervisor reviews the audit log (Story 4)**
Switch role selector to "Supervisor" → Audit Log section becomes visible within the Alerts view (hidden entirely, not just greyed out, in Operator mode) → table of every search performed, most recent first.

**Flow 4 — Analyst reviews traffic patterns (Story 5)**
Open Traffic Trends view → hourly bar chart of sightings loads → corridor table below shows mean transit time, average speed, sample count per camera pair, with seeded (synthetic-calibration) rows visually de-emphasized from real observed rows.

**Flow 5 — Regulator-facing evidence review (Story 6)**
Same as Flow 1's per-hop table — no separate screen. The requirement is that the evidence is *present and legible* on the existing Trajectory Search view, not a new export/report screen (none was requested).

---

## Screen Inventory

| Screen | Maps to user story |
|---|---|
| 1. Trajectory Search | Story 1, 3, 6 |
| 2. Heatmap | Story 5 |
| 3. Blacklist Check | Story 2 |
| 4. Alerts (+ role-gated Audit Log) | Story 2, 4 |
| 5. Traffic Trends | Story 5 |
| *(global, not a screen)* Alert toast + audio layer | Story 2, appears across all 5 screens |

---

## Per-Screen Breakdown

### 1. Trajectory Search
- **Purpose:** reconstruct and explain a specific vehicle's path.
- **Key elements:** search box (plate text or sighting ID), date range, Leaflet map with chronological connected markers, per-hop table (camera, timestamp, plate/visual/transit/composite scores, anomaly badge where flagged).
- **States:** *Empty* — no query yet, map centered on the city anchor, prompt text. *Loading* — map placeholder + table skeleton (plain gray blocks, no shimmer animation per the motion constraint). *No results* — plain text, "No trajectory found for this query," not a blank screen. *Error / backend unreachable* (new) — plain banner, "Unable to reach the backend — check your connection," not a silent failure. *Populated.*
- **Actions:** submit search → renders map + table; click a flagged hop → expands its reason inline.

### 2. Heatmap
- **Purpose:** show sighting density and restricted zones spatially.
- **Key elements:** Leaflet map, density-colored circle markers per camera (dark green = high, fading to background = low — no blue heat scale), dashed critical-accent circles for restricted zones with name tooltips.
- **States:** Loading, Populated, Error/unreachable (same pattern as above).
- **Actions:** hover a zone circle → tooltip with zone name and reason.

### 3. Blacklist Check
- **Purpose:** check a single plate against the blacklist.
- **Key elements:** search box, match/no-match result.
- **States:** Empty, Loading, Match (critical accent, states the reason on file), No match (plain, muted text — deliberately *not* styled as an error), Error/unreachable.
- **Actions:** submit → result appears inline, no page change.

### 4. Alerts (+ Audit Log)
- **Purpose:** central alert review; Supervisor-only audit oversight.
- **Key elements:** plain table (most recent first), alert_type color-coded (critical accent: clone/blacklist; amber: impossible_transit/zone_deviation/route_anomaly), Audit Log sub-section.
- **States:** Empty ("No alerts in this range"), Loading, Populated, Error/unreachable. Audit Log: hidden entirely in Operator mode (not present in the DOM, not just visually hidden — avoids a curious Operator opening dev tools and finding it anyway).
- **Actions:** role toggle switch → Audit Log mounts/unmounts; click an alert row → highlights the relevant hop if opened from Trajectory Search context.

### 5. Traffic Trends
- **Purpose:** descriptive city-wide analytics.
- **Key elements:** plain bar chart (inline SVG/DOM, no charting library) of sightings-per-hour; corridor table (camera pair, mean transit time, avg speed, sample count, source).
- **States:** Loading, Populated, Error/unreachable. Seeded rows in the corridor table render in muted text color with a small "seed" label — never visually identical to real observed data.
- **Actions:** none beyond viewing (no filters currently specced — **[NEEDS INPUT]** if date-range filtering on this view is wanted; not assumed here).

### Global — Alert Toast + Audio Layer (new)
- **Purpose:** ensure an Operator watching any screen notices a new alert without having to be on the Alerts view.
- **Key elements:** fixed-position toast (bottom-right, stacking if multiple), alert type + one-line reason, dismiss control, a persistent mute icon-button in the header.
- **States:** *Visible* (auto-dismiss after ~6s or manual dismiss), *Muted* (toast still appears silently; sound suppressed), *Stacked* (2+ alerts arrive close together — stack, don't overlap or replace).
- **Behavior:** sound plays once per unique alert, never repeats on re-render; toast is non-blocking (page remains fully interactive underneath); clicking a toast navigates to the Alerts view and highlights that row.

---

## Component Inventory

- **Pages (5):** Trajectory Search, Heatmap, Blacklist Check, Alerts, Traffic Trends.
- **Feature components:** trajectory map, per-hop score table, heatmap map, zone overlay, blacklist result panel, alerts table, audit log panel, corridor-baseline table, hourly bar chart, role selector.
- **Shared/global components (new additions marked):** left nav, header, role selector, **toast notification manager (new)**, **audio alert manager (new)**, error/unreachable banner (new — not previously specced, added per the NFR in TRD.md).

---

## Design System Basics

Brand direction **was** already given in this project's prior `DESIGN.md` — reused exactly, not reinvented:

- **Color:** background `#FAFAF8`; primary text `#1F1F1F`; muted text `#6B6B63`; border `#E1DED6`; primary accent `#2F5233`; warning accent `#C98A1E`; critical accent `#B3262A`. No other colors, including in the new toast component.
- **Typography:** UI text — system-ui / -apple-system / Segoe UI / sans-serif. Data fields (plates, coordinates, timestamps, scores, IDs) — monospace (ui-monospace / SF Mono / Cascadia Mono / Consolas).
- **Shape:** max 4px border-radius, everywhere, including the new toast.
- **Motion:** opacity/background-color transitions only, ≤150ms, ease timing. The toast's entrance/exit uses this same rule — no slide-bounce, no spring physics.
- **Sound (new, since none was previously specified):** a single short, low-key tone (not a siren, not a chime), distinct per severity tier is optional but not required — **[NEEDS INPUT: whether distinct tones per alert type/severity are wanted, or one tone for all alerts is sufficient]**. Default proposed here, flagged as an assumption: one tone for all alert types, since severity is already visually color-coded.

---

## Accessibility Notes

- Sound is never the only signal for an alert — every alert has an equally informative visual toast and a permanent row in the Alerts table. This is a direct requirement, not a nice-to-have, given the new audio feature.
- Color is never the only signal — every color-coded alert type also carries its text label (`clone`, `blacklist`, etc.), already true of the existing alert table design.
- The mute control must be keyboard-reachable and its state (muted/unmuted) conveyed by icon *and* text, not icon alone.
- Error/unreachable states use plain text, not color or iconography alone, so they're legible without relying on the accent palette.

---

## References

Real products/papers researched for this document (see PRD.md Competitive Landscape table for full detail):
- **Hikvision AcuSense/AcuSearch** — borrowed: automatic false-alarm-reduction philosophy (only surface signal, not noise). Avoided: search remains manual-trigger only in their product; this system automates it.
- **Dahua AcuPick 2.0** — borrowed: cross-camera automatic tracking of a single target. Avoided: their system doesn't explain *why* two sightings matched; this system's per-hop score breakdown directly addresses that gap.
- **Sun (2014) / ICCS 2018 ANPR-anomaly papers** — avoided: no operator-facing explainability in either — this project's explicit design principle #1 exists specifically because of this gap.
