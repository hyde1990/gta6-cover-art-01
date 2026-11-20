// Vice Cover Studio round 5 — the 2D composition engine.
//
// This paints the cover's base image on a plain canvas: a procedural sunset
// (or midnight / ink) backdrop, the layout's photo panels with per-panel crop
// + zoom + pan, a chrome poster caption and a neon subtitle on the title band.
// The GPU grade (bloom, halftone, grain, light sweep, vignette) runs on top
// of this in glfx.js; when WebGL2 is missing, applyFallbackGrade gives a
// lighter 2D version of the same finish.
//
// No network, no downloaded fonts: only system fonts and canvas gradients.
import { layoutCells, cellsFor, cellBounds, fitCaption, fitSubtitle, clampSlot } from './geometry.js';

export { layoutCells, cellsFor };

const BACKDROPS = {
  sunset: {
    sky: ['#2b0f4d', '#7b1e6e', '#e0396b', '#ff7a3d', '#ffc46b'],
    sun: '#ffe9a8',
    glow: 'rgba(255, 122, 61, 0.55)',
    ground: '#160a2e',
    band: '#12081f',
    tint: 'rgba(255, 110, 60, 0.10)',
  },
  midnight: {
    sky: ['#050510', '#141433', '#2b2a6b', '#5b3a9e', '#8a4fb8'],
    sun: '#dfe6ff',
    glow: 'rgba(120, 110, 255, 0.45)',
    ground: '#0a0a18',
    band: '#080816',
    tint: 'rgba(80, 60, 220, 0.08)',
  },
  ink: {
    sky: ['#000000', '#101010', '#242424', '#3d3d3d', '#5a5a5a'],
    sun: '#f2f2f2',
    glow: 'rgba(255, 255, 255, 0.28)',
    ground: '#000000',
    band: '#050505',
    tint: 'rgba(255, 255, 255, 0.04)',
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

function clipCell(ctx, cell, w, h) {
  ctx.beginPath();
  if (cell.poly) {
    cell.poly.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px * w, py * h);
      else ctx.lineTo(px * w, py * h);
    });
    ctx.closePath();
  } else {
    ctx.rect(cell.x * w, cell.y * h, cell.w * w, cell.h * h);
  }
  ctx.clip();
}

function drawPhotoCell(ctx, cell, w, h, img, slot, mirror) {
  const b = cellBounds(cell);
  const x = b.x * w;
  const y = b.y * h;
  const cw = b.w * w;
  const ch = b.h * h;
  ctx.save();
  clipCell(ctx, cell, w, h);
  const s = clampSlot(slot);
  const scale = Math.max(cw / img.width, ch / img.height) * s.zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  const cx = x + cw / 2 + s.dx * cw * 0.1;
  const cy = y + ch / 2 + s.dy * ch * 0.1;
  if (mirror) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }
  ctx.restore();
}

function drawProceduralCell(ctx, cell, w, h, grade, seed) {
  const b = cellBounds(cell);
  ctx.save();
  clipCell(ctx, cell, w, h);
  ctx.translate(b.x * w, b.y * h);
  drawBackdrop(ctx, b.w * w, b.h * h, grade);
  // A palm silhouette: a curved trunk with fronds that arc out and droop.
  const rnd = mulberry32(seed);
  const pw = b.w * w;
  const ph = b.h * h;
  const crownX = pw * 0.66;
  const crownY = ph * 0.38;
  ctx.strokeStyle = 'rgba(10, 4, 24, 0.92)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(4, pw * 0.022);
  ctx.beginPath();
  ctx.moveTo(pw * 0.86, ph);
  ctx.quadraticCurveTo(pw * 0.84, ph * 0.62, crownX, crownY);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, pw * 0.008);
  const fronds = 6;
  for (let i = 0; i < fronds; i++) {
    const a = Math.PI * (1.08 + (i / (fronds - 1)) * 0.84);
    const len = pw * (0.3 + rnd() * 0.08);
    const tipX = crownX + Math.cos(a) * len;
    const tipY = crownY + Math.sin(a) * ph * 0.22 + ph * 0.16;
    const ctrlX = crownX + Math.cos(a) * len * 0.55;
    const ctrlY = crownY + Math.sin(a) * ph * 0.3 - ph * 0.05;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    ctx.stroke();
  }
  ctx.restore();
}

