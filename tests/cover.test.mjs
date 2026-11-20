// Vice Cover Studio round 6 — pure-logic tests (Node, no DOM).
// Run: node --test tests/cover.test.mjs
// TDD: these were written before the engine, so they fail until the
// modules exist. They pin the layout rules, the caption rules, the
// Simian Prime portrait geometry (a chimp that must read as a chimp:
// symmetric eyes, ears outside the head, muzzle below the eyes), and
// the GLSL sources the WebGL2 grade pipeline compiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYOUT_NAMES,
  EXPORT_SIZES,
  layoutCells,
  cellsFor,
  cellBounds,
  fitCaption,
  fitSubtitle,
  clampSlot,
  GRADE_NAMES,
} from '../app/src/geometry.js';
import { simianLandmarks, simianPalette, jungleSpots } from '../app/src/simian.js';
import { VERT_SRC, BRIGHT_SRC, BLUR_SRC, COMPOSITE_SRC } from '../app/src/shaders.js';

test('every layout names its slots and covers the unit square', () => {
  for (const name of LAYOUT_NAMES) {
    const cells = layoutCells(name);
    assert.ok(cells.length >= 1, `${name} has cells`);
    assert.equal(cells.length, cellsFor(name).length, `${name} cells match slots`);
    for (const cell of cells) {
      const pts = cell.poly || [[cell.x, cell.y], [cell.x + cell.w, cell.y],
        [cell.x + cell.w, cell.y + cell.h], [cell.x, cell.y + cell.h]];
      for (const [px, py] of pts) {
        assert.ok(px >= 0 && px <= 1 && py >= 0 && py <= 1, `${name} point in bounds`);
      }
    }
  }
});

test('slash layout is a true diagonal: two polygons sharing a slanted edge', () => {
  const cells = layoutCells('slash');
  assert.equal(cells.length, 2);
  assert.deepEqual(cellsFor('slash'), [0, 1]);
  assert.deepEqual(cells[0].poly[0], [0, 0]);
  assert.ok(cells[1].poly.some((p) => p[0] === 1 && p[1] === 1), 'second panel owns the bottom-right corner');
  const shared = cells[0].poly[2];
  assert.ok(shared[0] > 0.3 && shared[0] < 0.7, 'slash cut crosses the middle');
  assert.ok(shared[1] > 0.3 && shared[1] < 0.7, 'slash cut is diagonal, not vertical');
});

test('grid reuses slot 0 in the fourth cell, mirrored', () => {
  assert.deepEqual(cellsFor('grid'), [0, 1, 2, 0]);
  assert.deepEqual(cellsFor('trio'), [0, 1, 2]);
  assert.deepEqual(cellsFor('duo'), [0, 1]);
  assert.deepEqual(cellsFor('single'), [0]);
});

test('cellBounds wraps polygons and rectangles the same way', () => {
  const b = cellBounds(layoutCells('slash')[0]);
  assert.equal(b.x, 0);
  assert.equal(b.y, 0);
  assert.equal(b.w, 1);
  assert.equal(b.h, 1);
  const t = cellBounds(layoutCells('trio')[0]);
  assert.deepEqual(t, { x: 0, y: 0, w: 0.62, h: 1 });
});

test('export sizes are exactly the three common post sizes', () => {
  assert.deepEqual(EXPORT_SIZES, [[1080, 1080], [1080, 1350], [1920, 1080]]);
});

test('four grades exist and the simian neon grade is one of them', () => {
  assert.deepEqual(GRADE_NAMES, ['sunset', 'midnight', 'ink', 'neon']);
});

test('empty caption falls back, long caption is trimmed', () => {
  assert.equal(fitCaption(''), 'SIMIAN CITY');
  assert.equal(fitCaption('   '), 'SIMIAN CITY');
  assert.equal(fitCaption('cyber jungle'), 'CYBER JUNGLE');
  const long = fitCaption('a'.repeat(80));
  assert.ok(long.length <= 40, 'caption capped at 40 chars');
  assert.equal(fitSubtitle(''), 'Cyber Jungle Nights');
  assert.equal(fitSubtitle('x'.repeat(80)).length <= 40, true);
});

test('slot crop values are clamped so a photo can never be panned off-canvas', () => {
  const slot = clampSlot({ kind: 'upload', zoom: 99, dx: -99, dy: 99 });
  assert.equal(slot.zoom, 2.5);
  assert.equal(slot.dx, -5);
  assert.equal(slot.dy, 5);
  const sane = clampSlot({ kind: 'pier', zoom: 1.2, dx: 0.5, dy: -0.5 });
  assert.equal(sane.zoom, 1.2);
});

// --- Simian Prime: the procedural chimp portrait -------------------------
// The landmarks are pure geometry (no DOM), so Node can check the anatomy:
// a face that is symmetric, ears that stick out past the head, a muzzle
// below the eyes, and a visor band across both eyes. If any of these break,
// the portrait stops reading as a chimp.

