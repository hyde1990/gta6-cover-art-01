// Wires Vice Cover Studio: layout + slots + crop + words + export, with
// undo/redo history and pointer-drag repositioning on the canvas.
import { renderCover, renderAt, LAYOUTS } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const captionEl = document.getElementById('caption');
const subtitleEl = document.getElementById('subtitle');
const backdropEl = document.getElementById('backdrop');
const sizeEl = document.getElementById('size');
const sourceEl = document.getElementById('source');
const uploadEl = document.getElementById('upload');
const zoomEl = document.getElementById('zoom');
const zoomVal = document.getElementById('zoomVal');
const shiftXEl = document.getElementById('shiftX');
const shiftYEl = document.getElementById('shiftY');

const imageCache = new Map();

function loadImage(url) {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function freshPanel(kind, src) {
  return { kind, src, zoom: 1.15, dx: 0, dy: 0, img: null };
}

function defaultState() {
  return {
    layout: 'trio',
    size: '1080x1080',
    caption: 'VICE CITY',
    subtitle: 'neon nights in leonida',
    backdrop: 'sunset',
    selected: 0,
    panels: [
      freshPanel('sample', 'samples/boulevard.jpg'),
      freshPanel('sample', 'samples/pier.jpg'),
      freshPanel('sunset', ''),
    ],
  };
}

let state = defaultState();
let past = [];
let future = [];

function snapshot() {
  return JSON.parse(JSON.stringify({
    layout: state.layout, size: state.size, caption: state.caption,
    subtitle: state.subtitle, backdrop: state.backdrop,
    selected: state.selected,
    panels: state.panels.map((p) => ({ kind: p.kind, src: p.src, zoom: p.zoom, dx: p.dx, dy: p.dy })),
  }));
}

function pushHistory() {
  past.push(snapshot());
  if (past.length > 40) past.shift();
  future = [];
}

async function hydrate(snap) {
  state = {
    layout: snap.layout, size: snap.size, caption: snap.caption,
    subtitle: snap.subtitle, backdrop: snap.backdrop, selected: snap.selected,
    panels: snap.panels.map((p) => ({ ...p, img: null })),
  };
  for (const p of state.panels) {
    if (p.kind === 'sample' && p.src) {
      try { p.img = await loadImage(p.src); } catch { p.img = null; }
    }
  }
  syncControls();
  render();
}

function render() {
  const [w, h] = state.size.split('x').map(Number);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  renderCover(canvas, state);
}

function syncControls() {
  captionEl.value = state.caption;
  subtitleEl.value = state.subtitle;
  backdropEl.value = state.backdrop;
  sizeEl.value = state.size;
  document.querySelectorAll('#layoutRow button').forEach((b) =>
    b.classList.toggle('picked', b.dataset.layout === state.layout));
  document.querySelectorAll('#slotRow button').forEach((b) =>
    b.classList.toggle('picked', Number(b.dataset.slot) === state.selected));
  const p = state.panels[state.selected];
  // An uploaded photo has no entry in the source menu — show the upload row.
  sourceEl.value = p.kind === 'upload' ? 'upload' : p.kind === 'sunset' ? 'sunset' : p.src;
  zoomEl.value = p.zoom;
  zoomVal.textContent = `${Number(p.zoom).toFixed(2)}×`;
  shiftXEl.value = p.dx;
  shiftYEl.value = p.dy;
}

function setStatus(msg) { statusEl.textContent = msg; }

async function applySource(value) {
  const p = state.panels[state.selected];
  pushHistory();
  if (value === 'sunset') {
    Object.assign(p, { kind: 'sunset', src: '', img: null, zoom: 1, dx: 0, dy: 0 });
  } else if (value === 'upload') {
    uploadEl.click();
    past.pop(); // no change yet — the upload itself will push history
    return;
  } else {
    Object.assign(p, { kind: 'sample', src: value, zoom: 1.15, dx: 0, dy: 0 });
    try { p.img = await loadImage(value); } catch { p.img = null; }
  }
  syncControls();
  render();
}

document.querySelectorAll('#layoutRow button').forEach((b) => {
  b.addEventListener('click', () => {
    if (state.layout === b.dataset.layout) return;
    pushHistory();
    state.layout = b.dataset.layout;
    syncControls();
    render();
  });
});

document.querySelectorAll('#slotRow button').forEach((b) => {
  b.addEventListener('click', () => {
    state.selected = Number(b.dataset.slot);
    syncControls();
  });
});

sourceEl.addEventListener('change', () => applySource(sourceEl.value));
backdropEl.addEventListener('change', () => { pushHistory(); state.backdrop = backdropEl.value; render(); });
sizeEl.addEventListener('change', () => { pushHistory(); state.size = sizeEl.value; render(); });

captionEl.addEventListener('input', () => { state.caption = captionEl.value; render(); });
captionEl.addEventListener('change', () => pushHistory());
subtitleEl.addEventListener('input', () => { state.subtitle = subtitleEl.value; render(); });
subtitleEl.addEventListener('change', () => pushHistory());

zoomEl.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(zoomEl.value);
  zoomVal.textContent = `${Number(zoomEl.value).toFixed(2)}×`;
  render();
});
zoomEl.addEventListener('change', () => pushHistory());
shiftXEl.addEventListener('input', () => { state.panels[state.selected].dx = Number(shiftXEl.value); render(); });
shiftXEl.addEventListener('change', () => pushHistory());
shiftYEl.addEventListener('input', () => { state.panels[state.selected].dy = Number(shiftYEl.value); render(); });
shiftYEl.addEventListener('change', () => pushHistory());

