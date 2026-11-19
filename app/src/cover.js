// Vice Cover Studio — the cover renderer. Every pixel of the poster is drawn here
// with the canvas 2D API: a procedural Vice City sunset (gradient sky, slatted sun,
// skyline and palm silhouettes), the multi-panel photo layout, and bold outlined
// caption lettering. No image, font or artwork is borrowed from any game: the sun,
// skyline, palms and lettering are all drawn from code, and the photos are the
// user's own (or the free samples under app/samples/).

export const LAYOUTS = ['trio', 'duo', 'single', 'grid'];

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 x 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 x 1080', w: 1920, h: 1080 },
];

/** A tiny deterministic RNG so the skyline, palms and grain look the same on every run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh editor state: three photo slots, four panel configs, caption and look. */
export function defaultState() {
  return {
    layout: 'trio',
    photos: [null, null, null], // HTMLImageElement per slot, or null
    panels: [
      { photo: 0, zoom: 1.0, ox: 0, oy: 0, grade: 0.8 },
      { photo: 1, zoom: 1.0, ox: 0, oy: 0, grade: 0.8 },
      { photo: 2, zoom: 1.0, ox: 0, oy: 0, grade: 0.8 },
      { photo: 0, zoom: 1.0, ox: 0, oy: 0, grade: 0.8 },
    ],
    caption: 'SUNSET HEIST',
    subcaption: 'VICE CITY  •  2026',
    captionSize: 1.0,
    captionColor: 'white', // white | gold | pink
    slant: true,
    grade: 70, // 0..100, strength of the sunset grade on every panel
    sun: true,
    grain: true,
    neon: true,
  };
}

/** Panel rectangles for a layout at W x H, plus the caption band rectangle.
 * A sunset sky strip stays open across the top (sun + skyline show there). */
export function layoutPanels(layout, W, H) {
  const m = Math.max(12, Math.round(W * 0.022)); // outer margin
  const g = Math.max(6, Math.round(W * 0.011)); // gap between panels
  const bandH = Math.round(H * (W > H ? 0.26 : 0.23)); // caption band height
  const skyH = Math.round(H * 0.10); // open sky strip at the top
  const x0 = m, y0 = m + skyH;
  const cw = W - m * 2; // content width
  const ch = H - bandH - y0 - g; // photo area height
  const band = { x: 0, y: H - bandH, w: W, h: bandH };
  const at = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  if (layout === 'single') {
    return { panels: [at(x0, y0, cw, ch)], band, skyH };
  }
  if (layout === 'duo') {
    const w = (cw - g) / 2;
    return { panels: [at(x0, y0, w, ch), at(x0 + w + g, y0, w, ch)], band, skyH };
  }
  if (layout === 'grid') {
    const w = (cw - g) / 2, h = (ch - g) / 2;
    return {
      panels: [
        at(x0, y0, w, h), at(x0 + w + g, y0, w, h),
        at(x0, y0 + h + g, w, h), at(x0 + w + g, y0 + h + g, w, h),
      ],
      band, skyH,
    };
  }
  // trio: one tall hero panel on the left, two stacked panels on the right.
  const heroW = Math.round(cw * 0.56);
  const sideW = cw - heroW - g;
  const halfH = (ch - g) / 2;
  return {
    panels: [
      at(x0, y0, heroW, ch),
      at(x0 + heroW + g, y0, sideW, halfH),
      at(x0 + heroW + g, y0 + halfH + g, sideW, halfH),
    ],
    band, skyH,
  };
}

/** Which panel (index) contains point (x, y) in canvas pixels, or -1. */
export function panelAt(state, W, H, x, y) {
  const { panels } = layoutPanels(state.layout, W, H);
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return i;
  }
  return -1;
}

/** Draws one photo cover-fitting `rect`, zoomed around its centre and panned by ox/oy (fractions of the rect).
 * The vertical anchor sits at the upper third (ay 0.20) instead of dead centre, so a
 * portrait photo in a wide panel shows the person's face by default instead of
 * their chest. The draw is clamped so the photo always covers the panel. */
function drawPhotoCover(ctx, img, rect, zoom, ox, oy) {
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  let dx = rect.x + (rect.w - pw) * 0.5 + ox * rect.w;
  let dy = rect.y + (rect.h - ph) * 0.20 + oy * rect.h;
  dx = Math.min(rect.x, Math.max(rect.x + rect.w - pw, dx));
  dy = Math.min(rect.y, Math.max(rect.y + rect.h - ph, dy));
  ctx.drawImage(img, dx, dy, pw, ph);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The retro sun, setting in the open sky strip above the panels. */
function drawSun(ctx, W, panelTop, skyH) {
  const cx = W * 0.68, cy = panelTop - skyH * 0.12;
  const r = skyH * 1.15;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4);
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.55)');
  glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.5, cy - r * 2.5, r * 5, r * 5);
  const disc = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  disc.addColorStop(0, '#ffe9a8');
  disc.addColorStop(0.55, '#ffb347');
  disc.addColorStop(1, '#ff5e62');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Retro slats cut across the sun's lower half (sky colour shows through).
  ctx.fillStyle = '#2a0f45';
  const slats = 5;
  for (let i = 0; i < slats; i++) {
    const y = cy + r * (0.08 + i * 0.17);
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    ctx.fillRect(cx - half, y, half * 2, r * 0.045 + i * 1.5);
  }
}

