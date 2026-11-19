// Drawing engine for Vice Cover Studio. Everything is painted on one canvas:
// a procedural sunset (or night / ink) backdrop, the layout's photo panels with
// per-panel crop + zoom + shift, a warm neon grade, a halftone title band, a
// vignette and a light grain pass, then the big poster caption and subtitle.

export const LAYOUTS = {
  trio: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 0.5 },
    { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
  ],
  duo: [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
  single: [{ x: 0, y: 0, w: 1, h: 1 }],
  grid: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
};

/** Which panel index fills each cell of a layout. Grid reuses slot 1 in the
 *  fourth cell with a mirrored crop, so three slots still fill four cells. */
export function cellsFor(layout) {
  if (layout === 'grid') return [0, 1, 2, 0];
  return LAYOUTS[layout].map((_, i) => i);
}

function lerp(a, b, t) { return a + (b - a) * t; }

/** Deterministic pseudo-random from an integer seed, so the grain is stable. */
function rand(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function paintBackdrop(ctx, w, h, mode) {
  let stops;
  if (mode === 'night') stops = [[0, '#160b2e'], [0.55, '#3a1154'], [1, '#0a0616']];
  else if (mode === 'ink') stops = [[0, '#1a1a22'], [0.6, '#0c0c12'], [1, '#000000']];
  else stops = [[0, '#2b0f4a'], [0.42, '#c22a7a'], [0.72, '#ff7a2f'], [1, '#ffc93c']];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [at, col] of stops) g.addColorStop(at, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (mode !== 'ink') {
    // Low sun disc with a soft halo.
    const cx = w * 0.5, cy = h * 0.46, r = w * 0.17;
    const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
    halo.addColorStop(0, 'rgba(255, 220, 120, 0.85)');
    halo.addColorStop(0.35, 'rgba(255, 122, 47, 0.35)');
    halo.addColorStop(1, 'rgba(255, 122, 47, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = mode === 'night' ? '#f4e9ff' : '#ffe9a8';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Horizon stripes cutting the sun.
    ctx.fillStyle = stops[0][1];
    for (let i = 0; i < 4; i++) {
      const y = cy + r * (0.05 + i * 0.22);
      ctx.fillRect(0, y, w, Math.max(2, h * 0.008 * (i + 1)));
    }
  }
  // Simple skyline silhouette along the bottom third.
  ctx.fillStyle = 'rgba(12, 4, 24, 0.85)';
  let x = 0, seed = 7;
  while (x < w) {
    const bw = w * (0.05 + rand(seed++) * 0.09);
    const bh = h * (0.08 + rand(seed++) * 0.16);
    ctx.fillRect(x, h - bh, bw, bh);
    x += bw + w * 0.012;
  }
}

/** Paints one photo (or the procedural sunset) into a rectangle, cover-fit,
 *  with zoom and a fractional shift. `mirror` flips it horizontally. */
export function paintPanel(ctx, rect, panel, mirror) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!panel || panel.kind === 'sunset' || !panel.img) {
    // Procedural sunset art, painted inside this panel's own rectangle.
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    paintBackdrop(ctx, w, h, 'sunset');
    ctx.restore();
    return;
  }
  const img = panel.img;
  const zoom = panel.zoom || 1;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * base;
  const ph = img.naturalHeight * base;
  const dx = (panel.dx || 0) * w;
  const dy = (panel.dy || 0) * h;
  if (mirror) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, (w - pw) / 2 + dx, (h - ph) / 2 + dy, pw, ph);
  } else {
    ctx.drawImage(img, x + (w - pw) / 2 + dx, y + (h - ph) / 2 + dy, pw, ph);
  }
  ctx.restore();
}

function paintGrade(ctx, w, h) {
  // Warm wash, stronger at the bottom where the title sits.
  const warm = ctx.createLinearGradient(0, h * 0.25, 0, h);
  warm.addColorStop(0, 'rgba(255, 94, 98, 0)');
  warm.addColorStop(0.7, 'rgba(255, 94, 98, 0.10)');
  warm.addColorStop(1, 'rgba(255, 46, 136, 0.28)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  // Cool top edge for contrast.
  const cool = ctx.createLinearGradient(0, 0, 0, h * 0.3);
  cool.addColorStop(0, 'rgba(55, 230, 255, 0.10)');
  cool.addColorStop(1, 'rgba(55, 230, 255, 0)');
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, w, h * 0.3);
}

