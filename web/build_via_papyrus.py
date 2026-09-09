#!/usr/bin/env python3
"""Build Pilobol.us through **Papyrus's** Markus renderer.

This is the point of the whole renderer initiative: Pilobol.us is not a
hand-rolled Markus site that happens to look like a Papyrus publication, it is
a publication rendered *by* Papyrus's `markus` renderer. The publication
supplies only its own identity (masthead, tagline, footer, theme CSS,
decorative scripts); the rendering itself is Papyrus's.

Contrast with the legacy `build.py` in this directory, which shells out to
`markus convert` directly and states "No Papyrus code involved". That script
also cannot rebuild its own front page or articles (it only writes
`effects/*.html`), so its `dist/` output is partly orphaned. See Papyrus
PPY-a2c716.

Usage:
    PAPYRUS_ROOT=/path/to/Papyrus python3 web/build_via_papyrus.py

`PAPYRUS_ROOT` defaults to ../Papyrus relative to this pod.
"""
from __future__ import annotations

import os
import re
import sys
from html import escape, unescape
from pathlib import Path

POD_ROOT = Path(__file__).resolve().parent
DEFAULT_PAPYRUS = POD_ROOT.parent.parent / "Papyrus"

PAPYRUS_ROOT = Path(os.environ.get("PAPYRUS_ROOT", DEFAULT_PAPYRUS)).resolve()
if not (PAPYRUS_ROOT / "src" / "papyrus_content").is_dir():
    sys.exit(
        f"Papyrus not found at {PAPYRUS_ROOT}. "
        "Set PAPYRUS_ROOT to your Papyrus checkout."
    )

sys.path.insert(0, str(PAPYRUS_ROOT / "src"))

from papyrus_content.markus_renderer import build as markus_build  # noqa: E402
from papyrus_content.markus_renderer import shell as markus_shell  # noqa: E402
from papyrus_content.markus_renderer.build import build_markus_site  # noqa: E402
from papyrus_content.markus_renderer.shell import SiteChrome  # noqa: E402

from elevenlabs_audio_native import sync_all_articles  # noqa: E402
from pilobol_feed import (  # noqa: E402
    DEFAULT_AUTHOR,
    discover_articles,
    parse_front_matter,
    write_generated_feed_pages,
)

# No site nav for now (YAGNI). Archive/drill-down later when there's a pile.
markus_build._build_nav_items = lambda articles: []

# Tagline is None: left-side masthead poem carries wordmark + lines.
# footer_html can't be "" (falsy → Papyrus default).
PILOBOL_CHROME = SiteChrome(
    site_name="Pilobolus",
    tagline=None,
    footer_html="<!-- background credit host -->",
    scripts=(
        "assets/background-manager.js",
        "assets/organic-image.js",
        "assets/cinematic-gallery.js",
    ),
)

_orig_render_page = markus_shell.render_page

# Markus :::video becomes <video src="…">; YouTube watch URLs need an iframe.
_YT_VIDEO_RE = re.compile(
    r'<video(?P<pre>[^>]*?)\bclass="markus-video"(?P<mid>[^>]*?)\bsrc="'
    r'(?P<src>https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)(?P<id>[\w-]{6,}))'
    r'(?:[^"]*)"(?P<post>[^>]*)>\s*</video>',
    re.I,
)


def _rewrite_youtube_videos(html: str) -> str:
    def repl(m: re.Match[str]) -> str:
        vid = m.group("id")
        blob = f'{m.group("pre")}{m.group("mid")}{m.group("post")}'
        title_m = re.search(r'\btitle="([^"]*)"', blob)
        title = escape(title_m.group(1) if title_m else "YouTube video", quote=True)
        return (
            f'<div class="pilo-youtube">'
            f'<iframe src="https://www.youtube-nocookie.com/embed/{vid}" '
            f'title="{title}" '
            f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; '
            f'gyroscope; picture-in-picture; web-share" '
            f'allowfullscreen loading="lazy" '
            f'referrerpolicy="strict-origin-when-cross-origin">'
            f'</iframe></div>'
        )

    return _YT_VIDEO_RE.sub(repl, html)




SITE_ORIGIN = "https://pilobol.us"
_DEFAULT_DESCRIPTION = (
    "Glimpses of our moldy future, as our society is gradually infected by a fungus that grows on our bullshit."
)
_DEFAULT_COVER = "assets/og-default.jpg"


