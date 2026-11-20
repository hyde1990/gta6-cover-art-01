// Vice Cover Studio round 6: wires the page. State, history (undo/redo),
// panel drag, photo upload, caption editing, the WebGL2 grade pipeline and
// PNG export. A `?shot=` query sets up a fixed scene for a screenshot
// instead (./shots.js). Round 6 defaults to the Simian Cyber World: the
// Slash layout, a Simian Prime hero panel, the neon grade and a SIMIAN
// CITY caption — the user can swap any panel for their own photo.
import { drawCoverBase, applyFallbackGrade, layoutCells, cellsFor } from './cover.js';
import { GradePipeline } from './glfx.js';
import { runShot } from './shots.js';
import { EXPORT_SIZES, clampSlot } from './geometry.js';

export const DEFAULT_STATE = {
  layout: 'slash',
  slots: [
    { kind: 'simian', zoom: 1, dx: 0, dy: 0 },
    { kind: 'procedural', zoom: 1, dx: 0, dy: 0 },
    { kind: 'procedural', zoom: 1, dx: 0, dy: 0 },
  ],
  caption: 'Simian City',
  subtitle: 'Cyber Jungle Nights',
  grade: 'neon',
  glow: 0.7,
  sweep: true,
};

function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Point-in-polygon hit test, so the diagonal slash panels are clickable
// exactly where they are drawn (a bounding box would overlap the other one).
export function hitCell(layout, px, py) {
  const cells = layoutCells(layout);
  const idx = cellsFor(layout);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.poly) {
      let inside = false;
      for (let a = 0, b = c.poly.length - 1; a < c.poly.length; b = a++) {
        const [ax, ay] = c.poly[a];
        const [bx, by] = c.poly[b];
        if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) {
          inside = !inside;
        }
      }
      if (inside) return idx[i];
    } else if (px >= c.x && px < c.x + c.w && py >= c.y && py < c.y + c.h) {
      return idx[i];
    }
  }
  return 0;
}

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const images = { boulevard: null, pier: null, uploads: new Map() };

// The base cover is painted on this offscreen 2D canvas; the visible canvas
// shows it after the GPU grade (or the 2D fallback when WebGL2 is missing).
const baseCanvas = document.createElement('canvas');
const baseCtx = baseCanvas.getContext('2d');
const pipeline = new GradePipeline();
const glOn = pipeline.init(canvas);
let baseVersion = 0;
let shotMode = false;

let state = cloneState(DEFAULT_STATE);
let selected = 0;
const past = [];
const future = [];

// History rule: snapshot the state BEFORE a change starts, commit it to the
// undo stack only when the change ends. That way undo restores the state
// from before the edit, not the edited state itself.
let pendingBefore = null;
function beginChange() {
  if (pendingBefore === null) pendingBefore = cloneState(state);
}
function commitChange() {
  if (pendingBefore === null) return;
  past.push(pendingBefore);
  if (past.length > 60) past.shift();
  pendingBefore = null;
  future.length = 0;
  syncHistoryButtons();
}

function applyState(next) {
  state = cloneState(next);
  baseVersion++;
  render(0);
  syncControls();
}

function undo() {
  if (!past.length) return;
  future.push(cloneState(state));
  applyState(past.pop());
  syncHistoryButtons();
}

function redo() {
  if (!future.length) return;
  past.push(cloneState(state));
  applyState(future.pop());
  syncHistoryButtons();
}

function syncHistoryButtons() {
  const u = document.getElementById('undo');
  const r = document.getElementById('redo');
  if (u) u.disabled = !past.length;
  if (r) r.disabled = !future.length;
}

function paintBase(w, h) {
  if (baseCanvas.width !== w || baseCanvas.height !== h) {
    baseCanvas.width = w;
    baseCanvas.height = h;
  }
  drawCoverBase(baseCtx, w, h, state, images);
}

