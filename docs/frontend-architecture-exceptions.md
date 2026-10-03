# Frontend Architecture Exceptions

This document records deliberate architectural exceptions identified during the Ledger Slate Phase DS-6 audit. These are not unresolved debt.

## 1. MapLibre GL Shader & Paint Expressions

- **Context**: MapLibre GL GL-JS renders vector/raster map layers via WebGL canvas contexts and style specification JSON.
- **Constraint**: WebGL shader expressions cannot dynamically resolve CSS custom properties (e.g. `var(--color-primary)`).
- **Resolution**: Canonical hex literals are centralized into `MAP_THEME_TOKENS` in `web/lib/map-config.ts` and consumed directly by `web/components/InteractiveMap.tsx`. If tokens change, update `MAP_THEME_TOKENS` alongside `web/app/globals.css`.

## 2. Recharts SVG Stroke & Active Dot Attributes

- **Context**: `web/components/PriceHistoryChart.tsx` and `web/components/NationalTrendChart.tsx` render responsive SVG charts with Recharts.
- **Constraint**: SVG stroke and activeDot fill attributes require resolved color strings for cross-browser SVG export and canvas fallback rendering.
- **Resolution**: Canonical color values (`#2563eb`, `#64748b`, `#e2e8f0`, `#ffffff`) are passed directly to Recharts `<Line>`, `<XAxis>`, and `<YAxis>` components.

## 3. Global Error Boundary Inline Styles

- **Context**: `web/app/global-error.tsx` serves as Next.js's top-level error boundary.
- **Constraint**: In catastrophic rendering failures where the root layout fails to mount, `globals.css` may not be loaded or evaluated.
- **Resolution**: Minimal inline styles using canonical Ledger Slate values (`#F8FAFC`, `#FFFFFF`, `#0F172A`, `#475569`, `#2563EB`) provide resilient fallback presentation without external stylesheet dependencies.
