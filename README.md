# Vice Cover Studio — GTA-style cover art maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/hyde1990/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/hyde1990/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn any photo and a caption into multi-panel GTA-style cover art — a Vice City
sunset poster with bold lettering — and export it as a PNG to share. A make.fun
entry for [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01).

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Plain static files under `app/`, no build step, no network: every script, image
and style is a file under `app/`, and photos are read on your own machine, never
uploaded.

## What it does

- **Any photo**: upload up to 3 photos (or load the free samples), crop and
  position each one — zoom and pan sliders per panel, or drag the photo inside
  the live preview. Click a panel to select it.
- **Multi-panel layouts**: Trio (hero + two stacked), Duo, Single hero, and a
  2×2 Grid — one photo across all panels, or a different photo per panel.
- **Caption**: editable caption and sub-caption, lettering size and colour
  (white / gold / pink), slanted poster lettering, all rendered live.
- **Sunset look**: a procedural Vice City grade — slatted retro sun, skyline and
  palm silhouettes, film grain, neon frame — with a grade-strength slider.
- **Fast export**: one click saves a PNG in a common post size — **1080×1080**,
  **1080×1350**, or **1920×1080**.

## Original art

Everything on the poster is drawn in code (`app/src/cover.js`): the sunset
gradient, the sun, the skyline, the palms and the lettering. No Rockstar Games
logo, official artwork, character or font is used anywhere. The three sample
photos under `app/samples/` are model-made and free to use.

## Layout

- `main.ts` — entrypoint: copies `app/` and `screenshots/` to the output and
  writes `dossier.json` with the vendored make.fun library.
- `serve.ts` — tiny static server for local development.
- `app/index.html`, `app/style.css` — the editor page.
- `app/src/cover.js` — the cover renderer (sunset scene, panels, caption).
- `app/src/main.js` — editor wiring (slots, layout, drag-to-pan, export).
- `app/src/shots.js` — fixed screenshot scenes (`?shot=cover|editor`).
- `app/samples/` — three free sample photos.
- `screenshots/` — 4 screenshots: the wide cover first, then the editor, the
  portrait cover, and the square grid cover.
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.
