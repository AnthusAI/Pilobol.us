# One-shot scripts (historical)

These are **not** part of the build. The site is built by `web/build.py`.

Each script here was written to make a single, specific edit to a file under
`web/` during the visual development of the Pilobol.us front page and its
generative effects (Physarum, reaction-diffusion, cellular automata). They
were run once, against the state of the tree at that moment, and their
results are already baked into the committed sources under `web/content/`
and `web/css/`.

## Do not re-run them

They are **not idempotent**. Most do a literal string replacement against a
file they expect to find in a specific prior state — for example
`fix_speed_v16.py` rewrites `web/content/assets/physarum-v11.js`, which has
since been superseded by `physarum-v17.js`. Running one now will either fail
outright or corrupt a source file by applying a patch twice.

## Why they are kept

They record how the effects were tuned — the sequence of decisions about
diffusion rate, growth speed, symmetry, feathering, compositing and masking.
That history is worth more than the clutter costs, but it belongs here rather
than in the repository root.

If you need to change an effect, edit the asset under
`web/content/assets/` directly and rebuild.