test('simian landmarks are symmetric about the face centre', () => {
  const L = simianLandmarks(1000, 1000);
  const cx = L.head.cx;
  assert.ok(Math.abs((L.eyeL.x + L.eyeR.x) / 2 - cx) < 1, 'eyes centred on the head');
  assert.ok(Math.abs(L.eyeL.y - L.eyeR.y) < 1, 'eyes level with each other');
  assert.ok(Math.abs((L.earL.x + L.earR.x) / 2 - cx) < 1, 'ears centred on the head');
  assert.ok(Math.abs(L.earL.y - L.earR.y) < 1, 'ears level with each other');
  assert.ok(Math.abs(L.muzzle.cx - cx) < 1, 'muzzle centred');
});

test('simian anatomy reads in the right order: ears out, muzzle below eyes', () => {
  const L = simianLandmarks(1000, 1000);
  assert.ok(L.earL.x < L.head.cx - L.head.rx, 'left ear sticks out past the head');
  assert.ok(L.earR.x > L.head.cx + L.head.rx, 'right ear sticks out past the head');
  assert.ok(L.muzzle.cy > L.eyeL.y, 'muzzle sits below the eyes');
  assert.ok(L.muzzle.cy < L.head.cy + L.head.ry, 'muzzle stays inside the head');
  assert.ok(L.head.rx > 0.2 * 1000 * 0.5, 'head is big enough to be the hero');
  assert.ok(L.visor.y > L.eyeL.y - L.eyeL.r * 2, 'visor band crosses the eyes');
  assert.ok(L.visor.y < L.eyeL.y + L.eyeL.r * 2, 'visor band crosses the eyes');
});

test('simian landmarks scale with the canvas and stay in bounds', () => {
  for (const [w, h] of [[1080, 1080], [1080, 1350], [1920, 1080], [400, 700]]) {
    const L = simianLandmarks(w, h);
    for (const p of [L.head, L.eyeL, L.eyeR, L.earL, L.earR, L.muzzle]) {
      const x = p.cx ?? p.x;
      const y = p.cy ?? p.y;
      assert.ok(x >= -w * 0.05 && x <= w * 1.05, 'landmark x in bounds');
      assert.ok(y >= -h * 0.05 && y <= h * 1.05, 'landmark y in bounds');
    }
    // Deterministic: same input, same landmarks.
    assert.deepEqual(simianLandmarks(w, h), L);
  }
});

test('simian view recentres the head and scales it for diagonal panels', () => {
  const base = simianLandmarks(1280, 720);
  assert.equal(base.head.cx, 640);
  const framed = simianLandmarks(1280, 720, { cx: 427, cy: 240, scale: 0.78 });
  assert.equal(framed.head.cx, 427);
  assert.equal(framed.head.cy, 240);
  assert.ok(framed.head.rx < base.head.rx, 'scaled portrait is smaller');
  assert.ok(Math.abs((framed.eyeL.x + framed.eyeR.x) / 2 - 427) < 1, 'framed eyes stay centred');
  assert.ok(framed.muzzle.cy > framed.eyeL.y, 'framed muzzle still below the eyes');
});

test('simian palette is chrome-green + magenta on every grade', () => {
  for (const grade of GRADE_NAMES) {
    const p = simianPalette(grade);
    assert.ok(p.fur && p.chromeA && p.chromeB && p.neon && p.visor, `${grade} palette complete`);
    assert.match(p.neon, /^#[0-9a-f]{6}$/i, 'neon is a hex colour');
  }
  assert.equal(simianPalette('neon').neon, '#39ff88');
});

test('jungle spots are deterministic and inside the panel', () => {
  const a = jungleSpots(800, 600, 7, 42);
  const b = jungleSpots(800, 600, 7, 42);
  assert.deepEqual(a, b, 'same seed, same spots');
  assert.equal(a.length, 7);
  for (const s of a) {
    assert.ok(s.x >= 0 && s.x <= 800 && s.y >= 0 && s.y <= 600, 'spot in bounds');
    assert.ok(s.r > 0, 'spot has a radius');
  }
});

// --- GLSL -----------------------------------------------------------------

test('every GLSL source is a complete fragment/vertex shader', () => {
  for (const [name, src] of Object.entries({ VERT_SRC, BRIGHT_SRC, BLUR_SRC, COMPOSITE_SRC })) {
    assert.match(src, /void\s+main\s*\(/, `${name} has a main function`);
    assert.match(src, /precision\s+highp\s+float/, `${name} sets float precision`);
    const opens = (src.match(/\{/g) || []).length;
    const closes = (src.match(/\}/g) || []).length;
    assert.equal(opens, closes, `${name} braces balance`);
  }
});

test('composite shader exposes grade, glow, sweep, grain and data particles', () => {
  assert.match(COMPOSITE_SRC, /uniform\s+float\s+uTime/);
  assert.match(COMPOSITE_SRC, /uniform\s+float\s+uGlow/);
  assert.match(COMPOSITE_SRC, /uniform\s+int\s+uGrade/);
  assert.match(COMPOSITE_SRC, /uniform\s+float\s+uSweep/);
  assert.match(COMPOSITE_SRC, /halftone|Halftone/i);
  assert.match(COMPOSITE_SRC, /bloom|Bloom/i);
  assert.match(COMPOSITE_SRC, /particle|Particle|data/i, 'composite carries drifting data particles');
  assert.match(COMPOSITE_SRC, /uGrade\s*==\s*3/, 'composite handles the neon grade (index 3)');
});
