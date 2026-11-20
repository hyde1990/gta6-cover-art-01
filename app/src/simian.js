// Vice Cover Studio round 6 — the Simian Cyber World.
//
// Everything in this file is drawn by hand, in code: no image is fetched,
// no photo of a real chimp is used, nothing comes from the internet. The
// Simian Prime portrait is vector paths on a canvas — fur head, bare face
// plate, neon visor, headset, chrome jacket — and the cyber jungle is
// hologram towers, cable lianas and a holo banana under a magenta-cyan sky.
//
// The anatomy lives in simianLandmarks(), pure geometry with no DOM, so
// Node tests can check the face before any pixel is painted: the eyes are
// symmetric, the ears stick out past the head, the muzzle sits below the
// eyes. The drawing functions below place every stroke from those same
// landmarks, so a test failure means a broken face, not a broken test.
import { GRADE_NAMES } from './geometry.js';

// Deterministic pseudo-random numbers so screenshots are stable run to run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Anchor points of the Simian Prime face inside a panel of w x h.
// s is the portrait's unit: the smaller panel side, so the face scales the
// same on square, portrait and landscape panels. view recentres the
// portrait: { cx, cy, scale } — the head centre and a size factor — so a
// diagonal panel can frame the face on its visible centroid instead of
// the bounding-box centre, where the slash would clip it.
export function simianLandmarks(w, h, view) {
  const s = Math.min(w, h) * (view?.scale ?? 1);
  const cx = view?.cx ?? w * 0.5;
  const cy = view?.cy ?? h * 0.38;
  const head = { cx, cy, rx: s * 0.3, ry: s * 0.28 };
  const eyeL = { x: cx - s * 0.11, y: cy - s * 0.02, r: s * 0.045 };
  const eyeR = { x: cx + s * 0.11, y: cy - s * 0.02, r: s * 0.045 };
  const earL = { x: cx - head.rx - s * 0.02, y: cy - s * 0.02, r: s * 0.085 };
  const earR = { x: cx + head.rx + s * 0.02, y: cy - s * 0.02, r: s * 0.085 };
  const muzzle = { cx, cy: cy + s * 0.13, rx: s * 0.18, ry: s * 0.12 };
  const visor = { x: cx - s * 0.2, y: eyeL.y, w: s * 0.4, h: s * 0.075 };
  const shoulders = { y: cy + s * 0.36, halfW: w * 0.42 * (view?.scale ?? 1) };
  return { s, head, eyeL, eyeR, earL, earR, muzzle, visor, shoulders, cx, cy };
}

// Chrome green + magenta on every grade; the grade only retunes the metal.
export function simianPalette(grade) {
  const g = GRADE_NAMES.includes(grade) ? grade : 'neon';
  const base = {
    neon: { fur: '#150a2e', face: '#e8b98a', chromeA: '#eafff3', chromeB: '#39ff88', neon: '#39ff88', visor: '#22d3ee', accent: '#ff2ea6' },
    sunset: { fur: '#160a2e', face: '#d9a06b', chromeA: '#fff7d6', chromeB: '#ffb347', neon: '#ff2ea6', visor: '#22d3ee', accent: '#39ff88' },
    midnight: { fur: '#0a0a18', face: '#c99a6b', chromeA: '#e6e9ff', chromeB: '#8a4fb8', neon: '#8a4fb8', visor: '#39ff88', accent: '#ff2ea6' },
    ink: { fur: '#0a0a0a', face: '#b9b9b9', chromeA: '#ffffff', chromeB: '#8a8a8a', neon: '#e8e8e8', visor: '#39ff88', accent: '#ff2ea6' },
  };
  return base[g];
}

// Deterministic scatter points (data motes, holo dots) inside a panel.
export function jungleSpots(w, h, count, seed) {
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: rnd() * w, y: rnd() * h, r: 1.5 + rnd() * 3.5, a: 0.25 + rnd() * 0.55 });
  }
  return out;
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

// A glowing holo banana: a crescent with a bright rim and two binary
// digits, the jungle's street sign. time bobs it a touch in the preview.
export function drawHoloBanana(ctx, x, y, size, color, time) {
  const bob = Math.sin(time * 1.3) * size * 0.04;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.42, Math.PI * 0.15, Math.PI * 0.95);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.max(9, size * 0.22)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('01', size * 0.55, -size * 0.28);
  ctx.fillText('10', -size * 0.55, size * 0.55);
  ctx.restore();
}