def _parse_front_matter(md_path: Path) -> dict[str, str]:
    """Tiny YAML-ish front-matter reader (scalars + indented continuations)."""
    if not md_path.is_file():
        return {}
    text = md_path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    block = text[3:end]
    out: dict[str, str] = {}
    key: str | None = None
    buf: list[str] = []

    def flush() -> None:
        nonlocal key, buf
        if key is None:
            return
        out[key] = " ".join(x for x in buf if x).strip()
        key = None
        buf = []

    for line in block.splitlines():
        if key is not None and (line.startswith("  ") or line.startswith("	")):
            piece = line.strip()
            if piece:
                buf.append(piece)
            continue
        flush()
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        k = k.strip()
        v = v.strip()
        if v in (">-", ">", "|", ""):
            key = k
            buf = []
            continue
        if len(v) >= 2 and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
            v = v[1:-1]
        key = k
        buf = [v]
    flush()
    return out


def _canonical_url(active_href: str) -> str:
    href = (active_href or "index.html").lstrip("/")
    if href in ("", "index.html"):
        return f"{SITE_ORIGIN}/"
    return f"{SITE_ORIGIN}/{href}"


def _absolute_asset(src: str) -> str:
    if src.startswith("http://") or src.startswith("https://"):
        return src
    return f"{SITE_ORIGIN}/{src.lstrip('./')}"


def _source_markdown_for_href(active_href: str) -> Path | None:
    """Map a built page href back to its Markdown source under content/."""
    href = (active_href or "index.html").lstrip("/")
    content = POD_ROOT / "content"
    if href in ("", "index.html"):
        return content / "index.md"
    candidate = content / href.replace(".html", ".md")
    if candidate.is_file():
        return candidate
    # effects/index.html etc.
    return None


def _pick_cover(fm: dict[str, str], html: str) -> str:
    if fm.get("cover"):
        return _absolute_asset(fm["cover"])
    fig = re.search(
        r'<figure class="markus-figure"><img[^>]+src="([^"]+)"', html
    )
    if fig:
        src = fig.group(1)
        if src.startswith("../"):
            src = src[3:]
        elif src.startswith("./"):
            src = src[2:]
        return _absolute_asset(src)
    img = re.search(r'<img[^>]+src="([^"]+)"', html)
    if img:
        src = img.group(1)
        if src.startswith("../"):
            src = src[3:]
        return _absolute_asset(src)
    return _absolute_asset(_DEFAULT_COVER)


def _pick_description(fm: dict[str, str], html: str, title: str) -> str:
    if fm.get("description"):
        return fm["description"]
    if fm.get("standfirst"):
        return fm["standfirst"]
    lede = re.search(r'<p class="markus-lede">(.*?)</p>', html, re.S)
    if lede:
        return re.sub(r"<[^>]+>", "", unescape(lede.group(1))).strip()
    if title and title.strip() and title.strip() != "Pilobolus":
        return title.strip()
    return _DEFAULT_DESCRIPTION


def _inject_social_meta(html: str, **kwargs) -> str:
    """Open Graph + Twitter large-image cards for crawlers and messengers."""
    title = (kwargs.get("title") or "").strip() or "Pilobolus"
    active_href = kwargs.get("active_href") or "index.html"
    fm_path = _source_markdown_for_href(active_href)
    fm = _parse_front_matter(fm_path) if fm_path else {}
    if fm.get("title"):
        # Prefer front-matter title when the shell got an empty homepage title.
        if not title or title in ("", "Home", "index.html"):
            title = fm["title"] or "Pilobolus"
    description = _pick_description(fm, html, title)
    image = _pick_cover(fm, html)
    url = _canonical_url(active_href)
    page_title = title if title != "Pilobolus" else "Pilobolus"
    # Homepage with blank title
    is_home = active_href in ("index.html", "")
    if is_home or page_title in ("", "Home"):
        page_title = "Pilobolus"
    og_type = "website" if is_home else "article"

    def q(value: str) -> str:
        return escape(value, quote=True)

    meta = (
        f'<meta name="description" content="{q(description)}">\n'
        f'<link rel="canonical" href="{q(url)}">\n'
        f'<meta property="og:site_name" content="Pilobolus">\n'
        f'<meta property="og:type" content="{og_type}">\n'
        f'<meta property="og:title" content="{q(page_title)}">\n'
        f'<meta property="og:description" content="{q(description)}">\n'
        f'<meta property="og:url" content="{q(url)}">\n'
        f'<meta property="og:image" content="{q(image)}">\n'
        f'<meta property="og:image:width" content="1200">\n'
        f'<meta property="og:image:height" content="630">\n'
        f'<meta name="twitter:card" content="summary_large_image">\n'
        f'<meta name="twitter:title" content="{q(page_title)}">\n'
        f'<meta name="twitter:description" content="{q(description)}">\n'
        f'<meta name="twitter:image" content="{q(image)}">\n'
    )
    if 'property="og:title"' in html:
        return html
    html2, n = re.subn(
        r"(</title>\s*)",
        r"\1" + meta,
        html,
        count=1,
    )
    if n != 1:
        raise RuntimeError("social meta inject failed")
    return html2



