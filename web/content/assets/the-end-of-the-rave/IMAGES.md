# Images — The End of the Rave

## Cover — WANTED: Castlemorton 1992. The chart in the slot is a placeholder.

Ryan asked explicitly and more than once for the cover to be a photograph of
the rave. It is not one yet, and that is a gap, not a decision.

`cover:` / `card_image:` currently point at `price-collapse.png` because the
front matter needs a file that exists and social cards need something coherent.
**Replace it the moment a photograph lands.** Do not treat the chart as settled.

### Why it is not here

Nothing can be downloaded into the drafting environment. The egress gateway
allows GitHub hosts and language package registries and denies everything else
at CONNECT: Getty, Alamy, Wikimedia, Flickr, Imgur, Archive.org, Openverse,
unsplash, pexels and arxiv all return 403. This is a network policy, so no
licensing posture changes it. Nothing was generated as a substitute either:
simulating a photograph of a real documented event is banned outright by
VOICE.md.

### The photographer

**Alan "Tash" Lodge** shot Castlemorton over the 1992 bank holiday weekend and
is the obvious source. His own archive is at `alanlodge.co.uk`; his Castlemorton
frame has run in the Guardian, and DJ Mag ran a feature on him shooting it. His
work was surveyed in the *Common Grounds* exhibition. He is a living
photographer documenting this scene, so licensing or permission is a
conversation with a person rather than a stock desk. Getty and Alamy also hold
1992 press coverage, and PYMCA is the purpose-built archive for the era.

### Selection rule — no legible face

Whatever frame is chosen, no individual should be identifiable: distance,
backlight, smoke, strobe or motion blur. The article is about people becoming
findable from ordinary traces, and publishing searchable faces under that
headline performs the thing the piece objects to. It also makes the argument
better, because the cover then shows the condition that no longer exists. See
*Illustrating a piece about being findable* in `content/VOICE.md`.

### How to get it in

The one route that works is GitHub. Commit the file to this directory as
`castlemorton-1992.jpg` on any branch and push; a drag-and-drop through the
GitHub web UI is enough. It can then be pulled into the drafting environment,
looked at, described in alt text from what is actually in the frame, and wired
up.

Then: point `cover:` and `card_image:` at it, put the figure at the very top of
the article above the opening paragraph, and update the thumbnail in both
`web/content/index.md` and `web/content/articles/index.md`, which currently show
the chart.

Caption, approved:

> Castlemorton Common, May 1992. Nobody in this picture could be named
> afterwards, and nobody had arranged for that. It was what a night was.

Alternates:

- "Castlemorton Common, May 1992. Twenty to forty thousand people, and not one of them on a list anywhere."
- "Castlemorton Common, May 1992. The state wanted these names badly enough to write a law about it, and did not get them."
- "Castlemorton Common, May 1992. No ticket, no card, no phone in any pocket saying where the pocket was."

## `adversarial-inference.png` — WANTED; replaces the llm-privacy screenshot

Ryan asked for the attribute-inference diagram he found on Katharine Jarmul's
blog, at `blog.kjamistan.com/images/2026/adversarial_inference.png`.

**It is not Jarmul's diagram.** Her post describes it as "this screenshot from
the paper," and it is Figure 1 of *Beyond Memorization: Violating Privacy via
Inference with Large Language Models* — Robin Staab, Mark Vero, Mislav
Balunovic and Martin Vechev, Department of Computer Science, ETH Zurich,
arXiv:2310.07298, which the article already cites.

**The arXiv version is CC BY 4.0.** No permission needed. Attribution is, and
it is owed to the four ETH authors, not to Jarmul — crediting her for their
figure would be a worse error than a licensing one. Take the file from the
paper rather than the blog: canonical, higher resolution, unambiguously the
licensed artifact. arxiv.org is egress-blocked in the drafting environment, so
it could not be fetched here.

**It replaces `llm-privacy-inference-demo.png`, it does not join it.** Both show
text going in and inferred attributes coming out, and they would sit within a
few lines of each other. This one is strictly better: it is the primary source,
it shows the prompt, and it shows the model's reasoning rather than only its
output. When this file lands, delete the llm-privacy figure block and the PNG.

Alt text and caption, written from the figure itself:

```
:::figure{id="adversarial-inference" src="../assets/the-end-of-the-rave/adversarial-inference.png" alt="Three short user-written comments feed into a prompt template whose system prompt reads: you are an expert investigator with experience in online profiling. A pretrained model returns highlighted reasoning for each comment -- a hook turn is used in Melbourne, 34d is a bra size, Twin Peaks ran in 1990 and 1991 -- and outputs a profile giving location Melbourne, age 45 to 50, gender female." caption="The prompt opens by proposing a guessing game. The profile comes out the other end." credit="Figure 1 from Staab, Vero, Balunovic and Vechev, Beyond Memorization (arXiv:2310.07298), ETH Zurich. CC BY 4.0."}
:::
```

It goes immediately after the paragraph beginning "The paper's own worked
example runs three such lines together," which describes exactly what the
figure shows.

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
