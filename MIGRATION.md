# Migration baseline

Inspected on October 16, 2026. Source: AsePlayer/Back-FIxer-Upper, default branch `main`, HEAD `ffcfdddc4c1107ea269d9a8696b77976ca14f2d4`. The supplied new workspace is **Health Stretch App** (package name Back-Fixer-Upper-Web). Its initial commit is `83eee8aef0e0fc145d6d05f28d66a1267df77775`; it has no remote configured. The original checkout and remote are never modified.

Read README/package.json; StretchFinder, History, Library; PersonDiagram, VideoCard, LibraryControls, ui/navigation; domain history/library/videos/types; storage repository/provider/export; content model/catalog/classification/import merge/generated snapshot; creator/override configuration; youtube-sync scanner/provider/cache/normalizer/generator/validator/CLI/worker/automation; related tests; CB03/CB04 and CONTENT_SOURCES.

`App.tsx` renders only `StretchFinder`. Its internal Find/History/Library tabs are reachable. Older screen files and React Navigation route declarations are obsolete. No intake, routine, session or diagnostic flow is migrated.

| Existing component | Decision |
| --- | --- |
| Generated YouTube catalog | Seed immediately; preserve every record and its full source/classification evidence |
| TypeScript classifier/model | Reuse unchanged, classifier version 1 |
| Scanner/provider/cache | Reuse; sanitize durable cache, bound execution, strengthen reconciliation guards |
| Windows worker/task | Replace with bounded CLI and GitHub Actions |
| SVG body geometry | Adapt to DOM/SVG with equivalent named buttons |
| Filtering/history semantics | Port to small browser ES modules |
| SQLite schema/export | Replace runtime with IndexedDB; import actual schema-4 export and aliases |
| Expo/native UI/navigation/sharing | Replace with semantic HTML/CSS, hash navigation and file downloads |
| Obsolete screens | Preserve legacy information in imports/exports without rebuilding the screens |

Search in the active source indexes titles, creator, external ID, region labels, subject/topic labels and tags. It does **not** index descriptions. The new index retains these exact searchable fields; full descriptions remain in details. The 23 catalog IDs use `upper_back`, `mid_back`, `lower_back`, `hips`; legacy UI aliases `upper`, `middle`, `lower`, `hip` are accepted on import.

Baseline counts, parity hashes and cache provenance are generated into `content/baseline.json`. Imported original extractor cache is preferred when available; reconstructed snapshot fields are explicitly marked normalized seeds otherwise. Neither path fetches YouTube. The old PC task is outside this project and is untouched.

Actual snapshot baseline: **1,308 IDs, 699 videos, 609 Shorts, 0 streams, 23 regions and 178 unclassified entries**. This supersedes the stale 1,306/698/608 README numbers in the assignment. Initial offline regeneration matched the source's complete parsed catalog and content revision `0df004283427f6468e446b2d1db59080ec14efb031511a33c2200248f1973607` exactly. A subsequent **real local full discovery** on October 16 succeeded with the same counts and updated discovery ordering/evidence; the current revision is `4fff90505e3be231904328d141b45c8a050ebd9e866c1da2c5d24005ae579358`. All 1,308 baseline IDs remain; no per-video metadata request was needed. Hosted Actions execution is still separate and unverified.

The original optional About warning signs and personal scoliosis-guidance boundary are retained. Their existing [NHS](https://www.nhs.uk/conditions/back-pain/) and [AANS](https://www.aans.org/patients/conditions-treatments/cauda-equina-syndrome/) sources were checked during conversion. There is no intake or automatic diagnostic routing.

Personal storage is `org.back-fixer-upper.web.v1`, IndexedDB version 1. Separate stores hold open events, bookmarks, ratings (including clear tombstones), explicit-use events/baselines, custom links, display snapshots, settings, preserved legacy data and import receipts. Catalog revisions and active revision metadata use separate stores. Catalog activation never writes personal stores. Export format is `back-fixer-upper-web`, schema 1.

Legacy importer uses actual top-level schema-4 fields, including raw `videoOpenEvents`, `personalVideoRatings`, `videoAliases` and `savedStretchAliases`. Canonical video keys are `youtube:<11-character-ID>`. Active savedStretches counts already consolidate duplicate aliases: alias counts are retained in the preserved section rather than added twice. Stable original event IDs and per-record use baselines make repeated/updated imports safe. The complete original export is retained once per content hash in `preserved`, including unmapped notes, sessions, flags, profile and unknown fields. Personal exports never enter this repository or CI.

Old Expo SQLite cannot be read automatically by this website. Export from the old app and import through About & data. Browser/device/origin storage is separate; there is no cross-device sync. Explicit Did this events are independent of bookmarks in the new app, allowing retained counts without forcing a save.
