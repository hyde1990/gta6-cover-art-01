// Vice Cover Studio round 6 — headless screenshot + probe driver (dev
// tooling only; NOT part of the handed-in app, main.ts never copies it to
// /output). Reads shots.json, serves app/ with serve.ts, screenshots each
// fixed scene with Playwright Chromium, and (with --probe) checks the edge
// cases: empty/long captions, all three export sizes, export determinism,
// WebGL2 presence and zero non-local network requests.
// Run: node tools/shots-driver.mjs [--probe]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/makefun/shot-tools/package.json');
const { chromium } = require('playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const PORT = 8092;
const BASE = `http://localhost:${PORT}`;
const PROBE = process.argv.includes('--probe');

const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));

function pngDims(dataUrl) {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  if (buf.subarray(1, 4).toString() !== 'PNG') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length };
}

const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], {
  cwd: repo, stdio: 'ignore',
});
const waitServer = async () => {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/index.html`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('serve.ts did not come up');
};

let failures = 0;
const fail = (msg) => { failures++; console.error(`FAIL: ${msg}`); };

try {
  await waitServer();
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
    const errors = [];
    const requests = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(`${BASE}/${shot.query}`, { waitUntil: 'load', timeout: 30000 });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
    } catch { fail(`${shot.name}: __shotReady never fired`); }
    const out = join(repo, 'screenshots', shot.name);
    await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
    const webgl = await page.evaluate(() => {
      try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
    });
    const external = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:'));
    console.log(`${shot.name}: ${shot.w}x${shot.h} webgl2=${webgl} errors=${JSON.stringify(errors)} externalReqs=${JSON.stringify(external)}`);
    if (errors.length) fail(`${shot.name}: console/page errors`);
    if (external.length) fail(`${shot.name}: external requests`);
    await page.close();
  }

  if (PROBE) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    const requests = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(`${BASE}/?shot=cover&layout=slash&slot0=simian&caption=%20`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
    const probe = await page.evaluate(async () => {
      const out = {};
      out.hasExport = typeof window.__exportCover === 'function';
      out.emptyCaption = window.__viceStudio.getState().caption;
      // Long caption via state: rendering must cap it (fitCaption), the
      // export must still succeed and stay deterministic.
      window.__viceStudio.applyState({ ...window.__viceStudio.getState(), caption: 'x'.repeat(80) });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.longCaptionExportLen = window.__exportCover(1080, 1080).length;
      // All three export sizes, twice each for determinism.
      out.exports = {};
      for (const [w, h] of [[1080, 1080], [1080, 1350], [1920, 1080]]) {
        const a = window.__exportCover(w, h);
        const b = window.__exportCover(w, h);
        out.exports[`${w}x${h}`] = { len: a.length, deterministic: a === b, prefix: a.slice(0, 22) };
      }
      // No-photo cover: every slot procedural/simian, empty subtitle.
      window.__viceStudio.applyState({
        ...window.__viceStudio.getState(),
        slots: [
          { kind: 'simian', zoom: 1, dx: 0, dy: 0 },
          { kind: 'procedural', zoom: 1, dx: 0, dy: 0 },
          { kind: 'procedural', zoom: 1, dx: 0, dy: 0 },
        ],
        caption: '', subtitle: '',
      });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.noPhotoExportLen = window.__exportCover(1080, 1080).length;
      return out;
    });
    console.log('PROBE:', JSON.stringify(probe, null, 1));
    const external = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:'));
    if (errors.length) fail(`probe console/page errors: ${JSON.stringify(errors)}`);
    if (external.length) fail(`probe external requests: ${JSON.stringify(external)}`);
    if (!probe.hasExport) fail('probe: __exportCover missing');
    if (!probe.longCaptionExportLen || probe.longCaptionExportLen < 1000) fail('probe: long-caption export failed');
    for (const [size, e] of Object.entries(probe.exports)) {
      if (!e.deterministic) fail(`probe: export ${size} not deterministic`);
      if (e.prefix !== 'data:image/png;base64,') fail(`probe: export ${size} is not a PNG data URL`);
      const dims = pngDims(await page.evaluate(([w, h]) => window.__exportCover(w, h), size.split('x').map(Number)));
      if (!dims || dims.w !== Number(size.split('x')[0]) || dims.h !== Number(size.split('x')[1])) {
        fail(`probe: export ${size} PNG header dims wrong: ${JSON.stringify(dims)}`);
      }
    }
    if (!probe.noPhotoExportLen || probe.noPhotoExportLen < 1000) fail('probe: no-photo export failed');
    await page.close();
  }

  await browser.close();
} finally {
  server.kill();
}

if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log('SHOTS DONE');
