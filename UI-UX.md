# UI-UX.md v2 — Visual & Layout Redesign

Supersedes the visual/layout portions of `UI-UX.md` (v1). Traces to the same PRD.md user stories and TRD.md components as v1 — nothing here changes what the product does.

**Reason for this pass:** the v1 spec was functionally sound but read as generic — the locked, restrained palette was correctly followed, but the layout underneath it (a uniform card grid, undifferentiated typography, default map pins, no distinct component language) is what actually made it feel templated, not the colors. This pass redesigns layout, typography, iconography, and component language. It changes nothing else.

## What changed / what didn't

| | |
|---|---|
| **Unchanged** | Color palette, tech stack (vanilla HTML/CSS/JS, Leaflet, no framework/build step), the 5 views and every state/action they must support, toast + audio alert behavior, the motion rule (opacity/background-color only, ≤150ms), font *families* (system-ui sans, system monospace) |
| **New in this pass** | An explicit type scale, a spacing scale, a single recurring "confidence/deviation meter" component used wherever a score or baseline deviation appears, custom flat map markers replacing default Leaflet pins, a single hand-drawn monoline icon set, a per-screen layout composition (no more one card-grid template repeated five times), a shared header status strip, an explicit focus-visible spec |

---

## Design Plan

**Color** — unchanged, reproduced for reference: background `#FAFAF8`, text `#1F1F1F`, muted `#6B6B63`, border `#E1DED6`, accent `#2F5233`, warning `#C98A1E`, critical `#B3262A`.

**Type** — one sans role (system-ui stack) for interface text, one monospace role (ui-monospace stack) for data. Same families as v1, but now with an explicit scale (below) instead of ad hoc sizing, and only two weights (400/600) — hierarchy comes from size and spacing, not boldness or color.

**Layout** — the single idea driving this pass: **the evidence is the design.** This product's whole pitch is "here's *why* this match or alert fired," so the per-hop score table, the corridor-baseline numbers, and the alert detail text are the visual centerpiece of their screens — not a map or chart sitting decoratively next to a generic card grid. Each of the 5 screens gets a layout shaped by its actual job (search-and-explain, spatial overview, single lookup, triage table, trend reading) instead of one dashboard template stamped five times.

**Principle** — restraint stays, but restraint means *quiet*, not *empty of decisions*. One recurring device, a small flat tick/bar meter next to every score or deviation number, carries the "instrument" character everywhere it's needed. Everything else (chrome, nav, buttons, headers) stays deliberately plain so that one device doesn't compete with anything.

*Self-check before building this out:* the generic default here would be a rounded-card grid with icon-topped stat tiles repeated on every screen — avoided by giving each screen its own asymmetric composition below. The other generic default would be tracked, all-caps section labels with a meta line underneath — avoided; labels stay sentence case, one line, nothing decorative that isn't already meaningful.

---

## Typographic Scale *(new)*

Sizes in rem, assuming a 16px root. Sans role unless marked mono.

| Role | Size | Weight | Used for |
|---|---|---|---|
| Screen title | 1.25rem (20px) | 600 | One per screen, top-left of the header strip |
| Section label | 0.8125rem (13px) | 600 | Sentence case — "Per-hop breakdown", "Restricted zones" |
| Body / table text | 0.875rem (14px) | 400 | Default interface text |
| Meta / caption | 0.75rem (12px) | 400, muted color | Timestamps under a heading, helper text |
| Data readout (mono) | 0.875rem (14px), tabular-nums | 400 | Plate text, coordinates, scores, IDs |
| Data readout, emphasized (mono) | 1rem (16px), tabular-nums | 600 | The one number a screen wants read first — e.g. a composite score in an expanded hop |

No size below 12px anywhere. No third typeface introduced.

## Spacing Scale *(new)*

4px base unit: `4, 8, 12, 16, 24, 32, 48`. Section padding defaults to 24px; inter-row padding in dense tables defaults to 8–12px; never less than 8px between two adjacent interactive targets.

## Iconography *(new)*

A single hand-drawn set, inline SVG, 1.5px stroke, no fill, monoline, 18–20px, colored `#1F1F1F` or `#6B6B63` (never accent-colored, except the active nav item). Covers: search, map pin, shield (blacklist), bell (alerts), trend line (traffic), audit log, mute/unmute, dismiss, expand. No icon pack, no duotone, no filled variants — keeps every icon visually related to every other one, which a mixed pack never does.

## The Confidence/Deviation Meter *(new — the one recurring signature device)*

Wherever a score (plate, visual, transit, composite) or a baseline deviation (timing z-score) is shown, it's paired with a small flat horizontal meter: a 40×6px bordered track, filled left-to-right in muted color up to the value, switching fill color to warning/critical only past the same thresholds already used for badges. Flat fill, 1px border, 2px radius — no gradient, no glow. This is the one place the design is allowed to be a little bold; everywhere else stays quiet.

```
Plate    0.94   [███████████░]
Visual   0.88   [██████████░░]
Transit  0.31   [███░░░░░░░░░]   ← below threshold, fill turns critical-red
```

