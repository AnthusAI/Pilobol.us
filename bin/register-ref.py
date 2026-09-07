#!/usr/bin/env python3
"""Add a pod-reference JSON for the Pilobil.us Papyrus local pod."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse

POD = Path(__file__).resolve().parents[1]
REFS = POD / "stories" / "WIKI-pilobil-accepted" / "references"
CORPUS = "pilobil-us"


def slug_from_url(url: str) -> str:
    p = urlparse(url)
    host = (p.netloc or "ref").replace("www.", "")
    tail = Path(p.path).name or host
    slug = re.sub(r"[^a-z0-9]+", "-", f"{host}-{tail}".lower())[:56].strip("-")
    return slug or "ref"


def main() -> int:
    parser = argparse.ArgumentParser(description="Register a Pilobil local pod reference")
    parser.add_argument("--title", required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--why", default="")
    parser.add_argument("--id", default="")
    parser.add_argument("--status", default="accepted")
    parser.add_argument("--source", default="pilobil-wiki")
    args = parser.parse_args()
    REFS.mkdir(parents=True, exist_ok=True)
    rid = args.id or slug_from_url(args.url)
    rec = {
        "id": rid,
        "title": args.title,
        "status": args.status,
        "corpus": CORPUS,
        "url": args.url,
        "source": args.source,
        "why": args.why,
    }
    path = REFS / f"{rid}.json"
    path.write_text(json.dumps(rec, indent=2) + "\n", encoding="utf-8")
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
