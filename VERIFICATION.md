# CB-WEB01 verification

Implemented in the supplied new **Health Stretch App** workspace, package `back-fixer-upper-web`. The original Expo application remains untouched. The separate **Portfolio 2.0** checkout now includes the requested Projects integration; no push or live deployment was performed. No original repository is configured as this app's push destination.

## Snapshot and data

- Original default branch: `main`, SHA **`ffcfdddc4c1107ea269d9a8696b77976ca14f2d4`**.
- Inspected baseline: **1,308 entries = 699 videos + 609 Shorts**, 0 streams, all 23 regions, 178 unclassified. The assignment's 1,306/698/608 figures were stale; no entries were dropped to force those counts.
- Initial full parsed catalog, every ID, descriptions, creator records, classifications, manual corrections, discovery/format evidence and unavailable state matched the source snapshot. Offline generation preserved revision `0df004283427f6468e446b2d1db59080ec14efb031511a33c2200248f1973607`. Source byte hash/counts/IDs are recorded in `content/baseline.json`.
- Durable bootstrap: **1,308 sanitized extractor records**, zero reconstructed records. Initial per-video cache size: 5,639,043 bytes; source snapshot in the Windows checkout: 8,779,162 bytes. Raw fields were allowlisted and source records retained sufficient metadata for offline reclassification. The alternative normalized snapshot bootstrap is implemented and marked distinctly.
- Real full local reconciliation succeeded on October 16, 2026 at **21:04 UTC** (2:04 p.m. Pacific daylight time). Videos 699, Shorts 609, Streams absent; no per-video metadata enrichments needed. It changed 1,267 cached discovery/source records (primarily refreshed ordering/evidence), retained all 1,308 IDs and published validated local revision **`4fff90505e3be231904328d141b45c8a050ebd9e866c1da2c5d24005ae579358`**. Durable cache/state size reported by the runner: **5,640,355 bytes**. This was followed by a byte-identical offline no-op regeneration.

## Storage and interface

Browser storage is **`org.back-fixer-upper.web.v1`**, IndexedDB schema 1. Separate stores hold opens, bookmarks, ratings/clear tombstones, explicit uses, custom links, display snapshots, settings, preserved legacy sections and import receipts. Catalog revision activation uses separate `catalogs`/`meta` transactions and never writes personal stores. Mutations read their affected stores inside the write transaction, preserving concurrent-tab events. Web export format is `back-fixer-upper-web`, schema 1.

The actual original schema-4 exporter was inspected, including top-level collections, raw event/rating identities, `videoAliases` and `savedStretchAliases`. Synthetic tests verify repeat imports, consolidated alias counts, timestamps, saved-off records, custom links, ratings and full preserved legacy payloads. Invalid input rolls back. There is no attempt to read Expo SQLite automatically, share records between devices, or send personal records to GitHub/CI. All browser exports/test records under ignored `artifacts/` are synthetic.

Find/History/Library are semantic DOM views with hash navigation. The original SVG geometry is adapted; all 23 named buttons remain keyboard accessible. Search semantics match the reachable source UI (description search was not supported there). Cards render in batches of 12, with lazy thumbnails and expandable full source details. The compact index is about 1.34 MB, downloaded separately; initial browser JavaScript is about **46 KB uncompressed / 17 KB gzip**, with no bundled full audit catalog or Node/native ingestion code. Full validated detail chunks warm in the background after initial rendering for offline use.

## Checks executed

- Portfolio follow-up: the actual **Portfolio 2.0** checkout passes its **20 existing tests**, build and artifact validation with the full app included under `/projects/stretch-finder/`. The compact card, keyboard activation, full-app loading, Portfolio return link, no-JavaScript card, trailing-slash redirect, no overflow at 360/768/960/1280 px, offline app reopen and service-worker scope were verified using installed Chrome against the prepared integration. No runtime page errors. Both pages in the actual checkout return HTTP 200 on the running local preview. The sync helper also refused an unowned directory and preserved its contents. Evidence is in ignored `artifacts/portfolio-integration-acceptance.json` and portfolio screenshots. These checks do not claim a hosted workflow or public deployment.

