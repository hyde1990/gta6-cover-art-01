// Vice Cover Studio — wires the editor: photo slots, layout, panel crop/position,
// caption, sunset look, and PNG export in the three common post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { defaultState, renderCover, exportCover, panelAt, layoutPanels, EXPORT_SIZES, LAYOUTS } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = defaultState();
let selectedPanel = 0;
let exportSize = EXPORT_SIZES[0]; // 1080 x 1080 by default

const SAMPLES = [
  { file: 'pier.jpg', label: 'Pier' },
  { file: 'boulevard.jpg', label: 'Boulevard' },
  { file: 'neon.jpg', label: 'Neon street' },
];

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  renderCover(canvas, state);
  syncPanelControls();
}

function setStatus(text) {
  status.textContent = text;
}

/* ---------- photo slots ---------- */

function buildPhotoSlots() {
  const host = document.getElementById('photoSlots');
  SAMPLES.forEach((sample, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.innerHTML = `
      <img class="thumb is-empty" alt="Photo ${i + 1}" id="thumb${i}">
      <div class="slot-body">
        <div class="slot-name">Photo ${i + 1}</div>
        <div class="slot-btns">
          <label style="margin:0"><input type="file" accept="image/*" id="file${i}" hidden>
          <button type="button" data-upload="${i}">Upload&hellip;</button></label>
          <button type="button" data-sample="${sample.file}" data-slot="${i}">Sample: ${sample.label}</button>
        </div>
      </div>`;
    host.appendChild(slot);
    slot.querySelector(`[data-upload="${i}"]`).addEventListener('click', () => {
      slot.querySelector(`#file${i}`).click();
    });
    slot.querySelector(`#file${i}`).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      state.photos[i] = await loadImage(URL.createObjectURL(file));
      setThumb(i);
      setStatus(`Photo ${i + 1} loaded — ${file.name}`);
      redraw();
    });
    slot.querySelector(`[data-sample]`).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      state.photos[i] = await loadImage(`samples/${btn.dataset.sample}`);
      setThumb(i);
      setStatus(`Photo ${i + 1} loaded — sample ${btn.dataset.sample}`);
      redraw();
    });
  });
}

function setThumb(i) {
  const thumb = document.getElementById(`thumb${i}`);
  if (!thumb) return; // only three photo slots exist; extra scene photos are ignored
  const img = state.photos[i];
  if (img) {
    thumb.src = img.src;
    thumb.classList.remove('is-empty');
  } else {
    thumb.removeAttribute('src');
    thumb.classList.add('is-empty');
  }
}

/* ---------- layout ---------- */

document.getElementById('layoutRow').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-layout]');
  if (!btn || !LAYOUTS.includes(btn.dataset.layout)) return;
  state.layout = btn.dataset.layout;
  selectedPanel = 0;
  document.querySelectorAll('#layoutRow .layout-btn').forEach((b) => {
    b.classList.toggle('is-active', b === btn);
  });
  redraw();
});

/* ---------- selected panel ---------- */

const panelPhoto = document.getElementById('panelPhoto');
const panelZoom = document.getElementById('panelZoom');
const panelOx = document.getElementById('panelOx');
const panelOy = document.getElementById('panelOy');
const panelGrade = document.getElementById('panelGrade');

function panelConfig() {
  return state.panels[selectedPanel];
}

function syncPanelControls() {
  const cfg = panelConfig();
  const count = { trio: 3, duo: 2, single: 1, grid: 4 }[state.layout];
  document.getElementById('panelHint').textContent =
    `panel ${selectedPanel + 1} of ${count} — ${['hero', 'top right', 'bottom right', 'bottom left'][selectedPanel] ?? ''}`;
  panelPhoto.value = String(cfg.photo);
  panelZoom.value = cfg.zoom;
  panelOx.value = cfg.ox;
  panelOy.value = cfg.oy;
  panelGrade.value = cfg.grade;
  document.getElementById('panelZoomOut').textContent = `${cfg.zoom.toFixed(2)}×`;
  document.getElementById('panelOxOut').textContent = cfg.ox.toFixed(2);
  document.getElementById('panelOyOut').textContent = cfg.oy.toFixed(2);
  document.getElementById('panelGradeOut').textContent = `${Math.round(cfg.grade * 100)}%`;
}

panelPhoto.addEventListener('change', () => { panelConfig().photo = Number(panelPhoto.value); redraw(); });
panelZoom.addEventListener('input', () => { panelConfig().zoom = Number(panelZoom.value); redraw(); });
panelOx.addEventListener('input', () => { panelConfig().ox = Number(panelOx.value); redraw(); });
panelOy.addEventListener('input', () => { panelConfig().oy = Number(panelOy.value); redraw(); });
panelGrade.addEventListener('input', () => { panelConfig().grade = Number(panelGrade.value); redraw(); });

