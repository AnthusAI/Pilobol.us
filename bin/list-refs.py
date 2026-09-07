#!/usr/bin/env python3
"""List Pilobil pod-references (JSON under stories/*/references/)."""
import json
from pathlib import Path

POD = Path(__file__).resolve().parents[1]
print("kind\tstatus\tid\ttitle\tcorpus")
stories = POD / "stories"
if not stories.exists():
    raise SystemExit(0)
for story in sorted(stories.glob("*")):
    refs = story / "references"
    if not refs.is_dir():
        continue
    for path in sorted(refs.glob("*.json")):
        try:
            rec = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(rec, dict):
            continue
        print(
            "\t".join(
                [
                    "pod-reference",
                    str(rec.get("status") or ""),
                    str(rec.get("id") or path.stem),
                    str(rec.get("title") or ""),
                    str(rec.get("corpus") or ""),
                ]
            )
        )
