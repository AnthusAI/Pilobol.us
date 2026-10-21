# Pilobol.us newsroom pod

Papyrus local pod + Kanbus publication board for **Pilobol.us** (*a fungus among us*).

- **Papyrus local pod** = desk language for this on-disk KB + newsroom.
- **Biblicus** = knowledge-base engine underneath.
- **Markus** = reader-facing Markdown publication (the site is the standard Papyrus front end: `web/projection.json`, `web/css/site-theme.css`, `web/hooks.py`).
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
the newsroom at the root (`/`) of the CMS app (`/newsroom` redirects there). pilobol.us is an
S3 projection behind CloudFront: saving or publishing runs the standard Papyrus front end, configured by
`web/projection.json` (settings), `web/css/site-theme.css` (theme) and `web/hooks.py` (masthead poem, cards,
article decoration), inside the publish mutation, and the page is live within seconds (no reader build, no Republish
button). To build the whole site locally, for example to compare with the projection, use the
guest export:

```bash
pip install "papyrus-newsroom[markus]==<pin in infra/site.json>"
export PAPYRUS_GRAPHQL_ENDPOINT=... PAPYRUS_IDENTITY_POOL_ID=... PAPYRUS_MEDIA_BUCKET=...
papyrus ops content export-published --auth guest --out content-export --clean
papyrus ops content project --all --from-dir content-export --static-dir web --out dist
```

The three variables are public values (see `Papyrus/docs/site-hosting.md`); no AWS credentials are needed for the
export. `web/assets/` holds the repository-owned files (effect scripts, lab pages, unreferenced images) that are
published under `/assets/`. Rollback of the cutover is Git history
(tag `pre-cms-cutover` is the last commit with `web/content`) plus a re-import into
the CMS.

Output: `dist/`. The site:

- Generates the home page and the archive (`/articles/`, "Spores") from the published articles' front matter, newest
  date first. The home page honors `feed: false`; the archive lists every published story.
- Embeds an [Auritus](https://aurit.us) narration player on every article.
  No build-time sync step: Auritus generates audio just-in-time, client-side,
  in the reader's own browser, keyed off a site key that's baked into
  `web/hooks.py` (`AURITUS_SITE_KEY`) — see
  `auritus site create` in the [Auritus README](https://github.com/AnthusAI/Auritus)
  if that key ever needs rotating.
- Writes `sitemap.xml`, `robots.txt`, `404.html`, `feed.xml` (RSS) and `atom.xml` from core.

### Environment

The guest export (local full build) needs the three public variables below; there is no CI reader build any more.
After a deploy that changes `web/` (settings, hooks or theme), the CMS backend deploy re-renders the site; to do it by hand run `papyrus ops content project --all` (see
`Papyrus/docs/site-hosting.md`).

| Variable | Purpose |
|----------|---------|
| `PAPYRUS_GRAPHQL_ENDPOINT` | CMS AppSync endpoint for the guest export |
| `PAPYRUS_IDENTITY_POOL_ID` | Cognito identity pool for guest read |
| `PAPYRUS_MEDIA_BUCKET` | CMS media bucket for exported images |

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

## License

Everything in this repository, writing and code alike, is licensed under the [MIT License](LICENSE).
