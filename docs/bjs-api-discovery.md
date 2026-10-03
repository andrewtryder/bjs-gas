# BJ's public API discovery notes

Discovery date: 2026-09-02.

This document records what was verified against BJ's public website and APIs.
Cookies, tokens, tracking IDs, and analytics parameters are redacted.

## Summary

| Purpose | Endpoint | Method | Auth |
| --- | --- | --- | --- |
| Enumerate all clubs (primary) | `https://api.bjs.com/digital/live/api/v1.2/club/search/10201` | `POST` | None (Akamai browser session) |
| State/town index (cross-check) | `https://api.bjs.com/digital/live/apis/v1.0/clublocatorpage/statetowns/10201` | `GET` | None (Akamai browser session) |
| Alternate all-clubs dump | `https://api.bjs.com/digital/live/api/v1.2/findnearestclub/clubDetails?radius=5000&storeID=10201&maxClub=500` | `GET` | None (Akamai browser session) |
| Fuel prices | `https://eisapi.bjs.com/api/v1/fuelprice/clubnum/{clubNumber}` | `GET` | None |

`10201` in these paths is the IBM WCS **catalog store id**, not a club number.

## Akamai / transport

- Bare Node `fetch` / `curl` to `api.bjs.com` returns **403 Access Denied**.
- Stock Playwright Chromium (automation flags on) is also blocked at the HTML layer (`Access Denied` on `www.bjs.com`).
- Working transport: **Playwright persistent Google Chrome** profile with `--disable-blink-features=AutomationControlled`, `ignoreDefaultArgs: ['--enable-automation']`, warm `https://www.bjs.com/clubLocator`, then in-page `fetch`.
- Optional: set `BJS_CDP_URL` (e.g. `http://127.0.0.1:9222`) to attach to an already-running Chrome DevTools endpoint.
- Optional offline: `BJS_RAW_CLUB_SEARCH=/path/to/raw.json` skips the browser and parses a previously saved club/search body.
- Meaningful request headers observed: `accept: application/json, text/plain, */*`, `content-type: application/json` (POST), `referer: https://www.bjs.com/clubLocator`, `origin: https://www.bjs.com`.
- Cookie jar contains Akamai sensor cookies (`_abck`, `bm_*`, `ak_bmsc`, etc.). Values are not hand-copied.
- No member login is required. Scripts do not solve CAPTCHAs.

`eisapi.bjs.com` is reachable without a browser session.

## DISCOVERY DATA SEMANTICS

The BJ's **locator** discovery output is authoritative for location membership and `hasGas`.

Do **not** attempt to infer production gas-club membership from the fuel API.

The following are **NOT** evidence that a club is non-gas:

- HTTP 200 with `fuelPriceResponse.data = []`
- absence from BJ's sitemap
- a temporarily incomplete/thin club HTML page
- a temporary fetch failure

`data: []` can mean gas-with-no-prices, non-gas warehouse, DC, or invalid ID.

The collector must poll every `data/gas-clubs.json` entry; empty fuels preserve currents and must not change `Club.hasGas` or the poll list. Only locator discovery → accept → import may change `hasGas`.

Maintenance flow: `pnpm discover` → `discovery:diff` → `discovery:accept` → `import:clubs`.

Sitemap inventory is **not** authoritative for membership or `hasGas`. Locator discovery remains the maintenance path. Public sitemap `/cl/` pages may omit known clubs and may return thin HTML shells. Empty eisapi `data: []` cannot classify gas membership.

`pnpm discover:sitemap-canary` is only a change detector: it fetches sitemap IDs, compares them to authoritative `clubs.json`, and alerts on new IDs. It never classifies `hasGas` and never replaces locator discovery.

## Club search (`/digital/live/api/v1.2/club/search/10201`)

### Method and bodies (verified)

**Geo search (used for full enumeration):**

```http
POST /digital/live/api/v1.2/club/search/10201
Content-Type: application/json

{"latitude":39.8283,"longitude":-98.5795,"radius":5000}
```

With `radius` ≥ ~3000 miles from a US interior point, the API returns the full set of physical stores in one response (observed **286** stores on 2026-09-02).

**Town / current-club body (seen on `/gas/`):**

```json
{"Town":"0039","latitude":"","longitude":"","radius":"","zipCode":""}
```

`Town` is the zero-padded club id for the shopper's selected club.

Empty `{}` returns HTTP 200 with `{"message":"Invalid Search Parameter"}`.
Bodies like `{ "Zip": "01835" }` return HTTP 400.

### Representative response shape

