# Images — Someone paid for the answer your chatbot just told you

Draft: `stories/PILO-72bae0bb-c62a-435f-8dbe-57574853c32c/article-draft.md`.

The board notes call for the training loop to be visible: text is written by a
machine, planted where crawlers graze, retrieved as an answer, and eventually
fed into the next model. The source should feel like evidence becoming
feedstock, not a generic robot illustration.

## Cover — `training-loop.svg` / `training-loop.png` — acquired

Original diagram drawn for this article. It shows the planted Reddit-style post,
the crawler, the model's training pile, the calm answer that comes back, and the
generated copy that starts the loop again. The small ochre circle marks the
human source falling out of frame. The SVG is the source of the 1200 × 630 PNG;
re-render with:

```bash
rsvg-convert -w 1200 -h 630 training-loop.svg -o training-loop.png
```

This is an original explanatory drawing, not a recreation of a real post,
answer, or screenshot. Credit: “Original diagram for this piece.”

## Inline — `model-collapse-figure-1.png` — acquired

Figure 1 from *AI models collapse when trained on recursively generated data*,
Ilia Shumailov et al., Nature 631 (2024),
https://www.nature.com/articles/s41586-024-07566-y. The article is open access
under the Creative Commons Attribution 4.0 International licence. The image is
the publisher's original 1417 × 1528 PNG, downloaded from Nature's Springer
media host:

https://media.springernature.com/full/springer-static/image/art%3A10.1038%2Fs41586-024-07566-y/MediaObjects/41586_2024_7566_Fig1_HTML.png

Suggested caption: “The loop has a measurable failure mode: probable events
are overestimated, the tails shrink, and the next model inherits the narrower
world.” Credit the six authors and link the Nature paper; retain the CC BY 4.0
notice. The full figure is tall, so crop to panel **a** only if the reading
column makes the charts too small.

## Wanted — real source material, only if it can be captured and credited

- A screenshot of the actual `r/SkincareAddiction` thread described in the
  draft, with the public URL and date visible. Do not recreate the question or
  the Honeydew Labs reply. Crop or obscure any full names; a public handle is
  still not an invitation to turn the person into a portrait.
- A screenshot of a real answer-engine result that cites the planted thread,
  only if a reproducible query and source trail can be recorded. Do not mock up
  an AI answer for the illustration.
- The Cornell WARP figure is useful research, but the arXiv page does not state
  a clear reuse licence in the captured source. Leave it out unless its rights
  status is confirmed or the authors grant permission.

## Rejected

- Stock robot brains, glowing server rooms, generic “AI” artwork, and agency
  marketing OG images. They explain a category instead of showing this loop.
- A fabricated Reddit thread, chatbot transcript, or brand recommendation. The
  story is about manufactured source material; the image cannot manufacture
  its own evidence.