// Chrome-foil poster lettering: the caption is painted once on a small
// offscreen canvas, so the specular stripe only ever lands on the letters.
function chromeCaption(ctx, w, h, caption, subtitle) {
  const bandH = h * 0.17;
  const y0 = h - bandH;
  ctx.fillStyle = 'rgba(14, 6, 26, 0.92)';
  ctx.fillRect(0, y0, w, bandH);

  const capSize = Math.min(w * 0.085, bandH * 0.52);
  const text = document.createElement('canvas');
  text.width = Math.max(2, Math.ceil(w));
  text.height = Math.max(2, Math.ceil(bandH));
  const t = text.getContext('2d');
  t.textAlign = 'center';
  t.textBaseline = 'middle';
  t.font = `900 ${capSize}px "Arial Black", Impact, sans-serif`;
  t.lineJoin = 'round';
  const cx = w / 2;
  const cy = bandH * 0.34;
  const foil = t.createLinearGradient(0, cy - capSize / 2, 0, cy + capSize / 2);
  foil.addColorStop(0, '#ffffff');
  foil.addColorStop(0.28, '#ffe9a8');
  foil.addColorStop(0.48, '#ffb347');
  foil.addColorStop(0.62, '#ff4d6d');
  foil.addColorStop(0.8, '#c62b8a');
  foil.addColorStop(1, '#7b1e6e');
  t.lineWidth = capSize * 0.16;
  t.strokeStyle = '#12081f';
  t.strokeText(caption, cx, cy);
  t.fillStyle = foil;
  t.fillText(caption, cx, cy);
  // One hard specular slash across the foil, clipped to the letters.
  t.save();
  t.globalCompositeOperation = 'source-atop';
  t.translate(cx, cy);
  t.rotate(-0.5);
  const stripe = t.createLinearGradient(-capSize * 0.4, 0, capSize * 0.4, 0);
  stripe.addColorStop(0, 'rgba(255,255,255,0)');
  stripe.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  stripe.addColorStop(1, 'rgba(255,255,255,0)');
  t.fillStyle = stripe;
  t.fillRect(-capSize * 0.4, -capSize, capSize * 0.8, capSize * 2);
  t.restore();
  ctx.drawImage(text, 0, y0);

  // Neon script subtitle, kept inside the band so it never clips.
  const subSize = Math.min(w * 0.042, bandH * 0.3);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic bold ${subSize}px "Brush Script MT", "Segoe Script", cursive`;
  ctx.shadowColor = '#ff2ea6';
  ctx.shadowBlur = subSize * 0.55;
  ctx.fillStyle = '#ffe9fb';
  ctx.fillText(subtitle, cx, y0 + bandH * 0.78);
  ctx.restore();
}

let grainTile = null;
function grainPattern(ctx) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 128;
    grainTile.height = 128;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(128, 128);
    const rnd = mulberry32(20261120);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 22;
    }
    g.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grainTile, 'repeat');
}

// Fallback finish for browsers without WebGL2: warm tint, vignette, grain.
export function applyFallbackGrade(ctx, w, h, grade) {
  const p = BACKDROPS[grade] || BACKDROPS.sunset;
  ctx.fillStyle = p.tint;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,2,20,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
}

// state: { layout, slots:[{kind, zoom, dx, dy}], caption, subtitle, grade, glow }
// images: { boulevard: HTMLImageElement, pier: HTMLImageElement, uploads: Map }
export function drawCoverBase(ctx, w, h, state, images) {
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, w, h, state.grade || 'sunset');
  const cells = layoutCells(state.layout);
  const slotIdx = cellsFor(state.layout);
  cells.forEach((cell, i) => {
    const slot = state.slots[slotIdx[i]] || { kind: 'procedural', zoom: 1, dx: 0, dy: 0 };
    const mirror = state.layout === 'grid' && i === 3;
    let img = null;
    if (slot.kind === 'boulevard') img = images.boulevard;
    else if (slot.kind === 'pier') img = images.pier;
    else if (slot.kind === 'upload') img = images.uploads.get(slotIdx[i]);
    if (img && img.complete && img.naturalWidth > 0) {
      drawPhotoCell(ctx, cell, w, h, img, slot, mirror);
    } else {
      drawProceduralCell(ctx, cell, w, h, state.grade || 'sunset', 100 + i * 17);
    }
    // Thin neon divider around each panel.
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 46, 166, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.004);
    clipCell(ctx, cell, w, h);
    ctx.stroke();
    ctx.restore();
  });
  // The slash layout's signature: a hot neon edge along the diagonal cut.
  if (state.layout === 'slash') {
    ctx.save();
    ctx.strokeStyle = '#ff2ea6';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = Math.max(8, w * 0.012);
    ctx.lineWidth = Math.max(4, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(0.68 * w, 0.32 * h);
    ctx.lineTo(0.32 * w, 0.68 * h);
    ctx.stroke();
    ctx.restore();
  }
  chromeCaption(ctx, w, h, fitCaption(state.caption), fitSubtitle(state.subtitle));
}
