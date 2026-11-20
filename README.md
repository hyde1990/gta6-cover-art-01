# Vice Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/hyde1990/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/hyde1990/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns a person's photo and a caption into GTA 6-style
multi-panel cover art, in the Vice City neon-sunset look. Built for the
[make.fun bounty “Make GTA 6 Cover Art”](https://make.fun/bounty/gta6-cover-art-01).

Round 5 rebuilt the renderer on WebGL2: the 2D engine paints the panels and
the chrome-foil caption, then a GLSL pipeline adds neon bloom, the sunset
grade, halftone, film grain and a drifting light sweep in the live preview
(frozen for exports, so a PNG is reproducible). Everything runs in the
browser with no network requests: photos stay on your machine, the sunset
art is drawn procedurally, and the export is a plain PNG.

## What it does

- **5 layouts** — Slash (a new diagonal comic split with a hot neon edge),
  Trio (hero + 2 smaller), Duo, Single full-bleed, Grid 2×2.
- **3 photo slots** — upload your own photo, or reuse the two bundled sample
  photos (`app/samples/boulevard.jpg`, `app/samples/pier.jpg`) across panels
  with different crops. The third slot defaults to procedural sunset art.
- **Per-panel crop, zoom and drag** — click a panel to select it, drag it on
  the cover to reposition the photo, or use the zoom / shift sliders.
- **WebGL2 grade** — bloom/glow slider, sunset / midnight / ink grades,
  GPU halftone + grain + vignette, and a light sweep that drifts across the
  live preview. Falls back to a 2D finish when WebGL2 is unavailable.
- **Chrome poster lettering** — editable caption in foil-gradient poster
  type with a specular slash, plus a neon script subtitle, on a halftone
  title band.
- **PNG export** — 1080×1080, 1080×1350 and 1920×1080, one click.
- **Undo / redo** — every layout, crop and wording change is reversible
  (buttons or Ctrl+Z / Ctrl+Y).

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies: `app/` is plain static files (HTML, CSS and
ES modules), served by the starter `serve.ts`.

## Screenshots

The four screenshots in `screenshots/` are taken headlessly from `shots.json`:
`1-cover.jpg` (Slash cover, landscape), `2-editor.jpg` (Trio editor),
`3-cover.jpg` (Trio cover, square) and `4-cover.jpg` (Grid cover, midnight,
portrait). Each shot is a fixed scene driven by the `?shot=` query
(`?shot=cover` / `?shot=editor` plus `layout`, `photo`, `caption` …), see
`app/src/shots.js`.

## Files

- `app/index.html` — the studio page
- `app/style.css` — dark neon styling
- `app/src/geometry.js` — layout, caption and slot rules (also unit-tested)
- `app/src/cover.js` — the 2D composition engine (backdrop, panels, chrome caption)
- `app/src/shaders.js` — the GLSL sources for the grade pipeline
- `app/src/glfx.js` — the WebGL2 pipeline (bloom, grade, halftone, grain, sweep)
- `app/src/main.js` — state, history, controls, drag, export
- `app/src/shots.js` — fixed scenes for headless screenshots
- `tests/cover.test.mjs` — Node tests (`node --test tests/cover.test.mjs`)
- `main.ts` — the make.fun hand-in program (checks the four screenshots,
  then builds the dossier)
- `serve.ts` — the local static server (starter, unchanged)

## License

MIT — see `LICENSE` (`SPDX-License-Identifier: MIT`).
