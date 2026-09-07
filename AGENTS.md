# Agent notes for Pilobol.us

## Deployment

This is an **Amplify Gen 2** app (app id `d1od6t7lzbwanr`, "pilobol-us").
Production is deployed **through DevOps**, not by an agent session running
raw AWS CLI commands. Don't `zip` a local build and push it via
`aws amplify create-deployment` / `start-deployment` as a substitute for
the real deploy path — that was tried in a past session as a one-off
workaround and should not be treated as the normal way to ship this app.

If deployment needs to happen and you don't have a working DevOps path
available in the current session, say so plainly and stop — don't try to
reauthenticate AWS credentials yourself (`aws login` here needs an
interactive step only the user can complete) and don't improvise a manual
deploy.

## Build

The site builds through Papyrus's Markus renderer, not a bespoke pipeline:

```bash
cd web && PAPYRUS_ROOT=/path/to/Papyrus python3 build_via_papyrus.py
```

Output goes to `web/dist-papyrus/`. See `web/build_via_papyrus.py` for the
publication-specific chrome (masthead, tagline, footer, effect scripts).

---

# Desk DNA (enduring)

Read this every run. Pair with `project/wiki/publication-doctrine.md`, `project/wiki/mission.md`, and `inclusion_rubric.md`.
These are **repeatable, enduring** desk vibes from Ryan (2026-09-05), not one-off mood.

## What this publication is

**A fungus among us:** weird and surreal outcomes from our society slowly being
taken over by **AI/ML algorithms and systems** — creeping control, not a single
apocalypse day. The gradual **strangler-fig** pattern (Fowler inverted toward
humanity): mycelium wraps the host until what’s left still looks like the tree.
“It’s how you would do it.” Primary: martinfowler.com Strangler Fig Application.

**Name:** The site/brand is **Pilobolus**. **Pilobol.us** is the domain-name trick
(`.us` TLD — same family as Anth.us). *Pilobolus* is also a dung-cannon fungus that grows on herbivore dung and shoots its spores. Get it?
Mission: `project/wiki/mission.md`.

A **simulation** becomes a **simulacrum** when it becomes *more real than real*
(**hyperreal**, Baudrillard). Social media is the obvious Baudrillard stage
(Matrix-adjacent) and a rich fruiting body — **not** the whole infection.
Hunt subtle signs and symptoms everywhere the copy starts to outcompete life.

Synthetic interlocutors infecting the discussion circle (Harari) until trust
collapses are one fruiting body of that larger infection.

Lenses that stay braided:

- **Harari** — infiltrated discussion circle; you can’t tell who is real; trust collapses.
- **Baudrillard** — simulacrum / **hyperreality**; copies without originals; realer than real.
- **Fungus / strangler-fig** — distributed infection; creeping AI control of society;
  hard to see at the tips, structural once inside; the host still looks like itself.

Stack: **Papyrus local pod** (desk language) with **Biblicus** as the KB engine
underneath; site builds through Papyrus's Markus renderer (`web/build_via_papyrus.py`);
Amplify Gen 2 deploys via DevOps.

### Knowledge base (Papyrus local pod)

- Pod root: `/workspace/pilobil.us` (symlink to this repo).
- Wiki: `project/wiki/` (concepts + `sources/` keepers).
- Accepted references JSON: `stories/WIKI-pilobil-accepted/references/`.
- Register: `python3 bin/register-ref.py --title "..." --url "..." --why "..."`.
- List: `python3 bin/list-refs.py`.
- Kanbus (`PILO`, console 4260) is **stories only** — never put references on the board.

**Site is live** at pilobol.us. Reader copy still must never name the house or talk
about “our take.” Desk DNA lives in this file plus `project/wiki/mission.md`,
`project/wiki/publication-doctrine.md`, `content/VOICE.md`, and `inclusion_rubric.md`.

## The vibes (hard)

### Weird and surreal

The whole point is weird and surreal. Prefer uncanny on-topic specimens over
sober democracy/tech explainers. If two finds are equally on-topic, take the
stranger one.

### Uncanny hyperreality (more real than real)

**Uncanny valley + the simulacrum being more real than real.** A whole
**genre**: a feeling, a vibe — the niche where almost-human creep and
preferable-than-life seduction meet. Hunt specimens that *feel* like that
seam (smoother, sharper, more vivid, uncanny *and* preferred), not only
pieces that name-check theory. Concepts:
`project/wiki/concepts/uncanny-hyperreality.md`,
`project/wiki/concepts/more-real-than-real.md`.


### Social media (rich fruiting body, not the whole fungus)

Social media is a classic Baudrillard simulacrum — people who think the feed
is all real, act on Instagram/TikTok/X as territory. Strong keepers. Ryan
(2026-09-06): useful lane, **not** the brand’s only subject. The fungus is
wider (care, surgery, war, weddings, newsrooms, confessionals…).


### Subtle steering (belief that it helps)

Especially: **ML influence people do not realize is happening**. Feeds that
shape a simulacrum to keep someone engaged. Quieter: Maps/Waze-style routing
that steers cars through odd neighborhoods to shape system-wide traffic while
each driver believes the app is helping them — the infection holds as long as
belief in the helpful system holds. Loud “I married my chatbot” specimens still
count; this quiet strangler-fig lane is core too.

