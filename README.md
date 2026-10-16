# Back-Fixer-Upper Web

A standalone, responsive stretch-video finder built with HTML, CSS and browser JavaScript. Pick a body area, open the original YouTube video, revisit History, and optionally save or rate it later. The migrated catalog contains **1,308 Dr. Rowe entries: 699 videos and 609 Shorts**, with all 23 body areas and 178 unclassified entries available. These are the inspected snapshot counts; later source updates can increase them.

**Where to edit:** change this app in **Health Stretch App**. Change its portfolio card in **Portfolio 2.0 → `data/site.json` → `projects`**. Run `npm run portfolio:sync` here to build and refresh the generated app in `Portfolio 2.0/projects/stretch-finder/`. The portfolio serves it at `/projects/stretch-finder/`. [PORTFOLIO_INTEGRATION.md](PORTFOLIO_INTEGRATION.md) explains local preview, publishing and automatic updates.

Use Node **24 LTS**. The same major is pinned in `.nvmrc`, `.node-version`, package engines and CI. Install and run:

```sh
npm ci
npm run dev
```

On Windows PowerShell use `npm.cmd` if script execution policy blocks `npm`. Open the address Vite prints. For the production build:

```sh
npm run verify
npm run preview
```

`dist/` is the static website. It works at a repository subpath or nested folder; hash links such as `#find?area=neck`, `#history` and `#library` need no server rewrites. Serve it over HTTPS (or localhost for development). Dev mode does not install the production service worker. No Expo, React, native libraries, server, login, paid database, extraction key, embedded players or isolation headers are involved.

Find opens by default. The source SVG geometry and named keyboard buttons select the same body-area results. Search titles, region/subject/topic labels, tags, creator or a YouTube link. Find’s advanced filters start collapsed; Library exposes complete browsing, format/subject/topic/duration filters and newest/shortest/title/use-count ordering. Creator controls appear only when more than one creator is enabled. “Other videos” includes unclassified and personal links. Cards show known source values, expandable full descriptions and evidence, and two ordinary safe YouTube links. An open is one visit; it is not watching, completion or benefit.

History has Frequent (two or more opens), Recent, Saved and Rated. Save is explicit, and optional Helpful / Neutral / Made it worse notes can be edited or cleared in History. A worse note remains visible throughout the app. Did this and Undo live under Source & details and do not force a bookmark. Adding a personal YouTube URL and optional title requires no metadata request. A later public record with the same video ID joins the existing personal records.

Personal records stay in this browser’s namespaced IndexedDB, separately from catalog revisions. About & data provides JSON export/import and confirmed deletion with an export option. It imports the actual original app’s schema-4 export, preserves alias identities, saved/open/use/rating data and keeps the complete legacy export (including unmapped notes/history) in a preserved section. Reimporting does not duplicate events or multiply counts. **Old Expo SQLite is not automatically readable**: export from the old app and import here. Browser/device/origin data stays separate; no cross-device synchronization is promised. Browser privacy rules can affect embedded persistence; full-screen use is the reliable fallback. Temporary mode visibly explains failed/unavailable storage and allows export before closing the tab.

After an initial successful download, IndexedDB caches the catalog and a subdirectory-scoped service worker caches the shell and validated resources for offline reopening in supported browsers. YouTube playback requires internet, and thumbnails are not promised offline. Catalog updates validate before replacing a usable revision and do not reset personal data or filters. Details load only when expanded; after the compact index renders, background warming downloads the remaining chunks for offline access.

Public source metadata lives durably in `content/source/youtube/`; personal data must never be put there, committed, logged or uploaded to CI. A clean clone plus `npm ci` builds the last known catalog without contacting YouTube. The reused TypeScript ingestion/classifier runs only under Node with tsx. Vite only serves development and produces `dist/`.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev`, `build`, `preview` | Develop, make static output, preview output |
| `npm run portfolio:sync` | Build and refresh the generated app in the sibling Portfolio 2.0 checkout |
| `npm run verify` | Focused regression tests, catalog integrity, build and artifact checks |
| `npm run check:browser` | Desktop and Chromium 360 px viewport, subpath, storage and offline acceptance |
| `npm run content:sync -- --creator dr-rowe --mode incremental` | Bounded source/checkpoint update only |
| `npm run content:classify` | Offline classification and public generation |
| `npm run content:validate` | Validate source catalog and runtime manifest/index/chunks |
| `npm run content:update -- --mode auto --creator all` | Sync, stage, validate and publish successful content locally |
| `npm run content:update -- --mode full --creator dr-rowe --dry-run` | Same pipeline against an isolated scratch cache; no tracked changes or push |

Source commands need the separately installed pinned yt-dlp `2026.06.09`; the website/build does not. `YT_DLP_PATH` can select its executable. Local commands never commit or push automatically. Actions handles the allowlisted bot commit and explicitly deploys its resulting SHA in the same workflow. The daily schedule is `17 16 * * *` UTC: 9:17 a.m. Pacific during daylight time and 8:17 a.m. during standard time. Auto mode chooses full discovery when the last successful full reconciliation is at least a week old. Limits are in `content/update-policy.json`.

See [AUTOMATION.md](AUTOMATION.md) for setup, bounded retries, protected-branch recovery, manual retry and disabling the schedule; [content/README.md](content/README.md) for cache/classification details; [MIGRATION.md](MIGRATION.md) for source SHA, reuse decisions and storage contract; [PORTFOLIO_INTEGRATION.md](PORTFOLIO_INTEGRATION.md) for the inspected portfolio and ready-to-apply integration; and [VERIFICATION.md](VERIFICATION.md) for exact execution evidence and remaining activation steps.

This is an educational subject browser. Creator claims are source text, not app promises or personalized advice. The original Expo project is untouched. The separate Portfolio 2.0 checkout has the Projects integration described above. This workspace has no remote configured, so scheduling and publishing still require GitHub setup; YAML alone does not activate hosting.