---

## Per-Screen Redesign

Purpose, states, and actions are carried over unchanged from v1 and repeated only where the visual treatment needs the context. Layout composition is new.

### 1. Trajectory Search
*(unchanged: search box, date range, per-hop table with plate/visual/transit/composite scores and anomaly badges, all 5 states)*
**Layout:** two-column, not stacked cards — map roughly 55% left, per-hop table roughly 45% right, both starting directly under one shared search bar (no separate "search card" floating above). The table is the primary artifact: each row shows the meter next to each score, and a flagged row's anomaly badge expands in place, growing that row, rather than opening a modal or side panel.
**Loading:** table rows render as flat gray bars occupying the exact position real rows will take (no shimmer, no skeleton "cards").
**Empty / no-results / error:** a left-aligned plain sentence sits in the table's position, not a centered illustration — keeps the instrument-not-app tone.

### 2. Heatmap
*(unchanged: density markers, restricted-zone overlay)*
**Layout:** full-bleed map, no card frame. Custom flat circle markers (replacing the default Leaflet teardrop pin) sized and colored by density with the same palette. Restricted zones keep the dashed critical-accent outline; the name appears on hover as a small flat tag anchored to the circle, not a floating shadowed tooltip. Legend is a slide-out panel from the left edge (bordered, flat, no shadow), not a card floating on top of the map.

### 3. Blacklist Check
*(unchanged: single search, match/no-match)*
**Layout:** deliberately small and centered — a single-purpose lookup, not stretched into a dashboard-width panel. This screen's generic-ness in v1 came from trying to fill space it doesn't need; staying small and quiet is the fix.

### 4. Alerts (+ Audit Log)
*(unchanged: table, color-coded types, role-gated audit log)*
**Layout:** one full-width table, most recent first, each row's alert type shown as a 2px left-border accent stripe plus its text label, rather than a filled colored badge — color-coding stays present but quiet, consistent with the rule that color is never the sole signal. Audit Log (Supervisor only) is a second table directly beneath, separated by a single rule and a section label, not a tab or modal.

### 5. Traffic Trends
*(unchanged: hourly bar chart, corridor table)*
**Layout:** the bar chart sits at the top as the primary artifact (muted-color bars, no gradient fill, thin border), corridor table beneath it. Seeded rows keep v1's muted-text-plus-"seed"-label treatment, unchanged.

### Global — Header Status Strip *(new)*
One persistent line above all 5 views: screen title on the left, then role selector, mute toggle, and a plain-text connection indicator ("Live" / "Static demo" / "Unreachable"). This reuses states each screen already has to report — no new data source, just one shared place for what v1 repeated per screen.

### Global — Toast + Audio Layer
*(behavior unchanged: visual-first, one sound per alert, persistent mute, non-blocking, stacking)*
**Visual:** flat bordered box, no shadow, severity shown as a 3px left-border stripe (critical/warning color) instead of a tinted background — consistent with the Alerts table treatment above. Bottom-right, stacks downward, ≤150ms opacity fade only.

---

## Buttons & Controls *(new)*

- **Primary action:** filled `#2F5233`, white text, 4px radius, no shadow. Hover: background darkens roughly 8%, 150ms.
- **Secondary:** border only, transparent fill, `#1F1F1F` text. Hover: background tints a few percent darker than the page background, 150ms.
- **Role selector / mute toggle:** plain text and icon, no pill background — the active state is a 2px underline in accent color, not a filled badge.
- No button carries a shadow, a gradient, or an appended arrow glyph.

## Focus & Keyboard *(new)*

Every interactive element gets a visible 2px accent-color outline on keyboard focus (not on mouse click). V1 already required the mute control specifically to be keyboard-reachable; this generalizes that into an explicit visual rule for every control.

---

## Accessibility Notes

Carried forward unchanged from v1, plus the focus rule above:
- Sound is never the only signal for an alert.
- Color is never the only signal — every color-coded element (alert type, meter fill) carries its text or number alongside it.
- Mute state is conveyed by icon and text, not icon alone.
- Error/unreachable states use plain text, not color or iconography alone.

## Component Inventory (updated)

Pages (5, unchanged): Trajectory Search, Heatmap, Blacklist Check, Alerts, Traffic Trends.
Feature components: trajectory map, per-hop table with confidence meter (new), heatmap map with custom markers (new), zone overlay, blacklist result panel, alerts table with left-border severity stripe (new), audit log panel, corridor-baseline table, hourly bar chart, role selector.
Shared/global: left nav, header status strip (new), toast manager (updated visual), audio manager (unchanged), icon set (new, one hand-drawn family), confidence/deviation meter (new, shared component).

## What This Does Not Touch

Backend, data model, API contracts (SCHEMA.md), the five views' functional scope, or the tech stack (still vanilla HTML/CSS/JS, Leaflet, no build step) — none of it needed to change to get this redesign, so none of it was touched. If implementing this surfaces a spot where it genuinely does need a backend or data change, that should be flagged before working around it silently, not assumed.
