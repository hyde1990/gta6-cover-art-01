// Vice Cover Studio round 6 — the 2D composition engine.
//
// This paints the cover's base image on a plain canvas: a cyber-jungle
// backdrop (hologram towers, cable lianas, holo banana), the layout's
// photo panels with per-panel crop + zoom + pan, the Simian Prime hero
// portrait for procedural hero slots, a chrome poster caption and a neon
// subtitle on the title band. The GPU grade (bloom, halftone, grain,
// light sweep, data particles, vignette) runs on top of this in glfx.js;
// when WebGL2 is missing, applyFallbackGrade gives a lighter 2D version
// of the same finish.
//
// No network, no downloaded fonts: only system fonts and canvas gradients.
// The chimp is drawn by hand in simian.js — no photo, no borrowed art.
import { layoutCells, cellsFor, cellBounds, fitCaption, fitSubtitle, clampSlot } from './geometry.js';
import { drawSimian, drawCyberJungle, mulberry32 } from './simian.js';

export { layoutCells, cellsFor };

// Warm tint washed over the whole cover in the 2D fallback, per grade.
const BACKDROP_TINT = {
  sunset: 'rgba(255, 110, 60, 0.10)',
  midnight: 'rgba(80, 60, 220, 0.08)',
  ink: 'rgba(255, 255, 255, 0.04)',
  neon: 'rgba(57, 255, 136, 0.07)',
};

// The neon edge colour of the slash cut, per grade.
const EDGE_COLOR = {
  sunset: '#ff2ea6',
  midnight: '#8a4fb8',
  ink: '#e8e8e8',
  neon: '#39ff88',
};

// Chrome-foil stops for the poster caption, per grade. Neon — the Simian
// grade — runs chrome green through cyan into magenta.
const FOIL_STOPS = {
  sunset: [[0, '#ffffff'], [0.28, '#ffe9a8'], [0.48, '#ffb347'], [0.62, '#ff4d6d'], [0.8, '#c62b8a'], [1, '#7b1e6e']],
  midnight: [[0, '#ffffff'], [0.3, '#dfe6ff'], [0.55, '#8a4fb8'], [0.8, '#5b3a9e'], [1, '#2b2a6b']],
  ink: [[0, '#ffffff'], [0.35, '#e8e8e8'], [0.6, '#b0b0b0'], [1, '#5a5a5a']],
  neon: [[0, '#ffffff'], [0.25, '#c8ffe2'], [0.45, '#39ff88'], [0.62, '#22d3ee'], [0.82, '#ff2ea6'], [1, '#7b1e6e']],
};

export function drawBackdrop(ctx, w, h, grade) {
  drawCyberJungle(ctx, w, h, grade || 'neon', 41, 0);
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

// A procedural panel: the cyber jungle on its own…
function drawJungleCell(ctx, cell, w, h, grade, seed) {
  const b = cellBounds(cell);
  ctx.save();
  clipCell(ctx, cell, w, h);
  ctx.translate(b.x * w, b.y * h);
  drawCyberJungle(ctx, b.w * w, b.h * h, grade, seed, 0);
  ctx.restore();
}

// …or with Simian Prime himself standing in it, the hero portrait.
// A diagonal panel frames the face on its polygon centroid (scaled down
// a little), so the slash cut never eats the head or the chest badge;
// a rectangular panel keeps the default centred framing.
function polyCentroid(poly) {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const cross = x0 * y1 - x1 * y0;
    a2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(a2) < 1e-9) return { x: 0.5, y: 0.5 };
  return { x: cx / (3 * a2), y: cy / (3 * a2) };
}

function drawSimianCell(ctx, cell, w, h, grade, seed) {
  const b = cellBounds(cell);
  ctx.save();
  clipCell(ctx, cell, w, h);
  ctx.translate(b.x * w, b.y * h);
  const pw = b.w * w;
  const ph = b.h * h;
  drawCyberJungle(ctx, pw, ph, grade, seed, 0);
  let view;
  if (cell.poly) {
    const c = polyCentroid(cell.poly);
    view = { cx: c.x * pw, cy: c.y * ph, scale: 0.78 };
  }
  drawSimian(ctx, pw, ph, grade, seed, 0, view);
  ctx.restore();
}

// Chrome-foil poster lettering: the caption is painted once on a small
// offscreen canvas, so the specular stripe only ever lands on the letters.
function chromeCaption(ctx, w, h, caption, subtitle, grade) {
  const bandH = h * 0.17;
  const y0 = h - bandH;
  ctx.fillStyle = 'rgba(10, 4, 26, 0.92)';
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
  for (const [stop, color] of FOIL_STOPS[grade] || FOIL_STOPS.neon) {
    foil.addColorStop(stop, color);
  }
  t.lineWidth = capSize * 0.16;
  t.strokeStyle = '#0a041a';
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
  ctx.shadowColor = grade === 'neon' ? '#39ff88' : '#ff2ea6';
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

// Fallback finish for browsers without WebGL2: tint, vignette, grain.
export function applyFallbackGrade(ctx, w, h, grade) {
  const g = grade || 'neon';
  ctx.fillStyle = BACKDROP_TINT[g] || BACKDROP_TINT.neon;
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(8,2,20,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
}

// state: { layout, slots:[{kind, zoom, dx, dy}], caption, subtitle, grade, glow }
// images: { boulevard: HTMLImageElement, pier: HTMLImageElement, uploads: Map }
// Slot kinds: boulevard / pier / upload (photos), procedural (cyber jungle),
// simian (Simian Prime hero portrait over the jungle).
export function drawCoverBase(ctx, w, h, state, images) {
  const grade = state.grade || 'neon';
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, w, h, grade);
  const cells = layoutCells(state.layout);
  const slotIdx = cellsFor(state.layout);
  cells.forEach((cell, i) => {
    const slot = state.slots[slotIdx[i]] || { kind: 'simian', zoom: 1, dx: 0, dy: 0 };
    const mirror = state.layout === 'grid' && i === 3;
    let img = null;
    if (slot.kind === 'boulevard') img = images.boulevard;
    else if (slot.kind === 'pier') img = images.pier;
    else if (slot.kind === 'upload') img = images.uploads.get(slotIdx[i]);
    if (img && img.complete && img.naturalWidth > 0) {
      drawPhotoCell(ctx, cell, w, h, img, slot, mirror);
    } else if (slot.kind === 'simian') {
      drawSimianCell(ctx, cell, w, h, grade, 100 + i * 17);
    } else {
      drawJungleCell(ctx, cell, w, h, grade, 100 + i * 17);
    }
    // Thin neon divider around each panel.
    ctx.save();
    ctx.strokeStyle = grade === 'neon' ? 'rgba(57, 255, 136, 0.85)' : 'rgba(255, 46, 166, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.004);
    clipCell(ctx, cell, w, h);
    ctx.stroke();
    ctx.restore();
  });
  // The slash layout's signature: a hot neon edge along the diagonal cut.
  if (state.layout === 'slash') {
    ctx.save();
    ctx.strokeStyle = EDGE_COLOR[grade] || EDGE_COLOR.neon;
    ctx.shadowColor = EDGE_COLOR[grade] || EDGE_COLOR.neon;
    ctx.shadowBlur = Math.max(8, w * 0.012);
    ctx.lineWidth = Math.max(4, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(0.68 * w, 0.32 * h);
    ctx.lineTo(0.32 * w, 0.68 * h);
    ctx.stroke();
    ctx.restore();
  }
  chromeCaption(ctx, w, h, fitCaption(state.caption), fitSubtitle(state.subtitle), grade);
}
