# Route Structure

Map of all routes, page files, layouts, and responsibilities in `bjs-gas` (`web/app/`).

| Route | File Path | Layout | Summary & Responsibilities |
|---|---|---|---|
| `/` | `web/app/page.tsx` | RootLayout | **Homepage & National Directory**: Hero with freshness pill, National Summary card (median, lowest, highest, total stations), National Price Trend chart with 7D/14D/30D segmented toggle, Price Movers (weekly drops & increases), State Price Preview, and searchable/filterable Station Directory. |
| `/map` | `web/app/map/page.tsx` | RootLayout | **Interactive Map Discovery**: Split-screen view (`MapDiscoveryView`) with MapLibre GL vector tiles (`InteractiveMap`), station selection pins, interactive sidebar, and filter toolbar (search, state select, fuel filter). |
| `/states` | `web/app/states/page.tsx` | RootLayout | **State Directory Index**: National state comparison list, state median summary highlights (cheapest, most expensive), and alphabetical state directory (`StateIndexDirectory`). |
| `/states/[state]` | `web/app/states/[state]/page.tsx` | RootLayout | **State Detail Page**: State-specific gas prices, state median, price range, state trend chart, and state station listing (`StateStationList`). |
| `/stations/[clubNumber]` | `web/app/stations/[clubNumber]/page.tsx` | RootLayout | **Station Detail Page**: Detailed station pricing for Regular, Premium, Diesel; comparison against state and national medians; interactive price history chart (`PriceHistoryChart`); recent price changes list; nearby stations comparison (`NearbyStations`). |
| `/status` | `web/app/status/page.tsx` | RootLayout | **System Data Status**: Data freshness indicators, hourly collection pipeline health, time since last check, stale station count, and health explanations. |
| (loading) | `web/app/loading.tsx` | RootLayout | **Global Loading Skeleton**: Shimmer animation cards and placeholder UI during streaming/suspense page transitions. |
| (error) | `web/app/error.tsx` | RootLayout | **Error Boundary**: User-facing failure alert with retry button, home navigation, and Honeybadger incident reporting. |
| (not-found) | `web/app/not-found.tsx` | RootLayout | **404 Page**: Missing station or route notice with links to home and map. |
| `/sitemap.xml` | `web/app/sitemap.ts` | (API) | XML sitemap generating canonical URLs for homepage, map, states index, state pages, and all station pages. |
| `/robots.txt` | `web/app/robots.ts` | (API) | Search crawler instructions and sitemap link. |
