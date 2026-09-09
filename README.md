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

```bash
cd web && PAPYRUS_ROOT=/path/to/Papyrus python3 build_via_papyrus.py
```

Output: `web/dist-papyrus/`. The build also:

- Regenerates `web/content/index.md` and `web/content/articles/index.md` from
  `web/content/articles/*.md` (homepage honors `feed: false`; archive lists all
  published stories).
- Syncs ElevenLabs Audio Native projects (one per article) when
  `ELEVENLABS_API_KEY` is set.

### Amplify / CI environment

Set in **Amplify Console → Environment variables**:

| Variable | Required in CI | Purpose |
|----------|----------------|---------|
| `ELEVENLABS_API_KEY` | Yes (Amplify builds fail without it) | Create/update Audio Native projects with voice `EkK5I93UQWFDigLMpZcX` |
| `PAPYRUS_ROOT` | No (set in `amplify.yml`) | Papyrus checkout for Markus renderer |

Local builds without the API key print a warning and reuse
`web/elevenlabs-audio-native-projects.json`. Set `PILOBOL_REQUIRE_ELEVENLABS=1`
to fail locally when the key is missing.

Article frontmatter:

- `feed: false` — omit from homepage cards (still published; still gets audio).
- `audio: false` — skip ElevenLabs sync for that slug.
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