function paintHalftoneBand(ctx, w, h) {
  const bandY = h * 0.78, bandH = h * 0.22;
  ctx.fillStyle = 'rgba(10, 4, 20, 0.55)';
  ctx.fillRect(0, bandY, w, bandH);
  ctx.fillStyle = 'rgba(255, 201, 60, 0.5)';
  const step = Math.max(10, w * 0.016);
  let row = 0;
  for (let yy = bandY + step * 0.5; yy < bandY + bandH; yy += step, row++) {
    for (let xx = step * 0.5 + (row % 2 ? step / 2 : 0); xx < w; xx += step) {
      const r = Math.max(0.6, step * 0.16 * (1 - (yy - bandY) / bandH));
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintVignetteAndGrain(ctx, w, h) {
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const n = Math.floor((w * h) / 9000);
  for (let i = 0; i < n; i++) {
    ctx.fillRect(rand(i) * w, rand(i + 5000) * h, 1.4, 1.4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < n; i++) {
    ctx.fillRect(rand(i + 9000) * w, rand(i + 13000) * h, 1.4, 1.4);
  }
}

function fitFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 3;
    ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  }
  return size;
}

function paintTitle(ctx, w, h, caption, subtitle) {
  const bandY = h * 0.78;
  const words = (caption || 'VICE CITY').trim().toUpperCase();
  // Keep the whole title block inside the canvas: the caption sits high
  // enough in the band that the underline and subtitle still fit below it.
  const size = fitFont(ctx, words, w * 0.92, h * 0.105);
  const cy = bandY + h * 0.085;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Outline + fill so the letters read over any photo.
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.strokeStyle = '#12081f';
  ctx.lineJoin = 'round';
  ctx.strokeText(words, w / 2, cy);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(words, w / 2, cy);
  // Pink underline sweep.
  const tw = ctx.measureText(words).width;
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(w / 2 - tw / 2, cy + size * 0.5, tw, Math.max(3, h * 0.006));
  const sub = (subtitle || '').trim();
  if (sub) {
    const ss = Math.max(14, h * 0.028);
    ctx.font = `italic 700 ${ss}px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = '#37e6ff';
    ctx.shadowColor = 'rgba(55, 230, 255, 0.9)';
    ctx.shadowBlur = ss * 0.6;
    ctx.fillText(sub, w / 2, cy + size * 0.5 + ss * 1.15);
    ctx.shadowBlur = 0;
  }
}

/** Renders the whole cover. `state` carries layout, backdrop, caption,
 *  subtitle and panels (each with img / kind / zoom / dx / dy). */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  paintBackdrop(ctx, w, h, state.backdrop || 'sunset');
  const rects = LAYOUTS[state.layout] || LAYOUTS.trio;
  const cells = cellsFor(state.layout);
  const gap = Math.max(4, Math.round(w * 0.006));
  rects.forEach((r, i) => {
    const rect = {
      x: r.x * w + (r.x > 0 ? gap / 2 : 0),
      y: r.y * h + (r.y > 0 ? gap / 2 : 0),
      w: r.w * w - (r.x > 0 ? gap / 2 : 0) - (r.x + r.w < 1 ? gap / 2 : 0),
      h: r.h * h - (r.y > 0 ? gap / 2 : 0) - (r.y + r.h < 1 ? gap / 2 : 0),
    };
    const panel = state.panels[cells[i]];
    paintPanel(ctx, rect, panel, state.layout === 'grid' && i === 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });
  paintGrade(ctx, w, h);
  paintHalftoneBand(ctx, w, h);
  paintTitle(ctx, w, h, state.caption, state.subtitle);
  paintVignetteAndGrain(ctx, w, h);
}

/** Sizes the canvas to a "1080x1080"-style spec and renders. */
export function renderAt(canvas, state, spec) {
  const [w, h] = spec.split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas, state);
  return { w, h };
}