// Cable lianas: vines that hang from the top of the panel like power
// cables, with a glowing node where each one ends. Seeded, so the same
// panel always grows the same vines.
function drawLianas(ctx, w, h, seed, neon) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.lineCap = 'round';
  const count = 5;
  for (let i = 0; i < count; i++) {
    const x0 = w * (0.06 + (i / (count - 1)) * 0.88) + (rnd() - 0.5) * w * 0.05;
    const len = h * (0.22 + rnd() * 0.3);
    const sway = (rnd() - 0.5) * w * 0.16;
    ctx.strokeStyle = 'rgba(20, 8, 40, 0.9)';
    ctx.lineWidth = Math.max(3, w * 0.008);
    ctx.beginPath();
    ctx.moveTo(x0, -4);
    ctx.quadraticCurveTo(x0 + sway * 0.4, len * 0.55, x0 + sway, len);
    ctx.stroke();
    // A neon node at the tip, plus a leaf or two on the way down.
    ctx.fillStyle = neon;
    ctx.shadowColor = neon;
    ctx.shadowBlur = Math.max(6, w * 0.012);
    ellipse(ctx, x0 + sway, len, Math.max(3, w * 0.008), Math.max(3, w * 0.008));
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(57, 255, 136, 0.75)';
    ellipse(ctx, x0 + sway * 0.55, len * 0.55, w * 0.014, h * 0.008);
  }
  ctx.restore();
}

// Hologram towers: dark slabs with neon window grids and a beacon antenna.
function drawHoloTowers(ctx, w, h, seed, palette) {
  const rnd = mulberry32(seed);
  const base = h * 0.82;
  ctx.save();
  let x = -w * 0.02;
  while (x < w) {
    const bw = w * (0.09 + rnd() * 0.11);
    const bh = h * (0.18 + rnd() * 0.34);
    const grad = ctx.createLinearGradient(x, base - bh, x, base);
    grad.addColorStop(0, '#1c0b3d');
    grad.addColorStop(1, '#0a0618');
    ctx.fillStyle = grad;
    ctx.fillRect(x, base - bh, bw, bh + h * 0.18);
    // Neon window grid, deterministic per tower.
    const cols = Math.max(2, Math.floor(bw / (w * 0.03)));
    const rows = Math.max(3, Math.floor(bh / (h * 0.05)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() > 0.62) {
          ctx.fillStyle = rnd() > 0.5 ? palette.neon : palette.visor;
          ctx.globalAlpha = 0.55 + rnd() * 0.4;
          ctx.fillRect(x + bw * 0.14 + c * (bw * 0.72 / cols), base - bh + bh * 0.1 + r * (bh * 0.8 / rows), Math.max(2, bw * 0.09), Math.max(2, bh * 0.05));
        }
      }
    }
    ctx.globalAlpha = 1;
    // Antenna beacon.
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(x + bw / 2, base - bh);
    ctx.lineTo(x + bw / 2, base - bh - h * 0.05);
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ellipse(ctx, x + bw / 2, base - bh - h * 0.055, Math.max(2, w * 0.005), Math.max(2, w * 0.005));
    x += bw + w * 0.03;
  }
  ctx.restore();
}