// Click a panel to select it; drag inside it to pan its photo.
let drag = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(state, canvas.width, canvas.height, p.x, p.y);
  if (hit < 0) return;
  selectedPanel = hit;
  const cfg = panelConfig();
  drag = { x: p.x, y: p.y, ox: cfg.ox, oy: cfg.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const cfg = panelConfig();
  // Pan in panel fractions: one full panel width of dragging moves the photo one panel width.
  const rect = layoutPanels(state.layout, canvas.width, canvas.height).panels[selectedPanel];
  const dx = (p.x - drag.x) / rect.w;
  const dy = (p.y - drag.y) / rect.h;
  if (Math.abs(dx) + Math.abs(dy) > 0.004) drag.moved = true;
  cfg.ox = Math.max(-0.5, Math.min(0.5, drag.ox + dx));
  cfg.oy = Math.max(-0.5, Math.min(0.5, drag.oy + dy));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

/* ---------- caption ---------- */

const captionInput = document.getElementById('caption');
const subcaptionInput = document.getElementById('subcaption');
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subcaptionInput.addEventListener('input', () => { state.subcaption = subcaptionInput.value; redraw(); });
document.getElementById('captionSize').addEventListener('input', (e) => {
  state.captionSize = Number(e.target.value);
  document.getElementById('captionSizeOut').textContent = `${Math.round(state.captionSize * 100)}%`;
  redraw();
});
document.getElementById('colorRow').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-color]');
  if (!btn) return;
  state.captionColor = btn.dataset.color;
  document.querySelectorAll('#colorRow .swatch').forEach((b) => {
    b.classList.toggle('is-active', b === btn);
  });
  redraw();
});
document.getElementById('slant').addEventListener('change', (e) => {
  state.slant = e.target.checked;
  redraw();
});

/* ---------- sunset look ---------- */

document.getElementById('grade').addEventListener('input', (e) => {
  state.grade = Number(e.target.value);
  document.getElementById('gradeOut').textContent = `${state.grade}%`;
  redraw();
});
for (const id of ['sun', 'grain', 'neon']) {
  document.getElementById(id).addEventListener('change', (e) => {
    state[id] = e.target.checked;
    redraw();
  });
}

/* ---------- export ---------- */

function buildExportButtons() {
  const host = document.getElementById('exportRow');
  EXPORT_SIZES.forEach((size) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'export-btn';
    btn.textContent = `PNG ${size.label}`;
    btn.dataset.size = size.id;
    if (size.id === exportSize.id) btn.classList.add('is-active-size');
    btn.addEventListener('click', () => {
      exportSize = size;
      canvas.width = size.w;
      canvas.height = size.h;
      document.querySelectorAll('#exportRow .export-btn').forEach((b) => {
        b.classList.toggle('is-active-size', b === btn);
      });
      redraw();
      const out = exportCover(state, size.w, size.h);
      out.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vice-cover-${size.w}x${size.h}.png`;
        a.click();
        setStatus(`Saved vice-cover-${size.w}x${size.h}.png (${size.w} x ${size.h} PNG)`);
      }, 'image/png');
    });
    host.appendChild(btn);
  });
}

/** Applies a shot scene (used by shots.js): loads samples, sets the state, renders. */
export async function applyShotScene(scene) {
  if (scene.layout) state.layout = scene.layout;
  if (scene.caption !== undefined) { state.caption = scene.caption; captionInput.value = scene.caption; }
  if (scene.subcaption !== undefined) { state.subcaption = scene.subcaption; subcaptionInput.value = scene.subcaption; }
  if (scene.size) {
    exportSize = scene.size;
    canvas.width = scene.size.w;
    canvas.height = scene.size.h;
  }
  if (scene.photos) {
    const loaded = await Promise.all(scene.photos.slice(0, 3).map((f) => loadImage(`samples/${f}`)));
    loaded.forEach((img, i) => { state.photos[i] = img; setThumb(i); });
  }
  if (scene.panels) {
    scene.panels.forEach((cfg, i) => { Object.assign(state.panels[i], cfg); });
  }
  if (scene.look) Object.assign(state, scene.look);
  redraw();
}

export function getState() { return state; }
export function getExportSize() { return exportSize; }

// Small test hook for the local checks (and anyone poking at the app in devtools):
// the live state plus the renderer, so a test can render any size and read its PNG.
window.__vice = { getState, getExportSize, renderCover, exportCover, panelAt, layoutPanels };

buildPhotoSlots();
buildExportButtons();

// Load the samples by default so the first paint already shows a cover.
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), applyShotScene);
} else {
  (async () => {
    state.photos[0] = await loadImage('samples/pier.jpg');
    state.photos[1] = await loadImage('samples/boulevard.jpg');
    state.photos[2] = await loadImage('samples/neon.jpg');
    state.photos.forEach((_, i) => setThumb(i));
    redraw();
  })();
}
