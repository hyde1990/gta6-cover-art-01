# Vice Cover Studio: Simian Cyber World

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/hyde1990/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/hyde1990/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns a person's photo and a caption into GTA 6-style
multi-panel cover art — set in a neon cyber jungle ruled by Simian Prime, a
chimp drawn by hand in code: chrome jacket, neon visor, headset and a holo
banana, standing among hologram towers and cable lianas under a magenta-cyan
sky. Built for the [make.fun bounty “Make GTA 6 Cover Art”](https://make.fun/bounty/gta6-cover-art-01).

Everything runs in the browser with no network requests: photos stay on your
machine, the jungle and the chimp are drawn procedurally, and the export is a
plain PNG. No Rockstar logo, artwork or font is used anywhere — the art is
original, drawn in code.

## What it does

- **Simian Prime hero panel** — a procedural chimp portrait (fur head, bare
  face plate, neon visor, headset, chrome jacket) that can fill any panel,
  drawn from tested geometry so the face always reads as a chimp.
- **Cyber jungle world** — hologram towers with neon windows, cable lianas
  with glowing nodes, a holo banana, a ringed holo sun and drifting data
  particles (animated in the preview, frozen in exports).
- **5 layouts** — Slash (diagonal comic split, default), Trio (hero + 2
  smaller), Duo, Single full-bleed, Grid 2×2.
- **3 photo slots** — upload your own photo, or reuse the two bundled sample
  photos (`app/samples/boulevard.jpg`, `app/samples/pier.jpg`) across panels
  with different crops. One photo can fill several panels.
- **Per-panel crop, zoom and drag** — click a panel to select it, drag it on
  the cover to reposition the photo, or use the zoom / shift sliders.
- **Poster lettering** — editable caption in chrome-foil type (chrome green
  through cyan into magenta on the neon grade) with a neon script subtitle,
  on a halftone title band.
- **Backdrop grades** — neon jungle (default), warm sunset, midnight violet,
  or black ink.
- **WebGL2 grade** — neon bloom, grade, halftone, film grain, a drifting
  light sweep and data particles; a 2D fallback keeps the app working
  without WebGL2.
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
`1-cover.jpg` (Slash simian cover, landscape), `2-editor.jpg` (Trio editor
with a photo loaded), `3-cover.jpg` (Trio square, Simian Prime hero) and
`4-cover.jpg` (Grid cover, neon grade). Each shot is a fixed scene driven by
the `?shot=` query (`?shot=cover` / `?shot=editor` plus `layout`, `photo`,
`slot0..2`, `caption` …), see `app/src/shots.js`.

## Files

- `app/index.html` — the studio page
- `app/style.css` — chrome-green + magenta styling
- `app/src/simian.js` — the Simian Prime portrait + cyber jungle world
- `app/src/cover.js` — the 2D composition engine (panels, grade, chrome caption)
- `app/src/geometry.js` — pure layout, caption and slot rules (Node-tested)
- `app/src/shaders.js` — GLSL sources for the WebGL2 grade pipeline
- `app/src/glfx.js` — the WebGL2 bloom / grade / particle pipeline
- `app/src/main.js` — state, history, controls, drag, export
- `app/src/shots.js` — fixed scenes for headless screenshots
- `main.ts` — the make.fun hand-in program (checks the four screenshots,
  then builds the dossier)
- `serve.ts` — the local static server (starter, unchanged)
- `tests/cover.test.mjs` — Node tests for geometry, simian anatomy and GLSL
- `tools/shots-driver.mjs` — headless screenshot + edge-case probe driver

## License

MIT — see `LICENSE` (`SPDX-License-Identifier: MIT`).
