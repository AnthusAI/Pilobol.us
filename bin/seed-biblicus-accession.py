#!/usr/bin/env python3
"""Seed corpora/pilobol-us accession from accepted wiki refs.

Reads stories/WIKI-*-accepted/references/*.json (+ matching project/wiki/sources/<id>.md).
Writes:
  corpora/pilobol-us/metadata/config.json
  corpora/pilobol-us/metadata/catalog.json
  corpora/pilobol-us/imports/<id>--<slug>.{md,html,pdf}
  corpora/pilobol-us/imports/<id>--<slug>.{md,html,pdf}.biblicus.yml

Default: materialize import files from wiki source cards (claim text + link).
Optional --fetch: try HTTP GET of url (saves .html or .pdf); falls back to wiki card on failure.

Does not run Biblicus extract/taxonomy. Does not touch GraphQL.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

POD = Path(__file__).resolve().parents[1]
CORPUS_KEY = "pilobol-us"
CORPUS = POD / "corpora" / CORPUS_KEY
IMPORTS = CORPUS / "imports"
METADATA = CORPUS / "metadata"
WIKI_SOURCES = POD / "project" / "wiki" / "sources"

USER_AGENT = "Pilobol.us-accession-seed/0.1 (+AnthusAI; local corpus seed)"


def find_ref_dirs() -> list[Path]:
    stories = POD / "stories"
    dirs = sorted(stories.glob("WIKI-*-accepted/references"))
    # Prefer pilobol name if both exist
    preferred = [d for d in dirs if "pilobol" in d.parts[-2] and "pilobil" not in d.parts[-2]]
    return preferred or dirs


def load_refs() -> list[dict]:
    refs: dict[str, dict] = {}
    for d in find_ref_dirs():
        for path in sorted(d.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            rid = data.get("id") or path.stem
            data["id"] = rid
            data["_ref_path"] = str(path)
            refs[rid] = data
    return [refs[k] for k in sorted(refs)]


def wiki_path_for(ref: dict) -> Path | None:
    wiki = ref.get("wiki")
    if wiki:
        p = POD / wiki
        if p.exists():
            return p
    p = WIKI_SOURCES / f"{ref['id']}.md"
    return p if p.exists() else None


def parse_wiki_card(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    out = {"title": None, "url": None, "claim": None, "date": None, "kind": None, "outlet": None}
    lines = text.splitlines()
    if lines and lines[0].startswith("# "):
        out["title"] = lines[0][2:].strip()
    for line in lines[1:20]:
        if line.startswith("- Link:"):
            out["url"] = line.split(":", 1)[1].strip()
        elif line.startswith("- Outlet:"):
            out["outlet"] = line.split(":", 1)[1].strip()
        elif line.startswith("- Date:"):
            out["date"] = line.split(":", 1)[1].strip()
        elif line.startswith("- Kind:"):
            out["kind"] = line.split(":", 1)[1].strip()
        elif line.startswith("Claim:"):
            out["claim"] = line.split(":", 1)[1].strip()
    # claim may be multi-line until blank or Updated:
    if out["claim"] is None:
        for i, line in enumerate(lines):
            if line.startswith("Claim:"):
                parts = [line.split(":", 1)[1].strip()]
                for cont in lines[i + 1 :]:
                    if not cont.strip() or cont.startswith("Updated:"):
                        break
                    parts.append(cont.strip())
                out["claim"] = " ".join(p for p in parts if p)
                break
    return out


def short_slug(item_id: str) -> str:
    parts = [p for p in item_id.split("-") if p][:4]
    slug = "-".join(parts) if parts else item_id
    return re.sub(r"[^a-z0-9-]+", "-", slug.lower())[:48].strip("-") or "item"


def media_from_url(url: str) -> tuple[str, str]:
    lower = (url or "").lower().split("?", 1)[0]
    if lower.endswith(".pdf"):
        return "application/pdf", ".pdf"
    return "text/html", ".html"


def write_wiki_card_markdown(path: Path, *, title: str, url: str, claim: str, why: str) -> None:
    body = f"""# {title}

Source: {url}

## Claim (from Pilobol.us wiki keeper)

{claim or why or "(no claim text)"}

## Accession note

Seeded from accepted wiki/ref cards for Biblicus corpus accession.
Replace this stub by re-running with `--fetch` once network fetch is available,
or by dropping the full article/PDF into this path.
"""
    path.write_text(body, encoding="utf-8")


def fetch_url(url: str, dest: Path, timeout: int = 45) -> tuple[bool, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            data = resp.read()
            dest.write_bytes(data)
            return True, f"fetched {len(data)} bytes -> {dest.name}"
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
        return False, f"fetch failed: {exc}"


def yaml_escape(s: str) -> str:
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    return s


def write_sidecar(
    path: Path,
    *,
    title: str,
    media_type: str,
    item_id: str,
    source_url: str,
    abstract: str,
    published_at: str | None,
    tags: list[str],
) -> None:
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    published_line = f'  published_at: "{published_at}"\n' if published_at else ""
    tag_lines = "\n".join(f"  - {t}" for t in tags) or "  - pilobolus"
    abstract_one = " ".join((abstract or "").split())[:400]
    text = f"""title: "{yaml_escape(title)}"
media_type: {media_type}
abstract: "{yaml_escape(abstract_one)}"
biblicus:
  id: {item_id}
  source: {source_url}
dates:
{published_line}  retrieved_at: "{retrieved}"
tags:
{tag_lines}
curation:
  corpus_role: source-material
ingestion_rationale: >
  Seeded from Pilobol.us accepted wiki keepers / standing accepted-refs story
  for Biblicus taxonomy and knowledge-graph work.
