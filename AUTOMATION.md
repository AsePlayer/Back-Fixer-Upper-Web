# Unattended updates and deployment

The pipeline is implemented in this repository. Activation is a separate step: this workspace currently has no remote, and no hosted Actions run or Pages deployment has been performed. The original PC’s scheduled task is not used or changed.

A real local full run succeeded on October 16, 2026: 699 Videos entries, 609 Shorts entries, Streams tab absent, 1,308 retained IDs and zero needed per-video metadata fetches. It persisted the new project's full-reconciliation checkpoint and validated catalog revision `4fff90505e3be231904328d141b45c8a050ebd9e866c1da2c5d24005ae579358`. This is evidence for local extraction/publication, not GitHub-hosted ingestion or Pages activation.

## Initial GitHub setup

**For the chosen portfolio URL `/projects/stretch-finder/`:** follow steps 1–3 below for the separate public app source repository, set its Actions repository variable `HOSTING_TARGET` to `portfolio`, and run the content dry-run/update from step 6. Skip the app's standalone Pages setup in steps 4–5. In Portfolio-2.0, set `STRETCH_FINDER_REPOSITORY` to the exact app `owner/repository` and deploy the portfolio. Its prepared workflow builds the latest committed app into the complete portfolio on pushes, manual dispatch and daily 17:17 UTC. See [PORTFOLIO_INTEGRATION.md](PORTFOLIO_INTEGRATION.md). This setup is prepared locally but has not been activated on GitHub.

1. Create/select a **new, isolated repository** for this workspace (suggested name `Back-Fixer-Upper-Web` if naming is still needed). Do not target `AsePlayer/Back-FIxer-Upper` or `Portfolio-2.0`. This environment has no repository-creation/Pages-administration tool and no destination configured. Keep the selected visibility unchanged; private-repository Pages availability depends on the existing account plan. No visibility change or plan purchase is part of this task.
2. Connect this workspace’s `origin` to that new repository and push the committed `main` branch. Inspect `git remote -v` first. Both automatic writer guards and documentation reject either protected original destination. `main` is the expected default; if a different default is selected, adjust the push branch filters in verify/deploy workflows as well.
3. Enable Actions for the repository and allow the SHA-pinned official actions used here. Allow `GITHUB_TOKEN` content writes for the writer job, subject to organization policy and branch protection. No broad personal access token is required.
4. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**. The `github-pages` environment must permit the default branch. Required environment approvals pause deployment; resolve any protection setup deliberately if unattended publication is desired. This project does not disable protections.
5. For standalone hosting, run **Deploy committed site** once. Inspect its literal `page_url` output and `build-commit.json` at that URL. Deployment is verified only after that succeeds. The chosen portfolio integration instead uses `/projects/stretch-finder/` after the complete portfolio has deployed.
6. Dispatch **Update YouTube catalog** with `mode: auto`, `creator: dr-rowe`, `dry_run: true`. A successful hosted extraction is not presumed. Inspect the summary; then run without dry-run to permit valid bot commits and deployment. The schedule becomes useful only with these files on the default branch and the required permissions/settings enabled.

## Run policy

