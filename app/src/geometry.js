// Vice Cover Studio round 5 — pure layout, caption and slot rules.
// No DOM here, so Node tests can import this module directly; the browser
// engine (cover.js / main.js) imports the same functions.
export const LAYOUT_NAMES = ['trio', 'duo', 'single', 'grid', 'slash'];

// The three common post sizes the bounty asks for, in export order.
export const EXPORT_SIZES = [[1080, 1080], [1080, 1350], [1920, 1080]];

// Axis-aligned cells carry x/y/w/h; the slash layout carries a polygon
// instead, so its two panels meet on a slanted neon edge.
const AXIS_CELLS = {
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

// The slash cut runs from upper-right toward lower-left: panel A owns the
// top-left triangle-ish half, panel B the bottom-right one. Both polygons
// share the slanted edge (0.68, 0.32) -> (0.32, 0.68).
const SLASH_CELLS = [
  { poly: [[0, 0], [1, 0], [0.68, 0.32], [0.32, 0.68], [0, 1]] },
  { poly: [[1, 0], [0.68, 0.32], [0.32, 0.68], [0, 1], [1, 1]] },
];

export function layoutCells(layout) {
  if (layout === 'slash') return SLASH_CELLS.map((c) => ({ poly: c.poly.map((p) => [...p]) }));
  const cells = AXIS_CELLS[layout] || AXIS_CELLS.trio;
  return cells.map((c) => ({ ...c }));
}

// Which photo slot fills each cell. Grid reuses slot 0 in the fourth cell
// with a mirrored crop, so three slots still fill four cells.
export function cellsFor(layout) {
  if (layout === 'trio') return [0, 1, 2];
  if (layout === 'duo') return [0, 1];
  if (layout === 'single') return [0];
  if (layout === 'slash') return [0, 1];
  return [0, 1, 2, 0];
}

// Bounding box of a cell (polygon or rectangle), in relative coordinates.
export function cellBounds(cell) {
  const pts = cell.poly || [[cell.x, cell.y], [cell.x + cell.w, cell.y],
    [cell.x + cell.w, cell.y + cell.h], [cell.x, cell.y + cell.h]];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}

export const DEFAULT_CAPTION = 'VICE CITY';
export const DEFAULT_SUBTITLE = 'Vice City Nights';

function tidyWords(text, fallback) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 40 ? clean.slice(0, 40).trimEnd() : clean;
}

// Poster caption: uppercased, capped at 40 characters, never blank.
export function fitCaption(text) {
  return tidyWords(text, DEFAULT_CAPTION).toUpperCase();
}

export function fitSubtitle(text) {
  return tidyWords(text, DEFAULT_SUBTITLE);
}

// Clamp a slot's crop so the photo can never be zoomed or panned off its
// panel entirely; keeps drags and sliders inside a sane range.
export function clampSlot(slot) {
  const s = { ...slot };
  s.zoom = Math.max(1, Math.min(2.5, Number(s.zoom) || 1));
  s.dx = Math.max(-5, Math.min(5, Number(s.dx) || 0));
  s.dy = Math.max(-5, Math.min(5, Number(s.dy) || 0));
  return s;
}
