# Ledger Slate — Authoritative Design System

**Product**: BJ's Gas Prices  
**Design System Name**: Ledger Slate  
**Authoritative Reference**: Reconciled from Superdesign Drafts:
1. `cc0f9163-e7b0-418b-9be3-c42ec9a44c8f` (Ultra-Minimal Tracker — *Primary Global Source*)
2. `a3a5bbaf-829d-4b89-ab0d-72148d01274a` (Trends Page — *Secondary Analytical Source*)

---

## 1. Product Context

BJ's Gas Prices is a public consumer utility tracking current fuel prices, historical trends, and station locations across all BJ's Wholesale Club fuel locations in the United States.

- **Domain**: Fuel price tracking, club warehouse retail directory, market pricing utility.
- **Audience**: BJ's Wholesale Club members, cost-conscious drivers, commuter fuel shoppers, and price comparison analysts.
- **Cadence**: Hourly data collection across all reporting clubs.
- **Tone**: Restrained, utilitarian, highly scannable, editorial, civic-utility. Feels like a financial ledger or transit fare schedule rather than a marketing landing page or a SaaS dashboard.

---

## 2. Jobs to Be Done

1. **What does BJ's gas cost?**  
   Instantly scan the national median price and local station prices with zero visual friction.
2. **Where is the cheapest nearby BJ's?**  
   Quickly locate the lowest-priced club in a given state, city, or radius via directory or map.
3. **How has the price changed?**  
   Understand short-term (7D, 14D) and monthly (30D) fuel price momentum without cognitive overload.
4. **Which state/station is cheaper?**  
   Compare regional price differences between states and individual club locations.
5. **Where is the station?**  
   Access addresses, club identifiers, and interactive geographic mapping seamlessly.

---

## 3. Brand Personality & Visual Direction

The Ledger Slate design system strips away decorative embellishments, marketing fluff, and SaaS dashboard chrome:

- **Strictly Light Ground**: A clean, crisp slate-tinted ground (`#F8FAFC`) with pure white surfaces (`#FFFFFF`).
- **Data-Dense & Content-First**: Hierarchy is established purely by typography, tabular numerals, alignment, borders, and whitespace.
- **Restrained Color Accent**: Accent blue (`#2563EB`) is strictly rationed for primary actions, selected states, and navigational links. It is never used as background decoration.
- **Semantic Clarity**: Color conveys price trajectory (emerald for favorable drops, crimson for increases) accompanied by explicit directional glyphs (`↓` / `↑`).
- **Anti-Generic**: No gradients, no glassmorphism, no backdrop filters, no rounded bubble cards, no floating dropshadows, no marketing illustrations, and no animated flair.

---

## 4. Reconciled Draft Synthesis & Decision Matrix

When reconciling the Primary draft (*Ultra-Minimal Tracker*) with the Secondary draft (*Trends Page*), the following authoritative decisions govern Ledger Slate:

| Design Element | Ultra-Minimal Tracker (`cc0f9163`) | Trends Page (`a3a5bbaf`) | Chosen "Ledger Slate" System | Rationale |
|---|---|---|---|---|
| **Page Ground** | Pure `#FFFFFF` throughout | Pure `#FFFFFF` throughout | `#F8FAFC` page ground, `#FFFFFF` panels | Preserves clean panel boundaries without harsh contrast. |
| **Panel / Card Radius** | `0px` (stark brutalist borders) | `0px` (sharp borders) | `12px` (`--radius-lg`) panels; `0px` for flush list rows | The project mandate specifies 12px for macro-panels to prevent harsh raw borders while keeping directory rows flush (0px). |
| **Control Radius** | `0px` sharp borders | `0px` sharp buttons | `8px` (`--radius-md`) | Standardizes touch targets and controls across mobile and desktop. |
| **Accent Blue** | `#2563eb` for prices and links | `#2563eb` for prices and active tabs | `#2563EB` | Uniform blue accent rationed for interactive elements, links, and selected states. |
| **Gas Price Numeral Color** | `#2563eb` (blue) | `#2563eb` (blue) | `#0F172A` (primary text), `#2563EB` for selected/active | High contrast dark slate (`#0F172A`) for dominant prices avoids visual fatigue, with `#2563EB` reserved for links/actions. |
| **Trend Chart Style** | Simple SVG line, dashed limits | Angular line, clean axes | SVG/Recharts line with solid blue median (`#2563EB`) and dashed muted boundaries (`#94A3B8`) | Cleanest analytical rendering with zero gradient fills and restrained tooltips. |
| **Timeframe Controls** | Underlined text tabs (7D, 14D, 30D, 90D) | Underlined text tabs (7D, 14D, 30D, 90D, 1Y) | Compact Segmented Pill Control (7D, 14D, 30D) | Segmented pill control provides superior touch ergonomics, active state clarity, and keyboard accessibility. |
| **Historic Data Table** | 6-row visible table on homepage | 8-row visible table on trends page | Screen-reader accessible (`.sr-only`) on main ledger; optional disclosure | Prevents duplicate data on the primary ledger and keeps "Find a station" high on screen. Full tabular data remains accessible for screen readers. |
| **Weekly Movers** | 2-column list (drops/rises) | State-level shifts | Station-level drops & increases with `↓`/`↑` and delta badge | Direct actionable station data is more useful to consumers than generic state averages. |
| **Station Directory Layout** | Flush table-like rows with hairline borders | (Not present on Trends page) | Single-column flush ledger with hairline `1px #E2E8F0` separators | Eliminates bulky card containers; maximizes vertical scanning efficiency. |
| **Mobile Station Record** | Stacked responsive grid | (Not present on Trends page) | Flush stacked ledger row with `0px` radius and hairline bottom border | Preserves ledger aesthetics on small screens without reverting to boxed card tiles. |

