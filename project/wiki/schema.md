# Pilobil.us wiki schema

Papyrus local-pod knowledge base for the Pilobil.us newsroom. Wiki markdown
lives at `project/wiki/`. This is the documented exception to “do not edit
`project/`”; never hand-edit `project/issues` or `project/events`.

Desk language: **Papyrus local pod**. Biblicus is the KB engine underneath;
Papyrus is the automated newsroom. Agents do not need a second dialect for
day-to-day wiki work.

Operator config: `.papyrus/operator-cli.config.yaml` (`podPath` →
`/workspace/pilobil.us`, corpus `pilobil-us`). Symlink: `/workspace/pilobil.us`
→ `/workspace/pilobol.us`.

## Layers

- `concepts/` — standing editorial concepts (simulacrum, infiltrated circle,
  fungus, institutional lag, …).
- [index.md](index.md) — catalog; read first.
- [log.md](log.md) — append-only timeline.
- [accepted-refs.md](accepted-refs.md) — live accepted list from pod JSON.
- `sources/` — one markdown keeper page per accepted source (notes, claims,
  concept links).
- **Pod references** — JSON on standing story `WIKI-pilobil-accepted`
  (`stories/WIKI-pilobil-accepted/references/*.json`). Not Kanbus board cards.

## Register / list

```
python3 bin/register-ref.py --title "..." --url "https://..." --why "..."
python3 bin/list-refs.py
```

New accepts: write/update the `sources/` keeper **and** register JSON
(`--status accepted`). Rejected sources: write nothing.

## Concept page shape

- What it is, current thesis, anchors, open questions, last updated.
- Relative links to sibling concepts. No fabricated citations.

## Accept vs reject

- **Accept:** source page + JSON ref + update concepts/index/log as needed.
- **Reject:** no wiki trace.
