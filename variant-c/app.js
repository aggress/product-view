// Product view — smooth hover zoom
// 20x20 grid of 40px product images (20px gap) on black. Each cell is a
// unique 160x160 photo (assets/img-1..400.jpg, randomly cropped).
// Hovering an image smoothly scales it to 160px (4x, 80px radius) whilst the
// neighbourhood both shrinks and moves outward radially to make room:
// - scale: cosine falloff from 40% at 1 cell away back to 100% at 5 cells
//   (40%, ~49%, 70%, ~91%, 100%), Euclidean distance so diagonals shrink a
//   touch less than straight neighbours.
// - push: cosine bump of up to 40px at 1 cell away, back to 0 at 5 cells
//   (40, ~34, 20, ~6, 0), so the straight neighbours end up at 100/154/200/
//   246/300px from the hovered centre with a minimum 8px edge gap to the
//   80px-radius highlight.
// Zero slope at both ends of both curves, so no ring of cells visibly
// "snaps" into or out of the effect.
// Hit-testing follows the moved cells: the hovered cell is the nearest
// transformed cell centre to the pointer (scaled for the fit transform).
// All motion is CSS transform + a 300ms cubic-bezier(0.4, 0, 0.2, 1)
// transition (GPU composited). Works with mouse hover and touch.
// GPU layers (will-change) are only held while cells animate, so the page
// stays light on mobile.

const COLS = 20;
const ROWS = 20;
const RADIUS = 5; // cells affected beyond the hovered one
const HOVER_SCALE = 4; // hovered cell scales to 160px
const FADE_MIN = 0.4; // scale at 1 cell distance
const FADE_MAX_DIST = 5; // distance at which cells are back to full size/position
const PUSH_MAX = 40; // px outward push of the first ring (clears the 80px-radius highlight)

const grid = document.getElementById('grid');
const stage = document.querySelector('.stage');

const cells = [];
for (let i = 0; i < ROWS * COLS; i++) {
  const img = document.createElement('img');
  img.className = 'cell';
  img.src = 'assets/img-' + (i + 1) + '.jpg';
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
  if (dr === 0 && dc === 0) return HOVER_SCALE;
  const d = Math.hypot(dr, dc);
  if (d >= FADE_MAX_DIST) return 1;
  // Smooth cosine falloff: FADE_MIN at d=1 -> 1.0 at d=FADE_MAX_DIST.
  const t = (d - 1) / (FADE_MAX_DIST - 1);
  const s = 1 - (1 - FADE_MIN) * 0.5 * (1 + Math.cos(Math.PI * t));
  return Math.round(s * 1000) / 1000;
}

// Outward push in grid px for a cell at distance d (cells) from the hovered
// one: cosine bump, PUSH_MAX at d=1 -> 0 at d=FADE_MAX_DIST.
function targetPush(d) {
  if (d <= 0 || d >= FADE_MAX_DIST) return 0;
  const t = (d - 1) / (FADE_MAX_DIST - 1);
  return PUSH_MAX * 0.5 * (1 + Math.cos(Math.PI * t));
}

let active = []; // cells currently carrying a non-default scale
let current = null;

function clearAll() {
  for (const el of active) {
    el.style.removeProperty('--s');
    el.style.removeProperty('--tx');
    el.style.removeProperty('--ty');
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
        // Push the cell radially away from the hovered one (grid px). The
        // hovered cell itself (d=0) is never pushed.
        const d = Math.hypot(r - hr, c - hc);
        const push = targetPush(d);
        if (push > 0) {
          el.style.setProperty('--tx', (((c - hc) / d) * push) + 'px');
          el.style.setProperty('--ty', (((r - hr) / d) * push) + 'px');
        }
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
  const k = pitch / 60; // grid px -> rendered px
  // Nearest transformed cell centre (cells may be pushed outward), so hover
  // tracking follows the moved cells. Accept within a bit more than half a
  // pitch so empty gaps between shrunken rings don't grab the pointer.
  const maxDist = pitch * 0.6;
  let best = null;
  let bestD = maxDist;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const el = cells[r * COLS + c];
      const tx = (parseFloat(el.style.getPropertyValue('--tx')) || 0) * k;
      const ty = (parseFloat(el.style.getPropertyValue('--ty')) || 0) * k;
      const dd = Math.hypot(
        x - ((c + 0.5) * pitch + tx),
        y - ((r + 0.5) * pitch + ty)
      );
      if (dd < bestD) {
        bestD = dd;
        best = { r, c };
      }
    }
  }
  return best;
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