---

## 5. Color Tokens

All colors are defined as CSS custom properties with strict semantic roles.

### Core Surfaces
```css
--color-bg:              #F8FAFC;  /* Slate-50: Main viewport background */
--color-surface:         #FFFFFF;  /* Pure White: Cards, panels, header, footer */
--color-surface-subtle:  #F1F5F9;  /* Slate-100: Subtle control backgrounds, table headers */
```

### Typography & Text
```css
--color-text-primary:    #0F172A;  /* Slate-900: Headings, dominant prices, primary body */
--color-text-secondary:  #475569;  /* Slate-600: Supporting metadata, labels, addresses */
--color-text-muted:      #64748B;  /* Slate-500: Axis labels, disabled text, captions */
```

### Borders & Hairlines
```css
--color-border:          #E2E8F0;  /* Slate-200: Hairline row dividers, card borders */
--color-border-hover:    #CBD5E1;  /* Slate-300: Interactive hover boundaries */
```

### Accent (Rationed Blue)
```css
--color-accent:          #2563EB;  /* Blue-600: Primary CTAs, active controls, links */
--color-accent-hover:    #1D4ED8;  /* Blue-700: Hover state for primary buttons */
--color-accent-subtle:   #EFF6FF;  /* Blue-50: Focus rings and active pill tints */
```

### Semantic Price Movement
```css
--color-positive:        #10B981;  /* Emerald-500: Price drops, cheaper rates */
--color-positive-bg:     #ECFDF5;  /* Emerald-50: Positive delta badge fill */
--color-positive-border: #A7F3D0;  /* Emerald-200: Positive delta badge border */

--color-danger:          #B91C1C;  /* Red-700: Price increases, higher rates */
--color-danger-bg:       #FEF2F2;  /* Red-50: Negative delta badge fill */
--color-danger-border:   #FECACA;  /* Red-200: Negative delta badge border */

--color-warning:         #D97706;  /* Amber-600: Aging data warning */
--color-warning-bg:      #FFFBEB;  /* Amber-50: Aging data badge fill */
```

### Accent Discipline Rules
- **Do NOT** use accent blue as a card background or section banner.
- **Do NOT** use accent blue for arbitrary numeric stats or non-interactive text.
- **DO** use accent blue for primary action buttons, active segmented control buttons, map action links (`Map →`), and `:focus-visible` outlines.

---

## 6. Typography System

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### Type Scale & Hierarchy

| Role | Font Size | Weight | Line Height | Tracking | Transform | Usage |
|---|---|---|---|---|---|---|
| **Display (Hero)** | 40px (md: 48px) | 800 | 1.15 | -1.4px (`-0.04em`) | Normal | Homepage H1 "BJ's gas prices" |
| **Section Headline** | 20px (md: 24px) | 700 | 1.25 | -0.4px (`-0.02em`) | Normal | H2 section headers ("National price trend", "Find a station") |
| **Card / Panel Title** | 16px (md: 18px) | 700 | 1.3 | -0.2px | Normal | State card headers, mover column titles |
| **Body Primary** | 16px | 400 | 1.5 | 0 | Normal | Hero descriptions, general text |
| **Body Secondary** | 14px | 400 | 1.5 | 0 | Normal | Station addresses, explanations |
| **Metadata / Caption** | 13px | 500 | 1.4 | 0 | Normal | Relative freshness timestamps, club numbers |
| **Eyebrow / Metric Label** | 11px to 12px | 700 | 1.2 | +0.12em to +0.16em | Uppercase | `NATIONAL MEDIAN`, `REGULAR`, `LOWEST PRICE` |
| **Dominant Price** | 30px to 36px | 800 | 1.0 | -0.03em | Tabular | Large gas price figures (`$3.999`) |
| **Hero Price** | 48px to 56px | 800 | 1.0 | -0.04em | Tabular | National summary median figure |
| **Secondary Price** | 13px to 14px | 600 | 1.2 | 0 | Tabular | Other fuels (`Premium $4.299`, `Diesel $3.999`) |