document.getElementById('resetCrop').addEventListener('click', () => {
  pushHistory();
  const p = state.panels[state.selected];
  p.zoom = 1.15; p.dx = 0; p.dy = 0;
  syncControls();
  render();
});

uploadEl.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pushHistory();
  const p = state.panels[state.selected];
  const url = URL.createObjectURL(file);
  p.img = await loadImage(url);
  p.kind = 'upload';
  p.src = file.name;
  p.zoom = 1.15; p.dx = 0; p.dy = 0;
  syncControls();
  render();
  setStatus(`Loaded ${file.name}.`);
});

document.getElementById('undo').addEventListener('click', async () => {
  const prev = past.pop();
  if (!prev) return;
  future.push(snapshot());
  await hydrate(prev);
  setStatus('Undone.');
});
document.getElementById('redo').addEventListener('click', async () => {
  const next = future.pop();
  if (!next) return;
  past.push(snapshot());
  await hydrate(next);
  setStatus('Redone.');
});

// Drag on the canvas: reposition the selected panel's photo, or click a
// panel to select the slot that fills it. A plain click (no movement) does
// not touch history; only a real drag records an undo step.
let dragging = null;
let moved = false;
function panelAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const fx = (clientX - r.left) / r.width;
  const fy = (clientY - r.top) / r.height;
  const rects = LAYOUTS[state.layout];
  const idx = rects.findIndex((c) => fx >= c.x && fx < c.x + c.w && fy >= c.y && fy < c.y + c.h);
  return idx === -1 ? 0 : idx;
}
canvas.addEventListener('pointerdown', (e) => {
  const cell = panelAt(e.clientX, e.clientY);
  const cells = state.layout === 'grid' ? [0, 1, 2, 0] : LAYOUTS[state.layout].map((_, i) => i);
  state.selected = cells[cell];
  syncControls();
  dragging = { x: e.clientX, y: e.clientY };
  moved = false;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const r = canvas.getBoundingClientRect();
  const p = state.panels[state.selected];
  const mx = ((e.clientX - dragging.x) / r.width) * 1.4;
  const my = ((e.clientY - dragging.y) / r.height) * 1.4;
  if (Math.abs(mx) > 0.001 || Math.abs(my) > 0.001) moved = true;
  p.dx += mx;
  p.dy += my;
  p.dx = Math.max(-0.6, Math.min(0.6, p.dx));
  p.dy = Math.max(-0.6, Math.min(0.6, p.dy));
  dragging = { x: e.clientX, y: e.clientY };
  syncControls();
  render();
});
canvas.addEventListener('pointerup', () => {
  if (dragging && moved) pushHistory();
  dragging = null;
});

// Keyboard undo / redo, so the studio works without reaching for the buttons.
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.target.matches('input, select, textarea')) return;
  if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); document.getElementById('undo').click(); }
  if ((e.key.toLowerCase() === 'y') || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); document.getElementById('redo').click(); }
});

document.getElementById('export').addEventListener('click', async () => {
  const off = document.createElement('canvas');
  renderAt(off, state, state.size);
  const name = `vice-cover-${state.size}.png`;
  off.toBlob((blob) => {
    if (!blob) { setStatus('Export failed.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setStatus(`Saved ${name} (${blob.size} bytes).`);
  }, 'image/png');
});

// Test hook for headless checks: render + export as a data URL without a download.
window.__vice = {
  get state() { return state; },
  render,
  exportDataUrl() {
    const off = document.createElement('canvas');
    renderAt(off, state, state.size);
    return off.toDataURL('image/png');
  },
};

async function boot() {
  for (const p of state.panels) {
    if (p.kind === 'sample' && p.src) {
      try { p.img = await loadImage(p.src); } catch { p.img = null; }
    }
  }
  const params = new URLSearchParams(location.search);
  if (params.get('shot')) {
    await runShot(params.get('shot'), params, async (patch) => {
      pushHistory();
      await hydrate({ ...snapshot(), ...patch });
    });
  } else {
    syncControls();
    render();
  }
  window.__shotReady = true;
}

boot();
