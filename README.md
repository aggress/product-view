# product-view

A web page for viewing product images: a 20×20 grid of 40px white circle PNGs
(20px gap) on a black background. Mousing over a circle smoothly scales it to
80px (2×) whilst the neighbours smoothly shrink with a distance-based falloff
(40% at 1 cell away, back to 100% at 5 cells, cosine curve — the 1st–4th
rings all get a graded shrink, and the 40% first ring keeps a clear edge gap
around the 2× hovered circle). Pure HTML/CSS/JS, no libraries.

Implementation notes:

- All motion is a CSS `transform` with a 300ms `cubic-bezier(0.4, 0, 0.2, 1)`
  transition (GPU composited, smooth in both grow and shrink).
- Works on mobile: touch/drag across the grid drives the same zoom as mouse
  hover (`touch-action: none` keeps the browser from hijacking the gesture,
  and the zoom stays in place when the finger lifts).
- GPU layers are allocated on demand: `will-change: transform` is only set on
  the ~41 cells inside the falloff radius, and only while their transition is
  running (dropped on `transitionend`). This keeps the page light on mobile
  instead of holding 400 persistent compositor layers.
- One 160×160px circle asset is used for every cell, so every display size —
  including the 80px hover state — is downscaling from native resolution and
  stays crisp even on 2× displays.
- The full-size grid is 1180×1180px; on smaller screens (including phones)
  the whole grid is scaled uniformly to fit the viewport, and the hover/touch
  tracking compensates for the scale by deriving cell size from the rendered
  bounding rect.

Open `variant-c/index.html` in a browser.