### Numerical Precision & Tabular Figures
Every numeric price, delta, date, and location count **MUST** enforce tabular numbers:
```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum";
```
This guarantees alignment across station ledger rows and historical tables.

---

## 7. Spacing, Radii & Elevation

### Spacing Scale
- Base unit: `4px`
- Rhythm: `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px`, `48px`, `64px`

### Border Radii
- **Flush Station Rows**: `0px` (clean hairline dividers)
- **Small Controls / Sub-buttons**: `6px` (`--radius-sm`)
- **Buttons, Form Inputs, Select Controls**: `8px` (`--radius-md`)
- **Cards & Summary Panels**: `12px` (`--radius-lg`)
- **Pills, Badges & Segmented Toggles**: `9999px`

### Elevation & Shadows
- **Base Shadow**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` (subtle hairline boundary lift on panels)
- **Dropdowns / Map Popups**: `0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.07)`
- **Station Directory Rows**: Zero elevation (`box-shadow: none`). Rows are separated exclusively by `1px solid var(--color-border)`.

---

## 8. Global Layout & Max-Width

- **Main Content Max-Width**: `1240px` centered with horizontal padding (`1rem` on mobile, `1.5rem` on desktop).
- **Page Ground**: `#F8FAFC`.
- **Panel Background**: `#FFFFFF` with `1px solid #E2E8F0` border and `12px` radius.
- **Station Directory Presentation**: Continuous single-column vertical list spanning the full container width. Never convert the station directory into multi-column card grids.

---

## 9. Header & Navigation System

- **Height**: ~62px fixed/sticky hairline boundary.
- **Surface**: Pure white (`#FFFFFF`) with bottom hairline border (`1px solid var(--color-border)`).
- **Left**: "BJ's gas prices" brand link (`16px`, weight `700`, tracking `-0.02em`). No image logo or mascot.
- **Right**:
  - `Map` (`/map`)
  - `States` (`/states`)
  - `Data status` (`/status` with `6px` emerald status dot)
- **Subdued Styling**: Text color `#475569`, hover `#0F172A`. No loud header CTA button.

---

## 10. Hero Section

- **Status Pill**: Compact badge (`border-radius: 9999px`, background `#F1F5F9`, border `#E2E8F0`) containing:
  - Small green status dot (`6px`)
  - Text: `Updated hourly • Updated 17m ago` (dynamic relative time)
- **Title**: `BJ's gas prices` (`40px` mobile, `48px` desktop, weight `800`).
- **Subtitle**: `Current BJ's gas prices, price history, and locations across the U.S. Updated hourly.`
- **Action Buttons**:
  - Primary CTA: `Find a station` (height `41px`, padding `0.5rem 1.25rem`, background `#2563EB`, text `#FFFFFF`, radius `8px`).
  - Secondary CTA: `View map` (height `41px`, padding `0.5rem 1.25rem`, background `#FFFFFF`, border `1px solid #CBD5E1`, text `#0F172A`, radius `8px`).

---

## 11. National Summary Panel

- **Container**: White panel (`#FFFFFF`), `12px` radius, `1px solid #E2E8F0` border, `p-6`.
- **Top Median Block**:
  - Label: `NATIONAL MEDIAN` (`12px`, uppercase, tracking `0.16em`, color `#64748B`).
  - Value Row: `$3.999` (`48px` to `56px`, weight `800`, tabular nums, color `#0F172A`) paired with 30-day delta badge (e.g. `+15¢ over 30 days` in red or `-12¢` in green).
  - Caption: `Regular unleaded across 207 stations` (`14px`, color `#475569`).
- **Divider**: Hairline `1px solid #E2E8F0` margin `1.5rem 0`.
- **Supporting 3-Column Metrics**:
  1. **Lowest price**: `$3.399` (`24px`, weight `700`, emerald `#10B981`), station link caption (e.g. `Noblesville, IN #761`).
  2. **Highest price**: `$4.549` (`24px`, weight `700`, crimson `#B91C1C`), station link caption (e.g. `Massena, NY #122`).
  3. **Locations tracked**: `221` (`24px`, weight `700`), caption `BJ's clubs with fuel stations`.

