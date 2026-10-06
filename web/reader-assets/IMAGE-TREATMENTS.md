# Image treatments

Article front matter can opt into one of the production treatments:

```yaml
image_effect: organic   # tiled/shattered image that assembles on scroll
image_effect: cinematic  # zoom-blurred image that settles on scroll
image_effect: mask       # curtain/clip reveal
image_effect: pixel      # low-resolution to high-resolution dissolve
image_effect: lenticular # chromatic afterimage / misregistration
```

The selected treatment is applied to the first `:::figure{}` image (or first
bare Markdown image) in the article, and to that article's first image wherever
it appears on the generated homepage or `articles/index.html` archive. The original `<img>` stays
in the markup as the no-JavaScript/accessibility fallback. Both treatments are
scroll-only; they do not respond to pointer, hover, or touch input.

The live prototypes and research queue are at
`/assets/image-effects-lab.html`. The lab and production pages share the same
scroll-only scripts, so each option can be tried there before assigning it to
an article.