// The cyber jungle backdrop for a procedural panel: magenta-cyan sky,
// a holo sun, towers, lianas, a small holo banana and drifting data motes.
// time is 0 for exports (frozen); the live preview passes a moving time.
export function drawCyberJungle(ctx, w, h, grade, seed, time) {
  const palette = simianPalette(grade);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (grade === 'neon') {
    sky.addColorStop(0, '#0b0620');
    sky.addColorStop(0.45, '#3d0a5e');
    sky.addColorStop(0.75, '#a4136b');
    sky.addColorStop(1, '#0e2a1a');
  } else if (grade === 'midnight') {
    sky.addColorStop(0, '#050510');
    sky.addColorStop(0.5, '#2b2a6b');
    sky.addColorStop(1, '#0a0a18');
  } else if (grade === 'ink') {
    sky.addColorStop(0, '#000000');
    sky.addColorStop(0.6, '#242424');
    sky.addColorStop(1, '#000000');
  } else {
    sky.addColorStop(0, '#2b0f4d');
    sky.addColorStop(0.5, '#e0396b');
    sky.addColorStop(1, '#160a2e');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Holo sun: a ringed disc with retro slats, low over the towers.
  const sx = w * 0.72;
  const sy = h * 0.34;
  const sr = Math.min(w, h) * 0.13;
  ctx.save();
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = sr * 0.6;
  const disc = ctx.createLinearGradient(sx, sy - sr, sx, sy + sr);
  disc.addColorStop(0, '#fff7d6');
  disc.addColorStop(0.5, palette.accent);
  disc.addColorStop(1, palette.neon);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(11, 6, 32, 0.85)';
  let y = sy + sr * 0.05;
  let gap = 3;
  while (y < sy + sr) {
    ctx.fillRect(sx - sr, y, sr * 2, gap);
    y += gap + 9;
    gap += 3;
  }
  ctx.restore();

  drawHoloTowers(ctx, w, h, seed + 5, palette);
  drawLianas(ctx, w, h, seed + 11, palette.neon);
  drawHoloBanana(ctx, w * 0.16, h * 0.2, Math.min(w, h) * 0.09, palette.neon, time || 0);

  // Data motes: tiny glowing dots that drift a little with time.
  const spots = jungleSpots(w, h, 26, seed + 23);
  ctx.save();
  for (const s of spots) {
    const drift = (time || 0) * 6;
    ctx.globalAlpha = s.a;
    ctx.fillStyle = palette.visor;
    ellipse(ctx, (s.x + drift) % w, s.y, s.r, s.r);
  }
  ctx.restore();

  // Ground glow line.
  ctx.save();
  ctx.fillStyle = palette.neon;
  ctx.shadowColor = palette.neon;
  ctx.shadowBlur = Math.max(8, w * 0.02);
  ctx.fillRect(0, h * 0.82, w, Math.max(2, h * 0.006));
  ctx.restore();
}

// Simian Prime: the hero chimp of the cyber jungle, drawn from the
// landmarks above. Chrome jacket, neon visor, headset, holo banana at
// his shoulder. Everything is placed from simianLandmarks(), so the
// portrait is the same face the tests check.
export function drawSimian(ctx, w, h, grade, seed, time, view) {
  const L = simianLandmarks(w, h, view);
  const { s } = L;
  const p = simianPalette(grade);
  ctx.save();

  // A soft halo behind the head, so the dark fur never melts into the
  // dark jungle sky: the silhouette must read at a glance.
  const halo = ctx.createRadialGradient(L.head.cx, L.head.cy, L.head.rx * 0.4, L.head.cx, L.head.cy, L.head.rx * 1.5);
  halo.addColorStop(0, grade === 'neon' ? 'rgba(57, 255, 136, 0.20)' : 'rgba(255, 46, 166, 0.18)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(L.head.cx - L.head.rx * 1.6, L.head.cy - L.head.ry * 1.6, L.head.rx * 3.2, L.head.ry * 3.2);

  // --- Chrome jacket: shoulders and torso, cropped by the panel clip.
  const jacket = ctx.createLinearGradient(0, L.shoulders.y - s * 0.3, 0, h);
  jacket.addColorStop(0, p.chromeA);
  jacket.addColorStop(0.35, p.chromeB);
  jacket.addColorStop(1, '#0d0a1f');
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(L.cx - L.shoulders.halfW, h);
  ctx.quadraticCurveTo(L.cx - L.shoulders.halfW * 0.92, L.shoulders.y, L.cx - s * 0.16, L.shoulders.y - s * 0.08);
  ctx.lineTo(L.cx + s * 0.16, L.shoulders.y - s * 0.08);
  ctx.quadraticCurveTo(L.cx + L.shoulders.halfW * 0.92, L.shoulders.y, L.cx + L.shoulders.halfW, h);
  ctx.closePath();
  ctx.fill();
  // Neon piping along the shoulders + centre zipper.
  ctx.strokeStyle = p.neon;
  ctx.shadowColor = p.neon;
  ctx.shadowBlur = s * 0.02;
  ctx.lineWidth = Math.max(2, s * 0.012);
  ctx.beginPath();
  ctx.moveTo(L.cx - L.shoulders.halfW * 0.86, L.shoulders.y + s * 0.02);
  ctx.quadraticCurveTo(L.cx - s * 0.2, L.shoulders.y - s * 0.06, L.cx - s * 0.16, L.shoulders.y - s * 0.08);
  ctx.moveTo(L.cx + L.shoulders.halfW * 0.86, L.shoulders.y + s * 0.02);
  ctx.quadraticCurveTo(L.cx + s * 0.2, L.shoulders.y - s * 0.06, L.cx + s * 0.16, L.shoulders.y - s * 0.08);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(13, 10, 31, 0.85)';
  ctx.lineWidth = Math.max(2, s * 0.014);
  ctx.beginPath();
  ctx.moveTo(L.cx, L.shoulders.y - s * 0.06);
  ctx.lineTo(L.cx, h);
  ctx.stroke();
  // Chest badge: a hex with the jungle's S.
  ctx.fillStyle = 'rgba(13, 10, 31, 0.9)';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = L.cx - s * 0.24 + Math.cos(a) * s * 0.055;
    const py = L.shoulders.y + s * 0.12 + Math.sin(a) * s * 0.055;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.neon;
  ctx.font = `900 ${s * 0.07}px "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', L.cx - s * 0.24, L.shoulders.y + s * 0.125);

  // --- Neck and head fur.
  ctx.fillStyle = p.fur;
  ctx.fillRect(L.cx - s * 0.07, L.head.cy + s * 0.16, s * 0.14, s * 0.16);
  // Cheek tufts: darker fur bulges that frame the face plate.
  ellipse(ctx, L.head.cx - L.head.rx * 0.82, L.head.cy + s * 0.1, s * 0.13, s * 0.15);
  ellipse(ctx, L.head.cx + L.head.rx * 0.82, L.head.cy + s * 0.1, s * 0.13, s * 0.15);
  // Cranium.
  ellipse(ctx, L.head.cx, L.head.cy, L.head.rx, L.head.ry);
  // Brow tuft on top.
  ellipse(ctx, L.head.cx, L.head.cy - L.head.ry * 0.86, s * 0.16, s * 0.07);
  // Neon rim light around the cranium: the silhouette must separate from
  // the dark sky even where the fur is nearly black.
  ctx.save();
  ctx.strokeStyle = p.neon;
  ctx.shadowColor = p.neon;
  ctx.shadowBlur = s * 0.025;
  ctx.lineWidth = Math.max(2, s * 0.01);
  ctx.beginPath();
  ctx.ellipse(L.head.cx, L.head.cy, L.head.rx, L.head.ry, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();

  // --- Ears: big rounds sticking out past the head, skin inside.
  for (const ear of [L.earL, L.earR]) {
    ctx.fillStyle = p.fur;
    ellipse(ctx, ear.x, ear.y, ear.r, ear.r);
    ctx.fillStyle = p.face;
    ellipse(ctx, ear.x, ear.y, ear.r * 0.55, ear.r * 0.55);
    ctx.fillStyle = 'rgba(13, 10, 31, 0.55)';
    ellipse(ctx, ear.x, ear.y, ear.r * 0.28, ear.r * 0.28);
  }

  // --- Bare face plate: brow band + heart-shaped muzzle in skin tone.
  ctx.fillStyle = p.face;
  ellipse(ctx, L.head.cx, L.eyeL.y - s * 0.01, s * 0.21, s * 0.075);
  // Muzzle: two cheek lobes and a chin, one path.
  ctx.beginPath();
  ctx.moveTo(L.muzzle.cx - L.muzzle.rx * 0.9, L.muzzle.cy - L.muzzle.ry * 0.2);
  ctx.bezierCurveTo(
    L.muzzle.cx - L.muzzle.rx * 1.15, L.muzzle.cy + L.muzzle.ry * 0.55,
    L.muzzle.cx - L.muzzle.rx * 0.5, L.muzzle.cy + L.muzzle.ry,
    L.muzzle.cx, L.muzzle.cy + L.muzzle.ry * 0.95,
  );
  ctx.bezierCurveTo(
    L.muzzle.cx + L.muzzle.rx * 0.5, L.muzzle.cy + L.muzzle.ry,
    L.muzzle.cx + L.muzzle.rx * 1.15, L.muzzle.cy + L.muzzle.ry * 0.55,
    L.muzzle.cx + L.muzzle.rx * 0.9, L.muzzle.cy - L.muzzle.ry * 0.2,
  );
  ctx.bezierCurveTo(
    L.muzzle.cx + L.muzzle.rx * 0.5, L.muzzle.cy - L.muzzle.ry * 0.75,
    L.muzzle.cx - L.muzzle.rx * 0.5, L.muzzle.cy - L.muzzle.ry * 0.75,
    L.muzzle.cx - L.muzzle.rx * 0.9, L.muzzle.cy - L.muzzle.ry * 0.2,
  );
  ctx.closePath();
  ctx.fill();

  // --- Neon visor: a glowing band across the eyes, with two lens dots.
  ctx.save();
  ctx.shadowColor = p.visor;
  ctx.shadowBlur = s * 0.03;
  ctx.fillStyle = p.visor;
  roundRectPath(ctx, L.visor.x, L.visor.y - L.visor.h / 2, L.visor.w, L.visor.h, L.visor.h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b0620';
  ellipse(ctx, L.eyeL.x, L.eyeL.y, L.eyeL.r * 0.62, L.eyeL.r * 0.62);
  ellipse(ctx, L.eyeR.x, L.eyeR.y, L.eyeR.r * 0.62, L.eyeR.r * 0.62);
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, L.eyeL.x - L.eyeL.r * 0.2, L.eyeL.y - L.eyeL.r * 0.2, L.eyeL.r * 0.2, L.eyeL.r * 0.2);
  ellipse(ctx, L.eyeR.x - L.eyeR.r * 0.2, L.eyeR.y - L.eyeR.r * 0.2, L.eyeR.r * 0.2, L.eyeR.r * 0.2);
  ctx.restore();

  // --- Nose + mouth on the muzzle.
  ctx.fillStyle = '#241428';
  ellipse(ctx, L.muzzle.cx - s * 0.035, L.muzzle.cy + s * 0.005, s * 0.022, s * 0.016);
  ellipse(ctx, L.muzzle.cx + s * 0.035, L.muzzle.cy + s * 0.005, s * 0.022, s * 0.016);
  ctx.strokeStyle = '#241428';
  ctx.lineWidth = Math.max(2, s * 0.01);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(L.muzzle.cx - s * 0.05, L.muzzle.cy + s * 0.055);
  ctx.quadraticCurveTo(L.muzzle.cx, L.muzzle.cy + s * 0.085, L.muzzle.cx + s * 0.05, L.muzzle.cy + s * 0.055);
  ctx.stroke();
  // Chin highlight so the muzzle reads as a separate face plate.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1.5, s * 0.006);
  ctx.beginPath();
  ctx.moveTo(L.muzzle.cx - s * 0.09, L.muzzle.cy + s * 0.075);
  ctx.quadraticCurveTo(L.muzzle.cx, L.muzzle.cy + s * 0.105, L.muzzle.cx + s * 0.09, L.muzzle.cy + s * 0.075);
  ctx.stroke();

  // --- Headset: chrome band hugging the crown, magenta ear cups.
  ctx.strokeStyle = p.chromeA;
  ctx.lineWidth = Math.max(4, s * 0.02);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(L.head.cx, L.head.cy, L.head.rx * 0.95, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  for (const ear of [L.earL, L.earR]) {
    ctx.fillStyle = '#1c0b3d';
    roundRectPath(ctx, ear.x - s * 0.045, ear.y - s * 0.06, s * 0.09, s * 0.12, s * 0.03);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.shadowColor = p.accent;
    ctx.shadowBlur = s * 0.02;
    ellipse(ctx, ear.x, ear.y, s * 0.018, s * 0.018);
    ctx.shadowBlur = 0;
  }

  // --- Holo banana floating at his shoulder, placed from the face
  // centre so it stays inside diagonal panels too.
  drawHoloBanana(ctx, L.cx + s * 0.42, L.cy - s * 0.3, s * 0.11, p.neon, time || 0);
  ctx.restore();
}
