# Changelog

## [0.1.2](https://github.com/andrewtryder/bjs-gas/compare/v0.1.1...v0.1.2) (2026-11-24)


### Bug Fixes

* **ci:** handle stale collection data in post-deploy smoke test ([#78](https://github.com/andrewtryder/bjs-gas/issues/78)) ([2d8dae9](https://github.com/andrewtryder/bjs-gas/commit/2d8dae9fb6e452d8bcfdc803aa4ca86aeff71532))

## [0.1.1](https://github.com/andrewtryder/bjs-gas/compare/v0.1.0...v0.1.1) (2026-11-24)


### Features

* add indexable state pages, nearby-station comparisons, and SEO layer (Phase 4) ([30bddea](https://github.com/andrewtryder/bjs-gas/commit/30bddea43d3161d53620912210ab0f9588d16e9b))
* add public web frontend as second Prisma Compute service (Phase 1) ([3837aa7](https://github.com/andrewtryder/bjs-gas/commit/3837aa7e54c22820cddf8301860419aa13ec7ffc))
* **analytics:** add historical analytics layer and national/state price trends ([f389ec7](https://github.com/andrewtryder/bjs-gas/commit/f389ec76e01d0f59fd540ad9dc96d147e1ece85d))
* expand pricing history to 90 days and improve cold-start query resilience ([#53](https://github.com/andrewtryder/bjs-gas/issues/53)) ([9040dd2](https://github.com/andrewtryder/bjs-gas/commit/9040dd2ff23bf4f8fa464d17b4e5d6b3a5baad55))
* **map:** upgrade CARTO basemap from raster to vector style ([#56](https://github.com/andrewtryder/bjs-gas/issues/56)) ([c3e515b](https://github.com/andrewtryder/bjs-gas/commit/c3e515bbd59abb2f008e88e99d25034a3a338085))
* **observability:** configure CARTO and Honeybadger production integration ([c0b6d21](https://github.com/andrewtryder/bjs-gas/commit/c0b6d21bca6b9d192495b19f684964ecdf13a78c))
* **scheduler:** migrate to Prisma-native cron and remove Cloudflare trigger ([a02a14a](https://github.com/andrewtryder/bjs-gas/commit/a02a14a74128548fb9598625d98578c17489c486))
* **scheduler:** migrate to Prisma-native cron and remove Cloudflare trigger ([76f5736](https://github.com/andrewtryder/bjs-gas/commit/76f573687620982743410da225d57fe38a19292f))
* **web:** add in-memory SWR caching and tune connection pool ([#55](https://github.com/andrewtryder/bjs-gas/issues/55)) ([24ce3c0](https://github.com/andrewtryder/bjs-gas/commit/24ce3c05a95c8c1fef493c015dc530807634d331))
* **web:** add interactive gas station map and discovery ([6bc796f](https://github.com/andrewtryder/bjs-gas/commit/6bc796f8d9ce83a1b9b3d0ce88321144f219b6e4))
* **web:** complete UI overhaul and cross-site polish ([6b30d9b](https://github.com/andrewtryder/bjs-gas/commit/6b30d9b6ebbd4d4c07be890f8549077e9429e4da))
* **web:** complete UI overhaul and cross-site polish ([bdbc159](https://github.com/andrewtryder/bjs-gas/commit/bdbc159ea18ef7718008223175cb65e18111863c))
* **web:** establish Ledger Slate design foundations ([aac0a46](https://github.com/andrewtryder/bjs-gas/commit/aac0a463d6cc921e05b29eae9e97a663600ec8c1))
* **web:** establish Ledger Slate design foundations (Phase DS-1) ([474da36](https://github.com/andrewtryder/bjs-gas/commit/474da369731266bcfc3f019b5165b52dde6e6aa4))
* **web:** establish redesigned UI foundation and homepage ([25b9af2](https://github.com/andrewtryder/bjs-gas/commit/25b9af203cb0368992aa4c1ce3cd451ae46830f8))
* **web:** establish redesigned UI foundation and homepage (Phase 1) ([decaefb](https://github.com/andrewtryder/bjs-gas/commit/decaefb1d202e294d8bcd73150b057e69bb948e5))
* **web:** migrate homepage to Ledger Slate ([#16](https://github.com/andrewtryder/bjs-gas/issues/16)) ([34dd584](https://github.com/andrewtryder/bjs-gas/commit/34dd584912409851b240c50b4cb45714fb3b9012))
* **web:** migrate map experience to Ledger Slate ([#18](https://github.com/andrewtryder/bjs-gas/issues/18)) ([ecd0c12](https://github.com/andrewtryder/bjs-gas/commit/ecd0c122b571a778dc0a4f5bee783f8d29ed4dfa))
* **web:** migrate station directory to Ledger Slate ([#17](https://github.com/andrewtryder/bjs-gas/issues/17)) ([f5e924a](https://github.com/andrewtryder/bjs-gas/commit/f5e924ae0b7ce6da6b26ba6a337993edce4a8e02))
* **web:** migrate subpages and edge states to Ledger Slate ([#19](https://github.com/andrewtryder/bjs-gas/issues/19)) ([266a53b](https://github.com/andrewtryder/bjs-gas/commit/266a53bded2805c991ead63c53f734e8046d8307))
* **web:** redesign station details and map experience ([102975f](https://github.com/andrewtryder/bjs-gas/commit/102975fad06bd8184c23f31026e3e796f322de2f))
* **web:** redesign station details and map experience (Phase 3) ([aceffc4](https://github.com/andrewtryder/bjs-gas/commit/aceffc4d287782221b242c426d9f14cbb18cf10a))
* **web:** redesign station details and map experience (Phase 3) ([#11](https://github.com/andrewtryder/bjs-gas/issues/11)) ([aceffc4](https://github.com/andrewtryder/bjs-gas/commit/aceffc4d287782221b242c426d9f14cbb18cf10a))
* **web:** redesign station discovery and directory ([c65a0fb](https://github.com/andrewtryder/bjs-gas/commit/c65a0fb2e1ca0dcbed01ce0e2b35f4b60b843eaa))
* **web:** redesign station discovery and directory (Phase 2) ([eba4289](https://github.com/andrewtryder/bjs-gas/commit/eba428978437c4e39b45e5304cc0683d45a0691b))
* **web:** redesign station discovery and directory (Phase 2) ([#10](https://github.com/andrewtryder/bjs-gas/issues/10)) ([eba4289](https://github.com/andrewtryder/bjs-gas/commit/eba428978437c4e39b45e5304cc0683d45a0691b))


### Bug Fixes

* **analytics:** count only currently active gas clubs ([74a2319](https://github.com/andrewtryder/bjs-gas/commit/74a231995691242f318b686987f405ef6c9a9042))
* **api,web:** add global DB admission limiter and preserve 503 diagnostics ([#46](https://github.com/andrewtryder/bjs-gas/issues/46)) ([af621b8](https://github.com/andrewtryder/bjs-gas/commit/af621b8c4001484d383176e86cee6a8d70c6c62f))
* **api:** add execution timeout to concurrency limiter to prevent permit leaks ([#51](https://github.com/andrewtryder/bjs-gas/issues/51)) ([f09bd9e](https://github.com/andrewtryder/bjs-gas/commit/f09bd9e79ea8aa84f04f4cee4f1a651b0fb5a37b))
* **api:** pool admission control and sequential status queries ([#24](https://github.com/andrewtryder/bjs-gas/issues/24)) ([cd4ee75](https://github.com/andrewtryder/bjs-gas/commit/cd4ee752d6c0c31ea3f52df5061c40fcae05af6c))
* **api:** retry closed connections on station-list reads ([24ea389](https://github.com/andrewtryder/bjs-gas/commit/24ea389686170205598668d3865107ace511382d))
* **ci:** ensure prisma client generation and effect resolution succeed in clean CI ([c0488ce](https://github.com/andrewtryder/bjs-gas/commit/c0488ce161391582ee7dee2ab2119d47de01ff06))
* **collector:** abort hung collections and prevent lock overlap ([becb6e6](https://github.com/andrewtryder/bjs-gas/commit/becb6e6d405a12b7959652438045750f7119f215))
* **collector:** enforce wall-clock deadline, fail-closed watchdog, and timezone safety ([#22](https://github.com/andrewtryder/bjs-gas/issues/22)) ([ed50f48](https://github.com/andrewtryder/bjs-gas/commit/ed50f480b3e01fb639a631da672a15212f36dc48))
* **deploy:** make Prisma Compute region deterministic ([5a66447](https://github.com/andrewtryder/bjs-gas/commit/5a66447d4e1fad6897aff1c6a629cf8df10447ed))
* **deploy:** pin Compute region and Prisma CLI ([4de190c](https://github.com/andrewtryder/bjs-gas/commit/4de190c0fdcb5ec93528d0dbc7092a4fb6f4315b))
* **deps:** pin patched audit transitive dependencies ([1d5ad7a](https://github.com/andrewtryder/bjs-gas/commit/1d5ad7a58d9b2103d8de8b0a374f61bd663c93cf))
* **deps:** remediate remaining open Dependabot vulnerabilities ([86f785f](https://github.com/andrewtryder/bjs-gas/commit/86f785f8daa5a40904545f76932611b57f8c275c))
* **deps:** remediate remaining open Dependabot vulnerabilities ([2dfe5da](https://github.com/andrewtryder/bjs-gas/commit/2dfe5da924d723288793f40d1e2f50c231b39acd))
* make deployment path type-safe, remove hardcoded engine path, and pin bun version ([#30](https://github.com/andrewtryder/bjs-gas/issues/30)) ([d25b071](https://github.com/andrewtryder/bjs-gas/commit/d25b071b76b3f468ec1b0b842ade86c443383f9b))
* map camera suppression on direct marker click; gas station alias canonicalization ([d4883a2](https://github.com/andrewtryder/bjs-gas/commit/d4883a25f6a9c299dd80c3b7a77e6fafd0422b2c))
* map camera suppression on direct marker click; gas station alias canonicalization ([d4883a2](https://github.com/andrewtryder/bjs-gas/commit/d4883a25f6a9c299dd80c3b7a77e6fafd0422b2c))
* map camera suppression on direct marker click; gas station alias canonicalization ([39b6503](https://github.com/andrewtryder/bjs-gas/commit/39b65036aafd6915de447cb69750c61561e0fd34))
* **map,web:** prevent ResizeObserver loops and filter benign notifications ([#65](https://github.com/andrewtryder/bjs-gas/issues/65)) ([ee6b046](https://github.com/andrewtryder/bjs-gas/commit/ee6b04621f7c1bbd915917edb7e6e37991a1b207))
* **map:** prevent map unmount and camera bounce on station selection ([#57](https://github.com/andrewtryder/bjs-gas/issues/57)) ([b399341](https://github.com/andrewtryder/bjs-gas/commit/b399341a5b47de40d43b483d90953a1aef395ca0))
* **map:** use ?key= parameter for authenticated CARTO basemap tiles ([5cfc59b](https://github.com/andrewtryder/bjs-gas/commit/5cfc59be0636f9541ba84546c69e89fbec427208))
* **map:** use ?key= query parameter for CARTO basemap tiles ([4a95626](https://github.com/andrewtryder/bjs-gas/commit/4a956267ab9b7a740e6171a4229c140386f26673))
* **ops:** adopt API freshWindowMinutes and schedule external health monitor ([#47](https://github.com/andrewtryder/bjs-gas/issues/47)) ([3793ae6](https://github.com/andrewtryder/bjs-gas/commit/3793ae6038ac106841f3dd90a5d55baadb154462))
* **ops:** retry transient health monitor failures ([07bee88](https://github.com/andrewtryder/bjs-gas/commit/07bee884d80014d0ac1d4c465addc7250e480fc0))
* **ops:** retry transient health monitor failures ([e62e527](https://github.com/andrewtryder/bjs-gas/commit/e62e52755013f71f981fc2421c9d4d3d8dcb07ba))
* **persist:** safe single retry for pre-callback transaction acquisition failure ([#27](https://github.com/andrewtryder/bjs-gas/issues/27)) ([b6136f4](https://github.com/andrewtryder/bjs-gas/commit/b6136f49b4a83d6a293c3b56ec5cd1596027099a))
* recover from transient station API failures on first page load ([4102479](https://github.com/andrewtryder/bjs-gas/commit/4102479f926ba184d140e4026a4d284ae19dbd62))
* **scheduler:** upgrade prisma composer to 0.18.0 for KeepAwakeGuard fix ([#23](https://github.com/andrewtryder/bjs-gas/issues/23)) ([bb1aa39](https://github.com/andrewtryder/bjs-gas/commit/bb1aa39cf59e988f123082a0bc3e91b6f3917c10))
* **status:** retry closed idle database connection ([9c23f87](https://github.com/andrewtryder/bjs-gas/commit/9c23f87ae939deeb373f65f2ab9e33f19936535c))
* **status:** retry closed idle database connection ([8d97cb3](https://github.com/andrewtryder/bjs-gas/commit/8d97cb3dba9f67efb7eb18b0b91f04372b4ea32f))
* **telemetry:** suppress Honeybadger error transmission during test execution ([acb60f9](https://github.com/andrewtryder/bjs-gas/commit/acb60f9cf75b3e8a43e8a89577593de2d749a16e))
* **web:** configure MapLibre GL v6 worker URL and public assets ([57074a7](https://github.com/andrewtryder/bjs-gas/commit/57074a7946a5c2b6222386fbe4be95673da616b6))
* **web:** configure MapLibre GL v6 worker URL and public assets ([bd208ce](https://github.com/andrewtryder/bjs-gas/commit/bd208ce15e4a4b1835da8fc8a2a9d88499f5aba0))
* **web:** disambiguate stations and repair map filters ([c8a466b](https://github.com/andrewtryder/bjs-gas/commit/c8a466bb59785971823fa4d0d46bec1b96bc3f52))
* **web:** disambiguate stations and repair map filters ([07e5caa](https://github.com/andrewtryder/bjs-gas/commit/07e5caa92cfc52cd044d2cbcb00b0f5bd8282c22))
* **web:** patch MapLibre security vulnerability ([eecfd61](https://github.com/andrewtryder/bjs-gas/commit/eecfd614e7e73278d148efeaf850f3d05190fb37))
* **web:** patch MapLibre security vulnerability ([c82e9f2](https://github.com/andrewtryder/bjs-gas/commit/c82e9f2ea20423c7cf29246b33b933742a455aaf))
* **web:** resolve map canvas collapse, mobile flex stretch, and worker resilience ([#54](https://github.com/andrewtryder/bjs-gas/issues/54)) ([a9ead68](https://github.com/andrewtryder/bjs-gas/commit/a9ead68d256e3a0ce81c3b701aa0072ac86540b7))
* **web:** retry transient station API failures once ([72993c0](https://github.com/andrewtryder/bjs-gas/commit/72993c039a7a9e5bfcbb9dea7c9737e64b406cf2))
* **web:** show unavailable state instead of misleading zero counts ([6478980](https://github.com/andrewtryder/bjs-gas/commit/6478980bd95ea23258e4987bee19487c9dd7218a))
* **web:** suppress hydration warning on dynamic station freshness ([#59](https://github.com/andrewtryder/bjs-gas/issues/59)) ([a56ba2f](https://github.com/andrewtryder/bjs-gas/commit/a56ba2f18f4b8ec96b6533af013c29510b4fb844))
* **web:** synchronize initialState and initialStationNumber props in MapDiscoveryView ([bb487ef](https://github.com/andrewtryder/bjs-gas/commit/bb487ef1fa81a87267df48c200e953e16cfb440e))
* **web:** use single font family string for Demotiles glyph resolution in map ([bdac8ed](https://github.com/andrewtryder/bjs-gas/commit/bdac8eddb5144a2cfd3f2f04cfac38322cd6e1cb))


### Miscellaneous Chores

* **ci:** upgrade GitHub actions and resolve high/critical audit advisories ([#52](https://github.com/andrewtryder/bjs-gas/issues/52)) ([7d3796f](https://github.com/andrewtryder/bjs-gas/commit/7d3796fe26ca54efb6b12cb8d31f2d0be922c230))
* **deps:** bump @honeybadger-io/nextjs from 5.11.4 to 6.0.9 ([#64](https://github.com/andrewtryder/bjs-gas/issues/64)) ([276eacd](https://github.com/andrewtryder/bjs-gas/commit/276eacd4cdac396dde6261fa608154e637669df8))
* **deps:** bump hono ([#58](https://github.com/andrewtryder/bjs-gas/issues/58)) ([ec0bc73](https://github.com/andrewtryder/bjs-gas/commit/ec0bc737fe0bad53ca8f879108d9c310d45d566a))
* **deps:** bump recharts from 2.15.4 to 3.10.1 ([#61](https://github.com/andrewtryder/bjs-gas/issues/61)) ([304250d](https://github.com/andrewtryder/bjs-gas/commit/304250d9bc1f83011e16960c1fa1ebb86ee4bfaf))
* **deps:** resolve high/critical audit advisories for next, undici, and fast-uri ([#25](https://github.com/andrewtryder/bjs-gas/issues/25)) ([bb7dc46](https://github.com/andrewtryder/bjs-gas/commit/bb7dc467851d603d4282724e6de7ddd38f39661f))
* **deps:** update minor and patch dependencies and fix maplibre-gl 6.19 worker test ([#70](https://github.com/andrewtryder/bjs-gas/issues/70)) ([e415a3c](https://github.com/andrewtryder/bjs-gas/commit/e415a3c7d28ad1863b698abb8e7aeb71a9410f68))
* **deps:** upgrade TypeScript to 7.0.2 ([#71](https://github.com/andrewtryder/bjs-gas/issues/71)) ([ce0d7bf](https://github.com/andrewtryder/bjs-gas/commit/ce0d7bf8dcc9287220be6d0e500871e2c72d91e7))
* disable scheduled production health monitor ([0c98f85](https://github.com/andrewtryder/bjs-gas/commit/0c98f85596f96920809a1586a7da7465bd7f9bbb))
* disable scheduled production health monitoring workflow ([04c41d0](https://github.com/andrewtryder/bjs-gas/commit/04c41d0121d31afa29d92963314e372652b888c2))
* migrate Prisma Composer to 0.39 ([#68](https://github.com/andrewtryder/bjs-gas/issues/68)) ([8058f1e](https://github.com/andrewtryder/bjs-gas/commit/8058f1ecb7e2b3ce6225e7f375e8d6496196350b))
* **repo:** add CI and Dependabot security automation ([c714d29](https://github.com/andrewtryder/bjs-gas/commit/c714d296476d595a20db964d3691505614523ff7))
* repository hygiene, cruft removal, and asset reorganization ([#28](https://github.com/andrewtryder/bjs-gas/issues/28)) ([d23dbf1](https://github.com/andrewtryder/bjs-gas/commit/d23dbf11c6051c757af7add45de5a7a84a44b702))
* upgrade to Node.js 26 LTS ([#67](https://github.com/andrewtryder/bjs-gas/issues/67)) ([75399b0](https://github.com/andrewtryder/bjs-gas/commit/75399b0e69dbd1bd9bfe2fc6cf48428102c507a4))
* **web:** finalize Ledger Slate cleanup and QA ([#20](https://github.com/andrewtryder/bjs-gas/issues/20)) ([e361720](https://github.com/andrewtryder/bjs-gas/commit/e361720812f14ef323e908ea77a68e42a9d527a0))
* **web:** harden production UX, observability, and accessibility (Phase 5) ([79b2192](https://github.com/andrewtryder/bjs-gas/commit/79b2192025454b8f8b3278d23e679f146be9d2eb))
* **web:** upgrade to Next.js 16 ([0bd472e](https://github.com/andrewtryder/bjs-gas/commit/0bd472e6b367b17a77205d12876116cbeb3afcd4))
* **web:** upgrade to Next.js 16 ([4772c44](https://github.com/andrewtryder/bjs-gas/commit/4772c447a6295da51cd615009d936488bc0aec05))


### Documentation

* archive 2026-10-02 incident resolution and add external health monitoring probe ([5a07dfe](https://github.com/andrewtryder/bjs-gas/commit/5a07dfe677a94eb07dd1bff2b412f4af7ddf7bf9))
* **design:** define Ledger Slate system and implementation plan ([4193c41](https://github.com/andrewtryder/bjs-gas/commit/4193c416e94a7f6bcf81218d12ad464a741f88ff))
* **design:** define Ledger Slate system and implementation plan ([10a0859](https://github.com/andrewtryder/bjs-gas/commit/10a08597d3cd2bb2d96f0c1c2257f3fc42cee3b0))
* **workflow:** update release discipline for branch-based deployments in AGENTS.md ([bba55a8](https://github.com/andrewtryder/bjs-gas/commit/bba55a8c9a1bcccd8688506cfe6f8bbfa361944f))


### Continuous Integration

* add pnpm audit --audit-level=high check to CI pipeline ([1d81348](https://github.com/andrewtryder/bjs-gas/commit/1d813485856ee4192f1777cdb2bd86ce757c35d4))
* add pnpm audit --audit-level=high check to CI pipeline ([0487752](https://github.com/andrewtryder/bjs-gas/commit/0487752ae19e23897fe5fda071283c8243b754ce))
* add postgres service container and run integration tests on every PR ([#26](https://github.com/andrewtryder/bjs-gas/issues/26)) ([93e2d68](https://github.com/andrewtryder/bjs-gas/commit/93e2d68c8f363e6fd28a8826adcb635f8c919cca))
* modernize GitHub Actions workflows, Release Please, and regression tests ([#75](https://github.com/andrewtryder/bjs-gas/issues/75)) ([f3927f9](https://github.com/andrewtryder/bjs-gas/commit/f3927f93772e69473945b9268d4f6ed18c107687))
