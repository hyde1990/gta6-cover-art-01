// Drawing engine for Vice Cover Studio. Everything is painted on one canvas:
// a procedural sunset (or midnight / ink) backdrop, the layout's photo panels
// with per-panel crop + zoom + pan, a warm neon grade, a halftone title band,
// a vignette and a light grain pass, then the big poster caption and subtitle.
//
// No network, no fonts to download: only system fonts and canvas gradients.

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

// Which photo slot fills each cell. Grid reuses slot 0 in the fourth cell
// with a mirrored crop, so three slots still fill four cells.
export function cellsFor(layout) {
  if (layout === 'trio') return [0, 1, 2];
  if (layout === 'duo') return [0, 1];
  if (layout === 'single') return [0];
  return [0, 1, 2, 0];
}

const BACKDROPS = {
  sunset: {
    sky: ['#2b0f4d', '#7b1e6e', '#e0396b', '#ff7a3d', '#ffc46b'],
    sun: '#ffe9a8',
    glow: 'rgba(255, 122, 61, 0.55)',
    ground: '#160a2e',
    band: '#12081f',
  },
  midnight: {
    sky: ['#050510', '#141433', '#2b2a6b', '#5b3a9e', '#8a4fb8'],
    sun: '#dfe6ff',
    glow: 'rgba(120, 110, 255, 0.45)',
    ground: '#0a0a18',
    band: '#080816',
  },
  ink: {
    sky: ['#000000', '#101010', '#242424', '#3d3d3d', '#5a5a5a'],
    sun: '#f2f2f2',
    glow: 'rgba(255, 255, 255, 0.28)',
    ground: '#000000',
    band: '#050505',
  },
};

// Deterministic pseudo-random numbers so screenshots are stable run to run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawSkyline(ctx, w, h, color, seed) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = color;
  const base = h * 0.78;
  let x = 0;
  while (x < w) {
    const bw = w * (0.04 + rnd() * 0.07);
    const bh = h * (0.06 + rnd() * 0.16);
    ctx.fillRect(x, base - bh, bw, bh + h * 0.22);
    // A lit window or two on some buildings.
    if (rnd() > 0.5) {
      ctx.fillStyle = 'rgba(255, 214, 130, 0.85)';
      ctx.fillRect(x + bw * 0.3, base - bh + bh * 0.3, 2, 3);
      ctx.fillStyle = color;
    }
    x += bw + w * 0.008;
  }
}

function drawSun(ctx, w, h, palette) {
  const cx = w * 0.5;
  const cy = h * 0.52;
  const r = Math.min(w, h) * 0.17;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const disc = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  disc.addColorStop(0, palette.sun);
  disc.addColorStop(1, '#ff9d5c');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Retro slats across the lower half of the sun.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = palette.sky[1];
  let y = cy + r * 0.05;
  let gap = 3;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, gap);
    y += gap + 9;
    gap += 3;
  }
  ctx.restore();
}

export function drawBackdrop(ctx, w, h, grade) {
  const p = BACKDROPS[grade] || BACKDROPS.sunset;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  p.sky.forEach((c, i) => sky.addColorStop(i / (p.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  drawSun(ctx, w, h, p);
  drawSkyline(ctx, w, h, p.ground, 41);
  drawSkyline(ctx, w, h, p.band, 97);
}

function drawPhotoCell(ctx, x, y, w, h, img, slot, mirror) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const zoom = slot.zoom || 1;
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  const cx = x + w / 2 + (slot.dx || 0) * w * 0.1;
  const cy = y + h / 2 + (slot.dy || 0) * h * 0.1;
  if (mirror) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }
  ctx.restore();
}

function drawProceduralCell(ctx, x, y, w, h, grade, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x, y);
  drawBackdrop(ctx, w, h, grade);
  // A palm silhouette for the procedural panel: a curved trunk with fronds
  // that arc out and droop, so it reads as a palm, not a star.
  const rnd = mulberry32(seed);
  const crownX = w * 0.66;
  const crownY = h * 0.38;
  ctx.strokeStyle = 'rgba(10, 4, 24, 0.92)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(4, w * 0.022);
  ctx.beginPath();
  ctx.moveTo(w * 0.86, h);
  ctx.quadraticCurveTo(w * 0.84, h * 0.62, crownX, crownY);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, w * 0.008);
  const fronds = 6;
  for (let i = 0; i < fronds; i++) {
    // Spread from up-left to up-right, each frond arcing out then drooping.
    const a = Math.PI * (1.08 + (i / (fronds - 1)) * 0.84);
    const len = w * (0.3 + rnd() * 0.08);
    const tipX = crownX + Math.cos(a) * len;
    const tipY = crownY + Math.sin(a) * h * 0.22 + h * 0.16;
    const ctrlX = crownX + Math.cos(a) * len * 0.55;
    const ctrlY = crownY + Math.sin(a) * h * 0.3 - h * 0.05;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    ctx.stroke();
  }
  ctx.restore();
}

