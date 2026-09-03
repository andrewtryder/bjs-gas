# Sitemap / Chromium-free discovery investigation

Date: 2026-09-02  
Probe script: `scripts/probe-sitemap-discovery.mjs`  
Artifact: `data/raw-sitemap-discovery-probe.json` (gitignored via `data/raw-*.json`)

```bash
pnpm probe:sitemap
```

Playwright discovery was **not** removed or changed. `pnpm discover:http` was **not** added.

---

## Completion checklist

### 1. Can `robots.txt` be fetched without browser?

**Yes** (from this repo’s Node `fetch` with a descriptive User-Agent, observed HTTP 200).

Also verified with a desktop Chrome UA (200). Googlebot UA received **403** in the same run.

Earlier in the same day, the same host returned intermittent Akamai **403** for ordinary clients — treat www.bjs.com access as **flaky**, not guaranteed.

### 2. Can `bjs_sitemap.xml` be fetched without browser?

**Yes** (Node `fetch`, HTTP 200, descriptive UA), with the same intermittent-403 caveat.

### 3. Sitemap structure

**Sitemap index** with four children:

| Child | Role | `/cl/` club URLs |
| --- | --- | --- |
| `bjs_custom_pages_sitemap.xml` | marketing/custom pages | 0 |
| `bjs_categories_sitemap.xml` | category URLs | 0 |
| `bjs_product_sitemap.xml` | product URLs | 0 |
| `bjs_ancillary_sitemap.xml` | ancillary + club pages | **272** |

### 4. Unique `/cl/` club IDs

**272** unique `clubNumber` values (min 1, max 905). Pattern: `https://www.bjs.com/cl/<slug>/<zero-padded-id>/`.

### 5. Difference vs current 286 locations (`data/clubs.json`)

| Set | Count |
| --- | --- |
| `clubs.json` | 286 |
| Sitemap `/cl/` | 272 |
| Only in `clubs.json` | **14** |
| Only in sitemap | **0** |

Missing from sitemap (present in locator discovery):

| clubNumber | name | hasGas |
| --- | --- | --- |
| 229 | Casselberry | yes |
| 245 | Rotterdam-ComingSoon | yes |
| 255 | Frankfort | yes |
| 260 | Ocala | yes |
| 261 | Port St. Lucie | yes |
| 266 | Mesquite | yes |
| 267 | Sumter | yes |
| 273 | Selma | yes |
| 276 | Lecanto | yes |
| 277 | Foley | yes |
| 281 | Portage | yes |
| 580 | Uxbridge Distribution Center | no |
| 582 | Burlington Distribution Center | no |
| 584 | Jacksonville Distribution Center | no |

Several missing gas clubs are among those that often return **empty** eisapi fuel arrays.

### 6. Can individual club pages be fetched without browser?

**Yes, often** — sample `/cl/...` pages returned HTTP 200 with large Angular HTML (~0.5–1.0 MiB). Response shape is **not stable**: the same URL sometimes returns a thin shell (~57 KiB, title `BJs.com`) without usable club JSON-LD.

### 7. Is structured location/service data embedded?

**Yes, when the full page HTML is returned:**

| Source | Contents |
| --- | --- |
| JSON-LD `WholesaleStore` | Name (generic “Bj's Wholesale Club”), `PostalAddress`, opening hours. **No** geo, phone, or amenity list in LD. |
| Escaped in-page `PhysicalStore`-like JSON | `uniqueID`, address, city, state, ZIP, **latitude/longitude**, phone, `Features`, `StoreType`, `Gas Hours`, display name — same family of fields as the locator API |
| Rendered Features UI | `feature-detail-text` nodes (e.g. literal `Gas`) |

**Gas signals that work without locator API (when full HTML loads):**

1. Features list contains `Gas`, **or**
2. Embedded `StoreType` value is `GAS`, **or**
3. Non-empty embedded `Gas Hours`

Examples:

- Club **39** (gas): Features includes `Gas`; `StoreType=CLUB`
- Club **901** (gas station): Features UI empty / no `Gas` chip; embedded `StoreType=GAS` + `Gas Hours`
- Club **189** sometimes returns a **thin shell** (~57 KiB) where Features chips are missing and `inferredHasGas` can false-negative even though locator data says gas — unattended parsers must retry or require full HTML.

Naive `\bGas\b` / “Gas Hours” label matching alone is **too loose** (labels appear even when hours are empty).

### 8. Can gas status be determined without locator API?

**Partially — from club pages, not from eisapi alone.**

`GET https://eisapi.bjs.com/api/v1/fuelprice/clubnum/{n}` (no browser):

| Case | HTTP | statusCode | fuels |
| --- | --- | --- | --- |
| Gas with prices (189, 39) | 200 | 0 success | 2–3 |
| Gas-listed empty fuels (901, 255) | 200 | 0 success | **0** |
| Known non-gas (11, 17) | 200 | 0 success | **0** |
| DC non-gas (580) | 200 | 0 success | **0** |
| Invalid (99999) | 200 | 0 success | **0** |

Empty `data: []` is **indistinguishable** among non-gas, empty-fuel gas stations, DCs, and invalid IDs. Transient failures must never be treated as `hasGas: false`.

### 9. Recommended Chromium-free architecture (ranking)

| Rank | Option | Verdict |
| --- | --- | --- |
| 1 | **C** — sitemap IDs + club pages for metadata/`hasGas` + eisapi soft verify only | Best *design* when pages load fully; **inventory incomplete** today (272 ⊂ 286) |
| 2 | **A** — sitemap → page Features contains Gas | Needs full HTML; must also honor `StoreType=GAS` / Gas Hours (901); same inventory gap |
| 3 | **B** — sitemap → eisapi for gas classification | **Reject** as sole classifier |

### 10. `pnpm discover:http` gate

**Not implemented.**

Reasons:

1. Sitemap inventory is incomplete vs known-good Playwright/`club/search` set (**14** missing).
2. Club page HTML is sometimes a thin shell without embedded store JSON — brittle for unattended discovery.
3. Googlebot UA is blocked; ordinary UA works only intermittently against Akamai.

Keep **Playwright + `club/search`** as the maintenance discovery path until sitemap coverage matches (or a conscious decision accepts dropping DCs / coming-soon / missing SEO pages).

---

## Edge cases

- Akamai 403 intermittency on `www.bjs.com` (observed same day).
- Angular SSR vs shell responses for identical `/cl/` URLs.
- HTML entities in feature names (`Apparel &amp; Footwear`).
- Embedded JSON uses `&q;`-style escaping inside the page blob.
- Distribution centers and ComingSoon clubs may be omitted from SEO sitemap but present in locator search.
- `/club/{id}` URLs in `clubs.json` differ from SEO `/cl/{slug}/{id}` paths.

## Transport matrix (this probe run)

| UA | robots.txt | sitemap | sample `/cl/` |
| --- | --- | --- | --- |
| descriptive research UA | 200 | 200 | 200 |
| Chrome desktop UA | 200 | 200 | 200 |
| Googlebot UA | 403 | 403 | (not required) |

No cookies, Playwright, CAPTCHA bypass, or brute-force ID scanning were used.
