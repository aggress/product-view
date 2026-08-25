// Product view (variant D) — watches, 10x10
// 10x10 grid of 20px watch previews (10px gap, 30px pitch) on black. Each
// cell is a unique circular crop of a watch face (assets/watch-1..100.png,
// 320x320, pre-cropped from watch_raw with the dial filling ~70% of the
// circle so there is breathing room around it).
// Hovering/touching a watch scales it smoothly to 160px (8x) whilst the
// neighbourhood both shrinks and moves outward radially to make room:
// - scale: cosine falloff from 30% at 1 cell away back to 100% at 6 cells,
//   Euclidean distance so diagonals shrink a touch less than straight
//   neighbours.
// - push: 63px at 1 cell away, decaying as 63*(1-t)^1.45 with t =
//   (r-30)/120 in grid px, back to 0 at 5 cells. Straight neighbours end up
//   at ~93/102/113/128/150/180px from the hovered centre, so every ring
//   keeps a positive edge gap to the 80px-radius highlight (10px at the
//   first ring, ~2px through the mid rings, 10px+ out to the tail).
// Hit-testing follows the moved cells: the hovered cell is the nearest
// transformed cell centre to the pointer (scaled for the fit transform).
// All motion is CSS transform + a 300ms cubic-bezier(0.4, 0, 0.2, 1)
// transition (GPU composited). Works with mouse hover and touch.
// GPU layers (will-change) are only held while cells animate, so the page
// stays light on mobile.

const COLS = 10;
const ROWS = 10;
const PITCH = 30; // grid px (20px cell + 10px gap)
const HOVER_SCALE = 8; // hovered watch scales to 160px
const FADE_MIN = 0.3; // scale at 1 cell distance
const FADE_MAX_DIST = 6; // distance at which watches are back to full size
const PUSH_MAX = 63; // grid px outward push at 1 cell distance
const PUSH_TAIL = 5; // cells; push is 0 beyond this distance

const grid = document.getElementById('grid');
const stage = document.querySelector('.stage');

const cells = [];
for (let i = 0; i < ROWS * COLS; i++) {
  const img = document.createElement('img');
  img.className = 'cell';
  img.src = 'assets/watch-' + (i + 1) + '.png';
  img.width = 20;
  img.height = 20;
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
// one. Steep just outside the 80px-radius highlight (so the first ring
// clears it), then a long gentle tail so full-size watches further out never
// crowd each other.
function targetPush(d) {
  const r = d * PITCH;
  if (r >= PUSH_TAIL * PITCH) return 0;
  const t = Math.max(0, (r - PITCH) / (PUSH_TAIL * PITCH - PITCH));
  return PUSH_MAX * Math.pow(1 - t, 1.45);
}

let active = []; // cells currently carrying a non-default transform
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
  const r0 = Math.max(0, hr - FADE_MAX_DIST);
  const r1 = Math.min(ROWS - 1, hr + FADE_MAX_DIST);
  const c0 = Math.max(0, hc - FADE_MAX_DIST);
  const c1 = Math.min(COLS - 1, hc + FADE_MAX_DIST);
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

// Nearest transformed cell centre to the pointer. Cells may be pushed
// outward, so plain grid maths would track the wrong cell. Accept within a
// bit more than half a rendered pitch, otherwise no cell.
function cellAt(e) {
  const rect = grid.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  const pitch = rect.width / COLS; // rendered px
  const k = pitch / PITCH; // grid px -> rendered px
  let best = null;
  let bestDist = Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const el = at(r, c);
      const cx = (c + 0.5) * PITCH + parseFloat(el.style.getPropertyValue('--tx') || 0);
      const cy = (r + 0.5) * PITCH + parseFloat(el.style.getPropertyValue('--ty') || 0);
      const d = Math.hypot(cx * k - x, cy * k - y);
      if (d < bestDist) {
        bestDist = d;
        best = { r, c };
      }
    }
  }
  return bestDist <= 0.6 * pitch ? best : null;
}

// Keep at most ~41 GPU layers: drop will-change shortly after the 300ms
// transform transition finishes.
function armClear() {
  if (armClear.timer) clearTimeout(armClear.timer);
  armClear.timer = setTimeout(() => {
    for (const el of active) el.classList.remove('moving');
    armClear.timer = null;
  }, 350);
}

function hover(e) {
  const cell = cellAt(e);
  if (cell && current && cell.r === current.r && cell.c === current.c) return;
  current = cell;
  if (cell) apply(cell.r, cell.c);
  else clearAll();
  armClear();
}

// Touch: pressing/dragging on the grid behaves like hover; leaving or
// tapping elsewhere clears it.
function onTouch(e) {
  if (e.type === 'touchend' || e.type === 'touchcancel') {
    current = null;
    clearAll();
    armClear();
    return;
  }
  hover(e.touches[0]);
}

grid.addEventListener('mousemove', hover);
grid.addEventListener('mouseleave', onTouch);
grid.addEventListener('touchstart', onTouch, { passive: true });
grid.addEventListener('touchmove', onTouch, { passive: true });
grid.addEventListener('touchend', onTouch, { passive: true });
grid.addEventListener('touchcancel', onTouch, { passive: true });

// If the grid + caption do not fit the viewport (small laptops/phones),
// uniformly scale the stage down. fit() runs once on layout; on resize it
// only re-fits if a hover is not in flight, so a mid-hover resize does not
// reset the neighbourhood.
function fit() {
  stage.style.transform = '';
  const sw = stage.scrollWidth;
  const sh = stage.scrollHeight;
  const scale = Math.min(1, innerWidth / sw, innerHeight / sh);
  if (scale < 1) stage.style.transform = 'scale(' + scale + ')';
}

fit();
addEventListener('resize', () => {
  if (!current) fit();
});