---

## 12. National Price Trend Panel & Chart

- **Container**: White panel (`#FFFFFF`), `12px` radius, `1px solid #E2E8F0` border, `p-6`.
- **Header**:
  - Left: Title `National price trend`, subtitle `Daily median and range across reporting BJ's stations`, large current price `$3.999` and delta badge.
  - Right: Segmented control pills: `7D`, `14D`, `30D` (selected: blue background `#2563EB`, white text; unselected: transparent/slate `#475569`).
- **Chart Presentation**:
  - Recharts ResponsiveContainer (height `300px`).
  - Clean horizontal hairline grid lines (`#F1F5F9`), zero vertical grid lines.
  - **Median Line**: Solid blue (`#2563EB`), stroke width `2.75px`, no dots except active hover dot.
  - **Lowest Line**: Muted slate (`#94A3B8`), dashed `4 4`, stroke width `1.25px`.
  - **Highest Line**: Muted slate (`#94A3B8`), dashed `4 4`, stroke width `1.25px`.
  - **Axes**: Hairline border, muted text (`12px`, color `#64748B`), tabular formatted prices (`$3.50`, `$4.00`).
  - **Tooltip**: White card (`#FFFFFF`), hairline border (`1px solid #E2E8F0`), subtle shadow, tabular dates and prices. Zero colored area gradients.

---

## 13. Accessible Trend Data Table Policy

- **Authoritative Decision**: On the primary homepage ledger, the full 30-day tabular data remains accessible via the dedicated screen-reader table (`.sr-only`) rather than a heavy visible table block.
- **Rationale**: A visible table with 30 rows duplicates the interactive chart, consumes excessive vertical viewport height, and pushes the primary directory ("Find a station") far down the page.
- **Usability Parity**: Screen readers receive a fully structured HTML `<table>` with `<caption>`, `<th scope="col">` headers, and tabular formatted values.

---

## 14. Weekly Price Movers (Drops & Increases)

- **Section Title**: `Biggest changes this week` with descriptive subtitle.
- **Grid Layout**: 2-column grid (`grid-cols-1 md:grid-cols-2`, gap `1.5rem`).
- **Column Panels**: White panels, `12px` radius, `1px solid #E2E8F0` border, `p-5`.
- **Left Column**: `↓ Largest drops` (header accented with emerald glyph and title).
- **Right Column**: `↑ Largest increases` (header accented with crimson glyph and title).
- **Row Anatomy**:
  - Left: Station city, state, club number link.
  - Right: Current price (`15px`, weight `700`, tabular) and semantic delta badge (`↓ 12¢` with `#ECFDF5` background / `↑ 18¢` with `#FEF2F2` background). Explicit arrow glyphs guarantee non-color-only communication.

---

## 15. Prices by State (Comparison)

- **Layout**: 2-column card grid for "Lowest State Medians" and "Highest State Medians" on homepage, linking to `/states`.
- **Card Anatomy**: White bordered panels (`12px` radius, `1px solid #E2E8F0`).
- **Row Items**: State name and abbreviation on left, state median price in tabular bold numerals on right, separated by subtle hairline row divider.

---

## 16. Station Directory (Authoritative Ledger Pattern)

The station directory is the primary workhorse of the product. It must scan as a high-density pricing ledger.

### Filter Toolbar
- **Container**: White bordered container (`12px` radius, `1px solid #E2E8F0`, padding `1rem 1.25rem`).
- **Primary Row**:
  - Search field: Input with search magnifying glass icon, clear button, placeholder `Search city, ZIP, or club`, height `38px`, radius `8px`.
  - State select: Dropdown selector, height `38px`, radius `8px`.
  - Sort select: Sort by price (low to high, high to low) or recently updated.
- **Secondary Row**:
  - Fuel selector pills: Segmented chips (`All fuels`, `Regular`, `Premium`, `Diesel`). Active: `#2563EB` fill with white text; Inactive: `#F1F5F9` surface with `#475569` text.
  - Results count & clear: Tabular counter (e.g. `207 locations`) with active filter reset link.

### Desktop Directory Ledger (>= 640px)
- **Container**: Continuous full-width flush ledger table.
- **Header**: Subtle slate header (`#F8FAFC`), uppercase tracking `0.05em`, `11px`, border-bottom `1px solid #CBD5E1`.
- **Row Anatomy**:
  1. **Location Block** (Left): City, State bold link (`16px`, weight `700`, hover `#2563EB`), followed by street address and `Club #N` (`13px`, color `#64748B`).
  2. **Primary Fuel Price**: Dominant tabular price (`28px` to `30px`, weight `800`, color `#0F172A`), with small caps fuel label (`REGULAR` / `11px`, color `#64748B`) directly underneath.
  3. **Secondary Fuels**: Horizontal pill list for Premium and Diesel (`12px`, tabular values).
  4. **Freshness**: Relative update text (e.g. `Updated 17m ago`, `13px`, color `#64748B`).
  5. **Action** (Right): Blue action link `Map →` (`14px`, weight `600`, color `#2563EB`).
