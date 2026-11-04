# Images — The End of the Rave

## Cover — DONE. `castlemorton-1992.jpg` is in place.

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

**How the file actually got in, for the next time this comes up:** a
straight paste/drag of an image into chat does not write it to this
filesystem — confirmed by repeated direct checks. What worked was pulling the
base64 image data out of this session's own conversation transcript
(`~/.claude/projects/.../<session>.jsonl`), which stores a pasted image inline
as a base64 `image` content block, decoding it, and converting from WebP to
JPEG with Pillow. An `@`-path file attachment (as Ryan did with the saved
Guardian webpage, further up this file) writes directly to
`~/.claude/uploads/<session>/` and is the more reliable route if this comes up
again — a straight paste needs the transcript-extraction workaround.

Alt text was corrected after installing the file: the original guess
("grassy hillside") was wrong. The Guardian's own alt text for this image —
recovered from the saved webpage Ryan attached — says "Festivalgoers on top
of a vehicle against a blue sky at Castlemorton," which matches what is
actually visible in the frame. Official Guardian photo credit, from the same
source: "Photograph: Alan Lodge." Published 10 August 2022, Guardian
Art & Design.

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

## Section-break art added 2026-09-14 (second pass)

The piece got long enough that the turn from the dance floor into the
identification cases needed a visible door, so the body now carries two `##`
subheads (`The bill`, `Friday night`) and two new pictures that open panels
inside the long middle.

### `spit-tube.jpg` — opens the GEDmatch panel

Stock, not drawn. Lisa Zins, "Wonder Who I Am??", taken 13 September 2018,
posted to Flickr 15 September 2018, **CC BY 2.0** (confirmed on the photo page
at `flickr.com/photos/94846844@N04/42875288260`). A saliva tube lying on an
AncestryDNA instruction card, "ACTIVATION CODE" on the label. Credited in the
figure as required by the licence.

Only 1024×457 is available — Flickr has no `_h` or `_k` size for this photo,
so it runs narrower than the 1200-wide diagrams. No faces, which keeps it
inside the *Illustrating a piece about being findable* rule in `VOICE.md`.

**Egress note for whoever comes next:** `upload.wikimedia.org` is blocked from
the drafting environment (returns a Wikimedia error page whatever the user
agent), so Commons-hosted candidates could not be pulled, including two decent
CC BY-SA 4.0 shots of a 23andMe kit. `live.staticflickr.com` does work, with a
browser user agent. Openverse's API (`api.openverse.org/v1/images`) is
reachable and was how these were found.

### `mailer-page.png` / `.svg` — opens the Target panel

Drawn here, in the `price-collapse.svg` palette, rendered with
`rsvg-convert -w 1200 -h 630`. Six dashed coupon tiles; five read "for nobody
in particular"; the crib, in rust, reads "for a due date she never gave
anyone."

This one is drawn because the search for a photograph came up empty. Openverse
has no usable CC-licensed image of a coupon circular, a pregnancy-prediction
mailer, or the lotion-and-cotton-balls still life the paragraph describes — the
coupon results are all hobbyist extreme-couponing snapshots, and the junk-mail
results are political flyers. If a photograph is wanted here later, it probably
has to be shot or licensed rather than found.
