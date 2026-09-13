# Extractable Components & Reusable Primitive Inventory

Inventory of candidates for extraction into shared UI primitives to unify `bjs-gas` design system and eliminate UI duplication.

---

## 1. FilterToolbar (`web/components/ui/FilterToolbar.tsx`)

- **Current Duplication**:
  - `StationList.tsx`: Uses `.directory-toolbar` with `.directory-toolbar-primary` and `.directory-toolbar-secondary`.
  - `MapDiscoveryView.tsx`: Uses `.map-toolbar.directory-toolbar` directly with broken nested flex columns and unstyled fuel pills.
  - `StateStationList.tsx`: Re-implements its own filter bar with `.directory-fuel-segments`.
  - `StateIndexDirectory.tsx`: Implements state search input and sort controls with distinct styles.
- **Extraction Target**:
  - A unified, composable `FilterToolbar` with sub-primitives:
    - `FilterToolbar.Primary`: Flex container for search and dropdowns
    - `FilterToolbar.Secondary`: Flex container with space-between for fuel toggles and results count
    - `SearchField`: Input with search icon, clear button, and accessible labels
    - `SelectControl`: Styled select wrapper with custom arrow and consistent padding
    - `FuelToggleGroup`: Segmented or chip button group for fuel types (All, Regular, Premium, Diesel)
    - `ResultsCount`: Tabular results counter with active filter badge and "Clear filters" button

---

## 2. StationRecord (`web/components/ui/StationRecord.tsx` / `StationLedgerRow.tsx`)

- **Current Duplication**:
  - `StationList.tsx`: Has both a desktop `<tr>` (`.directory-row`) and a mobile card (`.station-mobile-card`).
  - `StateStationList.tsx`: Has duplicate desktop row and mobile card markup.
  - `MapDiscoveryView.tsx`: Has sidebar station item (`.map-station-item`) with custom inline styles and duplicated fuel rendering.
- **Extraction Target**:
  - Authoritative Ledger Slate `StationRecord`:
    - Desktop: Flush ledger row with hairline 1px `#E2E8F0` border, left location block, 30px bold price with "REGULAR" caption, tabular secondary fuel pills, relative freshness text, and right blue map link action (`Map →`).
    - Mobile: Stacked flush record maintaining 0px card radius, hairline separator, dominant price, secondary fuels, and action button.

---

## 3. StatusPill & DeltaBadge (`web/components/ui/StatusPill.tsx`, `DeltaBadge.tsx`)

- **Current Duplication**:
  - Freshness pills in `web/app/page.tsx` (`.hero-freshness-pill`), `web/app/status/page.tsx`, and `web/components/StationList.tsx` (`.freshness-text`).
  - Price change deltas in `web/app/page.tsx` (`.national-median-delta`), `web/components/NationalTrendChart.tsx` (`.trend-stat-change`), `web/components/PriceMovers.tsx` (`.mover-delta-badge`), and `web/app/stations/[clubNumber]/page.tsx` (`.station-delta`).
- **Extraction Target**:
  - `StatusPill`: Standard pill (`border-radius: 9999px`) with optional status dot (green, amber, red), hourly cadence label, and relative timestamp.
  - `DeltaBadge`: Semantic price difference pill with explicit direction icon (`↓` / `↑`), amount in cents (e.g. `↓ 12¢`), and color/background pairing (`--color-positive-bg` / `--color-danger-bg`).

---

## 4. StatSummaryPanel & MetricGroup (`web/components/ui/StatSummaryPanel.tsx`)

- **Current Duplication**:
  - `web/app/page.tsx`: National summary panel with top median block and 3-column supporting metric grid.
  - `web/app/states/page.tsx`: 3-column summary highlight cards (Cheapest, Highest, Locations).
  - `web/app/states/[state]/page.tsx`: State hero card with median and range metrics.
  - `web/app/status/page.tsx`: Metric boxes for pipeline status.
- **Extraction Target**:
  - `StatSummaryPanel`: Clean 12px bordered white card (`#FFFFFF`, border `1px solid #E2E8F0`, subtle shadow).
  - `Metric`: Single metric component with eyebrow label (`11-12px uppercase tracking-wider`), dominant tabular value (`font-weight: 800`), and optional secondary caption or link.

---

## 5. PriceDisplay (`web/components/ui/PriceDisplay.tsx`)

- **Current Duplication**:
  - Inline price formatting with `formatPrice()` scattered across 8 different components, each manually pairing tabular numbers with uppercase fuel badges or small caps labels.
- **Extraction Target**:
  - Single authoritative price renderer supporting size tiers (`hero` 48px, `display` 30px, `secondary` 14px, `inline` 16px) and fuel label positioning.
