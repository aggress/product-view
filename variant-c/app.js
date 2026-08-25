// Product view — smooth hover zoom
// 20x20 grid of 40px circles (20px gap) on black. Hovering a circle scales it
// smoothly to 80px (2x) whilst the neighbourhood shrinks with a smooth,
// distance-based falloff: a cosine curve from 40% at 1 cell away back to 100%
// at 5 cells, so the 1st-4th rings all get a graded shrink (40%, ~49%, 70%,
// ~91%) using Euclidean distance, so diagonals shrink a touch less than
// straight neighbours. The 40% first ring keeps a 12px edge gap between the
// 2x hovered circle (40px radius) and its neighbours (8px radius) on the
// 60px pitch. Zero slope at both ends of the curve, so no ring
// of cells visibly "snaps" into or out of the effect.
// All motion is CSS transform + a 300ms cubic-bezier(0.4, 0, 0.2, 1)
// transition (GPU composited). Works with mouse hover and touch.
// GPU layers (will-change) are only held while cells animate, so the page
// stays light on mobile.

const COLS = 20;
const ROWS = 20;
const RADIUS = 5; // cells affected beyond the hovered one
const FADE_MIN = 0.4; // scale at 1 cell distance
const FADE_MAX_DIST = 5; // distance at which circles are back to full size

const grid = document.getElementById('grid');
const stage = document.querySelector('.stage');

const cells = [];
for (let i = 0; i < ROWS * COLS; i++) {
  const img = document.createElement('img');
  img.className = 'cell';
  img.src = 'assets/circle.png';
  img.width = 40;
  img.height = 40;
  img.draggable = false;
  img.alt = '';
  grid.appendChild(img);
  cells.push(img);
}

const at = (r, c) => cells[r * COLS + c];

// Scale for cell (r,c) when (hr,hc) is hovered. 1 = unchanged.
function targetScale(r, c, hr, hc) {
  const dr = r - hr;
  const dc = c - hc;
  if (dr === 0 && dc === 0) return 2;
  const d = Math.hypot(dr, dc);
  if (d >= FADE_MAX_DIST) return 1;
  // Smooth cosine falloff: FADE_MIN at d=1 -> 1.0 at d=FADE_MAX_DIST.
  const t = (d - 1) / (FADE_MAX_DIST - 1);
  const s = 1 - (1 - FADE_MIN) * 0.5 * (1 + Math.cos(Math.PI * t));
  return Math.round(s * 1000) / 1000;
}

let active = []; // cells currently carrying a non-default scale
let current = null;

function clearAll() {
  for (const el of active) {
    el.style.removeProperty('--s');
    el.classList.remove('zoomed', 'moving');
  }
  active = [];
}

function apply(hr, hc) {
  clearAll();
  const r0 = Math.max(0, hr - RADIUS);
  const r1 = Math.min(ROWS - 1, hr + RADIUS);
  const c0 = Math.max(0, hc - RADIUS);
  const c1 = Math.min(COLS - 1, hc + RADIUS);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const s = targetScale(r, c, hr, hc);
      if (s !== 1) {
        const el = at(r, c);
        el.style.setProperty('--s', s);
        el.classList.add('zoomed', 'moving'); // GPU layer while animating
        active.push(el);
      }
    }
  }
}

function cellAt(e) {
  const rect = grid.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  // Rendered pitch (60px at full size). Derived from the rect so hover
  // tracking stays correct if the grid is scaled to fit the viewport.
  const pitch = rect.width / COLS;
  const c = Math.floor(x / pitch);
  const r = Math.floor(y / pitch);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  return { r, c };
}

grid.addEventListener('mousemove', (e) => {
  const cell = cellAt(e);
  const key = cell ? cell.r + ',' + cell.c : null;
  if (key === current) return;
  current = key;
  if (cell) apply(cell.r, cell.c);
  else clearAll();
});

grid.addEventListener('mouseleave', () => {
  current = null;
  clearAll();
});

// Touch support (mobile): tapping or dragging across the grid zooms the
// cell under the finger, the same as mouse hover. The zoom is left in place
// when the finger lifts so the user can see it.
function handleTouch(e) {
  const t = e.touches[0];
  if (!t) return;
  const cell = cellAt({ clientX: t.clientX, clientY: t.clientY });
  const key = cell ? cell.r + ',' + cell.c : null;
  if (key === current) return;
  current = key;
  if (cell) apply(cell.r, cell.c);
}

grid.addEventListener('touchstart', handleTouch, { passive: true });
grid.addEventListener('touchmove', handleTouch, { passive: true });

// Once a cell's transform transition settles, drop its GPU layer again.
grid.addEventListener('transitionend', (e) => {
  if (e.target.classList) e.target.classList.remove('moving');
});

// The full-size grid is 1180x1180px; scale the whole stage down (uniformly)
// when it would not fit on screen.
function fit() {
  const s = Math.min(
    1,
    (window.innerWidth - 32) / stage.offsetWidth,
    (window.innerHeight - 32) / stage.offsetHeight
  );
  stage.style.transform = s < 1 ? 'scale(' + s + ')' : '';
}

window.addEventListener('resize', fit);
fit();
