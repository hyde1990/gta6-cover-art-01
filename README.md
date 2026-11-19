# Vice Cover Studio

[![make.fun](https://make.fun/badges/bounty-gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![make.fun](https://make.fun/badges/entry-gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![make.fun](https://make.fun/badges/verified-gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns a person's photo and a caption into GTA 6-style
multi-panel cover art, in the Vice City neon-sunset look. Built for the
[make.fun bounty “Make GTA 6 Cover Art”](https://make.fun/bounty/gta6-cover-art-01).

Everything runs in the browser with no network requests: photos stay on your
machine, the sunset art is drawn procedurally, and the export is a plain PNG.

## What it does

- **4 layouts** — Trio (hero + 2 smaller), Duo, Single full-bleed, Grid 2×2.
- **3 photo slots** — upload your own photo, or reuse the two bundled sample
  photos (`app/samples/boulevard.jpg`, `app/samples/pier.jpg`) across panels
  with different crops. The third slot defaults to procedural sunset art.
- **Per-panel crop, zoom and drag** — click a panel to select it, drag it on
  the cover to reposition the photo, or use the zoom / shift sliders.
- **Poster lettering** — editable caption in bold outlined poster type with a
  neon script subtitle, on a halftone title band.
- **Sunset / neon grade** — warm gradient map, halftone dots, vignette and
  grain over a procedural sunset (or midnight-violet / black-ink) backdrop.
- **PNG export** — 1080×1080, 1080×1350 and 1920×1080, one click.
- **Undo / redo** — every layout, crop and wording change is reversible.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies: `app/` is plain static files (HTML, CSS and
ES modules), served by the starter `serve.ts`.

## Screenshots

The four screenshots in `screenshots/` are taken headlessly from `shots.json`:
`1-cover.jpg` (Trio cover), `2-editor.jpg` (Duo editor), `3-cover.jpg`
(Single cover) and `4-cover.jpg` (Grid cover). Each shot is a fixed scene
driven by the `?shot=` query (`?shot=cover` / `?shot=editor` plus
`layout`, `photo`, `caption` …), see `app/src/shots.js`.

## Files

- `app/index.html` — the studio page
- `app/style.css` — dark neon styling
- `app/src/cover.js` — the canvas drawing engine (backdrop, panels, grade,
  halftone, title, vignette, grain)
- `app/src/main.js` — state, history, controls, drag, export
- `app/src/shots.js` — fixed scenes for headless screenshots
- `main.ts` — the make.fun hand-in program (starter, unchanged)
- `serve.ts` — the local static server (starter, unchanged)

## License

MIT — see `LICENSE` (`SPDX-License-Identifier: MIT`).
