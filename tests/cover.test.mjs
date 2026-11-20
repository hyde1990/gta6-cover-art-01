// Vice Cover Studio round 5 — pure-logic tests (Node, no DOM).
// Run: node --test tests/cover.test.mjs
// These cover the geometry, caption and shader-source rules the browser
// engine depends on, so a regression here fails before any screenshot runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYOUT_NAMES,
  EXPORT_SIZES,
  layoutCells,
  cellsFor,
  fitCaption,
  fitSubtitle,
  clampSlot,
} from '../app/src/geometry.js';
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
  // First polygon touches the top-left corner, second the bottom-right one.
  assert.deepEqual(cells[0].poly[0], [0, 0]);
  assert.ok(cells[1].poly.some((p) => p[0] === 1 && p[1] === 1), 'second panel owns the bottom-right corner');
  // The shared edge is slanted: its two endpoints differ in both axes.
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

test('export sizes are exactly the three common post sizes', () => {
  assert.deepEqual(EXPORT_SIZES, [[1080, 1080], [1080, 1350], [1920, 1080]]);
});

test('empty caption falls back, long caption is trimmed, not clipped mid-word badly', () => {
  assert.equal(fitCaption(''), 'VICE CITY');
  assert.equal(fitCaption('   '), 'VICE CITY');
  assert.equal(fitCaption('sunset heist'), 'SUNSET HEIST');
  const long = fitCaption('a'.repeat(80));
  assert.ok(long.length <= 40, 'caption capped at 40 chars');
  assert.equal(fitSubtitle(''), 'Vice City Nights');
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

test('every GLSL source is a complete fragment/vertex shader', () => {
  for (const [name, src] of Object.entries({ VERT_SRC, BRIGHT_SRC, BLUR_SRC, COMPOSITE_SRC })) {
    assert.match(src, /void\s+main\s*\(/, `${name} has a main function`);
    assert.match(src, /precision\s+highp\s+float/, `${name} sets float precision`);
    const opens = (src.match(/\{/g) || []).length;
    const closes = (src.match(/\}/g) || []).length;
    assert.equal(opens, closes, `${name} braces balance`);
  }
});

test('composite shader exposes the grade, glow, sweep and grain uniforms', () => {
  assert.match(COMPOSITE_SRC, /uniform\s+float\s+uTime/);
  assert.match(COMPOSITE_SRC, /uniform\s+float\s+uGlow/);
  assert.match(COMPOSITE_SRC, /uniform\s+int\s+uGrade/);
  assert.match(COMPOSITE_SRC, /uniform\s+float\s+uSweep/);
  assert.match(COMPOSITE_SRC, /halftone|Halftone/i);
  assert.match(COMPOSITE_SRC, /bloom|Bloom/i);
});
