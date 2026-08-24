# product-view

A web page for viewing product images: a 20×20 grid of 40px white circle PNGs
(20px gap) on a black background. Mousing over a circle smoothly scales it to
80px (2×) whilst the neighbours smoothly shrink with a distance-based falloff
(50% at 1 cell away, back to 100% at 3 cells, cosine curve). Pure HTML/CSS/JS,
no libraries.

Implementation notes:

- All motion is a CSS `transform` with a 300ms `cubic-bezier(0.4, 0, 0.2, 1)`
  transition (GPU composited, smooth in both grow and shrink).
- One 160×160px circle asset is used for every cell, so every display size —
  including the 80px hover state — is downscaling from native resolution and
  stays crisp even on 2× displays.
- The full-size grid is 1180×1180px; on smaller screens the whole grid is
  scaled uniformly to fit the viewport (hover tracking compensates for the
  scale).

Open `variant-c/index.html` in a browser.