// time: seconds of animation (0 = frozen, for shots and exports).
// The 2D base is repainted only when the state changed (baseVersion), so
// the animation loop only re-runs the GPU composite, not the whole painting.
let paintedVersion = -1;
function render(time) {
  const w = canvas.width;
  const h = canvas.height;
  if (paintedVersion !== baseVersion || baseCanvas.width !== w || baseCanvas.height !== h) {
    paintBase(w, h);
    paintedVersion = baseVersion;
  }
  if (glOn) {
    pipeline.render(baseCanvas, {
      grade: state.grade,
      glow: state.glow,
      time,
      sweep: state.sweep,
    }, baseVersion);
  } else {
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseCanvas, 0, 0);
    applyFallbackGrade(ctx, w, h, state.grade);
  }
  // Selection outline on the chosen panel (editor only, never in shots).
  // Only in the 2D-fallback path: a canvas with a WebGL2 context cannot
  // hand out a 2D one, so this block must not touch it when the GPU is on.
  if (!shotMode && !glOn) {
    const ctx = canvas.getContext('2d');
    const cells = layoutCells(state.layout);
    const idx = cellsFor(state.layout);
    const cellIndex = idx.indexOf(selected);
    if (cellIndex >= 0) {
      const c = cells[cellIndex];
      ctx.save();
      ctx.strokeStyle = '#39ff88';
      ctx.lineWidth = Math.max(3, w * 0.005);
      ctx.setLineDash([18, 10]);
      if (c.poly) {
        ctx.beginPath();
        c.poly.forEach(([px, py], i) => {
          if (i === 0) ctx.moveTo(px * w, py * h);
          else ctx.lineTo(px * w, py * h);
        });
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeRect(c.x * w + 2, c.y * h + 2, c.w * w - 4, c.h * h - 4);
      }
      ctx.restore();
    }
  }
}

