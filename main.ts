// Vice Cover Studio — the entrypoint for gta6-cover-art-01 (Node 22, stdlib only).
//
// What this program does: it hands the static web app in this directory's app/
// folder to the grader. It copies app/ and screenshots/ into the output directory
// and writes /output/dossier.json — the summary the judge reads — using the
// vendored make.fun library in vendor/makefun-app.ts, which must stay byte-identical
// to the kit's copy. The app itself is plain files a desktop browser loads offline
// (app/index.html plus its ES modules, no library, no network request): a
// multi-panel GTA-style cover maker with a procedural Vice City sunset, crop and
// position controls per panel, editable caption lettering, and PNG export at
// 1080x1080, 1080x1350 and 1920x1080.
//
// Try it locally first with `node serve.ts`, then open http://localhost:8080.
// To build the submission output outside the grader's container, set
// MAKEFUN_OUTPUT_DIR to stand in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's gate (reference/gate.json): only text_max_bytes
// shapes the dossier's bytes; the rest refuse an entry the scorer would refuse —
// more than 4 screenshots or one over 256 KiB, more than 993 files or 48 MiB under
// app/, or an app/ path over 1000 bytes. app/ shares /output's own 1000-entry cap
// with screenshots/ and dossier.json, so the app is kept well inside the limits.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
