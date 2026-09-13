# Design System Tokens & Theme

Comprehensive digest and source definitions of styling tokens for `bjs-gas`.

---

## Part 1: Compact Token Summary

### Color Palette

| Token Name | Existing Value | Ledger Slate Target | Semantic Role |
|---|---|---|---|
| `--bg-main` / `--color-bg` | `#f8fafc` | `#F8FAFC` | Main application background (slate-50) |
| `--bg-surface` / `--color-surface` | `#ffffff` | `#FFFFFF` | Primary surface, cards, panels, header, footer |
| `--bg-subtle` / `--color-surface-subtle`| `#f1f5f9` | `#F1F5F9` | Secondary backgrounds, subtle controls, table headers |
| `--border-color` / `--color-border` | `#e2e8f0` | `#E2E8F0` | Standard hairline boundaries, card borders, dividers |
| `--border-hover` / `--color-border-hover`| `#cbd5e1`| `#CBD5E1` | Interactive control hover border |
| `--text-primary` / `--color-text-primary`| `#0f172a`| `#0F172A` | Primary text, bold headers, dominant numerals (slate-900) |
| `--text-secondary` / `--color-text-secondary`| `#475569`| `#475569` | Secondary labels, location subtext, metadata (slate-600) |
| `--text-muted` / `--color-text-muted` | `#64748b` | `#64748B` | Captions, axis labels, disabled states (slate-500) |
| `--accent` / `--color-accent` | `#2563eb` | `#2563EB` | Primary CTA, selected tab/toggle, link blue (blue-600) |
| `--accent-hover` / `--color-accent-hover`| `#1d4ed8`| `#1D4ED8` | Primary CTA hover state (blue-700) |
| `--accent-subtle` | `#eff6ff` | `#EFF6FF` | Focus rings, light selection tint (blue-50) |
| `--cheaper` / `--color-positive` | `#15803d` | `#10B981` | Cheaper price, favorable price drops (emerald-500) |
| `--cheaper-bg` / `--color-positive-bg` | `#f0fdf4` | `#ECFDF5` | Favorable delta pill background (emerald-50) |
| `--color-positive-border` | (none) | `#A7F3D0` | Favorable delta border (emerald-200) |
| `--higher` / `--color-danger` | `#b91c1c` | `#B91C1C` | Unfavorable price increase, error (red-700) |
| `--higher-bg` / `--color-danger-bg` | `#fef2f2` | `#FEF2F2` | Unfavorable delta pill background (red-50) |
| `--warning` | `#d97706` | `#D97706` | Warning, aging data freshness badge (amber-600) |
| `--warning-bg` | `#fffbeb` | `#FFFBEB` | Warning badge background (amber-50) |

### Typography

- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Primary Display**: `40px` (mobile `32px`), weight `800`, line-height `1.15`, tracking `-1.4px` (`-0.04em`)
- **Section Headline**: `20px` to `24px`, weight `700`, tracking `-0.4px` (`-0.02em`)
- **Card/Item Title**: `16px` to `18px`, weight `600`
- **Body**: `15px` to `17px`, weight `400`, line-height `1.5`
- **Small Metadata**: `13px` to `14px`, weight `500`, color `var(--text-secondary)`
- **Caption / Eyebrow**: `11px` to `12px`, weight `600` or `700`, uppercase, tracking `0.12em` to `0.16em`
- **Numeric Display (Dominant Price)**: `30px` to `36px` (hero `48px` to `56px`), weight `800`, tabular figures (`font-variant-numeric: tabular-nums`)
- **Secondary Fuel Price**: `13px` to `14px`, weight `600`, tabular figures

### Spacing & Rhythm

- **Base unit**: `4px`
- **Rhythm scale**: `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px`, `48px`, `64px`

### Border Radii

- **Flush Rows & Dividers**: `0px` (station directory rows, divider rules)
- **Small elements / Sub-controls**: `6px` (`--radius-sm`)
- **Controls & Buttons**: `8px` (`--radius-md`)
- **Cards, Panels & Modal containers**: `12px` (`--radius-lg`)
- **Pills, Badges & Segmented Toggles**: `9999px`

### Shadows & Elevation

- **Restrained Elevation**: `0 1px 2px 0 rgb(0 0 0 / 0.05)` (`--shadow-sm`)
- **Popups / Dropdowns**: `0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)` (`--shadow-md`)
- **Station Directory Rows**: Completely flat (`box-shadow: none`) with hairline top/bottom borders (`1px solid var(--border-color)`)

### Layout Max-Width & Breakpoints

- **Max Container Width**: `1240px` centered (`margin: 0 auto; padding: 0 1.5rem`)
- **Breakpoints**:
  - `sm`: `640px`
  - `md`: `768px`
  - `lg`: `1024px`
  - `xl`: `1280px`
  - Mobile edge check: `320px` to `350px`

---

## Part 2: Raw CSS Tokens Source (`web/app/globals.css`)

```css
:root {
  --bg-main: #f8fafc;
  --bg-surface: #ffffff;
  --bg-subtle: #f1f5f9;
  --border-color: #e2e8f0;
  --border-hover: #cbd5e1;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-subtle: #eff6ff;
  --cheaper: #15803d;
  --cheaper-bg: #f0fdf4;
  --higher: #b91c1c;
  --higher-bg: #fef2f2;
  --warning: #d97706;
  --warning-bg: #fffbeb;

  /* Backwards compatibility aliases */
  --cheapest: var(--cheaper);
  --cheapest-bg: var(--cheaper-bg);
  --expensive: var(--higher);
  --expensive-bg: var(--higher-bg);

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07);
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --container-max-width: 1240px;
}
```
