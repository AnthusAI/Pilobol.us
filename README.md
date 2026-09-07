# Pilobil.us newsroom pod

Papyrus local pod + Kanbus publication board for **Pilobil.us** (*a fungus among us*).

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

## Quick check

```bash
cd /workspace/pilobil.us
PATH=/workspace/kbs-172/bin:$PATH
kbs validate
kbs hooks validate
kbs wiki list
python3 bin/list-refs.py
```
