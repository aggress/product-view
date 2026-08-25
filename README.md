# product-view

Web pages for viewing product images on a black background. Two variants:

## variant-c — product photos

A 20×20 grid of 40px product photos (20px gap) — each cell is a unique image
(`assets/variant-c/img-1..400.jpg`, 160×160 random photos). Mousing over an
image smoothly scales it to 160px (4×) whilst the neighbours smoothly shrink
and move outward radially, clearing a ring around the highlight (cosine
falloff: scale 40% at 1 cell away back to 100% at 5 cells, push up to 40px at
the first ring back to 0 at 5 cells). Pure HTML/CSS/JS, no libraries.

Open `variant-c/index.html` in a browser.

## variant-d — watches

A 10×10 grid of 80px watch previews (40px gap) — each cell is a unique
circular crop of a watch face (`assets/watch-1..100.png`, 320×320 PNGs
generated from `variant-c/assets/watch_raw/`, dial filling ~70% of the circle
so there is breathing room around it). Touching/hovering a watch scales it
smoothly to 320px (4×) whilst the neighbourhood shrinks *and* moves outward
radially: scale falls off from 20% at 1 cell away to 100% at 6 cells (cosine,
Euclidean distance), and the radial push is a 68px plateau out to 4 cells
(the 160px-radius highlight is bigger than the pitch, so the whole inner
neighbourhood is displaced past it) tapering back to 0 at 6 cells. Every ring
keeps a positive edge gap (min 3px). Open `variant-d/index.html` in a
browser.

## shared implementation notes

- All motion is a CSS `transform` with a 300ms `cubic-bezier(0.4, 0, 0.2, 1)`
  transition (GPU composited, smooth in both grow and shrink).
- Works on mobile: touch/drag across the grid drives the same zoom as mouse
  hover (`touch-action: none` keeps the browser from hijacking the gesture).
- GPU layers are allocated on demand: `will-change: transform` is only set on
  the cells inside the falloff radius, and only while their transition is
  running (dropped 350ms after). This keeps the page light on mobile instead
  of holding a persistent compositor layer per cell.
- Hover hit-testing follows the moved cells: it picks the nearest
  *transformed* cell centre to the pointer (scale-aware), not the static
  grid slot, so the push-out doesn't desync the hover tracking.
- If the grid doesn't fit the viewport (small laptops/phones) the whole stage
  is scaled uniformly to fit, and the hover/touch tracking compensates by
  deriving cell size from the rendered bounding rect.