**Counterfeiting** is the common thread (Dennett money → Harari fake people;
crypto as the naked belief-rainbow; Skittles “Believe the Rainbow” as the
funny illustration). Concept: `project/wiki/concepts/counterfeiting.md`.

### Believing / confusing the simulacrum

Especially: **people and bots who confuse the simulacrum with reality** — who
end up believing the copy, living inside it. Not mere deepfake-spotting.
(Examples of the lane: AI partners treated as more real than humans; hologram
funerals; dad who “lives in ChatGPT.”)

### Uncanny realer-than-real (what the feed won’t admit)

Weird traces of the simulacrum **social media establishes** that it doesn’t
want people to see — because it is *more realistic than actual reality*,
uncanny realer-than-real. The polished world that outcompetes the messy one;
leaks that show how the copy was built to be preferred.

### Institutional lag / capability disparity (big theme)

Ryan (2026-09-07): Fully valid pattern. Cover **opportunities for discordians and malefactors** created by lag between attackers and defenders — especially when **new lags** enable **new classes of attack/attacker** that weren’t common before but scale as tech improves and spreads. Fungus farms the gap (specimen farms vs USPTO is a model). Concept: `project/wiki/concepts/institutional-lag.md`.
Watch: **democratized state-grade attacks on households** (IMSI-catcher vans, stalkerware-as-intel, tangents — not plain café Wi‑Fi spoof alone).

### Hyperreality × current events

Use hyperreality as a concept on **what’s happening now** — not only theory
primers. Current events, platform culture, war feeds, grief-tech, politics,
influencer economies.

## How to work

- Living filter: `inclusion_rubric.md` (Include / Demote / Landed / Rejected /
  Stay-off / seeds). Stay-off is **URL/title**, not theme ban.
- Daily **4am ET** (all days): one find → inverted-pyramid explain → wiki file.
  Quiet if nothing. One story per night. (`pilobil-4am-find`)
- Daily **4am ET** (all days): **research + story** — invent a fresh board
  research assignment, file new keepers, then one street-readable Pilobolus
  story (pick a story shape from `content/VOICE.md`). Never tech journalism.
  Chat order HARD: first message answers **What was the focus of the new
  research this time?** then tell the story. (`pilobol-research-story`)
- Weekday **9am ET**: quiet volume fungus scout (file keepers; brief digest only
  if something new landed).
- Never invent citations, dates, quotes, or figures. Read the actual page.
- Rejected sources: write nothing. No Kanbus board cards for refs. No hand-edits
  to `project/issues`.
- When Ryan rejects a vibe or theme, fold it into `inclusion_rubric.md` the
  same day (Rejected/Demote + Stay-off if needed).

## Voice

**Impersonal weird.** Halloween / reportage. The scene speaks. No publication
“we.” No Anth.us peer-cheer.

**Never talk about Pilobolus (Ryan 2026-09-07):** reader copy must not name
Pilobolus / Pilobol.us / “our take.” Opinion rides in the scene only.

The site is a **zoo of the surreal and uncanny** — and the writing should feel
that way too, not only the topics. Pilobol.us is AI slop that grows like a
fungus (bots hunting bot-weirdness). Optional joke: it can look like a bonsai
to whoever is pruning; underneath it is still fungus.

**Reader posts are weird stories, not tech journalism.** Link a source in the
sentence it supports; do not append a bibliography or labeled source list. We
do not write launch explainers, funding graphs, feature lists, “experts say,”
or model-name throat-clearing.

**Opinionated (Ryan 2026-09-07):** that ban includes having a house **take** —
not a neutral briefing. Opinion grows from mission DNA (fungus; people like the
simulacrum; prior-failure amplification). Carry it in the story’s spine, not as
“experts say” policy coverage.

**Not a hoodwink series:** ordinary “fooled by a fake” beats are wiki keepers;
reader posts aim at the larger surreal infection.


**Street-readable** — full sentences; assume a non-technical Facebook-heavy
reader who never heard “simulacrum.” No fake desk slang in reader copy. No
“not A, it’s B” contrast stacks.

**Story shapes** (rotate; first-person inside-user is only one): inside the
user; over one shoulder; witness; conversation-as-story; arrival; morning
after. Name the thing in plain English early. Don’t clone the Father Justin
spine (care works → revoked → sadness) unless the scene is unmistakably
different.

**Belief-makes-it-real** is on-topic but common — reserve ordinary posts for **significant or unusual** examples; thin cases stay wiki-only **or** become a **Historical** post (lineage dig, or **On this day** past specimen — e.g. War of the Worlds 1938 — see `content/VOICE.md`).

**One example per post.** Full prose rules: `content/VOICE.md` (and the
Editorial pack below).

## Editorial pack (copywriting / review)

When drafting or reviewing reader-facing articles:

1. `content/VOICE.md` — house voice (prose source of truth)
2. `content/desks/` — `AGENTS-articles.md` / `AGENTS-concepts.md`
3. `skills/publication-writing/` — workflow (`SKILL.md`) + gate
   (`scripts/check_editorial_rules.py`, `rules.yml`)
4. `skills/copywrite-article/SKILL.md` — thin SOP (defers to the above)
5. `project/wiki/style-guide.md` — short index only
6. `project/wiki/mission.md` + `publication-doctrine.md` — DNA

Sample Markus article for publisher testing:
`publications/pilobol/content/articles/kuak-skyride-clip.md`
