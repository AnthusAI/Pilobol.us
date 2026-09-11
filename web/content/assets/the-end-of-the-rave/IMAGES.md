# Images — The End of the Rave

## Cover — `price-collapse.png` for now, Castlemorton still wanted

The article opens on Castlemorton Common and the cover should too. Until that
photograph is licensed, `cover:` / `card_image:` point at `price-collapse.png`,
the chart drawn for this piece. That is on-message and house-drawn, so the
listings and social cards are coherent rather than showing a traffic diagram
under a headline about a rave, but it is still an interim state.

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

## `adversarial-inference.png` — WANTED, third-party, permission needed

Ryan asked for Katharine Jarmul's attribute-inference diagram:

    https://blog.kjamistan.com/images/2026/adversarial_inference.png

Not fetched — the host is egress-blocked in the drafting environment, so the
file could not be downloaded and nobody here has seen it.

**Two things to settle before it ships.**

*Permission.* This is Jarmul's own artwork on her own blog, not a press asset.
The article already links her post in the sentence it supports, which is the
house's normal practice and needs no permission; reproducing her diagram is a
different act. Check whether the blog carries a licence (many practitioner
blogs are CC BY), and otherwise ask her. She is cited approvingly in the piece
and the request is a small one.

*Whether it duplicates what is already there.* The paragraph it belongs to sits
directly after `llm-privacy-inference-demo.png`, which already shows text going
in and inferred attributes coming out. If the two diagrams make the same point,
use the better one rather than both — that stretch already carries figures at
the hook-turn payoff and the Reddit study, and a third in ten lines rebuilds
the bunching this directory's other notes were written to avoid.

Drop-in block once the file is licensed and saved here, with `alt` rewritten to
describe what the diagram actually shows:

```
:::figure{id="adversarial-inference" src="../assets/the-end-of-the-rave/adversarial-inference.png" alt="DESCRIBE THE DIAGRAM AS IT ACTUALLY APPEARS" caption="An evaluation is an exam with a score. The machine sat it." credit="Diagram by Katharine Jarmul, from Privacy Evaluations for AI Systems. Used with permission."}
:::
```

It goes immediately after the paragraph beginning "People whose job is privacy
have a word for this kind of test."

## `price-collapse.png` — in place, and the current cover

Descending staircase of what it took to put a name to one person, 1992 to
2026, drawn for this piece. Sits directly under the thesis line, where the
argument is stated but not yet shown.

Only the two ends carry published figures — roughly four million pounds and no
names at Wolverhampton in 1994, and about two thousand dollars for 338 people
in 2026. The four steps between are what the reporting says each case cost in
time and people, not prices, and the chart says so on its face. Do not add
invented numbers to the middle steps.

## `genealogy-triangulation.png` — in place

How two weekend uploads reached a third person who never uploaded anything.
Sits beside the GEDmatch case.

## `hook-turn-diagram.png` — in place, inline figure

Original overhead diagram of a Melbourne hook turn, drawn for the earlier
version of this piece: stay in the left lane, wait in the marked box at the
intersection, then turn right across the tram tracks. It sits beside the
Melbourne section in the body. It was previously doing double duty as
`og-cover.png`; that duplicate is gone, so the cover can be swapped without
silently changing the figure.

## Re-rendering any of the diagrams

Each `.svg` in this directory is the source of the `.png` beside it. After
editing one:

```bash
python3 -c "import cairosvg; cairosvg.svg2png(url='NAME.svg', write_to='NAME.png', output_width=1200, output_height=630)"
```

Palette is taken from `web/css/pilobolus-theme.css` — paper `#f1ead9`, ink
`#211d17`, muted `#6b6153`, moss `#3f5d43`, ochre `#a35a2a` for whatever the
diagram wants to land on. Type is `Georgia, 'Times New Roman', serif` to match
the other house diagrams. Render and look at the PNG before committing: cairosvg
does not wrap or shrink text, so a long line silently runs off the right edge.

All three are captioned and credited as diagrams, not photographs.

## `llm-privacy-inference-demo.png` — in place

Screenshot of the llm-privacy.org demonstration accompanying the Beyond
Memorization research: a short Reddit comment on the left, the attributes a
model inferred from it on the right. Credited as a screenshot.