- **Divider**: Hairline `1px solid #E2E8F0` between rows. Zero card radius, zero shadows.

### Mobile Station Ledger (< 640px)
- **Container**: Flush stacked ledger items.
- **Styling**: `0px` radius, `1px solid #E2E8F0` border-bottom, padding `1rem 0`.
- **Top Row**: Location title on left; Dominant tabular price (`24px`, weight `800`) on right with fuel label.
- **Middle Row**: Secondary fuels pills and address.
- **Bottom Row**: Freshness indicator on left; `Map →` link button on right.
- **Discipline**: No floating card shadows or nested rounded boxes.

---

## 17. Interactive Map UI Rules

- **Split View**: Sidebar (width `360px` desktop) + MapLibre GL canvas.
- **Unified Toolbar**: The map page MUST use the exact same `FilterToolbar` component structure as the directory, eliminating layout breakage.
- **Sidebar Selection Card**:
  - Top: City, State, Club #, close button `×`.
  - Dominant price: `$3.999 REGULAR`.
  - Secondary fuels and relative freshness.
  - Action: `View club details →` linking to `/stations/[clubNumber]`.
- **Map Pins**:
  - Regular pins: Blue circle badge with tabular price text or marker dot.
  - Selected pin: Highlighted ring with accent blue contrast.

---

## 18. Footer System

- **Container**: Full-width white background (`#FFFFFF`), border-top `1px solid #E2E8F0`, padding `2rem 1.5rem`.
- **Nav Links**: Horizontal flex row linking to `Map`, `States`, `Data status`.
- **Brand & Disclaimer**:
  - `BJ's Gas Prices` (`14px`, weight `600`, color `#0F172A`).
  - `Independent price tracking project. Not affiliated with BJ's Wholesale Club.` (`13px`, color `#64748B`).

---

## 19. Accessibility System (WCAG 2.1 AA)

1. **Color Contrast**: All text achieves at least `4.5:1` contrast ratio against backgrounds (`#0F172A` on `#FFFFFF` is `16.0:1`; `#475569` on `#FFFFFF` is `7.0:1`).
2. **Non-Color Dependence**: Price movements ALWAYS combine color with explicit directional arrows (`↓` for drop, `↑` for increase) and descriptive ARIA labels.
3. **Keyboard Navigation & Focus Visible**: All interactive buttons, links, search inputs, and segmented controls feature high-visibility focus rings (`outline: 2px solid var(--color-accent); outline-offset: 2px;`).
4. **Heading Hierarchy**: Strictly one `<h1>` per page, followed by logical `<h2>` section headers and `<h3>` card titles.
5. **Form Controls**: All inputs and selects possess explicit `<label>` or `aria-label` attributes.
6. **Accessible Chart Fallback**: Every historical chart provides a semantic HTML `<table>` alternative (`.sr-only`) with full date, median, min, max, and station count values.
7. **Motion**: Respects `@media (prefers-reduced-motion: reduce)` by disabling all non-essential transitions and pulsing animations.

---

## 20. Authoritative Copy & Terminology Guardrails

### Approved Terminology
- `BJ's gas prices`
- `current prices`
- `price history`
- `updated hourly`
- `Updated Xm ago`
- `Regular`, `Premium`, `Diesel`
- `station`, `location`, `Club #N`
- `Data status`

### Prohibited Terminology
- ❌ `real-time` (prices are collected hourly)
- ❌ `pipeline`, `observations`, `reporting facilities` (too technical for consumers)
- ❌ `historical analytics` (use `price history` or `price trends`)
- ❌ `station discovery` (use `find a station` or `gas station map`)

---

## 21. Anti-Patterns (What NOT to Do)

1. **No Gradients**: Never use linear or radial gradients on cards, buttons, or charts.
2. **No Floating Card Stacks in Directory**: Never turn the station directory into a grid of bubbly rounded cards with drop shadows.
3. **No Decorative Iconography**: Avoid generic illustration kits, decorative badges, or oversized icons that convey no data.
4. **No Unstyled Components**: Every form control, select, search box, and fuel chip must use design-system styles.
5. **No Blue Overuse**: Never use blue as card backgrounds or decorative banners.
