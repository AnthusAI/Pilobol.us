# Images — The End of the Rave

## Cover — SELECTED, awaiting the file itself

Ryan selected a specific photograph and pasted it into chat: seven people in
early-1990s festival clothing on a grassy hillside under clear blue sky, a
shirtless man in orange trousers and a woman in a wide-brimmed cap gesturing
toward each other at the center of the group, others sitting, looking on, or
gesturing nearby. Several faces in the frame are clearly lit and identifiable.

**Credit, exact wording as instructed:** Alan "Tash" Lodge, a Nottingham-based
documentary photographer.

**Faces override.** This frame does not meet the *no legible face* guidance
in `content/VOICE.md` ("Illustrating a piece about being findable"). Asked
directly whether to keep looking for a faces-unreadable frame instead, Ryan
chose to run this one with no acknowledgment of the faces. Recorded as an
explicit exception in VOICE.md, not a change to the default rule.

**Source confirmed independently.** This is Alan Lodge's photograph published
in the Guardian's "My best photograph" interview series, under the title
"Ravers having it large at Castlemorton, 1992: Alan Lodge's best photograph"
(Lodge references it on his own blog at `alanlodge.co.uk/blog/archives/31295`
and `/31303`). Ryan's copy of it, on his own Desktop, carries that exact
filename. That is real provenance, not just a chat selection — but licence
terms for republishing a Guardian-published interview photograph were not
confirmed here, since both alanlodge.co.uk and theguardian.com's media hosts
are egress-blocked from the drafting environment. Ryan selected and authorized
the image and its use directly; this note exists so a future editor knows that
authorization came from him in chat rather than from a licence file anyone
here could open.

**Still blocked: getting the actual bytes in.** The file lives on Ryan's own
Mac (`~/Desktop/ravers-having-it-large-at-castlemorton-1992-alan-lodges-best-
photograph...`), not on the drafting container — pasting an image into chat
shows it to the model but does not write it to this filesystem, checked
directly more than once. Guardian's own media CDN (`media.guim.co.uk` and
`www.theguardian.com`) is also egress-blocked, so it cannot be fetched
independently either. The only route that works is a GitHub commit.

### What is already done, on branch `art/castlemorton-cover`

Written from what was visible in the pasted image, ready to go the moment the
file exists at `web/content/assets/the-end-of-the-rave/castlemorton-1992.jpg`:

- `the-end-of-the-rave.md` — `cover:` and `card_image:` point at the file; a
  `:::figure` block sits at the very top of the article, above the opening
  paragraph, with alt text and the caption/credit above.
- `web/content/articles/index.md` and `web/content/index.md` — both listing
  thumbnails point at the same file.

**To finish: commit `castlemorton-1992.jpg` to this path, on this branch or on
`main`, push, and the piece is done** — no further text changes needed, only
the binary. A drag-and-drop through the GitHub web UI is enough.

### Why nothing could be fetched from the open web

The egress gateway allows GitHub hosts and language package registries and
denies everything else at CONNECT: Getty, Alamy, Wikimedia, Flickr, Imgur,
Archive.org, Openverse, unsplash, pexels, arxiv, and alanlodge.co.uk itself all
return a policy denial. That is network configuration, not a licensing
question, so no rights posture changes it. Generating a substitute image is
separately banned outright by VOICE.md.

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