_POEM_LINES = (
    "a fungus among us",
    "feeding on our excrement",
    "and gradually infecting society.",
)



# Shared ElevenLabs Audio Native project (Anth.us + pilobol.us domains).
# Public user id is per project, not per domain — Ryan 2026-09-08.
_ELEVENLABS_AUDIO_NATIVE_PUBLIC_USER_ID = (
    "36d96927eb49029bd258c8a7138932b6afc7aca35d504f2986ff830522c11bd8"
)
_ELEVENLABS_PILOBOLUS_VOICE_ID = "EkK5I93UQWFDigLMpZcX"
_PILOBOLUS_DEFAULT_AUTHOR = "by various bots and Ryan Porter"

# slug -> project_id, filled during main() before HTML render.
_AUDIO_NATIVE_PROJECT_IDS: dict[str, str] = {}


def _audio_native_widget(project_id: str | None = None) -> str:
    project_attr = ""
    if project_id:
        project_attr = f' data-projectid="{escape(project_id, quote=True)}"'
    return (
        '<div id="elevenlabs-audionative-widget" '
        'data-height="90" data-width="100%" data-frameborder="no" data-scrolling="no" '
        f'data-publicuserid="{_ELEVENLABS_AUDIO_NATIVE_PUBLIC_USER_ID}"'
        f'{project_attr} '
        'data-playerurl="https://elevenlabs.io/player/index.html">'
        'Loading the '
        '<a href="https://elevenlabs.io/text-to-speech" target="_blank" rel="noopener noreferrer">'
        'Elevenlabs Text to Speech</a> AudioNative Player...'
        '</div>\n'
    )

_AUDIO_NATIVE_SCRIPT = (
    '<script src="https://elevenlabs.io/player/audioNativeHelper.js" '
    'type="text/javascript" async></script>\n'
)


def _inject_audio_native(html: str, *, active_href: str) -> str:
    """One Audio Native player after title/byline on article pages only."""
    href = (active_href or "").lstrip("./")
    if not href.startswith("articles/") or href.endswith("/index.html"):
        return html
    if "elevenlabs-audionative-widget" in html:
        return html
    slug = Path(href).stem
    if slug == "index":
        return html
    project_id = _AUDIO_NATIVE_PROJECT_IDS.get(slug)
    widget = _audio_native_widget(project_id)
    # Prefer after byline; fall back after h1 if byline missing.
    html2, n = re.subn(
        r'(<p class="markus-byline">.*?</p>)',
        r"\1\n" + widget,
        html,
        count=1,
        flags=re.S,
    )
    if n != 1:
        html2, n = re.subn(
            r'(<header class="markus-header">\s*<h1>.*?</h1>)',
            r"\1\n" + widget,
            html,
            count=1,
            flags=re.S,
        )
        if n != 1:
            return html  # non-article chrome; leave alone
    if "audioNativeHelper.js" not in html2:
        html2, n = re.subn(
            r"</body>",
            _AUDIO_NATIVE_SCRIPT + "</body>",
            html2,
            count=1,
            flags=re.I,
        )
        if n != 1:
            html2 = html2 + _AUDIO_NATIVE_SCRIPT
    return html2