function syncControls() {
  const cap = document.getElementById('caption');
  const sub = document.getElementById('subtitle');
  if (cap && cap.value !== state.caption) cap.value = state.caption;
  if (sub && sub.value !== state.subtitle) sub.value = state.subtitle;
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  const zoom = document.getElementById('zoom');
  const shiftX = document.getElementById('shiftx');
  const shiftY = document.getElementById('shifty');
  const glow = document.getElementById('glow');
  const sweep = document.getElementById('sweep');
  const slot = state.slots[selected];
  if (zoom) zoom.value = slot.zoom;
  if (shiftX) shiftX.value = slot.dx;
  if (shiftY) shiftY.value = slot.dy;
  if (glow) glow.value = state.glow;
  if (sweep) sweep.checked = state.sweep;
  const label = document.getElementById('slot-label');
  if (label) label.textContent = `Panel ${selected + 1} — ${slot.kind}`;
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// Export the cover at an exact size. The GPU grade runs with time frozen,
// so two exports of the same state are byte-identical.
export function exportCover(w, h) {
  if (!EXPORT_SIZES.some(([ew, eh]) => ew === w && eh === h)) {
    throw new Error(`Vice Cover Studio cannot export ${w}x${h}: use 1080x1080, 1080x1350 or 1920x1080`);
  }
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCoverBase(off.getContext('2d'), w, h, state, images);
  if (glOn) {
    const glCanvas = document.createElement('canvas');
    glCanvas.width = w;
    glCanvas.height = h;
    const pipe = new GradePipeline();
    if (pipe.init(glCanvas)) {
      pipe.render(off, { grade: state.grade, glow: state.glow, time: 0, sweep: false }, 1);
      return glCanvas.toDataURL('image/png');
    }
  }
  applyFallbackGrade(off.getContext('2d'), w, h, state.grade);
  return off.toDataURL('image/png');
}
window.__exportCover = exportCover;
// Headless test hook: lets the probe script set state and export covers.
window.__viceStudio = {
  exportCover,
  applyState,
  getState: () => cloneState(state),
};

function downloadExport(w, h) {
  const a = document.createElement('a');
  a.href = exportCover(w, h);
  a.download = `simian-cover-${w}x${h}.png`;
  a.click();
  setStatus(`Saved simian-cover-${w}x${h}.png`);
}

async function initImages() {
  const [b, p] = await Promise.all([
    loadImage('samples/boulevard.jpg'),
    loadImage('samples/pier.jpg'),
  ]);
  images.boulevard = b;
  images.pier = p;
}

function wireControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.addEventListener('click', () => {
      beginChange();
      state.layout = b.dataset.layout;
      selected = 0;
      commitChange();
      baseVersion++;
      render(0);
      syncControls();
    });
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.addEventListener('click', () => {
      beginChange();
      state.grade = b.dataset.grade;
      commitChange();
      baseVersion++;
      render(0);
      syncControls();
    });
  });
  document.querySelectorAll('[data-slot-kind]').forEach((b) => {
    b.addEventListener('click', () => {
      beginChange();
      state.slots[selected].kind = b.dataset.slotKind;
      commitChange();
      baseVersion++;
      render(0);
      syncControls();
    });
  });
  const cap = document.getElementById('caption');
  cap.addEventListener('focus', beginChange);
  cap.addEventListener('input', () => {
    beginChange();
    state.caption = cap.value;
    baseVersion++;
    render(0);
  });
  cap.addEventListener('change', commitChange);
  const sub = document.getElementById('subtitle');
  sub.addEventListener('focus', beginChange);
  sub.addEventListener('input', () => {
    beginChange();
    state.subtitle = sub.value;
    baseVersion++;
    render(0);
  });
  sub.addEventListener('change', commitChange);
  const zoom = document.getElementById('zoom');
  zoom.addEventListener('pointerdown', beginChange);
  zoom.addEventListener('input', () => {
    beginChange();
    state.slots[selected] = clampSlot({ ...state.slots[selected], zoom: Number(zoom.value) });
    baseVersion++;
    render(0);
  });
  zoom.addEventListener('change', commitChange);
  const shiftX = document.getElementById('shiftx');
  shiftX.addEventListener('pointerdown', beginChange);
  shiftX.addEventListener('input', () => {
    beginChange();
    state.slots[selected] = clampSlot({ ...state.slots[selected], dx: Number(shiftX.value) });
    baseVersion++;
    render(0);
  });
  shiftX.addEventListener('change', commitChange);
  const shiftY = document.getElementById('shifty');
  shiftY.addEventListener('pointerdown', beginChange);
  shiftY.addEventListener('input', () => {
    beginChange();
    state.slots[selected] = clampSlot({ ...state.slots[selected], dy: Number(shiftY.value) });
    baseVersion++;
    render(0);
  });
  shiftY.addEventListener('change', commitChange);
  const glow = document.getElementById('glow');
  glow.addEventListener('pointerdown', beginChange);
  glow.addEventListener('input', () => {
    beginChange();
    state.glow = Number(glow.value);
    render(0);
  });
  glow.addEventListener('change', commitChange);
  const sweep = document.getElementById('sweep');
  sweep.addEventListener('change', () => {
    beginChange();
    state.sweep = sweep.checked;
    commitChange();
    render(0);
  });

  const upload = document.getElementById('upload');
  upload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await loadImage(URL.createObjectURL(file));
    beginChange();
    images.uploads.set(selected, img);
    state.slots[selected].kind = 'upload';
    commitChange();
    baseVersion++;
    render(0);
    syncControls();
    setStatus(`Panel ${selected + 1} uses your photo: ${file.name}`);
  });

  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', () => {
      const [w, h] = b.dataset.export.split('x').map(Number);
      downloadExport(w, h);
    });
  });
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('redo').addEventListener('click', redo);

  // Click a panel to select it; drag it to pan its photo. Only a real drag
  // (more than a few pixels) writes history, so plain clicks stay cheap.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    selected = hitCell(state.layout, px, py);
    drag = { x: e.clientX, y: e.clientY, moved: false, before: cloneState(state) };
    canvas.setPointerCapture(e.pointerId);
    render(0);
    syncControls();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dxPx = e.clientX - drag.x;
    const dyPx = e.clientY - drag.y;
    if (Math.abs(dxPx) + Math.abs(dyPx) > 4) drag.moved = true;
    if (!drag.moved) return;
    const rect = canvas.getBoundingClientRect();
    const slot = state.slots[selected];
    state.slots[selected] = clampSlot({
      ...slot,
      dx: slot.dx + (dxPx / rect.width) * 10,
      dy: slot.dy + (dyPx / rect.height) * 10,
    });
    drag.x = e.clientX;
    drag.y = e.clientY;
    baseVersion++;
    render(0);
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && drag.moved) {
      past.push(drag.before);
      if (past.length > 60) past.shift();
      future.length = 0;
      syncHistoryButtons();
      syncControls();
    }
    drag = null;
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
    ) {
      e.preventDefault();
      redo();
    }
  });
}

// The live preview animates the sunset light sweep and the data particles;
// shots and exports use a frozen frame instead, so they are reproducible.
function animate(start) {
  if (shotMode) return;
  const tick = (now) => {
    if (shotMode) return;
    render(((now - start) / 1000) % 60);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  shotMode = true;
  await initImages();
  await runShot(shot, params, { state, images, render, applyState, syncControls });
} else {
  await initImages();
  wireControls();
  baseVersion++;
  render(0);
  syncControls();
  syncHistoryButtons();
  animate(performance.now());
}