function drawSkyline(ctx, W, H, base, rng) {
  ctx.fillStyle = '#1b0b33';
  let x = -10;
  while (x < W + 10) {
    const bw = 26 + rng() * 74;
    const bh = H * (0.04 + rng() * 0.09);
    ctx.fillRect(x, base - bh, bw, bh + 2);
    // A few lit windows, warm against the dark towers.
    ctx.fillStyle = 'rgba(255, 190, 90, 0.85)';
    const cols = Math.max(1, Math.floor(bw / 16));
    const rows = Math.max(1, Math.floor(bh / 22));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rng() < 0.35) ctx.fillRect(x + 5 + c * 15, base - bh + 6 + r * 20, 5, 7);
      }
    }
    ctx.fillStyle = '#1b0b33';
    x += bw + 4 + rng() * 14;
  }
}

function drawPalm(ctx, x, y, s, lean, rng) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(lean);
  ctx.strokeStyle = '#150829';
  ctx.fillStyle = '#150829';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  // Trunk, curving gently.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -70, 6, -140);
  ctx.stroke();
  // Fronds arc out of the crown and droop at the tips, like a fountain.
  for (let i = 0; i < 7; i++) {
    const a = -1.15 + i * 0.38; // spread across the crown, -66deg..+66deg from vertical
    const len = 58 + rng() * 26;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const ex = 6 + dx * len, ey = -140 + dy * len * 0.8 + len * 0.28; // tips droop down
    ctx.lineWidth = 7 - i * 0.35;
    ctx.beginPath();
    ctx.moveTo(6, -140);
    ctx.bezierCurveTo(
      6 + dx * len * 0.35, -140 + dy * len * 0.4 - 22,
      6 + dx * len * 0.7, -140 + dy * len * 0.7,
      ex, ey,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawPanel(ctx, img, panel, cfg, gradeStrength, W) {
  const r = Math.max(4, Math.round(W * 0.008));
  ctx.save();
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, r);
  ctx.clip();
  if (img) {
    drawPhotoCover(ctx, img, panel, cfg.zoom, cfg.ox, cfg.oy);
    // Sunset grade: warm magenta-to-orange wash, stronger at the bottom.
    const a = 0.12 + (gradeStrength / 100) * 0.38 * cfg.grade;
    const wash = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
    wash.addColorStop(0, `rgba(255, 90, 160, ${a * 0.45})`);
    wash.addColorStop(0.6, `rgba(255, 110, 60, ${a * 0.55})`);
    wash.addColorStop(1, `rgba(120, 20, 110, ${a})`);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.globalCompositeOperation = 'source-over';
    // Gentle vignette so the panel edges sit in the poster.
    const vig = ctx.createLinearGradient(0, panel.y + panel.h * 0.55, 0, panel.y + panel.h);
    vig.addColorStop(0, 'rgba(10, 4, 26, 0)');
    vig.addColorStop(1, 'rgba(10, 4, 26, 0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  } else {
    const empty = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w, panel.y + panel.h);
    empty.addColorStop(0, '#2c1448');
    empty.addColorStop(1, '#160a2a');
    ctx.fillStyle = empty;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = `700 ${Math.max(13, panel.w * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+  ADD A PHOTO', panel.x + panel.w / 2, panel.y + panel.h / 2);
  }
  ctx.restore();
  // Crisp white frame and a soft drop shadow under the panel.
  ctx.save();
  ctx.shadowColor = 'rgba(8, 2, 20, 0.55)';
  ctx.shadowBlur = Math.round(W * 0.012);
  ctx.shadowOffsetY = Math.round(W * 0.006);
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, r);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = Math.max(3, Math.round(W * 0.004));
  ctx.stroke();
  ctx.restore();
}

function fitCaptionLines(ctx, text, maxWidth, size, fontFor) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    ctx.font = fontFor(size);
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawCaption(ctx, state, band, W) {
  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim().toUpperCase();
  const cx = W / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (state.slant) {
    ctx.translate(cx, band.y + band.h / 2);
    ctx.rotate(-0.035);
    ctx.translate(-cx, -(band.y + band.h / 2));
  }
  // Sub-caption: small, wide-tracked, gold, with a neon pink glow, on its own line.
  if (sub) {
    const subSize = Math.max(12, band.h * 0.115);
    ctx.font = `700 ${subSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.42)}px`; } catch { /* older canvas: no tracking */ }
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = 'rgba(255, 45, 149, 0.9)';
    ctx.shadowBlur = subSize * 0.9;
    ctx.fillText(sub, cx, band.y + band.h * 0.13);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
  if (!text) { ctx.restore(); return; }
  const fill = { white: '#ffffff', gold: '#ffe9a8', pink: '#ff9ed2' }[state.captionColor] || '#ffffff';
  let size = band.h * (sub ? 0.44 : 0.52) * state.captionSize;
  const fontFor = (s) => `900 ${s}px 'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
  const maxW = W * 0.92;
  let lines = fitCaptionLines(ctx, text, maxW, size, fontFor);
  while (lines.length > 1 && size > 14) {
    // One line is punchier: shrink until it fits, then fall back to two lines.
    ctx.font = fontFor(size);
    if (ctx.measureText(text).width <= maxW) { lines = [text]; break; }
    size -= 2;
    lines = fitCaptionLines(ctx, text, maxW, size, fontFor);
  }
  const lineH = size * 1.04;
  const totalH = lineH * lines.length;
  // The caption block is centred in the band below the sub-caption line.
  const top = band.y + (sub ? band.h * 0.28 : band.h * 0.08);
  const bottom = band.y + band.h * 0.96;
  const centerY = (top + bottom) / 2;
  let y = centerY - totalH / 2 + lineH / 2;
  ctx.font = fontFor(size);
  try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* ignore */ }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160a2e';
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.fillStyle = fill;
  ctx.shadowColor = 'rgba(255, 45, 149, 0.55)';
  ctx.shadowBlur = size * 0.14;
  ctx.shadowOffsetY = size * 0.05;
  for (const line of lines) {
    ctx.strokeText(line, cx, y);
    ctx.fillText(line, cx, y);
    y += lineH;
  }
  ctx.restore();
}

