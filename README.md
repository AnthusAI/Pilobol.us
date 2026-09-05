# Pilobil.us newsroom pod

Papyrus local pod + Kanbus publication board for **Pilobil.us** (*a fungus among us*).

- **Papyrus** = automated newsroom (desk language for this pod).
- **Biblicus** = knowledge-base system underneath.
- **Markus** = planned reader-facing Markdown publication front end.
- **Kanbus** project key: `PILO`. Console port: `4260`.

## Layout

```
.kanbus.yml                   # story type + stage machine + hooks
doctrine/pilobil.md           # publication doctrine
.papyrus/operator-cli.config.yaml
project/wiki/                 # local-pod KB (concepts, index, log)
project/policies/             # coaching + skip-ahead policy
hooks/                        # artifact gates + story scaffold
skills/advance-story/         # agent SOP for stage moves
stories/<id>/                 # per-story markdown artifacts
```

## Stage order

`idea` → `assignment` → `research` → `report` → `editor_select` → `copywriting` → `published`

## Quick check

```bash
cd /workspace/pilobil.us
PATH=/workspace/kbs-172/bin:$PATH
kbs validate
kbs hooks validate
kbs wiki list
kbs create "Smoke story" --type story
```
