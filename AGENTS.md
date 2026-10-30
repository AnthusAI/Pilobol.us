# AGENTS.md: Pilobol.us

Operating manual for any agent or person working in this repository, whatever the tool. Read [README.md](README.md) first (what this is, where it runs, how a change ships). Engine-level rules live in the Papyrus [AGENTS.md](https://github.com/AnthusAI/Papyrus/blob/main/AGENTS.md); this file does not repeat them. Papyrus docs index: [docs/README.md](https://github.com/AnthusAI/Papyrus/blob/main/docs/README.md).

Pilobol.us (pilobol.us) is pre-production. Move fast, but use a pull request for every change. Part 1 is operations (read it before touching code or infrastructure). Part 2 is the editorial doctrine for anyone writing or reviewing stories.

# Part 1: Operations

## Map of the parts

| Part | Where | Docs |
| --- | --- | --- |
| Site registration and backend options | `papyrus.config.ts` (`defineSite`: brand `pilobol-us`, `s3-projection` publication with `staticDir: "web"`, edge distribution ARN `E2GKJ877IAH2I8`, `stagingBuild` on; console responder, Slack, inbound email and storage backups off) | [site-hosting](https://github.com/AnthusAI/Papyrus/blob/main/docs/site-hosting.md) |
| Standard projector (the public static site) | `web/projection.json` (settings: sections `articles` "Spores" and `effects`, feeds, sitemap, public data, GA4 and consent, agent output), `web/css/site-theme.css` (theme), `web/hooks.py` (masthead poem, cards, article decoration, video embeds, image effects, home, archive and 404 bodies, the Auritus narration player), `web/assets/` (effect scripts, lab pages, images, published under `/assets/`) | [building-a-papyrus-static-site](https://github.com/AnthusAI/Papyrus/blob/main/docs/building-a-papyrus-static-site.md) |
| CMS backend and console | The package's Amplify Gen 2 backend, newsroom at the root of `newsroom.pilobol.us` | [newsroom-operations](https://github.com/AnthusAI/Papyrus/blob/main/docs/newsroom-operations.md) |
| The edge | Public site: stack `papyrus-edge-pilobol-us` (template `infra/edge/pilobol-us.yaml` in the Papyrus repo). Newsroom host: stack `papyrus-edge-pilobol-us-cms` (design notes in Papyrus `docs/hosting/pilobolus-newsroom-repair.md`). | [edge-under-the-cms-backend](https://github.com/AnthusAI/Papyrus/blob/main/docs/hosting/edge-under-the-cms-backend.md) |
| CDK app shell | `infra/site.json` (account, hosted zone, domains, staging preview build command, Cognito prefix, GitHub ids, `papyrusVersion`) and `infra/README.md` | [site-hosting](https://github.com/AnthusAI/Papyrus/blob/main/docs/site-hosting.md) |
| Editorial doctrine and sections | One-time import files `corpora/pilobol-us-newsroom-sections.yml` and the steering file `corpora/pilobol-us-steering.yml`. The live doctrine is data in the CMS (see Part 2). | [editorial-context](https://github.com/AnthusAI/Papyrus/blob/main/docs/editorial-context.md), [steering-and-relevance](https://github.com/AnthusAI/Papyrus/blob/main/docs/steering-and-relevance.md) |
| Publication board | Kanbus project `PILO` (`.kanbus.yml`, `project/`, `stories/`, stage gates in `hooks/`, skill `skills/advance-story`). Stories only. | [CONTRIBUTING_AGENT.md in Papyrus](https://github.com/AnthusAI/Papyrus/blob/main/CONTRIBUTING_AGENT.md) |
| Local knowledge pod | `project/wiki/` (concepts, sources), `stories/WIKI-pilobil-accepted/references/`, `corpora/pilobol-us/`, scripts in `bin/` | [knowledge-base](https://github.com/AnthusAI/Papyrus/blob/main/docs/knowledge-base.md) |
| Agent-readable output | `agents` and `pageActions` in `web/projection.json`: Markdown twins, `llms.txt`, `llms-full.txt`, copy and open-in-AI actions | [agent-readable-sites](https://github.com/AnthusAI/Papyrus/blob/main/docs/agent-readable-sites.md) |
| GA4 and consent | `chrome.ga_measurement_id` and `chrome.consent_mode` in `web/projection.json` | [site-hosting, Consent Mode v2](https://github.com/AnthusAI/Papyrus/blob/main/docs/site-hosting.md) |
| Narration | Auritus embed on every article, client-side, keyed by a public site key in `web/hooks.py` | [Auritus](https://github.com/AnthusAI/Auritus) |

Papyrus features that run in the deployed backend rather than in files here: the shared relevance Cyclotron and section-fit classifier (they read the section and doctrine records), review requests and the Notification Center, the procedure runner ([procedure-runner](https://github.com/AnthusAI/Papyrus/blob/main/docs/procedure-runner.md)), [automations](https://github.com/AnthusAI/Papyrus/blob/main/docs/automations.md) and the weekly knowledge run ([knowledge-cloud-run](https://github.com/AnthusAI/Papyrus/blob/main/docs/knowledge-cloud-run.md)). Not used by this site: the newsletter plugin ([newsletter](https://github.com/AnthusAI/Papyrus/blob/main/docs/newsletter.md)) and reader steering ([reader-steering](https://github.com/AnthusAI/Papyrus/blob/main/docs/reader-steering.md)); nothing in `web/` or `papyrus.config.ts` enables them. Whether Cyclotron and the knowledge run are switched on for this site in the live backend was not verified when this file was written. Pilobol.us is not among the sites the Papyrus monitoring docs list for Hacker News routing.

## Common tasks

Use `AWS_PROFILE=papyrus-production` (account `712236451410`) and prefer read-only AWS calls.

**Run the tests**: the CI steps in the README (`npm ci`, stub `amplify_outputs.json`, `npx papyrus-app sync && npx tsc --noEmit`, `python3 -m unittest discover -s tests`). The only unit test covers `bin/diff-trees.py`. Board checks: `KANBUS_REALTIME_BROKER=off kbs validate` and `kbs hooks validate`.

**Preview a change to `web/`**: export the published content and project it locally (README, Quick start). Compare `dist/` with the live site. A draft preview of unpublished content is built by the CMS `staging` branch using `cms.stagingPreview` in `infra/site.json`.

**Bump the Papyrus pin**

1. `npm view @anthusai/papyrus version`, then read the release notes.
2. In one change set the same exact version in `package.json` and `infra/site.json` (`papyrusVersion`), then `npm install` so `package-lock.json` agrees. Use the same version for `pip install "papyrus-newsroom[markus]==<version>"` in local builds.
3. Open a pull request to `main` and merge when CI is green. The merge deploys the backend and re-renders the site. Never bump `package.json` alone: the version in `infra/site.json` decides the template that ships.

**Deploy**: merge a pull request to `main`. The `CI and deploy` workflow starts the Amplify job for the merged commit on app `d1eiwl0gedkmnj` through GitHub OIDC (role `pilobol-us-github-deploy`); Amplify's auto-build on `main` is off. Never zip a local build and push it with `aws amplify create-deployment` or `start-deployment`, never run `ampx pipeline-deploy` from a laptop, and never improvise a manual deploy. After a merge check that `https://pilobol.us/` returns 200 and `aws amplify list-jobs --app-id d1eiwl0gedkmnj --branch-name main --max-results 3` shows the merged commit (GitHub webhooks and jobs can be minutes late). If the AWS login is expired, `aws login` needs an interactive step only the user can complete: say so and stop.

**Re-project safely** (after changing `web/` without a backend deploy):

```bash
papyrus ops content project --reconcile --dry-run     # report drift, delete nothing
papyrus ops content project --all                      # re-render every page
```

A backend deploy re-renders the site by itself. Read the reconcile and deletion-guard sections of [site-hosting](https://github.com/AnthusAI/Papyrus/blob/main/docs/site-hosting.md) before any real reconcile. Image renditions: `papyrus ops content renditions --backfill --dry-run`, then without `--dry-run`.

**Edit editorial doctrine**: `papyrus sections doctrine set --kind mission --file <md> --dry-run`, or the newsroom Administration screens (`/administration/policies`, `/administration/sections`). The YAML files in `corpora/` are only a one-time import (`papyrus sections import-doctrine`, `papyrus sections import`); they never overwrite existing records.

**Register a site procedure**, **create an automation**, **start a new Papyrus site**: [newsroom-procedures-runbook](https://github.com/AnthusAI/Papyrus/blob/main/docs/newsroom-procedures-runbook.md), [automations](https://github.com/AnthusAI/Papyrus/blob/main/docs/automations.md) (only `monitor` triggers run today), [building-a-papyrus-static-site](https://github.com/AnthusAI/Papyrus/blob/main/docs/building-a-papyrus-static-site.md). Copy the shape of `papyrus.config.ts`, `web/` and `infra/site.json`, not Papyrus code.

**Add a reference to the local pod**: `python3 bin/register-ref.py --title "..." --url "..." --why "..."`; list with `python3 bin/list-refs.py`.

## Hard rules

- Never run `papyrus ops content project --reconcile` for real without the deployed plugin list (the CLI refuses without a readable `amplify_outputs.json` or a matching `PAPYRUS_PLUGINS`). Never use `--allow-deletions`. Always dry-run first.
- Projections take the projection lease; do not start one by hand while a deploy or a knowledge run is projecting.
- Secrets go in SSM Parameter Store as SecureString, created by infrastructure code, never in this repository. Never commit `.env*` or `amplify_outputs.json`.
- No real email addresses anywhere in the repository. Use placeholders; allowlists live in AWS configuration.
- Shared checkouts: never switch branches and never `git stash`. Use `git worktree add` or a fresh clone.
- Gherkin specs for every behaviour change, narrative and complete. Unit tests alone are not enough. (This repository has no `features/` runner today; put specs for engine behaviour in the Papyrus repository and for site behaviour under `features/` here.)
- Do not add a projector, a sitemap writer or a feed generator here. If the standard front end cannot do something, add it to Papyrus core.
- Do not read or write `project/` Kanbus data directly except the wiki pages under `project/wiki/*.md`; use `kbs`. Board mechanics: `KANBUS_REALTIME_BROKER=off kbs ...`; stories go open, in_progress, blocked or closed. Human review is never a story state; use review requests.
- Pull requests go to `main`. Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). Never force-push `main`.
- Wording: never write "desk"; say "section", "newsroom" or the role. Attribution is "AI". Use "Account", not "Organization", for the shared directory tenant.
- GA4 follows the anth.us standard: Consent Mode v2 with the banner and a Cookie settings link. Do not turn on `analytics_only` here.
- Production deploys are by merge to `main` through CI. Reader copy only goes live when Ryan asks in chat (see Part 2, Morning automation).

## Ownership and coordination

- Engine changes belong in the Papyrus repository; this repository follows by bumping the pin.
- Tell the Papyrus session before changing anything shared: the monitoring router, the procedure runner, the shared Cyclotron, and the reusable workflow `AnthusAI/Papyrus/.github/workflows/amplify-deploy.yml` that this repository's deploy job calls at `@main`.
- Never touch Anth.us from here. Ryan owns this publication.

## Current state (2026-10-23)

- Live: `https://pilobol.us/` (200), `/feed.xml` and `/llms.txt` (200), `https://newsroom.pilobol.us/` (200). GA4 and the consent banner are in the pages. Last deployed commit on `main` at the time of writing: the Papyrus 5.29.0 and GA4 merge.
- Pinned to Papyrus `5.60.0`.
- The mission doctrine was saved in the CMS in the 2026-10-22 handover (record `item-editorial-doctrine-mission-v1`, slug `editorial-doctrine-mission`; recorded from the handover, not re-read from the backend), and the four section descriptions were rewritten in Papyrus PR 640 to match it. The copy of the sections file in this repository carries that rewrite. Whether the live backend already holds `NewsroomSection` records was not verified (PR 640 said it had none).
- Known stale items, left as they are because they touch authentication or are historical: `papyrus.config.ts` still lists OAuth redirect URLs for a retired Amplify app (`dv0pdx67fk80m`), and `docs/organizer-cms-rollout.md` is a historical note whose claim that `amplify.yml` only generates outputs is out of date (it runs `ampx pipeline-deploy` today). `.papyrus/operator-cli.config.yaml` points at a `/workspace` path that exists only on the original author's machine. `staging.pilobol.us` does not resolve in DNS at the moment; the Amplify domain associations for it and for `newsroom.pilobol.us` report `FAILED`.
- The `develop` branch is far behind `main`. Work from `main`.
- Planned: nothing recorded in this repository. Product work is on the Papyrus `PPY` board; this repository's board is the `PILO` publication board.

## Where the docs live

Here: this file, `content/VOICE.md`, `inclusion_rubric.md`, `project/wiki/` and `docs/organizer-cms-rollout.md` (historical). Engine docs: the [Papyrus docs index](https://github.com/AnthusAI/Papyrus/blob/main/docs/README.md).

# Part 2: Editorial doctrine

The authoritative editorial mission and policy are data in the CMS (`editorial-doctrine-mission`, `editorial-doctrine-policy`, and each section's mission, policy, assignment guidance and kill criteria). Read them with `papyrus editorial context --backend cloud --section SECTION_ID --format text`; private doctrine shapes decisions and is never evidence to quote in reader copy. The wiki pages below (`project/wiki/mission.md`, `publication-doctrine.md`) and the rest of this part are the working notes behind that doctrine. If they disagree with the CMS record, the CMS record wins and the note should be updated the same day.

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

Stack: a **Papyrus local pod** with **Biblicus** as the knowledge-base engine underneath. The
public site is the standard Papyrus front end (Part 1).

### Knowledge base (Papyrus local pod)

- Pod root: the repository root.
- Wiki: `project/wiki/` (concepts + `sources/` keepers).
- Accepted references JSON: `stories/WIKI-pilobil-accepted/references/`.
- Register: `python3 bin/register-ref.py --title "..." --url "..." --why "..."`.
- List: `python3 bin/list-refs.py`.
- Kanbus (`PILO`, console 4260) is **stories only** — never put references on the board.
  Every piece is a board story first (Ryan HARD LOCK 2026-09-10 — see **Newsroom board
  first** and **Morning automation: board only, never publish** below).

**Site is live** at pilobol.us. Reader copy still must never name the house or talk
about “our take.” Publication DNA lives in this file plus `project/wiki/mission.md`,
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

## Newsroom board first (Ryan HARD LOCK 2026-09-10)

Always use the **Pilobolus newsroom board**. Every piece starts as a Kanbus
**PILO** / Papyrus board story — not as a draft article or chat-only copy.

Store intent, reporting notes, and narrative/presentation ideas on the board
(`idea.md`, `assignment.md`, `research.md`) **before** `article-draft.md` or chat
copywriting. Never let a story begin life only as a draft article. Digests and chat
point at the board id; the draft is downstream.

## Morning automation: board only, never publish (Ryan HARD LOCK 2026-09-10)

**Morning automation** (overnight bots: `pilobil-4am-find`, `pilobol-research-story`,
weekday 9am fungus scout, and any scheduled Anthus/Pilobolus agent runs) files
**newsroom board stories only** on Kanbus **PILO** / the Papyrus newsroom board. It is
**not** authorized to ship reader copy to the live site.

**Forbidden without Ryan’s explicit publish ask in chat:**

- Publishing in the Papyrus CMS (newsroom at `/`) or importing items into it (saving or
  publishing an item projects its pages straight onto pilobol.us).
- Pushing reader copy to `main`, opening a publish PR, or triggering a deploy to ship reader copy.
- Treating a board `article.md`, `article-draft.md`, or Kanbus status **`published`**
  as permission to go live — board workflow and production are separate gates.

Publication stays a **human, chat-requested** step after board review. Overnight work
stops at filed PILO stories, wiki keepers, and digests that point at board ids.

**Why (2026-09-10):** Anthus Bot direct-pushed `wiki-janitor.md` to `main`
(commit `71e4913`) while Ryan was editing the approved ZZZ piece (`PILO-ceb623`,
PR #20). The duplicate was removed in PR #21. Do not repeat.

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

**Never cite our own sites (Ryan 2026-09-23):** reader copy must not link to or
name Anth.us / Anthus or Chattic.us as a source. When one of those pieces covers
a finding, cite an independent source for the same effect instead.

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


**Hello, fellow humans (Ryan HARD 2026-09-29):** no prose that sounds like a
bot pretending to be a person — clever metaphors in place of facts, riddle
closers, borrowed idioms used slightly wrong. The weirdness is in what
happened; the sentences stay plain. Examples and tests: `content/VOICE.md`.

**The spine (Ryan HARD 2026-09-29):** every piece is about the copy of life
coming to matter more than life. Surveillance, fakes and feeds are causes, never
the whole subject; bridge into and out of each evidence chain, cut true facts
that don't serve the argument, and let the standfirst carry the whole argument,
not its smallest example. Check characterizations against the primary record
(Hansard, court papers, the code itself) and keep speakers' qualifiers.

**Dress every piece (Ryan 2026-09-29):** no reader post ships as text alone —
cover, scannable headings, drawn diagrams, research figures, verified video.
Rules and rights: `content/VOICE.md`, *Dressing a piece*.

**Street-readable** — full sentences; assume a non-technical Facebook-heavy
reader who never heard “simulacrum.” No fake newsroom slang in reader copy. No
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

1. `content/VOICE.md` — house voice, the single source of truth for prose,
   structure, sourcing and presentation
2. `project/wiki/style-guide.md` — short index only
3. `project/wiki/mission.md` + `publication-doctrine.md` — DNA
4. The published article `the-end-of-the-rave` (in the CMS, or in Git history before
   the CMS cutover: `git show pre-cms-cutover:web/content/articles/the-end-of-the-rave.md`) — the reference piece for how a
   finished article reads and looks (spine, bridges, headings, cover, diagrams,
   research figures, video)