The daily cron is **`17 16 * * *` UTC**: 9:17 a.m. Pacific during daylight time; 8:17 a.m. during standard time. GitHub can delay or drop scheduled work under load, and public-repository schedules can be disabled after 60 days without repository activity. Scheduled workflows use the default branch. Hosted runner/account/minutes and storage limits also apply; wall-clock execution is not guaranteed. Dispatch manually to recover or re-enable an inactive schedule. See GitHub’s [scheduled events documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

`workflow_dispatch` accepts only the enumerated mode (`auto`, `incremental`, `full`), a configured creator ID or `all`, and a boolean dry-run. Creator IDs are validated against enabled configuration and passed as process arguments, never interpolated into shell commands. Dry-run copies the committed cache into ignored scratch space, runs the same pipeline, and performs no push, deployment or tracked change.

`content/update-policy.json` centralizes one metadata worker, 5,000 ms between metadata requests, a 100-enrichment cap, per-surface high-water plus 20 distinct known-ID streaks, five recent items per surface eligible after 24 hours, 30-day old-metadata eligibility, seven days between successful full reconciliations, 180-second discovery/60-second metadata process timeouts and a 20-minute shared run budget. The writer job has a finite 30-minute timeout. It checkpoints and exits instead of sleeping for hours. Auto mode forces full discovery until this store has its own reliable complete reconciliation, then at least weekly. Manual incremental mode still performs full discovery when no complete inventory exists.

Videos, Shorts and Streams are independent surfaces. Shorts classification comes from discovery, not duration. Repeated IDs do not advance the known-ID streak; new IDs reset it; a missing high-water requires reading the remaining surface. New/missing/failed metadata has priority, recent eligible items are refreshed, and older eligible records rotate oldest enrichment first within the same cap. Optional stale work left over does not make a reliable discovery incomplete; required missing/failed work does. Only complete successful full runs infer absence. A suspicious empty/truncated surface, timeout, malformed response or throttle prevents that inference. A default 80% distinct-inventory guard catches dramatic unexplained truncation; investigate before deliberately adjusting it. Missing records remain in the catalog.

The reused extractor runs `--ignore-config --simulate --skip-download` and explicit no-write options. It downloads only public metadata. No media files, caption/comment collection, thumbnail-file downloads, cookies or access-control workarounds are used. HTTP 429, bot challenges and provider blocking open the circuit and make the run fail honestly. Good metadata survives null/missing refresh fields.

## Publication and Git behavior

One `content-writer` concurrency group, with `cancel-in-progress: false`, serializes content jobs. Valid per-item progress is committed even after a partial scan when the source audit, regression checks and existing build pass. Partial/failed discovery does **not** publish a new public catalog, advance success markers, infer deletion or deploy. The Actions job ends red, and the working site stays live. Attempt status is separate from content hashes; failed status committed with checkpoints becomes visible on a later successful/manual deployment. Actions is the immediate failure record.

On success, the runner generates a candidate in `.tmp/`, validates identity, ownership, counts, taxonomy, source/provenance URLs, chunk integrity and content-derived revision, then publishes the validated revision. Manifest replacement is last. Identical content produces identical bytes and no catalog rewrite. Source attempt/status timestamps can still produce a clearly labeled checkpoint-only commit. Current and one previous public revision are retained for clients crossing a deployment.

The writer audits sanitized source files, runs `npm run verify`, stages only an explicit allowlist of channel/video JSON, sync checkpoints, full catalog and runtime data/status files, and commits changed files with record counts. It never runs `git add .`, stages personal data or force-pushes. Normal push rejection stops visibly rather than overwriting a newer branch. The action uploads a seven-day `content-writer-recovery` **sanitized patch** artifact if a new bot commit was rejected. Artifacts are a recovery convenience, not the authoritative cache.

With standalone hosting (the default when `HOSTING_TARGET` is unset), the same update workflow explicitly calls `pages.yml` with `needs.writer.outputs.commit`. Its build job checks out that exact full SHA and verifies `HEAD`, runs tests/build and uploads `dist/`; the deployment job publishes that artifact. `dist/build-commit.json` records its source. This does not depend on a token-generated push starting a second workflow: [GitHub documents that limitation](https://docs.github.com/en/actions/concepts/security/github_token). Manual **Deploy committed site** accepts an exact committed SHA and never scans YouTube, so it can recover after a post-commit deployment failure. With `HOSTING_TARGET=portfolio`, both standalone deploy entry points are skipped; the source writer stays active and Portfolio-2.0 owns publication as described above.

Permissions are scoped by job: verification/build uses `contents: read`; only the writer has `contents: write`; only deployment has Pages/OIDC writes. Calling workflows grant only the ceiling needed by the reusable workflow; its build job remains read-only. There is no `pull_request_target`, exposure of secrets to untrusted PR code or cross-repository token assumption. Official action tags were resolved to immutable commit SHAs during implementation. Node 24 LTS was checked against [Node’s official release schedule](https://nodejs.org/en/about/previous-releases), and yt-dlp is pinned to **2026.06.09** (pip spelling `2026.6.9`). The current [GitHub custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) was reviewed for artifact, permission and environment requirements.

## Recovery and protected branches

For a blocked provider, keep the current site, wait until a later run, or run locally against the same committed durable store:

```sh
npm ci
python -m pip install yt-dlp==2026.6.9
npm run content:update -- --creator dr-rowe --mode auto --dry-run
npm run content:update -- --creator dr-rowe --mode auto
npm run verify
```

Local commands never push automatically. Check `git diff`, commit only the documented public source/generated paths and push normally to the **new** repository. Partial runs exit 2; early setup failures exit 1. Successful checks exit 0. Checkpoint successes persist for the next bounded attempt; no account credentials are harvested to resolve hosted blocking.

If direct bot commits are forbidden, retain the protection. Download the recovery patch from the failed run, fetch current `main`, create a new review branch, and apply the patch with `git am <path-to-content-writer.patch>`. If it conflicts, stop/abort the patch and regenerate against the newer committed cache; do not force it over human changes. Run verification, push that branch and open a normal PR (GitHub UI or authenticated `gh pr create` with a reviewed body file). This is the remaining human review/setup path; automatic PR creation is not granted broader permissions by default. After merge, the ordinary push deploy runs. The artifact’s commit includes only allowlisted public content/checkpoints.

To disable scheduling, disable **Update YouTube catalog** in Actions, or remove/comment its `schedule` trigger in the new repository. Manual deployment and ordinary static builds remain independent. Never disable/replace the portfolio’s existing deployment to host this app.
