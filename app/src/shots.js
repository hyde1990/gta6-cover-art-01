// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo; ?shot=cover shows the cover alone. `photo` picks the sample
// (samples/<photo>.jpg), `caption` the words, `layout` and `grade` the look,
// `subtitle` the neon line. window.__shotReady is set once painted.
export async function runShot(shot, query, app) {
  const { state, render, applyState, syncControls } = app;
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    // Match the canvas bitmap to the viewport so a wide shot (1280x720) is
    // rendered at that aspect instead of stretching a square bitmap.
    const canvas = document.getElementById('cover');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  if (shot === 'editor') document.body.classList.add('shot-editor');
  const next = JSON.parse(JSON.stringify(state));
  const photo = query.get('photo');
  if (photo === 'boulevard' || photo === 'pier') next.slots[0].kind = photo;
  const caption = query.get('caption');
  if (caption !== null) next.caption = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) next.subtitle = subtitle;
  const layout = query.get('layout');
  if (layout === 'trio' || layout === 'duo' || layout === 'single' || layout === 'grid') {
    next.layout = layout;
  }
  const grade = query.get('grade');
  if (grade === 'sunset' || grade === 'midnight' || grade === 'ink') next.grade = grade;
  applyState(next);
  syncControls();
  render();
  // Let the canvas paint twice before signalling readiness.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
