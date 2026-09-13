# Ledger Slate Design System — Codebase Implementation Plan

**Repository**: `bjs-gas`  
**Target Design System**: Ledger Slate  
**Document Purpose**: Definitive technical roadmap mapping the reconciled Ledger Slate design system onto the existing Next.js frontend codebase (`web/`).  
**Authoritative Design References**:
- Primary: Superdesign Draft `cc0f9163-e7b0-418b-9be3-c42ec9a44c8f` (BJ's Gas Prices — Ultra-Minimal Tracker)
- Secondary: Superdesign Draft `a3a5bbaf-829d-4b89-ab0d-72148d01274a` (BJ's Gas Prices — Trends Page)
- Specification: `.superdesign/design-system.md`

---

# 1. Executive Summary

The `bjs-gas` frontend is an hourly gas price tracking service for 200+ BJ's Wholesale Club locations across the eastern and central United States. While the backend collector, API, and analytical engines are robust, the frontend presentation has evolved across disparate design phases (Phase 0 MVP, Phase 2 Directory, Phase 3 Map Discovery, V2 Map split), leading to accumulated CSS debt in `globals.css` (over 3,200 lines / 58KB), inconsistent component styling, and a confirmed UI regression in the interactive map toolbar.

The **Ledger Slate** design system establishes a unified, restrained, consumer-facing editorial aesthetic inspired by modern financial price trackers and transit timetables. It emphasizes light surfaces, data density, tabular numeric scale, hairline row dividers, and strictly rationed blue accents.

This plan details the surgical, low-churn implementation of Ledger Slate across 6 phased releases (**Phase DS-1** through **Phase DS-6**), eliminating duplicate CSS, resolving the map toolbar bug, standardizing reusable primitives, and ensuring full WCAG 2.1 AA accessibility compliance without breaking existing functionality.

---

# 2. Current State

A comprehensive audit of `web/` reveals the following architectural realities:

1. **Framework & Styling Architecture**:
   - Next.js 16 (App Router) + React 19 + TypeScript.
   - Vanilla CSS architecture centered around `web/app/globals.css`.
   - No Tailwind runtime or build-time plugin is installed, yet several pages (`web/app/states/page.tsx`, `web/app/status/page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`) contain uncompiled Tailwind utility classes (e.g. `text-3xl`, `text-slate-900`, `bg-emerald-50/60`, `space-y-6`), resulting in unstyled elements and ad-hoc inline styles.
2. **CSS Duplication & Fragmentation**:
   - `globals.css` contains overlapping selector families across different phases:
     - Old Phase 0 styles (lines 856–1090): Generic cards, old search bar, raw station table.
     - Phase 2 Directory styles (lines 1238–1700): `.directory-toolbar`, `.directory-row`, `.station-mobile-card`.
     - Phase 3 Map layout (lines 1711–2100): `.map-page-wrapper`, `.map-split-view`, `.discovery-sidebar`.
     - Phase 3 V2 Map layout (lines 2568–2790): `.map-discovery-v2`, `.map-split-v2`, `.map-sidebar-pane`.
3. **Confirmed Map Toolbar Layout Regression**:
   - In `web/components/MapDiscoveryView.tsx`, the search toolbar uses `.directory-toolbar` without the required `.directory-toolbar-primary` and `.directory-toolbar-secondary` flex wrappers.
   - Because `.directory-toolbar` is `display: flex; flex-direction: column;`, controls stretch vertically into massive columns.
   - The fuel filter buttons render with `.directory-fuel-segments` and `.directory-fuel-pill`—classes completely absent from `globals.css`—rendering raw unstyled HTML buttons.
   - The state dropdown uses `.directory-select-wrapper` instead of `.directory-select-field`.
4. **Token Drift**:
   - Colors like `--cheaper` are set to dark green (`#15803d`) instead of the lighter, vibrant emerald (`#10B981`) favored in Ledger Slate.
   - Token naming inconsistencies exist between components (e.g. `Breadcrumbs.tsx` uses undefined `var(--border)` and `var(--text)`).
5. **Card vs. Ledger Inconsistency**:
   - On mobile, `StationList.tsx` switches from a table to `.station-mobile-card` with 8px radius, borders, and box shadows, departing from the flush hairline ledger pattern.

---

# 3. Target Ledger Slate System

The target system is governed by the principles in `.superdesign/design-system.md`:

- **Ground & Surfaces**: `#F8FAFC` viewport background, `#FFFFFF` panels, `#F1F5F9` subtle controls.
- **Typography**: Native system font stack, high-contrast dark slate (`#0F172A`), `40px`/`48px` display headlines, `20px` section titles, and `30px+` tabular gas prices (`font-variant-numeric: tabular-nums`).
- **Restrained Accent**: `#2563EB` reserved for primary CTAs, active controls, links, and map actions.
- **Directional Semantics**: Green (`#10B981`) and red (`#B91C1C`) accompanied by directional arrows (`↓` / `↑`).
- **Anatomy**:
  - Macro-panels and standalone cards: `12px` border-radius with `1px solid #E2E8F0` border.
  - Controls and buttons: `8px` border-radius.
  - Station directory: `0px` radius, continuous single-column flush list with hairline `1px #E2E8F0` separators.
  - Elevation: Flat by default; single restrained shadow (`0 1px 2px rgba(0,0,0,0.05)`) for panels.

---

# 4. Token Migration

To maintain backwards compatibility and allow zero-downtime component upgrades, existing CSS custom property names are preserved while mapped to Ledger Slate authoritative values. New aliases are introduced where beneficial.

| Current Token | Current Value | Ledger Slate Token | Target Value | Action / Migration Notes |
|---|---|---|---|---|
| `--bg-main` | `#f8fafc` | `--color-bg` | `#F8FAFC` | Keep `--bg-main: #F8FAFC;`; add `--color-bg: var(--bg-main);`. |
| `--bg-surface` | `#ffffff` | `--color-surface` | `#FFFFFF` | Keep `--bg-surface: #FFFFFF;`; add `--color-surface: var(--bg-surface);`. |
| `--bg-subtle` | `#f1f5f9` | `--color-surface-subtle` | `#F1F5F9` | Keep `--bg-subtle: #F1F5F9;`; add `--color-surface-subtle: var(--bg-subtle);`. |
| `--border-color` | `#e2e8f0` | `--color-border` | `#E2E8F0` | Keep `--border-color: #E2E8F0;`; add `--color-border: var(--border-color);`. Also add `--border: var(--border-color);` to fix `Breadcrumbs.tsx`. |
| `--border-hover` | `#cbd5e1` | `--color-border-hover` | `#CBD5E1` | Keep `--border-hover: #CBD5E1;`; add `--color-border-hover: var(--border-hover);`. |
| `--text-primary` | `#0f172a` | `--color-text-primary` | `#0F172A` | Keep `--text-primary: #0F172A;`; add `--color-text-primary: var(--text-primary);`. Also add `--text: var(--text-primary);` to fix `Breadcrumbs.tsx`. |
| `--text-secondary` | `#475569` | `--color-text-secondary` | `#475569` | Keep `--text-secondary: #475569;`; add `--color-text-secondary: var(--text-secondary);`. |
| `--text-muted` | `#64748b` | `--color-text-muted` | `#64748B` | Keep `--text-muted: #64748B;`; add `--color-text-muted: var(--text-muted);`. |
| `--accent` | `#2563eb` | `--color-accent` | `#2563EB` | Keep `--accent: #2563EB;`; add `--color-accent: var(--accent);`. |
| `--accent-hover` | `#1d4ed8` | `--color-accent-hover` | `#1D4ED8` | Keep `--accent-hover: #1D4ED8;`; add `--color-accent-hover: var(--accent-hover);`. |
| `--accent-subtle` | `#eff6ff` | `--color-accent-subtle` | `#EFF6FF` | Keep `--accent-subtle: #EFF6FF;`. |
| `--cheaper` | `#15803d` | `--color-positive` | `#10B981` | Update `--cheaper` to `#10B981` (emerald-500) from `#15803d`. |
| `--cheaper-bg` | `#f0fdf4` | `--color-positive-bg` | `#ECFDF5` | Update `--cheaper-bg` to `#ECFDF5`. |
| (new) | — | `--color-positive-border`| `#A7F3D0` | Add `--color-positive-border: #A7F3D0;` for delta badges. |
| `--higher` | `#b91c1c` | `--color-danger` | `#B91C1C` | Keep `--higher: #B91C1C;`; add `--color-danger: var(--higher);`. |
| `--higher-bg` | `#fef2f2` | `--color-danger-bg` | `#FEF2F2` | Keep `--higher-bg: #FEF2F2;`; add `--color-danger-bg: var(--higher-bg);`. |
| (new) | — | `--color-danger-border` | `#FECACA` | Add `--color-danger-border: #FECACA;` for delta badges. |
| `--warning` | `#d97706` | `--color-warning` | `#D97706` | Keep `--warning: #D97706;`. |
| `--warning-bg` | `#fffbeb` | `--color-warning-bg` | `#FFFBEB` | Keep `--warning-bg: #FFFBEB;`. |
| `--radius-sm` | `6px` | `--radius-sm` | `6px` | Preserve for small tags and indicators. |
| `--radius-md` | `8px` | `--radius-control` | `8px` | Authoritative control radius (buttons, inputs, selects). |
| `--radius-lg` | `12px` | `--radius-panel` | `12px` | Authoritative panel radius (cards, containers). |
| `--radius-flush`| (new) | `--radius-flush` | `0px` | Explicit 0px radius for station rows. |
| `--radius-pill` | `9999px`| `--radius-pill` | `9999px` | For badges, status pills, and toggle chips. |
| `--shadow-sm` | `0 1px 2px...` | `--shadow-panel` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Restrained boundary lift. |
| `--shadow-md` | `0 4px 6px...` | `--shadow-dropdown` | `0 4px 6px -1px rgba(0,0,0,0.07)` | For interactive popups only. |

---

# 5. Typography Migration

A unified type-role matrix standardizes font properties across the entire application:

| Type Role | Font Size | Weight | Line Height | Tracking | Transform | CSS Class / Selector |
|---|---|---|---|---|---|---|
| **display** | `40px` (md: `48px`) | 800 | 1.15 | `-0.04em` | normal | `.hero-title`, `h1.page-title` |
| **section-heading** | `20px` (md: `24px`) | 700 | 1.25 | `-0.02em` | normal | `.section-title`, `h2` |
| **card-heading** | `16px` (md: `18px`) | 700 | 1.3 | `-0.01em` | normal | `.card-title`, `h3` |
| **body** | `16px` | 400 | 1.5 | normal | normal | `body`, `.hero-subtitle`, `p` |
| **body-secondary** | `14px` | 400 | 1.5 | normal | normal | `.station-location-sub`, descriptions |
| **metadata** | `13px` | 500 | 1.4 | normal | normal | `.freshness-text`, captions |
| **eyebrow** | `11px` to `12px` | 700 | 1.2 | `0.14em` | uppercase | `.national-median-label`, `.col-header` |
| **numeric-hero** | `48px` to `56px` | 800 | 1.0 | `-0.04em` | tabular | `.national-median-price` |
| **numeric-display** | `30px` to `32px` | 800 | 1.0 | `-0.02em` | tabular | `.station-primary-price`, `.stat-price` |
| **numeric-secondary**| `13px` to `14px` | 600 | 1.2 | normal | tabular | `.other-fuel-val`, `.state-item-price` |

### Key Migration Actions:
1. Replace scattered font sizes in `globals.css` with semantic classes.
2. Remove uppercase from all general buttons and links; restrict uppercase exclusively to eyebrow labels (`NATIONAL MEDIAN`, `REGULAR`, `DIESEL`).
3. Enforce `.tabular-nums` on every single price, count, and delta.

---

# 6. Shared Primitive Strategy

To eliminate duplicated markup and inconsistent styles, the implementation will extract or standardize key primitives in `web/components/ui/`:

### 1. `FilterToolbar` (`web/components/ui/FilterToolbar.tsx`)
- **Structure**:
  ```tsx
  <FilterToolbar>
    <FilterToolbar.Primary>
      <SearchField ... />
      <SelectControl label="State" ... />
      <SelectControl label="Sort" ... />
    </FilterToolbar.Primary>
    <FilterToolbar.Secondary>
      <FuelToggleGroup ... />
      <ResultsCount ... />
    </FilterToolbar.Secondary>
  </FilterToolbar>
  ```
- Replaces duplicate toolbar logic in `StationList.tsx`, `MapDiscoveryView.tsx`, and `StateStationList.tsx`.

### 2. `StationRecord` (`web/components/ui/StationRecord.tsx`)
- Single component handling both desktop and mobile layouts using CSS media queries.
- Guarantees 0px radius, hairline `1px #E2E8F0` row separator, 30px dominant price, secondary fuel pills, relative freshness, and `Map →` action.

### 3. `StatusPill` (`web/components/ui/StatusPill.tsx`)
- Renders `Updated hourly • Updated 17m ago` with optional pulsing green dot and link to `/status`.

### 4. `DeltaBadge` (`web/components/ui/DeltaBadge.tsx`)
- Encapsulates `↓ 12¢` or `↑ 15¢` with semantic background, border, text color, and directional icon.

### 5. `StatSummaryPanel` (`web/components/ui/StatSummaryPanel.tsx`)
- 12px white panel container with structured eyebrow, primary metric, and supporting 3-column items.

### 6. `PriceDisplay` (`web/components/ui/PriceDisplay.tsx`)
- Tabular price formatter with attached small caps fuel badge.

---

# 7. Homepage Migration (`web/app/page.tsx`)

1. **Hero Alignment**:
   - Update buttons to use 8px border-radius (`.btn { border-radius: var(--radius-md); height: 41px; }`).
   - Standardize copy: replace any "real-time" with "current prices, updated hourly".
2. **National Summary Section**:
   - Refactor `.national-summary-section` to use `12px` border-radius, pure white background (`#FFFFFF`), and `1px solid #E2E8F0`.
   - Top median block: National median price in `48px` tabular text (`#0F172A`) paired with `DeltaBadge`.
   - Supporting 3-column metrics: Lowest price (emerald), Highest price (crimson), Locations tracked (slate).
3. **Station Directory Placement**:
   - Ensure the directory starts directly below the supporting preview sections with clear visual hierarchy.

---

# 8. Trend / Chart Migration (`web/components/NationalTrendChart.tsx`)

1. **Styling Refinement**:
   - Container updated to 12px radius white panel with hairline border.
   - Segmented toggle: Standardize `SegmentedControl` pill styling (selected `#2563EB` fill, unselected `#F1F5F9`).
2. **Chart Lines**:
   - Median line: Solid blue `#2563EB`, stroke width `2.75px`.
   - Lowest boundary line: Slate `#94A3B8`, dashed `4 4`, stroke width `1.25px`.
   - Highest boundary line: Slate `#94A3B8`, dashed `4 4`, stroke width `1.25px`.
   - Remove any gradient area fills or background shading.
3. **Axes and Tooltips**:
   - Grid: Subtle horizontal dashes (`#F1F5F9`), zero vertical grid lines.
   - Tooltip: Crisp white card with hairline border and tabular values.

---

# 9. Trend Data Table Decision

### Explicit Decision:
**Keep the full 30-day historical table as an accessible screen-reader table (`.sr-only`) on the primary homepage ledger, with an optional expandable native `<details>` disclosure.**

### Rationale:
1. **Vertical Hierarchy**: Placing a full 30-row visible data table on the homepage pushes the core job-to-be-done ("Find a station") far below the initial viewport.
2. **Visual Parity**: The Recharts interactive line chart already renders all daily points with hover tooltips displaying date, median, min, max, and reporting stations.
3. **Accessibility**: Screen readers already receive 100% data parity through the semantic HTML `<table>` in `.sr-only`.
4. **Consistency**: Aligns with the Ultra-Minimal Tracker draft's focus on scannable vertical efficiency.

---

# 10. Movers Migration (`web/components/PriceMovers.tsx`)

1. **Two-Column Layout**:
   - Preserve 2-column grid (`Largest drops` vs `Largest increases`).
   - Style columns as 12px white bordered panels.
2. **Semantic Treatment**:
   - Drops: Emerald header icon `↓`, text `#10B981`, and `DeltaBadge` with `#ECFDF5` background.
   - Increases: Crimson header icon `↑`, text `#B91C1C`, and `DeltaBadge` with `#FEF2F2` background.
   - Enforce explicit directional glyphs (`↓` / `↑`) to guarantee compliance with WCAG non-color-only guidelines.

---

# 11. State UX Migration (`web/app/states/page.tsx` & `[state]/page.tsx`)

1. **Eliminate Tailwind Leakage**:
   - Replace uncompiled classes (`space-y-6`, `text-3xl`, `text-slate-900`) in `states/page.tsx` and `states/[state]/page.tsx` with semantic design-system classes (`.state-index-page`, `.page-header`, `.page-title`).
2. **State Cards**:
   - 12px border radius, `1px solid #E2E8F0` border, white background.
   - Median price in tabular numerals (`#0F172A`).
3. **State Station List**:
   - Adopt the unified `FilterToolbar` and `StationRecord` ledger components.

---

# 12. Station Directory Migration (`web/components/StationList.tsx`)

1. **Desktop Ledger (>= 640px)**:
   - Single-column continuous table.
   - Hairline `1px solid #E2E8F0` row separators.
   - Left: City, State (bold link), address, Club #N (`13px`, `#64748B`).
   - Center-Left: Primary price in `30px` tabular numbers (`#0F172A`) with `REGULAR` eyebrow label.
   - Center-Right: Secondary fuels pills (`Premium $X.XXX`, `Diesel $X.XXX`).
   - Center-Right: Relative freshness (`Updated 17m ago`).
   - Right: Action link `Map →` (`#2563EB`).
2. **Mobile Ledger (< 640px)**:
   - Deprecate `.station-mobile-card` with 8px radius and drop shadows.
   - Replace with flush stacked row (`0px` radius, `1px solid #E2E8F0` border-bottom, padding `1rem 0`).
   - Preserves high-density ledger aesthetic on small screens.

---

# 13. Map UI Migration & Toolbar Fix (`web/components/MapDiscoveryView.tsx`)

### Root Cause Analysis of Existing Regression:
In `MapDiscoveryView.tsx`, the search toolbar uses:
```tsx
<div className="map-toolbar directory-toolbar" role="search">
  <div className="directory-search-field">...</div>
  <div className="directory-select-wrapper">...</div>
  <div className="directory-fuel-segments">...</div>
  <div className="directory-status-group">...</div>
</div>
```
Problems identified:
1. `.directory-toolbar` is styled with `display: flex; flex-direction: column; gap: 0.875rem;`. Without `.directory-toolbar-primary` and `.directory-toolbar-secondary` flex row wrappers, each control is treated as a full-width column block.
2. `.directory-select-wrapper` is used instead of `.directory-select-field`.
3. `.directory-fuel-segments` and `.directory-fuel-pill` are used instead of `.directory-fuel-group` and `.directory-fuel-chip`, rendering fuel buttons completely unstyled.

### Planned Fix:
1. Refactor `MapDiscoveryView.tsx` to consume the unified `FilterToolbar` shared primitive.
2. Structure controls into:
   - Primary: Search field + State dropdown.
   - Secondary: Fuel filter pills + Location counter + Clear filters.
3. Sidebar station list updated to use flush `StationRecord` items matching the directory.

---

# 14. Station Detail Migration (`web/app/stations/[clubNumber]/page.tsx`)

1. **Header & Freshness**:
   - Use `StatusPill` for collection freshness.
   - Replace any "Live fuel prices" copy with "Current fuel prices".
2. **Fuel Price Panel**:
   - 12px white bordered panel.
   - Dominant Regular price (`40px`, tabular) with secondary Premium and Diesel prices.
   - State and national median comparison pills.
3. **Price History Chart**:
   - Align styling with `NationalTrendChart`: restrained lines, clean axes, no gradient fills.

---

# 15. Status & Edge-State Migration

1. **Status Page (`web/app/status/page.tsx`)**:
   - Replace uncompiled Tailwind classes (`rounded-2xl`, `bg-emerald-50/60`, `animate-ping`) with design system classes (`.status-banner`, `.status-banner-healthy`, `.status-dot-pulse`).
   - Clean 12px bordered metric boxes.
2. **Loading Skeleton (`web/app/loading.tsx`)**:
   - Replace Tailwind utility classes with `.skeleton-container`, `.skeleton-card`, and `.skeleton-shimmer`.
3. **Error Boundary (`web/app/error.tsx`) & 404 (`not-found.tsx`)**:
   - Refactor container cards to use standard design-system tokens (`12px` radius, `1px solid #E2E8F0`, 8px buttons).

---

# 16. CSS Architecture & Cleanup Map

`globals.css` will be refactored into modular, logical sections with deprecated selectors removed after migration:

| Selector Family | Active Consumers (Current) | Replacement Primitive / Class | Deprecation Status |
|---|---|---|---|
| `.card`, `.card-header` (old phase 0) | Various old routes | `.panel`, `StatSummaryPanel` | Keep until Phase DS-6, then remove |
| `.station-table` (old phase 0) | None (superseded by `.directory-table`) | `.directory-ledger` | Safe to remove in Phase DS-6 |
| `.filter-bar` (old phase 0) | None (superseded by `.directory-toolbar`) | `FilterToolbar` | Safe to remove in Phase DS-6 |
| `.map-split-view`, `.discovery-sidebar` (phase 3 v1) | Superseded by `.map-split-v2` | `.map-split-v2` | Safe to remove in Phase DS-6 |
| `.station-mobile-card` | `StationList.tsx`, `StateStationList.tsx` | `.station-record-mobile` (flush row) | Deprecate in Phase DS-3 |
| `.directory-fuel-chip` / `.directory-fuel-pill` | Multiple inconsistent usages | `.fuel-pill` (part of `FilterToolbar`) | Standardize in Phase DS-1 |
| Uncompiled Tailwind utility classes (`text-3xl`, etc.) | `states/page.tsx`, `status/page.tsx` | Native CSS classes in `globals.css` | Replace in Phase DS-5 |

---

# 17. Responsive Strategy

Canonical breakpoints:
- `sm`: `640px` — Switch from mobile stacked station ledger to desktop tabular ledger.
- `md`: `768px` — Split views (movers grid, state preview columns).
- `lg`: `1024px` — Full desktop layout, map split pane (360px sidebar + map canvas).
- `xl`: `1280px` — Max container boundary (`1240px` inner).
- `edge-mobile`: `320px` to `350px` — Minimum touch-safe layout verification without horizontal overflow.

---

# 18. Accessibility Strategy (WCAG 2.1 AA)

1. **Color Contrast**: Verify all text meets minimum `4.5:1` contrast ratio (`#0F172A` on `#FFFFFF` is 16:1; `#475569` on `#FFFFFF` is 7:1; `#2563EB` on `#FFFFFF` is 4.6:1).
2. **Directional Indicators**: Every price change uses both color and symbols (`↓` / `↑`) with descriptive `aria-label`.
3. **Visible Focus**: All interactive elements feature `:focus-visible` with `outline: 2px solid #2563EB; outline-offset: 2px;`.
4. **Screen Reader Tables**: Keep semantic data tables for charts (`.sr-only`) with complete column scopes.
5. **Reduced Motion**: Enforce `@media (prefers-reduced-motion: reduce)` on all transitions.

---

# 19. Test & QA Strategy

### Automated Verification
```bash
# Typecheck
pnpm run typecheck

# Unit & integration tests
pnpm test

# Production build validation
pnpm run build
```

### Visual & Browser Verification
- Verify homepage rendering at 320px, 375px, 768px, 1280px.
- Verify map toolbar layout on desktop and mobile.
- Verify station directory vertical scanning and tabular number alignment.
- Verify color contrast and keyboard tab navigation.

---

# 20. Ordered Implementation Phases

```
PHASE DS-1: Foundations, Tokens & Shared Primitives
  ├── Token updates in globals.css (--color-positive: #10B981, radii, typography)
  ├── Extract FilterToolbar, SegmentedControl, DeltaBadge, StatusPill
  └── Standardize button (8px radius) and input styles

PHASE DS-2: Homepage & Core Analytical Components
  ├── Refactor Hero and StatusPill
  ├── Refactor NationalSummaryPanel (price-first hierarchy)
  ├── Refactor NationalTrendChart (restrained lines, no gradients)
  ├── Refactor PriceMovers (emerald/crimson semantic delta badges)
  └── Refactor StatePricePreview

PHASE DS-3: Station Directory Ledger
  ├── Implement flush desktop ledger (0px radius, 1px hairline separators)
  ├── Implement flush mobile stacked records (no box shadows)
  ├── Integrate unified FilterToolbar
  └── Apply identical ledger pattern to StateStationList

PHASE DS-4: Map UI Unification & Toolbar Bug Fix
  ├── Fix MapDiscoveryView toolbar using FilterToolbar
  ├── Restyle map sidebar to match ledger aesthetics
  ├── Restyle map popups with clean hairline borders
  └── Validate responsive split-view behavior

PHASE DS-5: Subpages & Edge States
  ├── Refactor States Index (/states) and State Detail (/states/[state])
  ├── Refactor Station Detail (/stations/[clubNumber])
  ├── Refactor System Status (/status)
  └── Eliminate lingering uncompiled Tailwind classes in loading/error/not-found

PHASE DS-6: CSS Cleanup, Visual QA & Final Verification
  ├── Remove dead and superseded CSS selectors from globals.css
  ├── Visual QA across all viewports (320px to 1440px)
  ├── Keyboard and screen-reader accessibility validation
  └── Run full build, typecheck, and test suite
```

---

# 21. File-by-File Migration Matrix

| File | Current Responsibility | Current Problems / Debt | Target Responsibility | Planned Changes | Risk | Phase |
|---|---|---|---|---|---|---|
| `web/app/globals.css` | Global styling & design tokens | 3,200+ lines; accumulated dead selectors; color drift; duplicate map styles | Single authoritative source for Ledger Slate tokens & global styles | Update tokens (`--color-positive: #10B981`); add typography utility classes; remove dead Phase 0 rules | Medium | DS-1, DS-6 |
| `web/app/layout.tsx` | App shell, navigation, footer | Undefined `var(--border)` in child components; minor nav spacing | Clean shell with 62px header, subdued nav, and quiet footer | Standardize header border, status dot, and footer typography | Low | DS-1 |
| `web/app/page.tsx` | Homepage & directory | Large card hierarchy; copy uses occasional "real-time" | Primary pricing ledger & national overview | Update hero buttons to 8px; style National Summary card; clean typography | Low | DS-2 |
| `web/components/NationalTrendChart.tsx` | 30-day historical trend line chart | Styling inconsistencies; text tabs vs segmented pills | High-density analytical price momentum visualizer | Restrained blue median line; slate dashed boundary lines; crisp tooltip; keep `.sr-only` table | Low | DS-2 |
| `web/components/PriceMovers.tsx` | Weekly price drops & rises | Inconsistent delta pills | 2-column movement ledger | Standardize `DeltaBadge` with emerald/crimson styling and `↓`/`↑` glyphs | Low | DS-2 |
| `web/components/StationList.tsx` | 200+ station directory table & cards | Mobile uses bulky card tiles with shadows; toolbar classes fragmented | Authoritative flush single-column pricing ledger | Adopt `FilterToolbar`; desktop hairline rows; mobile flush stacked rows (0px radius) | Medium | DS-3 |
| `web/components/StateStationList.tsx` | State-specific station directory | Duplicate toolbar and row code; unstyled fuel pills | State-specific flush pricing ledger | Share `FilterToolbar` and `StationRecord` with `StationList` | Medium | DS-3 |
| `web/components/MapDiscoveryView.tsx` | Map search toolbar & split view | **Broken toolbar layout**: missing flex wrappers; unstyled fuel pills; detached search icon | Unified map discovery with persistent sidebar | Fix toolbar using `FilterToolbar`; clean sidebar selection card | High | DS-4 |
| `web/components/InteractiveMap.tsx` | MapLibre GL map container | Marker styling and custom popup styling | Interactive geospatial price map | Update custom popup cards to 12px white bordered panels | Low | DS-4 |
| `web/app/states/page.tsx` | State directory index | Uncompiled Tailwind classes (`text-3xl`, `space-y-6`); ad-hoc inline styles | National state comparison directory | Replace Tailwind classes with semantic CSS classes; 12px summary cards | Low | DS-5 |
| `web/app/states/[state]/page.tsx` | State detail page | Hero card styling inconsistencies | State-specific fuel overview | Standardize state hero panel, trend chart, and station list | Low | DS-5 |
| `web/app/stations/[clubNumber]/page.tsx` | Station detail page | Copy uses "Live fuel prices"; history chart styling | Comprehensive station fuel dossier | Update copy to "Current fuel prices"; 12px price cards; clean history chart | Low | DS-5 |
| `web/app/status/page.tsx` | System health & data freshness | Uncompiled Tailwind classes (`rounded-2xl`, `bg-emerald-50/60`, `animate-ping`) | Clean civic status report | Replace Tailwind with design system status banners and metric cards | Low | DS-5 |
| `web/app/loading.tsx` | Streaming loading skeletons | Uncompiled Tailwind classes (`space-y-6`, `rounded-xl`) | Global skeleton placeholder | Standardize skeleton cards and shimmer animation | Low | DS-5 |
| `web/app/error.tsx` | Global error boundary | Uncompiled Tailwind classes | Resilient user error card | Standardize 12px error panel and 8px action buttons | Low | DS-5 |
| `web/app/not-found.tsx` | 404 page | Uncompiled Tailwind classes | Clear 404 missing station notice | Standardize 12px panel and 8px action buttons | Low | DS-5 |

---

# 22. Definition of Done

The Ledger Slate redesign implementation will be considered complete when:

1. **Design System Adherence**:
   - All colors, typography, radii (12px panels, 8px controls, 0px flush rows), and spacing match `.superdesign/design-system.md`.
   - The station directory scans as a single-column flush ledger on desktop and mobile with hairline separators.
2. **Regression Resolution**:
   - The map filter toolbar bug in `MapDiscoveryView.tsx` is completely resolved; search, state filter, fuel pills, and result counts align seamlessly.
3. **Code Quality & Architecture**:
   - Zero uncompiled Tailwind utility classes remain in any `.tsx` file.
   - All dead, obsolete Phase 0 selectors in `globals.css` are pruned.
   - Shared primitives (`FilterToolbar`, `StationRecord`, `DeltaBadge`, `StatusPill`) are reused without code duplication.
4. **Copy Discipline**:
   - The phrase "real-time" is eradicated from public copy, replaced by "current prices, updated hourly".
5. **Accessibility**:
   - Keyboard focus visible is verified on all interactive elements.
   - Headings follow strict hierarchy (single H1).
   - Price deltas combine color with explicit text/arrows.
   - Screen reader table alternative is verified for trend charts.
6. **Automated Verification**:
   - `pnpm run typecheck` passes with zero errors.
   - `pnpm test` passes with zero failures.
   - `pnpm run build` generates production bundles cleanly.
