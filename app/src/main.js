// Vice Cover Studio: wires the page. State, history (undo/redo), panel drag,
// photo upload, caption editing and PNG export. A `?shot=` query sets up a
// fixed scene for a screenshot instead (./shots.js).
import { drawCover, LAYOUTS, cellsFor } from './cover.js';
import { runShot } from './shots.js';

export const DEFAULT_STATE = {
  layout: 'trio',
  slots: [
    { kind: 'pier', zoom: 1, dx: 0, dy: 0 },
    { kind: 'boulevard', zoom: 1, dx: 0, dy: 0 },
    { kind: 'procedural', zoom: 1, dx: 0, dy: 0 },
  ],
  caption: 'Sunset Heist',
  subtitle: 'Vice City Nights',
  grade: 'sunset',
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

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const images = { boulevard: null, pier: null, uploads: new Map() };

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
  render();
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

function render() {
  const w = canvas.width;
  const h = canvas.height;
  drawCover(ctx, w, h, state, images);
  // Selection outline on the chosen panel (editor only, never in shots).
  if (!document.body.classList.contains('shot-cover') && !document.body.classList.contains('shot-editor')) {
    const cells = LAYOUTS[state.layout];
    const idx = cellsFor(state.layout);
    const cellIndex = idx.indexOf(selected);
    if (cellIndex >= 0) {
      const c = cells[cellIndex];
      ctx.save();
      ctx.strokeStyle = '#ff2ea6';
      ctx.lineWidth = Math.max(3, w * 0.005);
      ctx.setLineDash([18, 10]);
      ctx.strokeRect(c.x * w + 2, c.y * h + 2, c.w * w - 4, c.h * h - 4);
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
  const slot = state.slots[selected];
  if (zoom) zoom.value = slot.zoom;
  if (shiftX) shiftX.value = slot.dx;
  if (shiftY) shiftY.value = slot.dy;
  const label = document.getElementById('slot-label');
  if (label) label.textContent = `Panel ${selected + 1} — ${slot.kind}`;
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// Export the cover at an exact size on an offscreen canvas.
export function exportCover(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off.getContext('2d'), w, h, state, images);
  return off.toDataURL('image/png');
}
window.__exportCover = exportCover;

function downloadExport(w, h) {
  const a = document.createElement('a');
  a.href = exportCover(w, h);
  a.download = `vice-cover-${w}x${h}.png`;
  a.click();
  setStatus(`Saved vice-cover-${w}x${h}.png`);
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
      render();
      syncControls();
    });
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.addEventListener('click', () => {
      beginChange();
      state.grade = b.dataset.grade;
      commitChange();
      render();
      syncControls();
    });
  });
  document.querySelectorAll('[data-slot-kind]').forEach((b) => {
    b.addEventListener('click', () => {
      beginChange();
      state.slots[selected].kind = b.dataset.slotKind;
      commitChange();
      render();
      syncControls();
    });
  });
  const cap = document.getElementById('caption');
  cap.addEventListener('focus', beginChange);
  cap.addEventListener('input', () => {
    beginChange();
    state.caption = cap.value;
    render();
  });
  cap.addEventListener('change', commitChange);
  const sub = document.getElementById('subtitle');
  sub.addEventListener('focus', beginChange);
  sub.addEventListener('input', () => {
    beginChange();
    state.subtitle = sub.value;
    render();
  });
  sub.addEventListener('change', commitChange);
  const zoom = document.getElementById('zoom');
  zoom.addEventListener('pointerdown', beginChange);
  zoom.addEventListener('input', () => {
    beginChange();
    state.slots[selected].zoom = Number(zoom.value);
    render();
  });
  zoom.addEventListener('change', commitChange);
  const shiftX = document.getElementById('shiftx');
  shiftX.addEventListener('pointerdown', beginChange);
  shiftX.addEventListener('input', () => {
    beginChange();
    state.slots[selected].dx = Number(shiftX.value);
    render();
  });
  shiftX.addEventListener('change', commitChange);
  const shiftY = document.getElementById('shifty');
  shiftY.addEventListener('pointerdown', beginChange);
  shiftY.addEventListener('input', () => {
    beginChange();
    state.slots[selected].dy = Number(shiftY.value);
    render();
  });
  shiftY.addEventListener('change', commitChange);

  const upload = document.getElementById('upload');
  upload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await loadImage(URL.createObjectURL(file));
    beginChange();
    images.uploads.set(selected, img);
    state.slots[selected].kind = 'upload';
    commitChange();
    render();
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
    const cells = LAYOUTS[state.layout];
    const idx = cellsFor(state.layout);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (px >= c.x && px < c.x + c.w && py >= c.y && py < c.y + c.h) {
        selected = idx[i];
        break;
      }
    }
    drag = { x: e.clientX, y: e.clientY, moved: false, before: cloneState(state) };
    canvas.setPointerCapture(e.pointerId);
    render();
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
    slot.dx = Math.max(-5, Math.min(5, slot.dx + (dxPx / rect.width) * 10));
    slot.dy = Math.max(-5, Math.min(5, slot.dy + (dyPx / rect.height) * 10));
    drag.x = e.clientX;
    drag.y = e.clientY;
    render();
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

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  await initImages();
  await runShot(shot, params, { state, images, render, applyState, syncControls });
} else {
  await initImages();
  wireControls();
  render();
  syncControls();
  syncHistoryButtons();
}
