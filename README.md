# product-view

Web page for viewing product images: a 20×20 grid of 10px white circle PNGs
(5px gap) on a black background. Mousing over a circle smoothly scales it to
20px whilst the neighbours smoothly shrink. Pure HTML/CSS/JS, no libraries.

The effect uses CSS `transform` with a 200ms `ease-out` transition (GPU
composited, smooth). A single 40×40px circle asset is used for every cell, so
all display sizes — including the 20px hover state — are downscaling from
native resolution and stay crisp.

Three variants of the neighbour-shrink behaviour:

| Variant | Folder       | Neighbour behaviour                                                    |
| ------- | ------------ | ---------------------------------------------------------------------- |
| A       | `variant-a/` | the 8 direct neighbours shrink to 50%                                  |
| B       | `variant-b/` | ring 1 shrinks to 50%, ring 2 to 75%                                   |
| C       | `variant-c/` | smooth distance-based falloff, 50% at 1 cell to 100% at 3 cells (Euclidean) |

Open any `variant-*/index.html` in a browser.
