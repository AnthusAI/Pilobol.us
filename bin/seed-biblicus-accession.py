#!/usr/bin/env python3
"""Seed the pilobol-us Biblicus corpus from accepted wiki keepers.

Reads stories/WIKI-*-accepted/references/*.json joined to
project/wiki/sources/<id>.md. Default v1 writes wiki-card stub imports
(durable copies, not symlinks). Pass --fetch to download source URLs
when feasible (PDF bytes, otherwise HTML/text). Fetch failures fall
back to the same wiki-card stub.

Does not invent Biblicus extract/taxonomy CLI. After accession:

    biblicus reindex --corpus corpora/pilobol-us
    biblicus extract ...          # later
    # taxonomy / KG               # later
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import yaml

POD = Path(__file__).resolve().parents[1]
CORPUS_KEY = "pilobol-us"
CORPUS = POD / "corpora" / CORPUS_KEY
USER_AGENT = "pilobol-us-biblicus-accession/1"
FETCH_TIMEOUT_S = 45

FIELD_RE = re.compile(r"^- +([^:]+):\s*(.*)$")
CONCEPT_RE = re.compile(r"\[([^\]]+)\]\(\.\./concepts/([^)]+?)(?:\.md)?\)")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def slugify(text: str, limit: int = 80) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return (slug[:limit].strip("-") or "item")


def accepted_story_dir() -> Path:
    stories = POD / "stories"
    preferred = stories / "WIKI-pilobol-accepted"
    if preferred.is_dir():
        return preferred
    matches = sorted(stories.glob("WIKI-*-accepted"))
    if not matches:
        raise SystemExit("No stories/WIKI-*-accepted directory found.")
    return matches[0]


def load_refs(story_dir: Path) -> list[dict]:
    refs_dir = story_dir / "references"
    rows: list[dict] = []
    for path in sorted(refs_dir.glob("*.json")):
        rec = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(rec, dict):
            continue
        if str(rec.get("status") or "").lower() not in {"", "accepted"}:
            continue
        rec["_ref_path"] = str(path.relative_to(POD))
        rows.append(rec)
    return rows


def parse_wiki(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    fields: dict[str, str] = {"body": text, "title": ""}
    claim_lines: list[str] = []
    in_claim = False
    for line in text.splitlines():
        if line.startswith("# ") and not fields["title"]:
            fields["title"] = line[2:].strip()
            continue
        match = FIELD_RE.match(line)
        if match:
            key = match.group(1).strip().lower()
            fields[key] = match.group(2).strip()
            in_claim = False
            continue
        if line.startswith("Claim:"):
            claim_lines.append(line[len("Claim:") :].strip())
            in_claim = True
            continue
        if in_claim:
            if line.startswith("Updated:") or (line.startswith("#") and not line.startswith("##")):
                in_claim = False
            elif line.strip():
                claim_lines.append(line.strip())
        if line.startswith("Updated:"):
            fields["updated"] = line[len("Updated:") :].strip()
    if claim_lines:
        fields["claim"] = " ".join(claim_lines)
    return fields


def tags_from_wiki(wiki: dict[str, str]) -> list[str]:
    tags: list[str] = []
    for _label, slug in CONCEPT_RE.findall(wiki.get("updated") or ""):
        tag = slugify(Path(slug).stem, 48)
        if tag and tag not in tags:
            tags.append(tag)
    kind = wiki.get("kind") or ""
    if kind:
        kind_tag = slugify(kind.split("(")[0], 48)
        if kind_tag and kind_tag not in tags:
            tags.append(kind_tag)
    return tags


def abstract_for(ref: dict, wiki: dict[str, str]) -> str:
    claim = (wiki.get("claim") or "").strip()
    if claim:
        return claim
    why = str(ref.get("why") or "").strip()
    return why or str(ref.get("title") or ref.get("id") or "")


def ingestion_rationale(ref: dict, wiki: dict[str, str]) -> str:
    why = str(ref.get("why") or "").strip()
    if why:
        return why
    kind = wiki.get("kind") or "accepted keeper"
    title = ref.get("title") or wiki.get("title") or ref.get("id")
    return f"{title} is accepted source-material for the {CORPUS_KEY} corpus ({kind})."


def wiki_card_markdown(ref: dict, wiki: dict[str, str], *, fetch_note: str | None = None) -> str:
    title = ref.get("title") or wiki.get("title") or ref.get("id")
    url = ref.get("url") or wiki.get("link") or ""
    lines = [
        f"# {title}",
        "",
        f"- Item id: `{ref.get('id')}`",
        f"- URL: {url}" if url else "- URL:",
        f"- Date: {wiki.get('date') or ''}".rstrip(),
        f"- Outlet: {wiki.get('outlet') or ''}".rstrip(),
        f"- Seen: {wiki.get('seen') or ''}".rstrip(),
        f"- Kind: {wiki.get('kind') or ''}".rstrip(),
        f"- Accession: wiki-card stub"
        + (f" ({fetch_note})" if fetch_note else " (source URL not fetched)"),
        "",
        "## Claim / why accepted",
        "",
        abstract_for(ref, wiki) or "(no claim filed)",
        "",
        "## Wiki keeper",
        "",
        (wiki.get("body") or "").strip() or f"_No wiki page at {ref.get('wiki')}_",
        "",
    ]
    return "\n".join(lines)


def extension_for(media_type: str, url: str) -> str:
    guessed = mimetypes.guess_extension(media_type or "") or ""
    if guessed in {".md", ".markdown"}:
        return ".md"
    if guessed in {".htm"}:
        return ".html"
    if guessed:
        return guessed
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".pdf", ".html", ".htm", ".md", ".txt"}:
        return ".html" if suffix == ".htm" else suffix
    if (media_type or "").startswith("text/html"):
        return ".html"
    if (media_type or "").startswith("application/pdf"):
        return ".pdf"
    return ".md"


def import_filename(item_id: str, title: str, media_type: str, url: str) -> str:
    slug = slugify(title or item_id)
    return f"{item_id}--{slug}{extension_for(media_type, url)}"


def fetch_url(url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_S) as response:
        content_type = response.headers.get_content_type() or ""
        payload = response.read()
    if not payload:
        raise RuntimeError("empty body")
    if not content_type:
        content_type = mimetypes.guess_type(urlparse(url).path)[0] or "application/octet-stream"
    return payload, content_type


def write_sidecar(path: Path, payload: dict) -> None:
    cleaned = {key: value for key, value in payload.items() if value is not None}
    path.write_text(
        yaml.safe_dump(cleaned, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )


def seed_item(
    ref: dict,
    *,
    imports_dir: Path,
    fetch: bool,
    retrieved_at: str,
) -> dict:
    item_id = str(ref.get("id") or "").strip()
    if not item_id:
        raise ValueError(f"Reference without id: {ref.get('_ref_path')}")
    wiki_rel = str(ref.get("wiki") or f"project/wiki/sources/{item_id}.md")
    wiki = parse_wiki(POD / wiki_rel)
    title = str(ref.get("title") or wiki.get("title") or item_id)
    url = str(ref.get("url") or wiki.get("link") or "").strip()
    tags = tags_from_wiki(wiki)
    abstract = abstract_for(ref, wiki)
    rationale = ingestion_rationale(ref, wiki)
    accession_mode = "wiki-card-stub"
    fetch_note = None
    media_type = "text/markdown"
    body: bytes | None = None

    if fetch and url:
        try:
            body, media_type = fetch_url(url)
            accession_mode = "fetched"
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError, OSError) as err:
            fetch_note = f"fetch failed: {err}"
            accession_mode = "wiki-card-stub"
            media_type = "text/markdown"
            body = None

    if body is None:
        media_type = "text/markdown"
        body = wiki_card_markdown(ref, wiki, fetch_note=fetch_note).encode("utf-8")

    filename = import_filename(item_id, title, media_type, url)
    import_path = imports_dir / filename
    import_path.write_bytes(body)
    relpath = f"imports/{filename}"
    sha256 = hashlib.sha256(body).hexdigest()
    sidecar = {
        "title": title,
        "media_type": media_type,
        "abstract": abstract,
        "biblicus": {"id": item_id, "source": url or None},
        "dates": {
            "published_at": wiki.get("date") or None,
            "updated_at": None,
            "retrieved_at": retrieved_at,
        },
        "tags": tags,
        "curation": {"corpus_role": "source-material"},
        "ingestion_rationale": rationale,
    }
    write_sidecar(Path(f"{import_path}.biblicus.yml"), sidecar)
    return {
        "id": item_id,
        "relpath": relpath,
        "sha256": sha256,
        "bytes": len(body),
        "media_type": media_type,
        "title": title,
        "tags": tags,
        "source_uri": url or None,
        "metadata": {
            "biblicus": {"id": item_id, "source": url or None},
            "accession_mode": accession_mode,
            "wiki": wiki_rel,
        },
        "created_at": retrieved_at,
        "accession_mode": accession_mode,
        "fetch_note": fetch_note,
    }


def write_config(path: Path) -> None:
    config = {
        "schema_version": 1,
        "corpus_key": CORPUS_KEY,
        "title": "Pilobolus accepted sources",
        "description": "Seed accession from wiki keepers / accepted refs",
    }
    path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def write_catalog(path: Path, items: list[dict], generated_at: str) -> None:
    catalog_items = {}
    order = []
    for item in items:
        item_id = item["id"]
        order.append(item_id)
        catalog_items[item_id] = {
            "id": item_id,
            "relpath": item["relpath"],
            "sha256": item["sha256"],
            "bytes": item["bytes"],
            "media_type": item["media_type"],
            "title": item["title"],
            "tags": item["tags"],
            "source_uri": item["source_uri"],
            "metadata": {
                "biblicus": item["metadata"]["biblicus"],
            },
            "created_at": item["created_at"],
        }
    catalog = {
        "schema_version": 2,
        "generated_at": generated_at,
        "corpus_uri": f"file:corpora/{CORPUS_KEY}",
        "raw_dir": ".",
        "latest_run_id": None,
        "latest_snapshot_id": None,
        "items": catalog_items,
        "order": order,
    }
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def reset_imports(imports_dir: Path) -> None:
    if imports_dir.exists():
        for child in imports_dir.iterdir():
            if child.is_file():
                child.unlink()
    imports_dir.mkdir(parents=True, exist_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed corpora/pilobol-us from accepted wiki refs")
    parser.add_argument(
        "--fetch",
        action="store_true",
        help="Download source URLs when feasible; fall back to wiki-card stubs on failure",
    )
    args = parser.parse_args()
    story = accepted_story_dir()
    refs = load_refs(story)
    if not refs:
        print(f"No accepted refs under {story / 'references'}", file=sys.stderr)
        return 1

    generated_at = utc_now()
    metadata_dir = CORPUS / "metadata"
    imports_dir = CORPUS / "imports"
    metadata_dir.mkdir(parents=True, exist_ok=True)
    reset_imports(imports_dir)
    write_config(metadata_dir / "config.json")

    items = []
    for ref in refs:
        item = seed_item(ref, imports_dir=imports_dir, fetch=args.fetch, retrieved_at=generated_at)
        items.append(item)
        mode = item["accession_mode"]
        extra = f"  {item['fetch_note']}" if item.get("fetch_note") else ""
        print(f"{mode}\t{item['id']}\t{item['relpath']}\t{item['bytes']}{extra}")

    write_catalog(metadata_dir / "catalog.json", items, generated_at)
    fetched = sum(1 for item in items if item["accession_mode"] == "fetched")
    stubs = len(items) - fetched
    print(
        f"seeded\t{len(items)}\tfetched={fetched}\tstubbed={stubs}\t"
        f"catalog={metadata_dir / 'catalog.json'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
