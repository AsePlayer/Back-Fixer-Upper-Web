# Portfolio integration

The chosen public URL is **https://ryanscott.org/projects/stretch-finder/**. The portfolio shows a compact **Projects → Back-Fixer-Upper** launch card. Clicking it opens the full app on the same site; the app's **← Portfolio** link returns to the Projects section.

## Where to edit

| Change | Source project and file |
| --- | --- |
| Portfolio copy, project title, description, technologies or link | `D:\Coding\Github\Portfolio 2.0\data\site.json` → `projects` |
| Project card appearance | `D:\Coding\Github\Portfolio 2.0\css\styles.css` → `.project-*` |
| Stretch app screens, styling, body diagram, history and storage | **This project** → `src/` |
| Creator settings and catalog tooling | **This project** → `content/`, `tools/`, `scripts/` |
| Generated app that the portfolio publishes | `Portfolio 2.0/projects/stretch-finder/` — regenerate it from here |

Keep working on the app here. The portfolio receives only generated static HTML/CSS/JS/JSON; it does not receive a second editable copy of the app source or ingestion tooling.

## Refresh and preview

From **Health Stretch App**:

```sh
npm run portfolio:sync
```

This builds and refreshes only the owned `projects/stretch-finder/` directory in the sibling **Portfolio 2.0** checkout. For another location: `npm run portfolio:sync -- --portfolio "path/to/Portfolio 2.0"`. Windows PowerShell can use `npm.cmd`.

From **Portfolio 2.0**:

```sh
node --test scripts/site.test.mjs
node scripts/build.mjs
node scripts/validate-site.mjs
node scripts/serve.mjs
```

Open **http://127.0.0.1:8000/#projects**, then click the project card. The whole app is served from **http://127.0.0.1:8000/projects/stretch-finder/**. Both pages use one local server. The separate `npm run dev` command in this app remains useful for app development.

The helper stages new files before replacing the prior generated app and refuses a directory without its ownership marker. It adds the portfolio return link and recomputes the service-worker shell version. Existing body-area hash links, relative assets, IndexedDB storage and scoped offline shell work at the nested path. The worker stays inside `/projects/stretch-finder/`; it cannot control the portfolio home page. Personal data on localhost and ryanscott.org remains separate; export/import can move it.

## Publish and keep updates flowing

Review and commit the portfolio changes, generated root `index.html`, and `projects/stretch-finder/` snapshot in **Portfolio-2.0**. Its existing Pages workflow publishes the entire portfolio and preserves `CNAME` (`ryanscott.org`). There is one deployment for this domain.

For unattended catalog publication, first put this app in its own **public** GitHub repository and enable its existing content-update workflow as described in [AUTOMATION.md](AUTOMATION.md). Set the app repository's Actions variable **`HOSTING_TARGET=portfolio`** to skip its standalone Pages deployment; its catalog writer still runs. In **Portfolio-2.0**, set the Actions repository variable **`STRETCH_FINDER_REPOSITORY`** to that exact `owner/repository` name. The prepared portfolio workflow then checks out the latest app source, builds from its committed catalog, and includes it in every portfolio deployment. It runs on portfolio pushes, manual dispatch, and daily **17:17 UTC**, one hour after the app's **16:17 UTC** source-update schedule. It never scans YouTube itself or writes to the app repository. A public source repository needs no additional write token or standalone Pages site.

Without that variable, pushes/manual deployments use the checked-in app snapshot and the new daily run is skipped. A failed fetch/build leaves the working portfolio live. If a source update finishes late, the next portfolio run picks it up; manually run the portfolio deployment for a quicker refresh. Hosting the app independently does not refresh the portfolio copy.

The local **Portfolio 2.0** checkout was inspected at `f8b7c4eeb294baebfe75a8805e79109df8212d67` and then edited for this integration. Its three capability categories and nine professional examples are retained; Projects is a separate section. Local integration is implemented; the new app remote, Actions variable, pushes and live URL activation have not been configured or verified by these file changes.

An inline iframe is optional if you later want the app visible directly inside a portfolio section; [docs/portfolio-embed.html](docs/portfolio-embed.html) shows same-origin markup. The compact card is the implemented default.
