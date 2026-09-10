# Images — A Hook Turn Is a Melbourne Thing

## `og-cover.png` — in place

Original overhead diagram of a Melbourne hook turn, drawn for this piece:
stay in the left lane, wait in the marked box at the intersection, then turn
right across the tram tracks. Source is `hook-turn-diagram.svg` in this
directory; re-render after editing with

```bash
python3 -c "import cairosvg; cairosvg.svg2png(url='hook-turn-diagram.svg', write_to='og-cover.png', output_width=1200, output_height=630)"
```

Palette is taken from `web/css/pilobolus-theme.css` — paper `#f1ead9`, ink
`#211d17`, moss `#3f5d43` for the path, ochre `#a35a2a` for the waiting box.

It is captioned and credited as a diagram, not as a photograph. Outbound image
fetching is blocked by egress policy in the drafting environment, so a
photograph of a real hook turn sign could not be retrieved and was not
simulated.

## If a photograph replaces it later

A Melbourne hook turn sign or a CBD intersection with the box painted on the
road would both work. Keep the diagram in the article as a second figure if so —
most readers have never seen the manoeuvre and the piece turns on it.
