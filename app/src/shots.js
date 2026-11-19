// Fixed scenes for headless screenshots. ?shot=cover shows the cover alone
// (the editor chrome is hidden by CSS); ?shot=editor shows the full studio.
// Query knobs: layout, photo / photo2 / photo3 (sample file name without
// extension, or "sunset"), caption, subtitle, size, backdrop.
// The `apply` callback receives a full state snapshot; window.__shotReady is
// set once the scene has been applied and painted.

const SAMPLES = { boulevard: 'samples/boulevard.jpg', pier: 'samples/pier.jpg' };

function panelFrom(name, zoom) {
  if (name === 'sunset' || !name) return { kind: 'sunset', src: '', zoom: 1, dx: 0, dy: 0 };
  return { kind: 'sample', src: SAMPLES[name] || SAMPLES.pier, zoom: zoom ?? 1.15, dx: 0, dy: 0 };
}

export async function runShot(shot, params, apply) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const layout = params.get('layout') || 'trio';
  const size = params.get('size') || '1080x1080';
  const patch = {
    layout,
    size,
    caption: params.get('caption') || 'VICE CITY',
    subtitle: params.get('subtitle') || 'neon nights in leonida',
    backdrop: params.get('backdrop') || 'sunset',
    selected: 0,
    panels: [
      panelFrom(params.get('photo') || 'boulevard', 1.25),
      panelFrom(params.get('photo2') || 'pier', 1.1),
      panelFrom(params.get('photo3') || 'sunset', 1),
    ],
  };
  // Give the grid a tighter hero crop so the four cells read differently.
  if (layout === 'grid') patch.panels[0].zoom = 1.6;
  if (layout === 'single') patch.panels[0].zoom = 1.05;
  await apply(patch);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