- Clean local clone of implementation commit `8352780`: `npm ci --offline --no-audit --no-fund`, followed by the complete verification/browser/cache audit, passed with `YT_DLP_PATH` deliberately unavailable and without `.migration/` or the old PC's ignored cache. Its Git working tree remained clean. A subsequent skip-link accessibility fix was built and passed browser acceptance, including Enter-to-main focus while keeping the History route.
- `npm run verify`: **25 focused tests**, catalog/chunk validation, production build and public-artifact checks. Covers baseline ID/metadata parity, region/unclassified access, history independence and thresholds, reload/cross-tab persistence, repeat-safe legacy import/rollback, pinned/duplicate/removed high-water cases, interrupted enrichment, empty/truncated/throttled/full failure guards, rotating stale metadata, null preservation, offline determinism/source immutability, candidate rejection, no-op output and allowlisted Git writer behavior.
- A local bare Git fixture verifies the bot writes/pushes its resulting commit normally, excludes unrelated files, produces no extra no-op commit and stops visibly with a recovery patch when a human advances the remote. This is an actual **local Git fixture**, not a GitHub push.
- `npm run check:browser`: installed Chrome, **1280 × 900 desktop and 360 × 800 mobile viewport**, served at `/nested/back-fixer-upper/`. Passed navigation, named areas/front-back, source details/use/undo, one open through each of the two actions, threshold-two Frequent, saved/use/rating independence, edit/clear/reload, safe custom title/URL, Library intersections, invalid import rollback, JSON export, direct hash navigation, no horizontal overflow and keyboard focus.
- The same pass verified **offline document reopening**, cached catalog access, service-worker shell update/cleanup, worker scope excluding the outside portfolio fixture, invalid-revision fallback, valid simulated catalog replacement preserving personal data, and usable visible storage-failure mode. No runtime page errors were reported. A Chromium viewport is **not an iPhone/Safari test**.
- `npx tsx scripts/audit-cache.ts`: sanitized durable cache audit passes; no binary media or personal data is published.
- All four workflow YAML files parsed locally without syntax or duplicate-key errors. This is separate from execution on GitHub.
- `npm run content:classify` and a hash comparison: identical inputs leave **every public catalog, status and revision file byte-identical**; source files stay untouched.
- Real `npm run content:update -- --mode full --creator dr-rowe`: success using installed yt-dlp **2026.06.09**. An earlier isolated two-minute-budget real dry-run also succeeded without modifying production data. Both reused all cached detailed metadata; real **fresh per-video metadata extraction was not exercised**, while its failure/merge behavior was tested with provider fixtures.

Browser handoffs were intercepted after verifying exact canonical YouTube URLs. Playback and clinical suitability were not tested. Desktop/mobile screenshots and structured evidence are in ignored `artifacts/`; only this deidentified report is tracked.

## Implementation and activation states

| State | Result |
| --- | --- |
| Standalone website, storage, import/export, durable ingestion, scheduled writer/deploy workflows | Implemented |
| Local pipeline configuration, creator, cache, policy and pinned tools | Configured |
| Local real YouTube full discovery, validation and public catalog generation | Successfully run |
| Real new/failed-video metadata enrichment | Not needed in live runs; simulated fixtures tested |
| Local repository commit | Recorded with the delivery; see `git log` |
| GitHub destination/push | No remote configured; not pushed |
| Hosted GitHub Actions execution | Not run; cannot claim hosted YouTube extraction succeeds |
| Pages environment/account activation | Portfolio Pages is the selected host; separate app Pages is skipped with `HOSTING_TARGET=portfolio` |
| Deployment/live URL | Not deployed; no verified URL |
| Portfolio | Compact Projects card and generated app applied in local Portfolio 2.0 checkout; checks passed; uncommitted/unpushed |
| Physical iPhone/Safari | Not tested |

The remaining GitHub steps are in [AUTOMATION.md](AUTOMATION.md) and [PORTFOLIO_INTEGRATION.md](PORTFOLIO_INTEGRATION.md): connect and push the separate public app repository, enable its content writer, set its `HOSTING_TARGET=portfolio`, set `STRETCH_FINDER_REPOSITORY` in Portfolio-2.0, then commit/push and deploy the complete portfolio. The selected public path is `https://ryanscott.org/projects/stretch-finder/`; it has not been verified live. Standalone hosting remains available as an alternative. No visibility, account settings or plan changes were made by the local integration.

## Changed/new files

The new runtime is organized under `src/ui`, `src/views`, `src/domain`, `src/storage`, `src/catalog`, `src/styles`, plus `index.html` and a small favicon. Reused TypeScript model/classification lives under `src/content`; scanner/cache/provider/normalization/validation lives under `tools/youtube-sync`. New `tools/catalog` splits and validates public data. `content/` contains creator/override/policy/baseline configuration, the full audit catalog and 1,308 durable per-video records plus channel/checkpoint files. `public/data` contains manifests, compact indexes, 64-record details and status for the current and previous revision. `scripts/` contains bounded orchestration, build/worker generation, artifact checks, browser acceptance and allowlisted commit/deploy helpers. Four workflows provide verification, update, manual deploy and reusable Pages build/deploy. Focused tests are under `tests/`.

Setup and operational documentation: README, MIGRATION, AUTOMATION, PORTFOLIO_INTEGRATION, this report, content README, creator guidance, retained original CONTENT_SOURCES and the portfolio snippet. Native runtime dependencies, SQLite/WASM, app-store work, server infrastructure, analytics and speculative recommendation features are absent.
