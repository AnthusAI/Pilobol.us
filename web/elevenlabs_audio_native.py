"""Sync Pilobolus article pages with ElevenLabs Audio Native projects.

Creates one Audio Native project per article slug (ElevenLabs requires a
project per URL/content bundle). Reuses persisted project_id values and
updates content only when the Markdown source hash changes.

Registry: ``web/elevenlabs-audio-native-projects.json`` (committed).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

API_BASE = "https://api.elevenlabs.io/v1/audio-native"
VOICE_ID = "EkK5I93UQWFDigLMpZcX"
# ElevenLabs player embed author — not the visible page byline.
AUDIO_NATIVE_PLAYER_AUTHOR = "Pilobol.us"
SITE_ORIGIN = "https://pilobol.us"
REGISTRY_NAME = "elevenlabs-audio-native-projects.json"


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _is_falsy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"0", "false", "no", "off"}


def _require_api_key() -> bool:
    """True when CI should fail without ELEVENLABS_API_KEY."""
    if _is_truthy(os.environ.get("PILOBOL_REQUIRE_ELEVENLABS")):
        return True
    if _is_falsy(os.environ.get("PILOBOL_REQUIRE_ELEVENLABS")):
        return False
    # Amplify Hosting sets AWS_BRANCH; treat that as CI.
    return bool(os.environ.get("AWS_BRANCH") or os.environ.get("AWS_APP_ID"))


def registry_path(pod_root: Path) -> Path:
    return pod_root / REGISTRY_NAME


def load_registry(pod_root: Path) -> dict[str, Any]:
    path = registry_path(pod_root)
    if not path.is_file():
        return {"projects": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RuntimeError(f"Invalid Audio Native registry shape in {path}")
    data.setdefault("projects", {})
    return data


def save_registry(pod_root: Path, data: dict[str, Any]) -> None:
    path = registry_path(pod_root)
    path.write_text(
        json.dumps(data, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def content_hash(markdown_path: Path) -> str:
    raw = markdown_path.read_text(encoding="utf-8")
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _strip_front_matter(text: str) -> str:
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end < 0:
        return text
    return text[end + 4 :].lstrip("\n")


def article_html_payload(
    markdown_path: Path,
    *,
    front_matter: dict[str, str],
    fragment_html: str,
) -> bytes:
    """Wrap Markus article HTML for Audio Native upload."""
    title = front_matter.get("title") or markdown_path.stem.replace("-", " ").title()
    body = fragment_html.strip()
    if not body:
        plain = _strip_front_matter(markdown_path.read_text(encoding="utf-8"))
        plain = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", plain)
        plain = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", plain)
        plain = re.sub(r"^#+\s+", "", plain, flags=re.M)
        plain = re.sub(r"\n{3,}", "\n\n", plain).strip()
        escaped = (
            plain.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        paragraphs = "".join(
            f"<p>{chunk.strip()}</p>"
            for chunk in escaped.split("\n\n")
            if chunk.strip()
        )
        inner = f"<h1>{title}</h1>{paragraphs}"
    else:
        inner = body
    document = (
        "<html><body><div>"
        f"{inner}"
        "</div></body></html>"
    )
    return document.encode("utf-8")


def _multipart_body(
    fields: dict[str, str],
    *,
    file_field: str,
    filename: str,
    file_bytes: bytes,
    content_type: str = "text/html",
) -> tuple[bytes, str]:
    boundary = f"----PilobolElevenLabs{hashlib.sha256(file_bytes).hexdigest()[:16]}"
    lines: list[bytes] = []
    for key, value in fields.items():
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode())
        lines.append(value.encode("utf-8"))
        lines.append(b"\r\n")
    lines.append(f"--{boundary}\r\n".encode())
    lines.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode()
    )
    lines.append(f"Content-Type: {content_type}\r\n\r\n".encode())
    lines.append(file_bytes)
    lines.append(b"\r\n")
    lines.append(f"--{boundary}--\r\n".encode())
    body = b"".join(lines)
    return body, boundary


def _api_post(
    url: str,
    *,
    api_key: str,
    fields: dict[str, str],
    file_field: str | None = None,
    filename: str | None = None,
    file_bytes: bytes | None = None,
) -> dict[str, Any]:
    if file_field and file_bytes is not None:
        body, boundary = _multipart_body(
            fields,
            file_field=file_field,
            filename=filename or "article.html",
            file_bytes=file_bytes,
        )
        content_type = f"multipart/form-data; boundary={boundary}"
    else:
        body, boundary = _multipart_body(fields, file_field="file", filename="empty.html", file_bytes=b"")
        content_type = f"multipart/form-data; boundary={boundary}"

    request = urllib.request.Request(url, data=body, method="POST")
    request.add_header("Content-Type", content_type)
    request.add_header("xi-api-key", api_key)
    request.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"ElevenLabs API {exc.code} for {url}: {detail.strip() or exc.reason}"
        ) from exc
    if not payload.strip():
        return {}
    parsed = json.loads(payload)
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Unexpected ElevenLabs response for {url}: {payload!r}")
    return parsed


def _api_get(url: str, *, api_key: str) -> dict[str, Any]:
    request = urllib.request.Request(url, method="GET")
    request.add_header("xi-api-key", api_key)
    request.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"ElevenLabs API {exc.code} for {url}: {detail.strip() or exc.reason}"
        ) from exc
    if not payload.strip():
        return {}
    parsed = json.loads(payload)
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Unexpected ElevenLabs response for {url}: {payload!r}")
    return parsed


def _api_json_post(url: str, *, api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("xi-api-key", api_key)
    request.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"ElevenLabs API {exc.code} for {url}: {detail.strip() or exc.reason}"
        ) from exc
    if not raw.strip():
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Unexpected ElevenLabs response for {url}: {raw!r}")
    return parsed


def get_project_settings(*, api_key: str, project_id: str) -> dict[str, Any]:
    return _api_get(f"{API_BASE}/{project_id}/settings", api_key=api_key)


def update_content_from_url(
    *,
    api_key: str,
    page_url: str,
    title: str,
    author: str = AUDIO_NATIVE_PLAYER_AUTHOR,
) -> None:
    """Re-sync an existing project from a live page URL (updates player author/title)."""
    _api_json_post(
        f"{API_BASE}/content",
        api_key=api_key,
        payload={"url": page_url, "author": author, "title": title},
    )


def article_page_url(slug: str) -> str:
    return f"{SITE_ORIGIN}/articles/{slug}.html"


def player_author_from_settings(settings: dict[str, Any]) -> str | None:
    nested = settings.get("settings")
    if isinstance(nested, dict):
        author = nested.get("author")
        if isinstance(author, str) and author.strip():
            return author.strip()
    return None


def sync_player_author(
    *,
    api_key: str,
    slug: str,
    title: str,
    project_id: str,
) -> None:
    print(f"  ElevenLabs: sync player author {slug} ({project_id}) → {AUDIO_NATIVE_PLAYER_AUTHOR}")
    update_content_from_url(
        api_key=api_key,
        page_url=article_page_url(slug),
        title=title,
        author=AUDIO_NATIVE_PLAYER_AUTHOR,
    )


def create_project(
    *,
    api_key: str,
    name: str,
    title: str,
    author: str,
    html_bytes: bytes,
) -> str:
    response = _api_post(
        API_BASE,
        api_key=api_key,
        fields={
            "name": name,
            "title": title,
            "author": author,
            "voice_id": VOICE_ID,
            "auto_convert": "true",
        },
        file_field="file",
        filename="article.html",
        file_bytes=html_bytes,
    )
    project_id = response.get("project_id")
    if not project_id:
        raise RuntimeError(f"ElevenLabs create missing project_id: {response!r}")
    return str(project_id)


def update_project(
    *,
    api_key: str,
    project_id: str,
    html_bytes: bytes,
) -> None:
    url = f"{API_BASE}/{project_id}/content"
    _api_post(
        url,
        api_key=api_key,
        fields={"auto_convert": "true", "auto_publish": "true"},
        file_field="file",
        filename="article.html",
        file_bytes=html_bytes,
    )


def _audio_disabled(front_matter: dict[str, str]) -> bool:
    val = front_matter.get("audio")
    if val is None:
        return False
    return str(val).strip().lower() in {"false", "0", "no", "off"}


def sync_article(
    *,
    slug: str,
    markdown_path: Path,
    front_matter: dict[str, str],
    fragment_html: str,
    registry: dict[str, Any],
    api_key: str,
) -> str | None:
    if _audio_disabled(front_matter):
        return None
    digest = content_hash(markdown_path)
    projects: dict[str, Any] = registry.setdefault("projects", {})
    entry = dict(projects.get(slug) or {})
    title = front_matter.get("title") or slug.replace("-", " ").title()
    html_bytes = article_html_payload(
        markdown_path,
        front_matter=front_matter,
        fragment_html=fragment_html,
    )
    project_id = entry.get("project_id")
    content_unchanged = bool(project_id and entry.get("content_hash") == digest)
    player_author_ok = entry.get("player_author") == AUDIO_NATIVE_PLAYER_AUTHOR

    if content_unchanged and player_author_ok:
        try:
            settings = get_project_settings(api_key=api_key, project_id=str(project_id))
            remote_author = player_author_from_settings(settings)
            if remote_author == AUDIO_NATIVE_PLAYER_AUTHOR:
                return str(project_id)
        except RuntimeError as exc:
            print(f"  WARNING: could not verify player author for {slug}: {exc}", file=sys.stderr)
            return str(project_id)

    if content_unchanged and project_id:
        sync_player_author(
            api_key=api_key,
            slug=slug,
            title=title,
            project_id=str(project_id),
        )
        projects[slug] = {
            **entry,
            "project_id": project_id,
            "content_hash": digest,
            "title": title,
            "player_author": AUDIO_NATIVE_PLAYER_AUTHOR,
        }
        return str(project_id)

    name = f"Pilobolus — {title}"
    if project_id:
        print(f"  ElevenLabs: update {slug} ({project_id})")
        update_project(api_key=api_key, project_id=str(project_id), html_bytes=html_bytes)
        sync_player_author(
            api_key=api_key,
            slug=slug,
            title=title,
            project_id=str(project_id),
        )
    else:
        print(f"  ElevenLabs: create {slug}")
        project_id = create_project(
            api_key=api_key,
            name=name,
            title=title,
            author=AUDIO_NATIVE_PLAYER_AUTHOR,
            html_bytes=html_bytes,
        )

    projects[slug] = {
        "project_id": project_id,
        "content_hash": digest,
        "title": title,
        "player_author": AUDIO_NATIVE_PLAYER_AUTHOR,
    }
    return str(project_id)


def sync_all_articles(
    *,
    pod_root: Path,
    articles: list[tuple[str, Path, dict[str, str], str]],
) -> dict[str, str]:
    """Return slug -> project_id for articles synced this build."""
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    require = _require_api_key()
    if not api_key:
        if require:
            print(
                "ERROR: ELEVENLABS_API_KEY is required in Amplify CI.\n"
                "Set it in Amplify Console → Environment variables.",
                file=sys.stderr,
            )
            raise SystemExit(1)
        print(
            "WARNING: ELEVENLABS_API_KEY not set — skipping Audio Native sync "
            "(local build). Set the key or PILOBOL_REQUIRE_ELEVENLABS=1 to fail.",
            file=sys.stderr,
        )
        registry = load_registry(pod_root)
        return {
            slug: str(entry["project_id"])
            for slug, entry in registry.get("projects", {}).items()
            if isinstance(entry, dict) and entry.get("project_id")
        }

    registry = load_registry(pod_root)
    project_ids: dict[str, str] = {}
    for slug, path, front_matter, fragment_html in articles:
        project_id = sync_article(
            slug=slug,
            markdown_path=path,
            front_matter=front_matter,
            fragment_html=fragment_html,
            registry=registry,
            api_key=api_key,
        )
        if project_id:
            project_ids[slug] = project_id

    save_registry(pod_root, registry)
    return project_ids
