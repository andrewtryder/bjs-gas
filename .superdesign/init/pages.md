# Page Dependency & Architecture Matrix

Detailed documentation of every page in `web/app/`, its server-side data fetching, component hierarchy, client components, and state management.

---

## 1. Homepage (`/`)

- **File**: `web/app/page.tsx`
- **Render Mode**: Server Component (`export const dynamic = "force-dynamic"`)
- **Data Fetched**:
  - `getStations()`: Full list of 200+ gas stations with addresses, coordinates, and current fuel observations.
  - `getNationalSummary("1")`: National regular unleaded stats (median, min station, max station, total reporting stations).
  - `getNationalTrends(30, "1")`: 30-day historical points (date, medianPrice, minPrice, maxPrice, stationCount).
  - `getStateSummaries("1")`: State-by-state median Regular prices and station counts.
  - `getPriceMovers(7, "1")`: Top price decreases and increases over the last 7 days.
  - `getSystemStatus()`: Overall collection pipeline health and latest observation timestamp.
- **Component Hierarchy**:
  - `<header className="hero-section">`: Freshness pill, title, description, CTAs ("Find a station", "View map").
  - `<section className="national-summary-section">`: Large national median price, 30d delta badge, supporting metrics grid (Lowest, Highest, Locations tracked).
  - `<NationalTrendChart initialTrends={trends} />`: Client component rendering interactive Recharts line chart and accessible fallback table.
  - `<PriceMovers movers={moversData} />`: Two-column grid showing largest drops and largest increases.
  - `<StatePricePreview states={statesData.states} />`: Lowest 5 and Highest 5 states with links to `/states/[state]`.
  - `<SectionHeader title="Find a station" ... />`: Header introducing directory.
  - `<StationList stations={stations} />`: Search input, state filter, sort dropdown, fuel type chips, desktop directory table, and mobile card views.

---

## 2. Interactive Map Page (`/map`)

- **File**: `web/app/map/page.tsx`
- **Render Mode**: Server Component (`force-dynamic`) wrapping dynamic client map
- **Data Fetched**:
  - `getStations()`: Complete station list with coordinates
  - `getCartoApiKey()`: CARTO basemap API key from environment
  - `searchParams`: Optional `state` or `station` pre-selection
- **Component Hierarchy**:
  - Page header: Title and description
  - `<MapDiscoveryView stations={stations} ... />` (Client Component):
    - Search toolbar: Search input, state selector, fuel pills, count badge, clear action
    - `<div className="map-split-v2">`: Split layout
      - Sidebar: Selected station banner (details, price, close action) and scrollable station list
      - `<InteractiveMap ... />` (Dynamically loaded MapLibre GL instance without SSR): Canvas map, station markers, clustering, custom popup cards

---

## 3. States Index (`/states`)

- **File**: `web/app/states/page.tsx`
- **Render Mode**: Server Component (`force-dynamic`)
- **Data Fetched**:
  - `getStateSummaries("1")`: All state median prices, station counts, fuel type
- **Component Hierarchy**:
  - `<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "States" }]} />`
  - Page title: "Gas prices by state"
  - Summary highlight cards: Cheapest State Median, Highest State Median, Total States Tracked
  - `<StateIndexDirectory states={rawStates} />` (Client Component):
    - Search filter
    - Sorting controls (A-Z, lowest price, highest price, most stations)
    - State grid cards

---

## 4. State Detail Page (`/states/[state]`)

- **File**: `web/app/states/[state]/page.tsx`
- **Render Mode**: Server Component with dynamic route parameter
- **Data Fetched**:
  - `getStations()`: Filtered to stations in target state
  - `getStateSummaries("1")`: For state median and national ranking
  - `getNationalTrends(30, "1", stateCode)`: State-specific 30-day price trend history
- **Component Hierarchy**:
  - `<Breadcrumbs />`: Home > States > [State Name]
  - State hero card: State median price, station count, lowest and highest price in state
  - `<NationalTrendChart initialTrends={stateTrends} ... />`: State trend chart
  - `<StateStationList stations={stateStations} ... />`: Filterable and sortable state station list

---

## 5. Station Detail Page (`/stations/[clubNumber]`)

- **File**: `web/app/stations/[clubNumber]/page.tsx`
- **Render Mode**: Server Component with dynamic route parameter
- **Data Fetched**:
  - `getStation(clubNumber)`: Station address, hours, phone, coordinate, current fuel prices
  - `getStationHistory(clubNumber)`: Historical price observations for this station
  - `getNationalSummary("1")`: For comparison against national median
  - `getStateSummaries("1")`: For comparison against state median
  - `getNearbyStations(clubNumber, 5)`: Up to 5 geographically closest BJ's stations
- **Component Hierarchy**:
  - `<Breadcrumbs />`: Home > States > [State] > Club #[Number]
  - Station header: City, State, Club #, address, directions link
  - Fuel prices card: Large Regular price, secondary fuels (Premium, Diesel)
  - Price comparison callouts: vs State Median, vs National Median
  - `<PriceHistoryChart history={history} />`: Recharts interactive price history for this club
  - Recent price changes table / disclosure
  - `<NearbyStations nearby={nearby} />`: Comparison cards of nearby clubs

---

## 6. System Data Status (`/status`)

- **File**: `web/app/status/page.tsx`
- **Render Mode**: Server Component with `export const revalidate = 60`
- **Data Fetched**:
  - `getSystemStatus()`: Overall health, last collection run, freshness summary, station staleness counts, reasons
- **Component Hierarchy**:
  - `<Breadcrumbs />`: Home > Data status
  - Health banner: Large colored card (Healthy, Degraded, Stale) with pulsing indicator
  - Metric cards: Last Check, Stale Stations, Reporting Locations, Schedule
  - Operational details: Explanation of hourly collection and staleness thresholds
