---
name: advance-pilobol-story
description: >-
  Advance a Pilobol.us newsroom pod story through Kanbus stages. Use when
  working in /workspace/pilobol.us, moving a story between idea/assignment/
  research/report/editor_select/copywriting/published, or when Kanbus refuses
  a transition.
---
# Advance a Pilobol.us newsroom story

Work from the pod root: `/workspace/pilobol.us`. Prefer Kanbus **0.20.1**
(`kanbus-version`). Never edit `project/issues/` or `project/events/` by hand.
Wiki pages under `project/wiki/` are the exception — agents may edit those.

Read `project/wiki/mission.md` and `project/wiki/publication-doctrine.md` when
context is thin. Desk language: Papyrus local pod (Biblicus is the KB engine
underneath; Papyrus is the automated newsroom).

## Inspect before acting

1. `kbs show <story-id>` — current stage, title, and guidance.
2. Read `stories/<story-id>/` — which artifacts exist.
3. Read doctrine and relevant `project/wiki/concepts/` pages.

## Stage order

`idea` → `assignment` → `research` → `report` → `editor_select` → `copywriting` → `published`

Do not skip stages; workflow and hooks refuse skip-ahead.

## Artifacts (one directory per story)

| Stage entered via transition | File that must exist before advancing |
| --- | --- |
| `assignment` | `idea.md` |
| `research` | `assignment.md` |
| `report` | `research.md` |
| `editor_select` | `report.md` |
| `copywriting` | `editor_select.md` |
| `published` | `article.md` |

Reader-facing `article.md` will eventually be Markus markdown. Until the
Markus publish path exists, treat `article.md` as the publish artifact.

## Advance a story

```bash
cd /workspace/pilobol.us
kbs update <story-id> --status <next-stage>
```

## Create a new story

```bash
cd /workspace/pilobol.us
kbs create "Post title" --type story
```

Creation scaffolds `stories/<new-id>/idea.md`. Fill `idea.md`, then move to
`assignment`.