```json
{
  "Stores": {
    "PhysicalStore": [
      {
        "storeName": "0189",
        "uniqueID": "189",
        "city": "Haverhill",
        "stateOrProvinceName": "MA",
        "postalCode": "01835",
        "addressLine": ["25 Shelley Rd."],
        "latitude": "42.75717",
        "longitude": "-71.11847",
        "telephone1": "978-241-1050",
        "Description": [{ "displayStoreName": "Haverhill" }],
        "Attribute": [
          {
            "name": "Features",
            "displayValue": "Apparel & Footwear|...|Gas|...|Tire Center",
            "value": "Apparel & Footwear|...|Gas|Tir|..."
          },
          { "name": "StoreType", "value": "CLUB", "displayValue": "CLUB" },
          { "name": "Gas Hours", "displayValue": "Mon. - Sat.: 6:30 AM - 10 PM<br>..." }
        ]
      }
    ]
  }
}
```

Notes:

- Prefer `Features.displayValue` over `Features.value` (value is often truncated).
- Pagination is not used; radius controls result size.
- No authentication headers beyond normal browser cookies.

## State/towns index

```http
GET /digital/live/apis/v1.0/clublocatorpage/statetowns/10201
```

Returns:

```json
{
  "clubLocatorStateTownList": [
    {
      "StateName": "Massachusetts",
      "StateCode": "MA",
      "Towns": ["0189|Haverhill", "0901|Auburn Gas Station", "..."]
    }
  ]
}
```

Observed **283** entries. Search returned **286**, including clubs `0580`, `0582`, `0584` absent from the index. Enumeration therefore uses **club/search**, with statetowns only as a cross-check.

## Find-nearest (alternate full dump)

```http
GET /digital/live/api/v1.2/findnearestclub/clubDetails?radius=5000&storeID=10201&maxClub=500
```

Also returned **286** stores. `storeID=10201` is the catalog id. Passing a club id as `storeID` still resolves nearest-to-cookie-location behavior, not “details for that club only.”

## Fuel price API

```http
GET https://eisapi.bjs.com/api/v1/fuelprice/clubnum/{clubNumber}
```

`clubnum` is the numeric club number (e.g. club id `0189` → `189`).

Success with products:

```json
{
  "response": {
    "fuelPriceResponse": {
      "data": [
        { "name": "Unleaded", "sku": "1", "price": 3.919, "priceDateTime": "..." },
        { "name": "Premium", "sku": "3", "price": 4.469, "priceDateTime": "..." }
      ]
    },
    "statusCode": 0,
    "statusMsg": "success"
  }
}
```

Success with **empty** `data: []` is common for:

- Clubs without gas
- Standalone `StoreType=GAS` stations (e.g. 0898–0905)
- Invalid/unknown club numbers

Therefore empty fuel data is **not** treated as confirmed no-gas.

No rate limiting was observed during light probing; discovery still uses conservative concurrency (≤6) and retries 429/5xx with exponential backoff + jitter.

## How gas status is determined

Primary (locator attributes — preferred):

1. `Features.displayValue` pipe-list contains `Gas` or `Diesel`, **or**
2. `StoreType` is `GAS`, **or**
3. Non-empty `Gas Hours`, **or**
4. Display name matches `/gas\s*station/i`

Otherwise, if Features or `StoreType=CLUB` is present without Gas → **no**.

Fuel probing is only used for clubs still marked **unknown** (`discover:gas`).

## Club ID ↔ fuel `clubnum`

| Field | Example |
| --- | --- |
| `storeName` / club id | `"0189"` |
| `uniqueID` / club number | `189` / `"189"` |
| Fuel path | `/fuelprice/clubnum/189` |

Normalization: strip non-digits, parse int for `clubNumber`, zero-pad to 4 for `clubId`.

## Public pages inspected

- `https://www.bjs.com/allClubLocator` — loads statetowns; state list UI
- `https://www.bjs.com/clubLocator` — ZIP/radius locator UI
- `https://www.bjs.com/gas/` — issues `club/search` + `fuelprice` for the selected club

## Uncertainties / fragile assumptions

1. Large-radius `club/search` currently returns the full fleet; if BJ's caps results later, fall back to multi-center geo searches or `findnearestclub` with high `maxClub`.
2. Statetowns can lag behind search (3 clubs missing on discovery day).
3. Fuel API is incomplete for dedicated gas stations — locator attributes are authoritative.
4. Akamai behavior may change. `api.bjs.com` still requires persistent Chrome for discovery. `www.bjs.com` SEO/sitemap pages sometimes work with plain Node `fetch` and sometimes return 403 — do not assume either is stable.
5. `Features.value` truncation means parsers must prefer `displayValue`.
6. Coming-soon clubs (e.g. name containing `ComingSoon`) may still appear in search.
7. `StoreType=DC` distribution centers appear in club/search but not in the all-clubs HTML index; they are treated as non-gas.
8. Public sitemap `/cl/` coverage lags locator search; some known clubs are omitted. Use `discover:sitemap-canary` as a change detector only.

## Reproduction without interactive browsing

```bash
pnpm install
# Uses locally installed Google Chrome via Playwright channel "chrome"
pnpm discover
```

After the contract was learned, discovery does not require a human-driven interactive browser. It launches headless Chrome (persistent profile under `.cache/bjs-chrome-profile`) solely so Akamai accepts `api.bjs.com` calls the same way the public site does.
