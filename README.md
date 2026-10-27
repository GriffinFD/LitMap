# LitMap / MappingJacobs

An interactive visual companion to Jane Jacobs’s *The Death and Life of Great American Cities* (1961). The map helps readers locate places, read short excerpts and understand how those places illustrate her arguments. Independent, unofficial and educational.

## Run locally

Node.js 20 or later is required. No dependency installation or build step is needed.

```powershell
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. Stop with Ctrl+C. Use an HTTP server, not a file URL. `npm run dev` is equivalent when npm is installed. Set `$env:PORT = '4174'` before starting to use a different port.

```powershell
node scripts/check.mjs
```

## Interface

The map fills the viewport below a slim header. All chapters is selected on a fresh visit, with no place panel open. All 22 chapters are listed individually in the scrollable sidebar. Chapter titles are checked against the linked table of contents in the catalogue. Chapter counts refer to entries currently in this companion, not every mention in the book.

Selecting a chapter filters and frames its places. All chapters clears the search and restores every marker. Empty chapters explain that entries have not yet been added. Search supports names, cities and aliases. The sidebar also contains a collapsible place index.

Markers open an overlay containing the excerpt, chapter, explanation, Street View and source notes. Closing the overlay leaves the map center and zoom unchanged. Place/chapter/search URL fragments restore the corresponding view. On mobile, chapters use a modal drawer with keyboard focus containment, and details appear in an expandable bottom sheet. Escape dismisses either panel. The welcome text can be dismissed. About contains preview information, attribution, source standards and a data download.

## Architecture

- Static HTML, CSS and native ES modules; deploy **dist/** on an HTTPS static host.
- Vendored Leaflet 1.9.4 and Leaflet.markercluster 1.5.3, with licenses. No framework build or runtime server database.
- OpenStreetMap raster tiles with visible attribution. Tile provider configuration lives in `dist/config.js`. Review provider capacity before a larger public launch.
- Normalized JSON and JSON Schema separate places, mentions, editions, chapters, sources, geography and Street View references. Hundreds of entries can use the same interface.
- Fonts load from Google Fonts, with system fallbacks. Map tiles and Street View require a network connection. No app analytics or account system is added.

## Content and configuration

The collection contains **15 places and 15 short excerpts** checked against the owner-supplied 2016 EPUB. Citations include chapter, embedded page labels and an exact EPUB paragraph locator. Explanations remain null for the project owner to supply. Excerpt verification is independent of geographic precision and explanation status.

`dist/data/catalogue.json` stores entries. `dist/data/catalogue.schema.json` documents their shape. `dist/catalogue.js` contains validation, filtering and official Street View URL builders. The checks enforce foreign-key consistency and verification prerequisites. The reader displays quotations only when marked verified.

Street View uses selected panoramas through Google's official Share → Embed URLs, stored as `place.streetView.embedUrl`. This route does not require an API key. The viewer loads automatically at the top of a location panel when the reader opens it; no extra click is needed. Google retains the interactive controls, imagery and attribution. See `STREET-VIEW.md` for adding and reviewing a view.

The Maps Embed API remains an optional fallback for entries without a selected embed URL. Enable Maps Embed API, restrict a browser key to that API and the intended website origins, and set `googleMapsEmbedApiKey` in `dist/config.js`. Browser keys are visible by design; do not use a server credential. See https://developers.google.com/maps/documentation/embed/embedding-map.

Content and source standards are documented in `CONTENT-GUIDE.md`.

## GitHub Pages deployment

`.github/workflows/pages.yml` checks every push and pull request to `main`. Successful pushes to `main` publish only `dist/` to GitHub Pages. Pull requests run checks without publishing. Manual runs are also available from Actions.

Initial repository configuration: set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The `github-pages` environment should allow deployment from `main`. The workflow uses GitHub’s built-in short-lived token; no personal token or hosting secret belongs in the repository.

After deployment, the workflow requests the public site without credentials and verifies its HTML, JavaScript, stylesheets, catalogue, selected Street View references, and exact commit marker. A failed public check is visible in Actions. Browser checks additionally cover map movement, zoom, marker panels, chapter filters, search, panel dismissal, and mobile controls.

All application assets and catalogue requests are relative, supporting a repository path such as `/LitMap/`. To preview that layout locally in PowerShell:

```powershell
$env:BASE_PATH = '/LitMap/'
node scripts/serve.mjs
```

Open `http://127.0.0.1:4173/LitMap/`. Run `node scripts/check-live.mjs http://127.0.0.1:4173/LitMap/` to check served assets. Stop the server with Ctrl+C.

The full EPUB, local extraction files, account credentials, and former hosting configuration are excluded from this standalone repository. The fifteen brief attributed excerpts remain in the public catalogue; explanations await the project owner.

## Next content step

Add the project owner’s explanations to `mention.explanation`. The fifteen-place selection is editorial, not an objective ranking or exhaustive index. The model remains expandable beyond fifteen. To recheck excerpts locally against the supplied book, run `python scripts/verify-epub.py <path-to-epub>`; the script reads the book without copying it into the site.
