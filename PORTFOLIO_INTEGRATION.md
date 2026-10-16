# Portfolio integration

Inspected `AsePlayer/Portfolio-2.0` default-branch snapshot **`f8b7c4eeb294baebfe75a8805e79109df8212d67`**. Its current `CNAME` is **ryanscott.org**. The existing `.github/workflows/pages.yml` builds and deploys the entire portfolio from `main`. Node `scripts/build.mjs` renders `data/site.json` and `templates/index.html` into the generated root `index.html` and public `dist/`. Styles live in `css/styles.css`; the existing reusable classes include `section`, `container`, `section-intro` and `btn`. The content schema deliberately requires exactly three capability areas, so adding a new category to its JSON is inappropriate for this small integration.

The portfolio has **not** been edited or redeployed. Its domain and existing Pages workflow are untouched. This app’s deployment URL is **not yet verified** because the new workspace has no remote/Pages activation. `__APP_DEPLOYMENT_URL__` is an explicit placeholder, not a live URL.

Default integration: deploy this new repository as its own Pages project. After **Deploy committed site** succeeds, copy the literal `page_url` output, open it and verify `build-commit.json` and the app. Use that URL in [docs/portfolio-embed.html](docs/portfolio-embed.html). Its visible **Open full screen** link is the minimal launch integration; the accessible titled responsive iframe is optional. Current styling is inherited from the portfolio’s existing classes; the iframe is full-width with a useful 900 px/75 vh mobile height.

To apply, replace **both** placeholder occurrences with the verified HTTPS app URL, then paste the snippet into the portfolio’s **`templates/index.html` immediately after `{{content}}` inside `<main>`**. For link-only integration, omit the iframe and its storage paragraph. Do not hand-edit generated `index.html` and do not replace `CNAME` or its workflow. In the portfolio checkout run its documented checks:

```sh
node --test scripts/site.test.mjs
node scripts/build.mjs
node scripts/validate-site.mjs
```

Review the added section at desktop/mobile widths, commit the changed template and generated root HTML in **Portfolio-2.0**, and let its existing deployment publish the complete portfolio. If its fixed-section checks need adjustment, update only the expected added section and keep the three capability categories intact. This task supplies the ready-to-apply snippet; no cross-repository write is attempted.

The portfolio iframe always loads the current independently deployed app, so there is no daily copying or second content writer. Browser data belongs to the app’s actual origin, not the enclosing portfolio. Third-party iframe privacy/partitioning rules can limit persistence; full-screen use is the reliable fallback. Database names are namespaced even when projects share an origin. No frame-denying or cross-origin-isolation policy is added by this app. Its worker registers relative to its own folder and cannot control the portfolio outside that folder; nested-path scope was checked locally.

Optional later alternative: copy this static `dist/` into the portfolio build at `/back-fixer-upper/`, then deploy the **whole portfolio together**. Relative URLs/hash navigation support that location, and the worker remains scoped there. Do not select this alternative alongside the independent deployment by accident: keeping copied content current would require an explicitly authenticated cross-repository update mechanism. The new repository’s `GITHUB_TOKEN` cannot be assumed to write Portfolio-2.0. No competing second production pipeline is implemented in this milestone.
