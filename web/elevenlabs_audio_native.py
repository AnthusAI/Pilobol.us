"""Sync Pilobolus article pages with ElevenLabs Audio Native projects.

Creates one Audio Native project per article slug (ElevenLabs requires a
project per URL/content bundle). Reuses persisted project_id values and
updates content only when the spoken HTML upload hash changes.

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

# Markus article chrome present in convert_fragment HTML but omitted from TTS.
_ARTICLE_LEDE_RE = re.compile(r'<p class="markus-lede">.*?</p>', re.S)
_ARTICLE_BYLINE_RE = re.compile(r'<p class="markus-byline">.*?</p>', re.S)


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


def upload_content_hash(html_bytes: bytes) -> str:
    """SHA-256 of the HTML bytes uploaded to ElevenLabs Audio Native."""
    return hashlib.sha256(html_bytes).hexdigest()


def _strip_spoken_chrome(html: str) -> str:
    """Remove subtitle and byline/date from Markus fragment HTML for TTS only."""
    stripped = _ARTICLE_LEDE_RE.sub("", html)
    stripped = _ARTICLE_BYLINE_RE.sub("", stripped)
    return stripped.strip()


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
    """Wrap Markus article HTML for Audio Native upload.

    Spoken track is headline + body only — no standfirst/lede or byline/date.
    Visible page chrome is unchanged; stripping happens here before upload.
    """
    title = front_matter.get("title") or markdown_path.stem.replace("-", " ").title()
    body = fragment_html.strip()
    if not body:
        # Title from front matter; body from markdown after front matter only.
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
        inner = _strip_spoken_chrome(body)
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


def get_project_settings(*, api_key: str, project_id: str) -> dict[str, Any]:
    return _api_get(f"{API_BASE}/{project_id}/settings", api_key=api_key)


def player_author_from_settings(settings: dict[str, Any]) -> str | None:
    nested = settings.get("settings")
    if isinstance(nested, dict):
        author = nested.get("author")
        if isinstance(author, str) and author.strip():
            return author.strip()
    return None


def remote_convert_status(*, api_key: str, project_id: str) -> str | None:
    try:
        settings = get_project_settings(api_key=api_key, project_id=project_id)
    except RuntimeError as exc:
        print(f"  WARNING: could not read convert status for {project_id}: {exc}", file=sys.stderr)
        return None
    nested = settings.get("settings")
    if isinstance(nested, dict):
        status = nested.get("status")
        if isinstance(status, str) and status.strip():
            return status.strip()
    return None


def remote_player_author(*, api_key: str, project_id: str) -> str | None:
    try:
        settings = get_project_settings(api_key=api_key, project_id=project_id)
    except RuntimeError as exc:
        print(f"  WARNING: could not read player settings for {project_id}: {exc}", file=sys.stderr)
        return None
    return player_author_from_settings(settings)


def player_author_is_correct(
    *,
    api_key: str,
    project_id: str,
    entry: dict[str, Any],
) -> bool:
    if entry.get("player_author") != AUDIO_NATIVE_PLAYER_AUTHOR:
        return False
    remote_author = remote_player_author(api_key=api_key, project_id=project_id)
    if remote_author is None:
        # Registry says OK but we could not verify remotely — recreate to be safe
        # when the registry predates player_author tracking.
        return entry.get("player_author_verified") is True
    return remote_author == AUDIO_NATIVE_PLAYER_AUTHOR


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
            # Convert happens on the follow-up content update, which is the
            # only Audio Native endpoint that accepts auto_publish.
            "auto_convert": "false",
        },
        file_field="file",
        filename="article.html",
        file_bytes=html_bytes,
    )
    project_id = response.get("project_id")
    if not project_id:
        raise RuntimeError(f"ElevenLabs create missing project_id: {response!r}")
    return str(project_id)


def create_and_publish_project(
    *,
    api_key: str,
    name: str,
    title: str,
    author: str,
    html_bytes: bytes,
) -> str:
    """Create a project, then convert+publish it.

    POST /v1/audio-native has auto_convert but no auto_publish. Without a
    published snapshot the embed loads and then hides itself. Content update
    is the endpoint that publishes.
    """
    project_id = create_project(
        api_key=api_key,
        name=name,
        title=title,
        author=author,
        html_bytes=html_bytes,
    )
    print(f"  ElevenLabs: publish {project_id}")
    update_project(api_key=api_key, project_id=project_id, html_bytes=html_bytes)
    return project_id


_LIVE_PROJECT_ID_RE = re.compile(r'data-projectid="([^"]+)"', re.I)
_LIVE_CONTENT_HASH_RE = re.compile(r'data-contenthash="([^"]+)"', re.I)


def recover_live_embed(slug: str) -> tuple[str | None, str | None]:
    """Read project_id / content hash from the live article embed, if any.

    Amplify writes an updated registry during the build but never commits it.
    New slugs would otherwise create a fresh unpublished project on every
    deploy. The live HTML is the project-id that readers already have.
    """
    urls = (
        f"{SITE_ORIGIN}/articles/{slug}.html",
        f"{SITE_ORIGIN}/{slug}.html",
    )
    for url in urls:
        request = urllib.request.Request(
            url,
            method="GET",
            headers={"User-Agent": "Pilobol.us Audio Native sync"},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                html = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                continue
            print(f"  WARNING: could not recover {slug} from {url}: {exc}", file=sys.stderr)
            continue
        except urllib.error.URLError as exc:
            print(f"  WARNING: could not recover {slug} from {url}: {exc}", file=sys.stderr)
            continue
        project_id = None
        pid_m = _LIVE_PROJECT_ID_RE.search(html)
        if pid_m:
            project_id = pid_m.group(1).strip() or None
        content_hash = None
        hash_m = _LIVE_CONTENT_HASH_RE.search(html)
        if hash_m:
            content_hash = hash_m.group(1).strip() or None
        if project_id:
            return project_id, content_hash
    return None, None


def update_project(
    *,
    api_key: str,
    project_id: str,
    html_bytes: bytes,
) -> dict[str, Any]:
    url = f"{API_BASE}/{project_id}/content"
    return _api_post(
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
    projects: dict[str, Any] = registry.setdefault("projects", {})
    entry = dict(projects.get(slug) or {})
    if not entry.get("project_id"):
        live_id, live_hash = recover_live_embed(slug)
        if live_id:
            print(f"  ElevenLabs: recover {slug} from live site ({live_id})")
            entry["project_id"] = live_id
            if live_hash and not entry.get("content_hash"):
                entry["content_hash"] = live_hash
    elif not entry.get("content_hash"):
        _, live_hash = recover_live_embed(slug)
        if live_hash:
            entry["content_hash"] = live_hash
    title = front_matter.get("title") or slug.replace("-", " ").title()
    html_bytes = article_html_payload(
        markdown_path,
        front_matter=front_matter,
        fragment_html=fragment_html,
    )
    digest = upload_content_hash(html_bytes)
    name = f"Pilobolus — {title}"
    project_id = entry.get("project_id")
    content_unchanged = bool(project_id and entry.get("content_hash") == digest)
    author_correct = bool(
        project_id
        and player_author_is_correct(
            api_key=api_key,
            project_id=str(project_id),
            entry=entry,
        )
    )

    if content_unchanged and author_correct:
        return str(project_id)

    if project_id and not author_correct:
        old_id = str(project_id)
        remote_author = remote_player_author(api_key=api_key, project_id=old_id)
        print(
            f"  ElevenLabs: recreate {slug} ({old_id}) — "
            f"player author was {remote_author!r}; author is create-only"
        )
        project_id = create_and_publish_project(
            api_key=api_key,
            name=name,
            title=title,
            author=AUDIO_NATIVE_PLAYER_AUTHOR,
            html_bytes=html_bytes,
        )
    elif project_id and not content_unchanged:
        status = remote_convert_status(api_key=api_key, project_id=str(project_id))
        if status == "processing":
            print(
                f"  ElevenLabs: skip {slug} ({project_id}) — still converting"
            )
            projects[slug] = {
                "project_id": project_id,
                "content_hash": entry.get("content_hash") or digest,
                "title": title,
                "player_author": AUDIO_NATIVE_PLAYER_AUTHOR,
                "player_author_verified": True,
            }
            return str(project_id)
        print(f"  ElevenLabs: update {slug} ({project_id})")
        update_project(api_key=api_key, project_id=str(project_id), html_bytes=html_bytes)
    else:
        print(f"  ElevenLabs: create {slug}")
        project_id = create_and_publish_project(
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
        "player_author_verified": True,
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


def _self_check() -> None:
    """Quick regression checks for spoken-chrome stripping (no pytest in repo)."""
    sample = (
        "<h1>Believe the rainbow</h1>"
        '<p class="markus-lede">TerraUSD was supposed to always equal a dollar.</p>'
        '<p class="markus-byline">by various bots and Ryan Porter · Sunday, September 6, 2026</p>'
        "<p>There is an old Skittles commercial still sitting on YouTube.</p>"
    )
    stripped = _strip_spoken_chrome(sample)
    assert "markus-lede" not in stripped
    assert "markus-byline" not in stripped
    assert "<h1>Believe the rainbow</h1>" in stripped
    assert "Skittles commercial" in stripped

    pod = Path(__file__).resolve().parent
    article = pod / "content" / "articles" / "believe-the-rainbow.md"
    payload = article_html_payload(
        article,
        front_matter={"title": "Believe the rainbow"},
        fragment_html=sample,
    )
    html = payload.decode("utf-8")
    assert "markus-lede" not in html
    assert "markus-byline" not in html
    assert "Believe the rainbow" in html

    sample_embed = (
        '<div id="elevenlabs-audionative-widget" '
        'data-projectid="qqnKQKwfIuSDXTkY1858" '
        'data-contenthash="abc123"></div>'
    )
    pid_m = _LIVE_PROJECT_ID_RE.search(sample_embed)
    hash_m = _LIVE_CONTENT_HASH_RE.search(sample_embed)
    assert pid_m is not None and pid_m.group(1) == "qqnKQKwfIuSDXTkY1858"
    assert hash_m is not None and hash_m.group(1) == "abc123"


if __name__ == "__main__":
    _self_check()
    print("elevenlabs_audio_native: self-check OK")
