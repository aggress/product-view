// Product view (variant D) — watches, 10x10
// 10x10 grid of 80px watch previews (40px gap) on black. Each cell is a
// unique circular crop of a watch face (assets/watch-1..100.png, 320x320,
// pre-cropped from watch_raw with the dial filling ~70% of the circle so
// there is breathing room around it).
// Hovering/touching a watch scales it smoothly to 400px (5x, 200px radius)
// whilst the neighbourhood both shrinks and moves outward radially to make
// room, in per-ring steps (ring = ceil of Euclidean distance, so straight
// and diagonal neighbours of a ring share values):
// - RINGS[1..3] hold the tuned scale + radial push for rings 1-3 (defaults
//   80%/80px, 49%/68px, 70%/40px). The on-page tuning panel edits these
//   live; the confirmed values are hardcoded back into RINGS below.
// - Rings 4-5 continue with a cosine fade from the ring-3 values to
//   100% / 0px at 5 cells, so no ring visibly "snaps" into or out of the
//   effect.
// (Diagonal cells sit partly under the enlarged highlight, which renders on
// top via z-index — same as variant-c.)
// Hit-testing follows the moved cells: the hovered cell is the nearest
// transformed cell centre to the pointer (scaled for the fit transform).
// All motion is CSS transform + a 300ms cubic-bezier(0.4, 0, 0.2, 1)
// transition (GPU composited). Works with mouse hover and touch.
// GPU layers (will-change) are only held while cells animate, so the page
// stays light on mobile.

const COLS = 10;
const ROWS = 10;
const RADIUS = 5; // cells affected beyond the hovered one
const HOVER_SCALE = 5; // hovered cell scales to 400px
const FADE_MAX_DIST = 5; // distance at which cells are back to full size/position

// Per-ring tuning values (ring = ceil of Euclidean cell distance). Rings
// 4-5 fade cosine from the ring-3 values to 100% scale / 0px push at 5
// cells. The tuning panel edits these live.
const RINGS = [
  null,
  { s: 0.8, push: 80 }, // ring 1: 80% size, 80px outward push
  { s: 0.488, push: 68 }, // ring 2
  { s: 0.7, push: 40 }, // ring 3
];

const grid = document.getElementById('grid');
const stage = document.querySelector('.stage');

const cells = [];
for (let i = 0; i < ROWS * COLS; i++) {
  const img = document.createElement('img');
  img.className = 'cell';
  img.src = 'assets/watch-' + (i + 1) + '.png';
  img.width = 80;
  img.height = 80;
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
  const ring = Math.ceil(d);
  if (ring <= 3) return RINGS[ring].s;
  // Rings 4-5: cosine fade from the ring-3 size to 100% at d=FADE_MAX_DIST.
  const t = (d - 3) / (FADE_MAX_DIST - 3);
  const s0 = RINGS[3].s;
  const s = s0 + (1 - s0) * 0.5 * (1 - Math.cos(Math.PI * t));
  return Math.round(s * 1000) / 1000;
}

// Outward push in grid px for a cell at distance d (cells) from the hovered
// one: ring values 1-3, then a cosine fade to 0 at d=FADE_MAX_DIST.
function targetPush(d) {
  if (d <= 0 || d >= FADE_MAX_DIST) return 0;
  const ring = Math.ceil(d);
  if (ring <= 3) return RINGS[ring].push;
  const t = (d - 3) / (FADE_MAX_DIST - 3);
  return RINGS[3].push * 0.5 * (1 + Math.cos(Math.PI * t));
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
  // Rendered pitch (120px at full size). Derived from the rect so hover
  // tracking stays correct if the grid is scaled to fit the viewport.
  const pitch = rect.width / COLS;
  const k = pitch / 120; // grid px -> rendered px
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

// The full-size grid is 1160x1160px; scale the whole stage down (uniformly)
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

// --- Tuning panel: live sliders + numerical readouts for rings 1-3 ---
// Lets the ring size (scale) and distance (radial push) be tested manually;
// the confirmed values are then hardcoded back into RINGS above and the
// panel removed.
const PITCH = 120; // grid px per cell (80px cell + 40px gap)
const HIGHLIGHT_R = HOVER_SCALE * 40; // 160px radius of the enlarged cell

const panel = document.getElementById('panel');
const panelRows = [];

function refreshStats() {
  for (let k = 1; k <= 3; k++) {
    const row = panelRows[k];
    const { s, push } = RINGS[k];
    const size = 80 * s; // rendered px at full grid scale
    const centre = PITCH * k + push; // straight neighbour centre distance
    const gap = centre - HIGHLIGHT_R - size / 2; // edge gap to highlight
    row.sVal.textContent = Math.round(100 * s) + '%';
    row.pVal.textContent = Math.round(push) + 'px';
    row.stats.textContent =
      Math.round(size) + 'px wide • ' +
      Math.round(centre) + 'px from centre • ' +
      Math.round(gap) + 'px gap to highlight';
  }
}

function reapply() {
  if (current === null) return;
  const [r, c] = current.split(',').map(Number);
  apply(r, c);
}

for (let k = 1; k <= 3; k++) {
  const ring = document.createElement('div');
  ring.className = 'ring';
  ring.innerHTML =
    '<h3>Ring ' + k + '</h3>' +
    '<div class="row"><label>size</label>' +
    '<input type="range" min="10" max="100" step="1" aria-label="Ring ' + k + ' size">' +
    '<span class="val"></span></div>' +
    '<div class="row"><label>push</label>' +
    '<input type="range" min="0" max="120" step="1" aria-label="Ring ' + k + ' push">' +
    '<span class="val"></span></div>' +
    '<div class="stats"></div>';
  const sInput = ring.querySelectorAll('input')[0];
  const pInput = ring.querySelectorAll('input')[1];
  const row = {
    sVal: ring.querySelectorAll('.val')[0],
    pVal: ring.querySelectorAll('.val')[1],
    stats: ring.querySelector('.stats'),
  };
  sInput.value = Math.round(100 * RINGS[k].s);
  pInput.value = Math.round(RINGS[k].push);
  sInput.addEventListener('input', () => {
    RINGS[k].s = sInput.value / 100;
    refreshStats();
    reapply();
  });
  pInput.addEventListener('input', () => {
    RINGS[k].push = Number(pInput.value);
    refreshStats();
    reapply();
  });
  panelRows[k] = row;
  panel.appendChild(ring);
}
refreshStats();
