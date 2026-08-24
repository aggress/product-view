// Product View — Variant A
// 20x20 grid of 10px circles (5px gap) on black. Hovering a circle scales it
// to 20px (2x) while the 8 direct neighbours (Chebyshev distance 1) shrink to
// 50%. All motion is CSS transform + a 200ms ease-out transition.

const COLS = 20;
const ROWS = 20;
const PITCH = 15; // 10px circle + 5px gap
const RADIUS = 1; // cells affected beyond the hovered one

const grid = document.getElementById('grid');

const cells = [];
for (let i = 0; i < ROWS * COLS; i++) {
  const img = document.createElement('img');
  img.className = 'cell';
  img.src = 'assets/circle.png';
  img.width = 10;
  img.height = 10;
  img.draggable = false;
  img.alt = '';
  grid.appendChild(img);
  cells.push(img);
}

const at = (r, c) => cells[r * COLS + c];

// Scale for cell (r,c) when (hr,hc) is hovered. 1 = unchanged.
function targetScale(r, c, hr, hc) {
  const d = Math.max(Math.abs(r - hr), Math.abs(c - hc));
  if (d === 0) return 2;
  if (d === 1) return 0.5;
  return 1;
}

let active = []; // cells currently carrying a non-default scale
let current = null;

function clearAll() {
  for (const el of active) {
    el.style.removeProperty('--s');
    el.classList.remove('zoomed');
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
        if (s > 1) el.classList.add('zoomed');
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
  const c = Math.floor(x / PITCH);
  const r = Math.floor(y / PITCH);
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
