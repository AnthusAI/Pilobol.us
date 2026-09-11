# Images — The End of the Rave

## Cover — to be licensed, NOT yet in place

The article opens on Castlemorton Common and the cover should too. The file
currently referenced by `cover:` / `card_image:` is still `og-cover.png`, the
hook-turn diagram, which now also serves as an inline figure further down the
piece. That is an interim state, not the intended one.

**What to license:** a photograph of the Castlemorton Common Festival,
22–29 May 1992, Malvern Hills, Worcestershire. Wide crowd, field, night or
dawn.

**Hard requirement — no legible face.** Choose a frame where no individual is
identifiable: distance, backlight, smoke, strobe or motion blur. Two reasons.
The article is about people becoming findable from ordinary traces, and
publishing searchable faces under that headline would perform the thing the
piece objects to. It also makes the argument better: the cover should show the
condition that no longer exists.

**Where to look:** Getty and Alamy both hold 1992 press coverage of
Castlemorton. PYMCA (Photographic Youth Music Culture Archive) is the
purpose-built archive for this material. Dave Swindells, Gavin Watson,
Matthew Smith and Vinca Petersen all shot the era and are licensable.

Outbound image fetching is blocked by egress policy in the drafting
environment, so no candidate could be retrieved, compared or embedded here.
Nothing was generated as a substitute: an invented or AI-made "rave photo"
would break the house rule against illustrating a real documented night with
something that did not happen.

**Paste this in at the top of the article once the file is in place**, with
`src` and `credit` corrected to the licensed image:

```
:::figure{id="castlemorton-cover" src="../assets/the-end-of-the-rave/castlemorton-1992.jpg" alt="A large crowd at night in an open field at the Castlemorton Common Festival, May 1992; the figures are distant and lit from behind, and no individual face is distinguishable" caption="Castlemorton Common, May 1992. Nobody in this picture could be named afterwards, and nobody had arranged for that. It was what a night was." credit="PHOTOGRAPHER / ARCHIVE — licence reference"}
:::
```

Caption alternates, if the chosen frame suits a different beat:

- "Castlemorton Common, May 1992. Twenty to forty thousand people, and not one of them on a list anywhere."
- "Castlemorton Common, May 1992. The state wanted these names badly enough to write a law about it, and did not get them."
- "Castlemorton Common, May 1992. No ticket, no card, no phone in any pocket saying where the pocket was."

## `og-cover.png` — in place, now an inline figure

Original overhead diagram of a Melbourne hook turn, drawn for the earlier
version of this piece: stay in the left lane, wait in the marked box at the
intersection, then turn right across the tram tracks. Source is
`hook-turn-diagram.svg` in this directory; re-render after editing with

```bash
python3 -c "import cairosvg; cairosvg.svg2png(url='hook-turn-diagram.svg', write_to='og-cover.png', output_width=1200, output_height=630)"
```

Palette is taken from `web/css/pilobolus-theme.css` — paper `#f1ead9`, ink
`#211d17`, moss `#3f5d43` for the path, ochre `#a35a2a` for the waiting box.

It is captioned and credited as a diagram, not as a photograph. It now sits
beside the Melbourne section in the body. When the Castlemorton cover lands,
`cover:` and `card_image:` should point at that instead, and this file stays
where it is as the inline figure.

## `llm-privacy-inference-demo.png` — in place

Screenshot of the llm-privacy.org demonstration accompanying the Beyond
Memorization research: a short Reddit comment on the left, the attributes a
model inferred from it on the right. Credited as a screenshot.
