# Pilobol.us newsroom pod

Papyrus local pod + Kanbus publication board for **Pilobol.us** (*a fungus among us*).

- **Papyrus local pod** = desk language for this on-disk KB + newsroom.
- **Biblicus** = knowledge-base engine underneath.
- **Markus** = reader-facing Markdown publication (site builds via `web/build_via_papyrus.py`).
- **Kanbus** project key: `PILO`. Console port: `4260`. Stories only — not the knowledge store.

Pod path: `/workspace/pilobil.us` → `/workspace/pilobol.us`.

## Layout

```
.kanbus.yml                          # story type + stage machine + hooks
.papyrus/operator-cli.config.yaml    # local backend, corpus pilobil-us
bin/register-ref.py                  # accept a reference (JSON)
bin/list-refs.py                     # list accepted/pending refs
project/wiki/                        # Papyrus local-pod wiki (concepts, sources, DNA)
stories/WIKI-pilobil-accepted/references/  # accepted reference JSON
stories/<id>/                        # publication story artifacts
web/                                 # Markus site
```

Knowledge home: `project/wiki/` + `stories/WIKI-pilobil-accepted/references/`.
Do not put references on the Kanbus board.

## Stage order (publication stories)

`idea` → `assignment` → `research` → `report` → `editor_select` → `copywriting` → `published`

## Build (Markus site)

Article content lives in the Papyrus CMS, not in Git. Humans publish in
`/newsroom` on the CMS app; each publish starts a reader build. The reader
builds from the guest export of published items:

```bash
pip install "papyrus-newsroom[markus]==<pin in infra/site.json>"
export PAPYRUS_GRAPHQL_ENDPOINT=... PAPYRUS_IDENTITY_POOL_ID=... PAPYRUS_MEDIA_BUCKET=...
papyrus ops content export-published --auth guest --out content-export --clean
python3 reader/build.py --content content-export --out dist
```

The three variables are public values (see `infra/site.json`
`reader.environment`); no AWS credentials are needed. `web/reader-assets/` holds the
reader-owned files (effect scripts, lab pages, unreferenced images) that
`reader/build.py` overlays onto the export. Rollback of the cutover is Git history
(tag `pre-cms-cutover` is the last commit with `web/content`) plus a re-import into
the CMS.

Output: `dist/`. The build also:

- Regenerates homepage and archive listings from the exported articles at build
  time, newest date first. Homepage honors `feed: false`; the archive lists every
  published story.
- Embeds an [Auritus](https://aurit.us) narration player on every article.
  No build-time sync step: Auritus generates audio just-in-time, client-side,
  in the reader's own browser, keyed off a site key that's baked into the
  build (`_AURITUS_SITE_KEY` in `build_via_papyrus.py`) — see
  `auritus site create` in the [Auritus README](https://github.com/AnthusAI/Auritus)
  if that key ever needs rotating.

### Amplify / CI environment

Set in **Amplify Console → Environment variables**:

| Variable | Required in CI | Purpose |
|----------|----------------|---------|
| `PAPYRUS_GRAPHQL_ENDPOINT` | Yes (reader app, from `infra/site.json`) | CMS AppSync endpoint for the guest export |
| `PAPYRUS_IDENTITY_POOL_ID` | Yes (reader app, from `infra/site.json`) | Cognito identity pool for guest read |
| `PAPYRUS_MEDIA_BUCKET` | Yes (reader app, from `infra/site.json`) | CMS media bucket for exported images |

Article frontmatter:

- `feed: false` — omit from homepage cards (still published; still gets audio).
- `audio: false` — skip the Auritus embed for that slug.
- `author:` — defaults to `by various bots and Ryan Porter` when omitted.

## Quick check

Kanbus is pinned by `kanbus-version`. On a machine without the
`/workspace/kbs-172` checkout, install the pinned release from PyPI — it ships
the `kanbus` entry point, so alias it if you want the `kbs` name the docs use:

```bash
pip install "kanbus==$(cat kanbus-version)"
ln -sf "$(command -v kanbus)" /usr/local/bin/kbs
apt-get install -y mosquitto   # otherwise every kbs command prints a realtime warning
```

```bash
cd /workspace/pilobil.us
PATH=/workspace/kbs-172/bin:$PATH
kbs validate
kbs hooks validate
kbs wiki list
python3 bin/list-refs.py
```