let grainPattern = null;
function drawGrain(ctx, W, H) {
  if (!grainPattern) {
    const rng = mulberry32(20261119);
    const tile = document.createElement('canvas');
    tile.width = 160; tile.height = 160;
    const tctx = tile.getContext('2d');
    const img = tctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.floor(rng() * 90);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    grainPattern = ctx.createPattern(tile, 'repeat');
  }
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Renders the whole cover onto `canvas` (any size) from `state`. */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const { panels, band, skyH } = layoutPanels(state.layout, W, H);
  const panelTop = panels.length ? panels[0].y : Math.round(H * 0.12);
  const rng = mulberry32(1337);

  // Sunset sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1d0b3d');
  sky.addColorStop(0.35, '#6d1d7c');
  sky.addColorStop(0.62, '#e33e7f');
  sky.addColorStop(0.82, '#ff7a3c');
  sky.addColorStop(1, '#ffc46b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (state.sun) drawSun(ctx, W, panelTop, skyH);
  drawSkyline(ctx, W, H, panelTop, rng);

  // Framing palms, behind the panels so they peek out at the edges.
  const palmScale = Math.min(W, H) / 1080;
  drawPalm(ctx, W * 0.015, H * 0.99, palmScale * 1.0, 0.12, rng);
  drawPalm(ctx, W * 0.985, H * 0.99, palmScale * 1.0, -0.12, rng);

  // Photo panels.
  panels.forEach((panel, i) => {
    const cfg = state.panels[i];
    const img = cfg ? state.photos[cfg.photo] ?? null : null;
    drawPanel(ctx, img, panel, cfg ?? { photo: 0, zoom: 1, ox: 0, oy: 0, grade: 0.8 }, state.grade, W);
  });

  // Caption band: the sunset deepens into dusk behind the lettering.
  const bandGrad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  bandGrad.addColorStop(0, 'rgba(60, 10, 70, 0.25)');
  bandGrad.addColorStop(0.5, 'rgba(120, 20, 90, 0.55)');
  bandGrad.addColorStop(1, 'rgba(24, 6, 44, 0.85)');
  ctx.fillStyle = bandGrad;
  ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(0, band.y, W, Math.max(2, Math.round(H * 0.002)));
  drawCaption(ctx, state, band, W);

  if (state.grain) drawGrain(ctx, W, H);

  // Neon frame around the whole cover.
  if (state.neon) {
    const inset = Math.max(5, Math.round(W * 0.006));
    ctx.save();
    ctx.strokeStyle = '#ff2d95';
    ctx.lineWidth = Math.max(2, Math.round(W * 0.0025));
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = Math.round(W * 0.014);
    roundRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, Math.max(6, W * 0.01));
    ctx.stroke();
    ctx.restore();
  }
}

/** Renders the cover at an exact export size and returns the canvas. */
export function exportCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas, state);
  return canvas;
}
