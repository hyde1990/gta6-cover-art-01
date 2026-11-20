// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo; ?shot=cover shows the cover alone. `photo` picks the sample
// (samples/<photo>.jpg), `caption` the words, `layout` and `grade` the look,
// `subtitle` the neon line, `glow` the bloom strength, and `slot0..2` the
// kind of each panel (simian, procedural, boulevard, pier). The frame is
// frozen (time 0), so the shot is reproducible. window.__shotReady is set
// once painted.
const LAYOUTS = ['trio', 'duo', 'single', 'grid', 'slash'];
const GRADES = ['sunset', 'midnight', 'ink', 'neon'];
const SLOT_KINDS = ['simian', 'procedural', 'boulevard', 'pier'];

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
  for (let i = 0; i < 3; i++) {
    const kind = query.get(`slot${i}`);
    if (SLOT_KINDS.includes(kind)) next.slots[i].kind = kind;
  }
  const caption = query.get('caption');
  if (caption !== null) next.caption = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) next.subtitle = subtitle;
  const layout = query.get('layout');
  if (LAYOUTS.includes(layout)) next.layout = layout;
  const grade = query.get('grade');
  if (GRADES.includes(grade)) next.grade = grade;
  const glow = query.get('glow');
  if (glow !== null && !Number.isNaN(Number(glow))) {
    next.glow = Math.max(0, Math.min(1, Number(glow)));
  }
  applyState(next);
  syncControls();
  render(0);
  // Let the canvas paint twice before signalling readiness.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