function halftoneBand(ctx, w, h, color) {
  const bandH = h * 0.17;
  const y0 = h - bandH;
  ctx.fillStyle = color;
  ctx.fillRect(0, y0, w, bandH);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  const step = Math.max(7, w * 0.011);
  for (let y = y0 + step / 2; y < h; y += step) {
    const row = Math.round((y - y0) / step);
    for (let x = step / 2 + (row % 2 ? step / 2 : 0); x < w; x += step) {
      const r = Math.max(1, step * 0.16 * (1 + ((x + y) % 3) * 0.25));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function vignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,2,20,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

let grainTile = null;
function grain(ctx, w, h) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 128;
    grainTile.height = 128;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(128, 128);
    const rnd = mulberry32(20261119);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 22;
    }
    g.putImageData(img, 0, 0);
  }
  const pattern = ctx.createPattern(grainTile, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
}

function posterText(ctx, w, h, caption, subtitle) {
  const bandH = h * 0.17;
  const y0 = h - bandH;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const capSize = Math.min(w * 0.085, bandH * 0.52);
  ctx.font = `900 ${capSize}px "Arial Black", Impact, sans-serif`;
  ctx.lineJoin = 'round';
  const cx = w / 2;
  const cy = y0 + bandH * 0.34;
  ctx.lineWidth = capSize * 0.16;
  ctx.strokeStyle = '#12081f';
  ctx.strokeText(caption.toUpperCase(), cx, cy);
  const grad = ctx.createLinearGradient(0, cy - capSize / 2, 0, cy + capSize / 2);
  grad.addColorStop(0, '#fff7d6');
  grad.addColorStop(0.55, '#ffb347');
  grad.addColorStop(1, '#ff4d6d');
  ctx.fillStyle = grad;
  ctx.fillText(caption.toUpperCase(), cx, cy);
  // Neon script subtitle, kept inside the band so it never clips.
  const subSize = Math.min(w * 0.042, bandH * 0.3);
  ctx.font = `italic bold ${subSize}px "Brush Script MT", "Segoe Script", cursive`;
  ctx.shadowColor = '#ff2ea6';
  ctx.shadowBlur = subSize * 0.55;
  ctx.fillStyle = '#ffe9fb';
  ctx.fillText(subtitle, cx, y0 + bandH * 0.78);
  ctx.restore();
}

// state: { layout, slots:[{kind, zoom, dx, dy}], caption, subtitle, grade }
// images: { boulevard: HTMLImageElement, pier: HTMLImageElement, uploads: Map }
export function drawCover(ctx, w, h, state, images) {
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, w, h, state.grade || 'sunset');
  const cells = LAYOUTS[state.layout] || LAYOUTS.trio;
  const slotIdx = cellsFor(state.layout);
  cells.forEach((cell, i) => {
    const cx = cell.x * w;
    const cy = cell.y * h;
    const cw = cell.w * w;
    const ch = cell.h * h;
    const slot = state.slots[slotIdx[i]] || { kind: 'procedural', zoom: 1, dx: 0, dy: 0 };
    const mirror = state.layout === 'grid' && i === 3;
    let img = null;
    if (slot.kind === 'boulevard') img = images.boulevard;
    else if (slot.kind === 'pier') img = images.pier;
    else if (slot.kind === 'upload') img = images.uploads.get(slotIdx[i]);
    if (img && img.complete && img.naturalWidth > 0) {
      drawPhotoCell(ctx, cx, cy, cw, ch, img, slot, mirror);
    } else {
      drawProceduralCell(ctx, cx, cy, cw, ch, state.grade || 'sunset', 100 + i * 17);
    }
    // Thin neon divider between panels.
    ctx.strokeStyle = 'rgba(255, 46, 166, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.strokeRect(cx, cy, cw, ch);
  });
  // Warm neon grade over everything.
  ctx.fillStyle = state.grade === 'midnight'
    ? 'rgba(80, 60, 220, 0.08)'
    : state.grade === 'ink' ? 'rgba(255,255,255,0.04)' : 'rgba(255, 110, 60, 0.10)';
  ctx.fillRect(0, 0, w, h);
  halftoneBand(ctx, w, h, 'rgba(14, 6, 26, 0.92)');
  vignette(ctx, w, h);
  grain(ctx, w, h);
  posterText(ctx, w, h, state.caption || 'VICE CITY', state.subtitle || 'Sunset Heist');
}
