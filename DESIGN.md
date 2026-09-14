# DESIGN.md — City-Wide ANPR Trajectory & Route-Anomaly Engine Design Contract

## 1. Brand & Design Philosophy
A serious operations and dispatch tool for traffic police, smart city authorities, and transport regulators.
Not a generic AI product or consumer app:
- High information density, clear contrast, zero visual clutter.
- No decorative gradients, no drop shadows, no glassmorphism, no bouncy/spring animations.
- Maximum 4px border-radius everywhere.

## 2. Color Palette (Strict Enforcement)
| Role | Color Name | Hex Code | Purpose |
|---|---|---|---|
| Background | Neutral Off-White | `#FAFAF8` | Main application canvas and panels |
| Card / Table Row Alt | Panel Surface | `#F2EFEB` | Card backgrounds, table alternate rows |
| Primary Text | Charcoal Black | `#1F1F1F` | Headers, primary data, active labels |
| Muted Text | Neutral Grey | `#6B6B63` | Subtitles, helper text, empty states, seed data |
| Border | Muted Beige/Grey | `#E1DED6` | Panel borders, table dividers, input borders |
| Primary Accent | Dark Forest Green | `#2F5233` | Nav highlights, positive badges, heatmap density |
| Warning Accent | Deep Amber | `#C98A1E` | Route anomalies, impossible transit, zone alerts |
| Critical Accent | Muted Crimson Red | `#B3262A` | Blacklist matches, cloned plate alerts, restricted zones |

### Forbidden Colors & Styles:
- **STRICTLY FORBIDDEN**: Any shade of blue, indigo, violet, cyan, or purple (e.g. `#0000FF`, `#1E40AF`, `#6366F1`, `#3B82F6`, `#8B5CF6`).
- **STRICTLY FORBIDDEN**: Gradients of any kind (`linear-gradient`, `radial-gradient`).
- **STRICTLY FORBIDDEN**: Drop shadows (`box-shadow`, `text-shadow`).
- **STRICTLY FORBIDDEN**: Border radius $> 4\text{px}$.
- **STRICTLY FORBIDDEN**: Spring or bouncy easing curves (`cubic-bezier` with bounce).

## 3. Typography
- **UI / Headings / Labels**: System font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- **Data Fields**: Monospace font stack: `ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace`
  - Required for: License plates, GPS coordinates, timestamps, confidence/similarity scores, camera IDs, alert IDs.

## 4. Layout & Spacing
- Fixed 240px left sidebar navigation.
- Top control header with Operator/Supervisor role toggle, global alert mute toggle, and system status indicator.
- Content body with clean bordered panels, standard 16px/24px padding.
- Tables: Monospace data cells, clean horizontal borders (`#E1DED6`), right-aligned numeric metrics.

## 5. Components
- **Buttons**: Max 4px border-radius, solid border, flat hover state (opacity/bg color shift only).
- **Toasts**: Fixed bottom-right notification stack, flat background (`#FAFAF8`), 1px solid border (`#E1DED6`), left accent border (amber `#C98A1E` or red `#B3262A`), max 4px radius, auto-dismiss 6s.
- **Banners**: Full-width bordered banner (`#F2EFEB`) with muted text for offline/unreachable states.