"""
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fetch",
        action="store_true",
        help="HTTP-fetch each url into imports/ (pdf/html); fall back to wiki-card md on failure",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing import files and sidecars",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print actions only",
    )
    args = parser.parse_args()

    refs = load_refs()
    if not refs:
        print("No accepted refs found under stories/WIKI-*-accepted/references/")
        return 1

    if not args.dry_run:
        IMPORTS.mkdir(parents=True, exist_ok=True)
        METADATA.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc).isoformat()
    items: dict[str, dict] = {}
    order: list[str] = []
    actions: list[str] = []

    for ref in refs:
        item_id = ref["id"]
        wiki = wiki_path_for(ref)
        card = parse_wiki_card(wiki) if wiki else {}
        title = ref.get("title") or card.get("title") or item_id
        url = ref.get("url") or card.get("url") or ""
        claim = card.get("claim") or ref.get("why") or ""
        published = card.get("date")
        kind = card.get("kind") or ""
        tags = ["pilobolus"]
        if "surreal" in kind.lower():
            tags.append("surreal-specimen")
        if "fact-check" in kind.lower():
            tags.append("fact-check")
        elif "news" in kind.lower():
            tags.append("news")
        elif "classic" in kind.lower() or "psychology" in kind.lower():
            tags.append("classic")

        slug = short_slug(item_id)
        media_type, ext = media_from_url(url)
        # Default materialization is markdown claim card unless fetch succeeds as html/pdf
        use_ext = ".md"
        use_media = "text/markdown"
        import_name = f"{item_id}--{slug}{use_ext}"
        import_path = IMPORTS / import_name
        sidecar_path = IMPORTS / f"{import_name}.biblicus.yml"

        if args.fetch and url:
            f_media, f_ext = media_from_url(url)
            fetched_name = f"{item_id}--{slug}{f_ext}"
            fetched_path = IMPORTS / fetched_name
            if args.dry_run:
                actions.append(f"FETCH {url} -> {fetched_path.relative_to(POD)}")
                use_ext, use_media, import_path = f_ext, f_media, fetched_path
                sidecar_path = IMPORTS / f"{fetched_name}.biblicus.yml"
            else:
                if fetched_path.exists() and not args.force:
                    actions.append(f"SKIP fetch exists {fetched_path.name}")
                    use_ext, use_media, import_path = f_ext, f_media, fetched_path
                    sidecar_path = IMPORTS / f"{fetched_name}.biblicus.yml"
                else:
                    ok, msg = fetch_url(url, fetched_path)
                    actions.append(msg)
                    if ok:
                        use_ext, use_media, import_path = f_ext, f_media, fetched_path
                        sidecar_path = IMPORTS / f"{fetched_name}.biblicus.yml"
                    else:
                        # fall back to wiki card md
                        if not import_path.exists() or args.force:
                            write_wiki_card_markdown(
                                import_path, title=title, url=url, claim=claim, why=ref.get("why", "")
                            )
                            actions.append(f"WROTE wiki-card fallback {import_path.name}")
        else:
            if args.dry_run:
                actions.append(f"WRITE wiki-card {import_path.relative_to(POD)}")
            else:
                if import_path.exists() and not args.force:
                    actions.append(f"SKIP exists {import_path.name}")
                else:
                    write_wiki_card_markdown(
                        import_path, title=title, url=url, claim=claim, why=ref.get("why", "")
                    )
                    actions.append(f"WROTE {import_path.name}")

        if args.dry_run:
            actions.append(f"WRITE sidecar {sidecar_path.relative_to(POD)}")
        else:
            if sidecar_path.exists() and not args.force:
                actions.append(f"SKIP sidecar exists {sidecar_path.name}")
            else:
                write_sidecar(
                    sidecar_path,
                    title=title,
                    media_type=use_media,
                    item_id=item_id,
                    source_url=url,
                    abstract=claim,
                    published_at=published,
                    tags=tags,
                )
                actions.append(f"WROTE {sidecar_path.name}")

        if not args.dry_run and import_path.exists():
            relpath = str(import_path.relative_to(CORPUS))
            digest = sha256_file(import_path)
            items[item_id] = {
                "id": item_id,
                "relpath": relpath,
                "sha256": digest,
                "bytes": import_path.stat().st_size,
                "media_type": use_media,
                "title": title,
                "tags": tags,
                "source_uri": url,
                "created_at": now,
                "metadata": {
                    "title": title,
                    "tags": tags,
                    "biblicus": {"id": item_id, "source": url},
                },
            }
            order.append(item_id)

    config = {
        "schema_version": 1,
        "corpus_key": CORPUS_KEY,
        "title": "Pilobolus accepted sources",
        "description": "Seed accession from wiki keepers / standing accepted-refs for Biblicus taxonomy/KG",
    }
    catalog = {
        "schema_version": 2,
        "generated_at": now,
        "corpus_uri": f"file://{CORPUS}",
        "raw_dir": "imports",
        "latest_run_id": None,
        "latest_snapshot_id": None,
        "items": items,
        "order": order,
    }

    if args.dry_run:
        print(f"Would seed {len(refs)} refs into {CORPUS}")
        for line in actions:
            print(line)
        return 0

    (METADATA / "config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    (METADATA / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")

    print(f"Seeded {len(order)} items into {CORPUS}")
    print(f"Wrote {METADATA / 'config.json'}")
    print(f"Wrote {METADATA / 'catalog.json'}")
    for line in actions:
        print(line)
    print("\nNext: from Biblicus checkout, extract text against this corpus, then taxonomy discover.")
    print(f"  --corpus {CORPUS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
