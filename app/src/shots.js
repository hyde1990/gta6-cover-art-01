// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos loaded;
// ?shot=cover shows one exported cover alone, rendered through the app's own export
// path at the requested post size. Query params: size=WxH, layout, caption,
// subcaption, photos (comma list of sample files), panels (JSON: per-panel crop).
// window.__shotReady is set once painted.
export async function runShot(shot, query, applyScene) {
  const sizeParam = query.get('size') ?? '1080x1080';
  const [w, h] = sizeParam.split('x').map(Number);
  const scene = {
    layout: query.get('layout') ?? 'trio',
    caption: query.get('caption') ?? 'Sunset Heist',
    subcaption: query.get('subcaption') ?? 'Vice City  •  2026',
    photos: (query.get('photos') ?? 'pier,boulevard,neon').split(',').map((f) => `${f}.jpg`),
    size: { id: 'shot', label: `${w} x ${h}`, w: Number.isFinite(w) ? w : 1080, h: Number.isFinite(h) ? h : 1080 },
  };
  const panelsParam = query.get('panels');
  if (panelsParam) {
    try { scene.panels = JSON.parse(panelsParam); } catch { /* keep defaults */ }
  }
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await applyScene(scene);
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