def render_page_with_poem(**kwargs):
    """Left-stack brand poem only — no nav."""
    html = _orig_render_page(**kwargs)
    depth = kwargs.get("depth", 0) or 0
    prefix = "../" * depth
    mission = f"{prefix}a-fungus-among-us.html"
    rendered_lines = []
    for line in _POEM_LINES:
        if line == "a fungus among us":
            rendered_lines.append(
                f'      <p class="pilo-poem-line">'
                f'a <a href="{mission}">fungus among us</a></p>'
            )
        else:
            rendered_lines.append(f'      <p class="pilo-poem-line">{line}</p>')
    lines = "\n".join(rendered_lines)
    poem = (
        '    <div class="pilo-masthead-poem">\n'
        f'      <p class="markus-site-wordmark"><a href="{prefix}index.html">Pilobolus</a></p>\n'
        f"{lines}\n"
        "    </div>"
    )
    html2, n = re.subn(
        r'<header class="markus-site-masthead">.*?</header>',
        f'<header class="markus-site-masthead">\n{poem}\n  </header>',
        html,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise RuntimeError(f"masthead poem inject failed (n={n})")
    html2 = _rewrite_youtube_videos(html2)
    html2 = _inject_audio_native(
        html2, active_href=kwargs.get("active_href") or ""
    )
    return _inject_social_meta(html2, **kwargs)


markus_shell.render_page = render_page_with_poem
markus_build.render_page = render_page_with_poem


def _build_standalone_page(result, source: Path, href: str) -> None:
    """Render one root-level page that isn't part of ``articles/`` or a
    ``sections`` collection — e.g. the mission statement, linked only from
    the masthead poem. ``_discover_articles``/``_discover_section`` never
    see it, so it needs its own write here.
    """
    if not source.is_file():
        raise RuntimeError(f"Standalone page source not found: {source}")
    css_version = markus_build._css_version(
        result.out_dir / "css", result.out_dir / "assets"
    )
    fragment = markus_build.convert_fragment(source, theme=None)
    title = markus_build._read_title(source, href)
    page_path = result.out_dir / href
    page_path.write_text(
        markus_build.render_page(
            title=title,
            fragment=fragment,
            active_href=href,
            nav_items=[],
            depth=0,
            chrome=PILOBOL_CHROME,
            css_version=css_version,
        ),
        encoding="utf-8",
    )
    result.pages.append(page_path)


def _ensure_author_front_matter(source: Path) -> None:
    """Default byline for reader posts when author/authors is omitted."""
    text = source.read_text(encoding="utf-8")
    fm, _ = parse_front_matter(text)
    if fm.get("author") or fm.get("authors"):
        return
    if not text.startswith("---"):
        return
    end = text.find("\n---", 3)
    if end < 0:
        return
    block = text[3:end]
    lines = block.splitlines()
    insert_at = len(lines)
    for idx, line in enumerate(lines):
        if line.startswith("date:"):
            insert_at = idx + 1
            break
    lines.insert(insert_at, f"author: {DEFAULT_AUTHOR}")
    updated = "---\n" + "\n".join(lines) + "\n---" + text[end + 4 :]
    source.write_text(updated, encoding="utf-8")


def _prepare_articles(content_dir: Path) -> list[tuple[str, Path, dict[str, str], str]]:
    articles_dir = content_dir / "articles"
    prepared: list[tuple[str, Path, dict[str, str], str]] = []
    for slug, path, fm in discover_articles(articles_dir):
        _ensure_author_front_matter(path)
        fm, _ = parse_front_matter(path.read_text(encoding="utf-8"))
        fragment = markus_build.convert_fragment(path, theme=None)
        prepared.append((slug, path, fm, fragment))
    return prepared


def main() -> int:
    content_dir = POD_ROOT / "content"
    global _AUDIO_NATIVE_PROJECT_IDS

    print("Generating homepage and archive feed from articles…")
    write_generated_feed_pages(content_dir)

    print("Preparing ElevenLabs Audio Native projects…")
    article_payloads = _prepare_articles(content_dir)
    _AUDIO_NATIVE_PROJECT_IDS = sync_all_articles(
        pod_root=POD_ROOT,
        articles=article_payloads,
    )

    result = build_markus_site(
        content_dir=POD_ROOT / "content",
        out_dir=POD_ROOT / "dist-papyrus",
        theme=None,
        site_css=POD_ROOT / "css" / "pilobolus-theme.css",
        chrome=PILOBOL_CHROME,
        sections=("effects",),
    )
    _build_standalone_page(
        result,
        POD_ROOT / "content" / "a-fungus-among-us.md",
        "a-fungus-among-us.html",
    )
    # Crawlers (Twitterbot, Slack, iMessage, Facebook) need an explicit allow.
    (result.out_dir / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\n"
        f"Sitemap: {SITE_ORIGIN}/sitemap.xml\n",
        encoding="utf-8",
    )
    # Minimal sitemap so preview crawlers can find story URLs.
    urls = []
    for page in result.pages:
        rel = page.relative_to(result.out_dir).as_posix()
        urls.append(_canonical_url(rel))
    body = "\n".join(
        f"  <url><loc>{escape(u, quote=True)}</loc></url>" for u in sorted(set(urls))
    )
    (result.out_dir / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>\n",
        encoding="utf-8",
    )
    print(f"Built Pilobol.us via Papyrus renderer: {result.out_dir}")
    for page in result.pages:
        print("  -", page.relative_to(result.out_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
