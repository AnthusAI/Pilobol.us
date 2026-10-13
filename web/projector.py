"""Pilobol.us as a Papyrus SiteProjector: the reader's pages, rendered one at a time from stored items.

This is ``web/build_via_papyrus.py`` (the whole-site Amplify reader build) re-expressed
for the projection engine. The pages it yields are byte-identical to that build's
output for the same published content (checked with ``diff -r`` of a full build against
``papyrus ops content project --all --out``).

Pages
    ``articles/<slug>.html`` and ``effects/<slug>.html``  one per published item
    ``<slug>.html``                                       one per published root-level item
    ``index.html``                                        generated home: every article not hidden from
                                                          the feed, newest first, cover from the newest
    ``articles/index.html``                               generated archive: every article, newest first
    ``sitemap.xml``                                       every page above
    ``404.html``, ``robots.txt``, ``css/``, ``assets/``   static files

Dependency rule: the home page, the archive and the sitemap are rewritten when, and only
when, the generated Markdown they are rendered from (or the page list) differs between the
site before a change and the site after it. An item page depends on nothing but its own item.

Deploy-time inputs: this repository's ``web/`` directory, bundled next to the module
(``PAPYRUS_SITE_STATIC_DIR``). Media uploaded in the CMS are not part of it; see
``PILOBOL_MEDIA_DIRECTORY``.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Collection
from datetime import datetime
from html import escape, unescape
from pathlib import Path, PurePosixPath

from papyrus_content.markus_renderer.pages import (
    ARTICLES_INDEX_SLUG,
    ARTICLES_SECTION,
    HOME_HREF,
    read_title,
    render_content_page,
    render_home_page,
    title_from_slug,
)
from papyrus_content.markus_renderer.shell import SiteChrome, render_page
from papyrus_content.markus_renderer.vendor_css import vendor_markus_css_text
from papyrus_content.projection.model import ItemSummary, ProjectedItem, SiteIndex
from papyrus_content.projection.projector import (
    MarkusProjectorSettings,
    MarkusSiteProjector,
    digest_of,
)

SITE_ORIGIN = "https://pilobol.us"
EFFECTS_SECTION = "effects"
ARCHIVE_PATH = "articles/index.html"
SITEMAP_PATH = "sitemap.xml"
NOT_FOUND_PATH = "404.html"
ROBOTS_PATH = "robots.txt"
STATIC_DIRECTORY_ENVIRONMENT_VARIABLE = "PAPYRUS_SITE_STATIC_DIR"
MEDIA_DIRECTORY_ENVIRONMENT_VARIABLE = "PILOBOL_MEDIA_DIRECTORY"
THEME_SOURCE = "css/pilobolus-theme.css"
OVERLAY_ASSETS_SOURCE = "reader-assets"
NOT_FOUND_SOURCE = "standalone/404.md"

DEFAULT_AUTHOR = "by various bots and Ryan Porter"
DEFAULT_SITE_DESCRIPTION = (
    "Glimpses of our moldy future, as our society is gradually infected by a "
    "fungus that grows on its own bullshit."
)
DEFAULT_SITE_COVER = "assets/og-default.jpg"
SOCIAL_DEFAULT_DESCRIPTION = (
    "Glimpses of our moldy future, as our society is gradually infected by a fungus that grows on our bullshit."
)
SOCIAL_DEFAULT_COVER = "assets/og-default.jpg"
ARCHIVE_TITLE = "Spores"
ARCHIVE_DESCRIPTION = "Glimpses of our moldy future."
DATE_FORMATS = ("%A, %B %d, %Y", "%Y-%m-%d")
IMAGE_EFFECTS = {"organic", "cinematic", "mask", "pixel", "lenticular"}

PILOBOL_CHROME = SiteChrome(
    site_name="Pilobolus",
    tagline=None,
    footer_html="<!-- background credit host -->",
    scripts=(
        "assets/background-manager.js",
        "assets/organic-image.js",
        "assets/cinematic-gallery.js",
        "assets/image-treatment-lab.js",
    ),
)

YOUTUBE_VIDEO_PATTERN = re.compile(
    r'<video(?P<pre>[^>]*?)\bclass="markus-video"(?P<mid>[^>]*?)\bsrc="'
    r'(?P<src>https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)(?P<id>[\w-]{6,}))'
    r'(?:[^"]*)"(?P<post>[^>]*)>\s*</video>',
    re.I,
)
INSTAGRAM_VIDEO_PATTERN = re.compile(
    r'<video(?P<pre>[^>]*?)\bclass="markus-video"(?P<mid>[^>]*?)\bsrc="'
    r'(?P<src>https?://(?:www\.)?instagram\.com/(?P<kind>p|reel)/(?P<id>[\w-]{5,}))'
    r'(?:[^"]*)"(?P<post>[^>]*)>\s*</video>',
    re.I,
)
INSTAGRAM_EMBED_SCRIPT = '<script async src="https://www.instagram.com/embed.js"></script>'

POEM_LINES = (
    "a fungus among us",
    "feeding on our excrement",
    "and gradually infecting society.",
)

AURITUS_SCRIPT_SOURCE = "https://aurit.us/embed.js"
AURITUS_API_BASE = "https://4o6atlkpeh.execute-api.us-east-1.amazonaws.com"
AURITUS_SITE_KEY = "WuNsWJc9fLoFesPzXkg2BZBurubafE2F"
AURITUS_VOICE = "serious"
AURITUS_TTS_BACKEND = "fish"
AUDIO_NATIVE_STANDALONE_HREFS = frozenset({"a-fungus-among-us.html"})

ARTICLE_HEADER_PATTERN = re.compile(r'(<header class="markus-header">)(.*?)(</header>)', re.S)
ARTICLE_HEADING_PATTERN = re.compile(r"<h1>.*?</h1>", re.S)
ARTICLE_LEDE_PATTERN = re.compile(r'<p class="markus-lede">.*?</p>', re.S)
ARTICLE_BYLINE_PATTERN = re.compile(r'<p class="markus-byline">.*?</p>', re.S)
AUDIO_NATIVE_WIDGET_PATTERN = re.compile(r'<div class="pilo-audio-native"[^>]*>[\s\S]*?</div>\s*', re.I)
FIGURE_ALT_PATTERN = re.compile(r':::figure\{[^}]*\balt="([^"]+)"')


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end < 0:
        return {}, text
    block = text[3:end]
    body = text[end + 4 :].lstrip("\n")
    parsed: dict[str, str] = {}
    key: str | None = None
    pieces: list[str] = []

    def flush() -> None:
        nonlocal key, pieces
        if key is None:
            return
        parsed[key] = " ".join(piece for piece in pieces if piece).strip()
        key = None
        pieces = []

    for line in block.splitlines():
        if key is not None and (line.startswith("  ") or line.startswith("\t")):
            piece = line.strip()
            if piece:
                pieces.append(piece)
            continue
        flush()
        if ":" not in line:
            continue
        name, _, value = line.partition(":")
        name = name.strip()
        value = value.strip()
        if value in (">-", ">", "|", ""):
            key = name
            pieces = []
            continue
        if len(value) >= 2 and ((value[0] == value[-1] == '"') or (value[0] == value[-1] == "'")):
            value = value[1:-1]
        key = name
        pieces = [value]
    flush()
    return parsed, body


def is_truthy(value: str | None) -> bool:
    return value is not None and value.strip().lower() in {"1", "true", "yes", "on"}


def is_draft(front_matter: dict[str, str]) -> bool:
    if is_truthy(front_matter.get("draft")):
        return True
    return (front_matter.get("status") or "").strip().lower() == "draft"


def is_hidden_from_feed(front_matter: dict[str, str]) -> bool:
    for key in ("feed", "home"):
        value = front_matter.get(key)
        if value is not None and str(value).strip().lower() in {"false", "0", "no", "off"}:
            return True
    return False


def parse_article_date(front_matter: dict[str, str]) -> datetime:
    raw = (front_matter.get("date") or "").strip().strip("'\"")
    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(raw, date_format)
        except ValueError:
            continue
    return datetime.min


def ensure_author_front_matter(text: str) -> str:
    front_matter, _ = parse_front_matter(text)
    if front_matter.get("author") or front_matter.get("authors"):
        return text
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end < 0:
        return text
    lines = text[3:end].splitlines()
    insert_at = len(lines)
    for index, line in enumerate(lines):
        if line.startswith("date:"):
            insert_at = index + 1
            break
    lines.insert(insert_at, f"author: {DEFAULT_AUTHOR}")
    return "---\n" + "\n".join(lines) + "\n---" + text[end + 4 :]


def card_image(front_matter: dict[str, str]) -> str | None:
    for key in ("card_image", "cover"):
        value = front_matter.get(key)
        if value:
            return value
    return None


def card_blurb(front_matter: dict[str, str]) -> str:
    return front_matter.get("description") or front_matter.get("standfirst") or ""


def card_image_alt(front_matter: dict[str, str], *, title: str) -> str:
    if front_matter.get("card_image_alt"):
        return front_matter["card_image_alt"]
    figure = FIGURE_ALT_PATTERN.search(front_matter.get("_body", ""))
    return figure.group(1) if figure else title


Article = tuple[str, dict[str, str]]


def newest_first(articles: list[Article]) -> list[Article]:
    return sorted(articles, key=lambda article: (-parse_article_date(article[1]).timestamp(), article[0]))


def generate_homepage_markdown(articles: list[Article]) -> str:
    feed_articles = newest_first([article for article in articles if not is_hidden_from_feed(article[1])])
    cover = DEFAULT_SITE_COVER
    if feed_articles:
        newest_image = card_image(feed_articles[0][1])
        if newest_image:
            cover = newest_image
    lines = [
        "---",
        'title: ""',
        "description: >-",
        f"  {DEFAULT_SITE_DESCRIPTION}",
        f"cover: {cover}",
        "---",
        "",
        ':::card-grid{columns="6"}',
    ]
    for slug, front_matter in feed_articles:
        title = front_matter.get("title") or slug.replace("-", " ").title()
        blurb = card_blurb(front_matter)
        date = front_matter.get("date", "").strip("'\"")
        image = card_image(front_matter)
        lines.append(':::card{span="full"}')
        lines.append(f"### [{title}](articles/{slug}.html)")
        lines.append("")
        if image:
            lines.append(f"![{card_image_alt(front_matter, title=title)}]({image})")
            lines.append("")
        if blurb:
            lines.append(blurb)
            lines.append("")
        if date:
            lines.append(f"*{date}*")
        lines.append(":::")
    lines.append(":::")
    lines.append("")
    return "\n".join(lines)


def generate_archive_markdown(articles: list[Article]) -> str:
    lines = ["---", f"title: {ARCHIVE_TITLE}", f"description: {ARCHIVE_DESCRIPTION}", "---", ""]
    for slug, front_matter in newest_first(articles):
        title = front_matter.get("title") or slug.replace("-", " ").title()
        blurb = card_blurb(front_matter)
        date = front_matter.get("date", "").strip("'\"")
        image = card_image(front_matter)
        lines.append(f"### [{title}]({slug}.html)")
        lines.append("")
        if image:
            relative = image if image.startswith("../") else f"../{image.lstrip('/')}"
            lines.append(f"[![{card_image_alt(front_matter, title=title)}]({relative})]({slug}.html)")
            lines.append("")
        if blurb:
            lines.append(blurb)
            lines.append("")
        if date:
            lines.append(f"*{date}*")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def canonical_url(active_href: str) -> str:
    href = (active_href or "index.html").lstrip("/")
    if href in ("", "index.html"):
        return f"{SITE_ORIGIN}/"
    return f"{SITE_ORIGIN}/{href}"


def absolute_asset(source: str) -> str:
    if source.startswith("http://") or source.startswith("https://"):
        return source
    return f"{SITE_ORIGIN}/{source.lstrip('./')}"


def pick_cover(front_matter: dict[str, str], html: str) -> str:
    if front_matter.get("cover"):
        return absolute_asset(front_matter["cover"])
    figure = re.search(r'<figure class="markus-figure"><img[^>]+src="([^"]+)"', html)
    if figure:
        source = figure.group(1)
        if source.startswith("../"):
            source = source[3:]
        elif source.startswith("./"):
            source = source[2:]
        return absolute_asset(source)
    image = re.search(r'<img[^>]+src="([^"]+)"', html)
    if image:
        source = image.group(1)
        if source.startswith("../"):
            source = source[3:]
        return absolute_asset(source)
    return absolute_asset(SOCIAL_DEFAULT_COVER)


def pick_description(front_matter: dict[str, str], html: str, title: str) -> str:
    if front_matter.get("description"):
        return front_matter["description"]
    if front_matter.get("standfirst"):
        return front_matter["standfirst"]
    lede = re.search(r'<p class="markus-lede">(.*?)</p>', html, re.S)
    if lede:
        return re.sub(r"<[^>]+>", "", unescape(lede.group(1))).strip()
    if title and title.strip() and title.strip() != "Pilobolus":
        return title.strip()
    return SOCIAL_DEFAULT_DESCRIPTION


def inject_social_meta(html: str, *, title: str, active_href: str, front_matter: dict[str, str]) -> str:
    title = (title or "").strip() or "Pilobolus"
    active_href = active_href or "index.html"
    if front_matter.get("title"):
        if not title or title in ("", "Home", "index.html"):
            title = front_matter["title"] or "Pilobolus"
    description = pick_description(front_matter, html, title)
    image = pick_cover(front_matter, html)
    url = canonical_url(active_href)
    is_home = active_href in ("index.html", "")
    page_title = title
    if is_home or page_title in ("", "Home"):
        page_title = "Pilobolus"
    open_graph_type = "website" if is_home else "article"

    def quoted(value: str) -> str:
        return escape(value, quote=True)

    meta = (
        f'<meta name="description" content="{quoted(description)}">\n'
        f'<link rel="canonical" href="{quoted(url)}">\n'
        f'<meta property="og:site_name" content="Pilobolus">\n'
        f'<meta property="og:type" content="{open_graph_type}">\n'
        f'<meta property="og:title" content="{quoted(page_title)}">\n'
        f'<meta property="og:description" content="{quoted(description)}">\n'
        f'<meta property="og:url" content="{quoted(url)}">\n'
        f'<meta property="og:image" content="{quoted(image)}">\n'
        f'<meta property="og:image:width" content="1200">\n'
        f'<meta property="og:image:height" content="630">\n'
        f'<meta name="twitter:card" content="summary_large_image">\n'
        f'<meta name="twitter:title" content="{quoted(page_title)}">\n'
        f'<meta name="twitter:description" content="{quoted(description)}">\n'
        f'<meta name="twitter:image" content="{quoted(image)}">\n'
    )
    if 'property="og:title"' in html:
        return html
    injected, replacements = re.subn(r"(</title>\s*)", r"\1" + meta, html, count=1)
    if replacements != 1:
        raise RuntimeError("social meta inject failed")
    return injected


def rewrite_youtube_videos(html: str) -> str:
    def replace(match: re.Match[str]) -> str:
        video_id = match.group("id")
        attributes = f'{match.group("pre")}{match.group("mid")}{match.group("post")}'
        title_match = re.search(r'\btitle="([^"]*)"', attributes)
        title = escape(title_match.group(1) if title_match else "YouTube video", quote=True)
        return (
            f'<div class="pilo-youtube">'
            f'<iframe src="https://www.youtube-nocookie.com/embed/{video_id}" '
            f'title="{title}" '
            f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; '
            f'gyroscope; picture-in-picture; web-share" '
            f'allowfullscreen loading="lazy" '
            f'referrerpolicy="strict-origin-when-cross-origin">'
            f'</iframe></div>'
        )

    return YOUTUBE_VIDEO_PATTERN.sub(replace, html)


def rewrite_instagram_videos(html: str) -> str:
    def replace(match: re.Match[str]) -> str:
        post_kind = match.group("kind").lower()
        post_id = match.group("id")
        permalink = f"https://www.instagram.com/{post_kind}/{post_id}/"
        attributes = f'{match.group("pre")}{match.group("mid")}{match.group("post")}'
        title_match = re.search(r'\btitle="([^"]*)"', attributes)
        title = escape(title_match.group(1) if title_match else "Instagram post", quote=True)
        return (
            f'<div class="pilo-instagram">'
            f'<blockquote class="instagram-media" data-instgrm-captioned '
            f'data-instgrm-permalink="{permalink}?utm_source=ig_embed" '
            f'data-instgrm-version="14">'
            f'<a href="{permalink}" target="_blank" rel="noopener">'
            f'{title} — view this post on Instagram</a>'
            f'</blockquote></div>'
        )

    rewritten = INSTAGRAM_VIDEO_PATTERN.sub(replace, html)
    if rewritten != html and INSTAGRAM_EMBED_SCRIPT not in rewritten:
        if "</body>" in rewritten:
            rewritten = rewritten.replace("</body>", f"{INSTAGRAM_EMBED_SCRIPT}\n</body>", 1)
        else:
            rewritten += INSTAGRAM_EMBED_SCRIPT
    return rewritten


def auritus_widget(*, title: str, author: str) -> str:
    name_attribute = escape(title, quote=True)
    byline_attribute = escape(author, quote=True)
    return (
        '<div class="pilo-audio-native">'
        f'<script src="{AURITUS_SCRIPT_SOURCE}" '
        f'data-auritus-site-key="{AURITUS_SITE_KEY}" '
        f'data-auritus-api="{AURITUS_API_BASE}" '
        f'data-auritus-name="{name_attribute}" '
        f'data-auritus-byline="{byline_attribute}" '
        f'data-auritus-voice="{AURITUS_VOICE}" '
        f'data-auritus-tts-backend="{AURITUS_TTS_BACKEND}" '
        'data-auritus-root=".markus-document" '
        'data-auritus-ignore-selectors=".markus-lede,.markus-byline">'
        "</script>"
        "<script>(function(){"
        "var s=document.currentScript.previousElementSibling;"
        "function go(){if(s&&window.Auritus&&window.Auritus.boot){window.Auritus.boot({script:s});}}"
        "if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',go);}else{go();}"
        "})();</script>"
        "</div>\n"
    )


def is_audio_disabled(front_matter: dict[str, str]) -> bool:
    value = front_matter.get("audio")
    return value is not None and str(value).strip().lower() in {"false", "0", "no", "off"}


def href_has_audio_native(href: str) -> bool:
    href = (href or "").lstrip("./")
    if href.endswith("/index.html") or href in ("", "index.html"):
        return False
    if href.startswith("articles/"):
        return Path(href).stem != "index"
    return href in AUDIO_NATIVE_STANDALONE_HREFS


def fix_article_header(html: str, *, active_href: str, front_matter: dict[str, str]) -> str:
    href = (active_href or "").lstrip("./")
    if not href_has_audio_native(href):
        return html
    slug = Path(href).stem
    header = ARTICLE_HEADER_PATTERN.search(html)
    if not header:
        return html
    inner = AUDIO_NATIVE_WIDGET_PATTERN.sub("", header.group(2))
    heading = ARTICLE_HEADING_PATTERN.search(inner)
    byline = ARTICLE_BYLINE_PATTERN.search(inner)
    lede = ARTICLE_LEDE_PATTERN.search(inner)
    subheadline = (front_matter.get("standfirst") or front_matter.get("description") or "").strip() or None
    parts: list[str] = []
    if heading:
        parts.append(heading.group(0))
    if subheadline:
        parts.append(f'<p class="markus-lede">{escape(subheadline)}</p>')
    elif lede:
        parts.append(lede.group(0))
    if byline:
        parts.append(byline.group(0))
    if not is_audio_disabled(front_matter):
        title = front_matter.get("title") or slug.replace("-", " ").title()
        author = front_matter.get("author") or DEFAULT_AUTHOR
        parts.append(auritus_widget(title=title, author=author))
    new_header = f"{header.group(1)}{''.join(parts)}{header.group(3)}"
    return html[: header.start()] + new_header + html[header.end() :]


def wrap_effect_image(image_tag: str, source: str, effect: str) -> str:
    wrappers = {
        "cinematic": "pilo-cinematic-gallery",
        "mask": "pilo-mask-reveal",
        "pixel": "pilo-pixel-dissolve",
        "lenticular": "pilo-lenticular",
    }
    if effect in wrappers:
        return f'<span class="{wrappers[effect]}">{image_tag}</span>'
    data_source = escape(source, quote=True)
    return (
        f'<span class="pilo-organic-image" data-src="{data_source}">'
        f'<img class="pilo-organic-fallback" {image_tag[4:]}'
        f'</span>'
    )


def decorate_article_media(html: str, *, front_matter: dict[str, str]) -> str:
    effect = front_matter.get("image_effect")
    if effect not in IMAGE_EFFECTS:
        return html
    figure_pattern = re.compile(r'(<figure\b[^>]*>\s*)(<img\b([^>]*\bsrc="([^"]+)"[^>]*)>)(.*?</figure>)', re.S | re.I)

    def replace(match: re.Match[str]) -> str:
        prefix, image_tag, _attributes, source, tail = match.groups()
        if "pilo-" in prefix or "pilo-" in image_tag:
            return match.group(0)
        return f"{prefix}{wrap_effect_image(image_tag, source, effect)}{tail}"

    decorated, count = figure_pattern.subn(replace, html, count=1)
    if count:
        return decorated
    image_pattern = re.compile(r'(<img\b([^>]*\bsrc="([^"]+)"[^>]*)>)', re.I)

    def replace_bare(match: re.Match[str]) -> str:
        image_tag, _attributes, source = match.groups()
        return wrap_effect_image(image_tag, source, effect)

    return image_pattern.sub(replace_bare, html, count=1)


def decorate_index_media(html: str, *, active_href: str, effects_by_slug: dict[str, str | None]) -> str:
    href = (active_href or "").lstrip("./")
    if href not in {"index.html", "articles/index.html"}:
        return html

    def decorate_block(block: str, link_href: str) -> str:
        effect = effects_by_slug.get(Path(link_href).stem)
        if effect not in IMAGE_EFFECTS or "pilo-" in block:
            return block
        image_pattern = re.compile(r'<img\b([^>]*\bsrc="([^"]+)"[^>]*)>', re.I)

        def wrap(match: re.Match[str]) -> str:
            return wrap_effect_image(f"<img{match.group(1)}>", match.group(2), effect)

        return image_pattern.sub(wrap, block, count=1)

    card_pattern = re.compile(r'(<article\b[^>]*class="markus-card"[^>]*>.*?</article>)', re.S | re.I)

    def replace_card(match: re.Match[str]) -> str:
        block = match.group(1)
        link = re.search(r'<h3>\s*<a\s+href="([^"]+)"', block, re.I)
        return decorate_block(block, link.group(1)) if link else block

    html = card_pattern.sub(replace_card, html)
    entry_pattern = re.compile(r'(<h3>\s*<a\s+href="([^"]+)"[^>]*>.*?</h3>.*?)(?=<h3\b|</article>|$)', re.S | re.I)

    def replace_entry(match: re.Match[str]) -> str:
        return decorate_block(match.group(1), match.group(2))

    return entry_pattern.sub(replace_entry, html)


def decorate_page(
    html: str,
    *,
    title: str,
    active_href: str,
    depth: int,
    front_matter: dict[str, str],
    effects_by_slug: dict[str, str | None],
) -> str:
    prefix = "../" * depth
    mission = f"{prefix}a-fungus-among-us.html"
    rendered_lines = []
    for line in POEM_LINES:
        if line == "a fungus among us":
            rendered_lines.append(f'      <p class="pilo-poem-line">a <a href="{mission}">fungus among us</a></p>')
        else:
            rendered_lines.append(f'      <p class="pilo-poem-line">{line}</p>')
    lines = "\n".join(rendered_lines)
    poem = (
        '    <div class="pilo-masthead-poem">\n'
        f'      <p class="markus-site-wordmark"><a href="{prefix}index.html">Pilobolus</a></p>\n'
        f"{lines}\n"
        "    </div>"
    )
    masthead, replacements = re.subn(
        r'<header class="markus-site-masthead">.*?</header>',
        f'<header class="markus-site-masthead">\n{poem}\n  </header>',
        html,
        count=1,
        flags=re.S,
    )
    if replacements != 1:
        raise RuntimeError(f"masthead poem inject failed (n={replacements})")
    decorated = rewrite_youtube_videos(masthead)
    decorated = rewrite_instagram_videos(decorated)
    decorated = decorate_article_media(decorated, front_matter=front_matter)
    decorated = decorate_index_media(decorated, active_href=active_href, effects_by_slug=effects_by_slug)
    decorated = fix_article_header(decorated, active_href=active_href, front_matter=front_matter)
    return inject_social_meta(decorated, title=title, active_href=active_href, front_matter=front_matter)


def read_tree(root: Path) -> dict[str, bytes]:
    if not root.is_dir():
        return {}
    return {path.relative_to(root).as_posix(): path.read_bytes() for path in sorted(root.rglob("*")) if path.is_file()}


def read_site_static_files(web_directory: Path, media_directory: Path | None) -> dict[str, bytes]:
    files: dict[str, bytes] = {
        "css/markus-vendor.css": vendor_markus_css_text(theme=None).encode("utf-8"),
        "css/site-theme.css": (web_directory / THEME_SOURCE).read_bytes(),
    }
    assets = read_tree(web_directory / OVERLAY_ASSETS_SOURCE)
    if media_directory is not None:
        assets.update(read_tree(media_directory))
    for relative, content in assets.items():
        files[f"assets/{relative}"] = content
    return files


class PilobolSiteProjector(MarkusSiteProjector):
    def __init__(self, web_directory: Path, media_directory: Path | None = None, public_data=None) -> None:
        extra = {} if public_data is None else {"public_data": public_data}
        settings = MarkusProjectorSettings(theme=None, sections=(EFFECTS_SECTION,), chrome=PILOBOL_CHROME, **extra)
        super().__init__(settings, read_site_static_files(web_directory, media_directory))
        self._web_directory = web_directory
        self._records_by_version: dict[tuple[str, int | None], dict[str, str]] = {}

    @staticmethod
    def _page_kind(summary: ItemSummary) -> str | None:
        if PurePosixPath(summary.output_path).name.startswith(("_", ".")):
            return None
        if summary.section is None:
            return None if summary.slug == ARTICLES_INDEX_SLUG else "standalone"
        if summary.section == ARTICLES_SECTION:
            return None if summary.slug == ARTICLES_INDEX_SLUG else "article"
        if summary.section == EFFECTS_SECTION:
            return "section"
        return None

    def _nav_items(self, site: SiteIndex):
        return []

    def item_page_paths(self, summary: ItemSummary) -> tuple[str, ...]:
        kind = self._page_kind(summary)
        if kind is None:
            return ()
        if kind == "standalone":
            return (f"{summary.slug}.html",)
        return (f"{summary.section}/{summary.slug}.html",)

    def _decorated(self, html: str, *, title: str, href: str, depth: int, text: str, effects=None) -> bytes:
        front_matter, _ = parse_front_matter(text)
        return decorate_page(
            html,
            title=title,
            active_href=href,
            depth=depth,
            front_matter=front_matter,
            effects_by_slug=effects or {},
        ).encode("utf-8")

    def item_pages(self, item: ProjectedItem, site: SiteIndex) -> dict[str, bytes]:
        summary = item.summary
        kind = self._page_kind(summary)
        if kind is None:
            return {}
        if kind == "standalone":
            href = f"{summary.slug}.html"
            title = read_title(item.source_text, href)
            html = render_page(
                title=title,
                fragment=self._fragment(item.source_text, 0),
                active_href=href,
                nav_items=[],
                depth=0,
                chrome=PILOBOL_CHROME,
                css_version=self.version,
            )
            return {href: self._decorated(html, title=title, href=href, depth=0, text=item.source_text)}
        text = ensure_author_front_matter(item.source_text) if kind == "article" else item.source_text
        href, html = render_content_page(
            section=summary.section,
            slug=summary.slug,
            text=text,
            fragment=self._fragment(text, 1),
            nav_items=[],
            chrome=PILOBOL_CHROME,
            css_version=self.version,
        )
        title = read_title(text, title_from_slug(summary.slug))
        return {href: self._decorated(html, title=title, href=href, depth=1, text=text)}

    def _article_record(self, summary: ItemSummary, site: SiteIndex) -> dict[str, str]:
        key = (summary.item_id, summary.version_number)
        record = self._records_by_version.get(key)
        if record is None:
            front_matter, body = parse_front_matter(site.load_item(summary.item_id).source_text)
            record = {**front_matter, "_body": body}
            self._records_by_version[key] = record
        return record

    def _articles(self, site: SiteIndex) -> list[Article]:
        articles = []
        for summary in sorted(site.items, key=lambda item: item.output_path):
            if self._page_kind(summary) != "article":
                continue
            record = self._article_record(summary, site)
            if not is_draft(record):
                articles.append((summary.slug, record))
        return articles

    def _page_keys(self, site: SiteIndex) -> list[str]:
        keys = {HOME_HREF, ARCHIVE_PATH}
        for summary in site.items:
            keys.update(self.item_page_paths(summary))
        return sorted(keys)

    def _listing_sources(self, site: SiteIndex) -> tuple[str, str, dict[str, str | None]]:
        articles = self._articles(site)
        effects = {slug: record.get("image_effect") for slug, record in articles}
        return generate_homepage_markdown(articles), generate_archive_markdown(articles), effects

    def public_data_entries(self, site: SiteIndex):
        """The articles a visitor can find: not drafts, not hidden from the feed. Only with ``publicData`` in projection.json."""
        settings = self._settings.public_data
        if settings is None:
            return []
        from papyrus_content.projection.public_data import PublicEntry, clipped, tags_of

        entries = []
        for slug, record in self._articles(site):
            if is_hidden_from_feed(record):
                continue
            parsed = parse_article_date(record)
            entries.append(
                PublicEntry(
                    title=clipped(record.get("title") or title_from_slug(slug), 200),
                    url=f"/{ARTICLES_SECTION}/{slug}.html",
                    summary=clipped(card_blurb(record), settings.summary_characters),
                    tags=tags_of(record.get("tags")),
                    date=parsed.strftime("%Y-%m-%d") if parsed != datetime.min else "",
                )
            )
        return entries

    def listing_inputs(self, site: SiteIndex) -> dict[str, str]:
        home, archive, effects = self._listing_sources(site)
        return {
            HOME_HREF: digest_of([home, effects]),
            ARCHIVE_PATH: digest_of([archive, effects]),
            SITEMAP_PATH: digest_of(self._page_keys(site)),
            **self.public_data_inputs(site),
        }

    def shared_inputs(self, site: SiteIndex) -> str:
        return digest_of("no navigation")

    def owns_page_key(self, key: str) -> bool:
        if key in (HOME_HREF, SITEMAP_PATH) or (self._settings.public_data is not None and key.startswith("_data/")):
            return True
        if not key.endswith(".html") or key == NOT_FOUND_PATH:
            return False
        if "/" not in key:
            return True
        return key.split("/", 1)[0] in (ARTICLES_SECTION, EFFECTS_SECTION)

    def listing_pages(self, site: SiteIndex, keys: Collection[str] | None = None) -> dict[str, bytes]:
        wanted = {HOME_HREF, ARCHIVE_PATH, SITEMAP_PATH, *self.public_data_inputs(site)} if keys is None else set(keys)
        pages: dict[str, bytes] = self.public_data_pages(site, wanted)
        if wanted & {HOME_HREF, ARCHIVE_PATH}:
            home, archive, effects = self._listing_sources(site)
            if HOME_HREF in wanted:
                title = read_title(home, "Home")
                html = render_home_page(
                    fragment=self._fragment(home, 0),
                    title=title,
                    nav_items=[],
                    chrome=PILOBOL_CHROME,
                    css_version=self.version,
                )
                pages[HOME_HREF] = self._decorated(html, title=title, href=HOME_HREF, depth=0, text=home, effects=effects)
            if ARCHIVE_PATH in wanted:
                _, html = render_content_page(
                    section=ARTICLES_SECTION,
                    slug=ARTICLES_INDEX_SLUG,
                    text=archive,
                    fragment=self._fragment(archive, 1),
                    nav_items=[],
                    chrome=PILOBOL_CHROME,
                    css_version=self.version,
                )
                title = read_title(archive, title_from_slug(ARTICLES_INDEX_SLUG))
                pages[ARCHIVE_PATH] = self._decorated(
                    html, title=title, href=ARCHIVE_PATH, depth=1, text=archive, effects=effects
                )
        if SITEMAP_PATH in wanted:
            urls = sorted({canonical_url(key) for key in self._page_keys(site)})
            body = "\n".join(f"  <url><loc>{escape(url, quote=True)}</loc></url>" for url in urls)
            pages[SITEMAP_PATH] = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                f"{body}\n"
                "</urlset>\n"
            ).encode("utf-8")
        return pages

    def _not_found_page(self) -> bytes:
        text = (self._web_directory / NOT_FOUND_SOURCE).read_text(encoding="utf-8")
        title = read_title(text, NOT_FOUND_PATH)
        html = render_page(
            title=title,
            fragment=self._fragment(text, 0),
            active_href=NOT_FOUND_PATH,
            nav_items=[],
            depth=0,
            chrome=PILOBOL_CHROME,
            css_version=self.version,
        )
        decorated = decorate_page(
            html, title=title, active_href=NOT_FOUND_PATH, depth=0, front_matter={}, effects_by_slug={}
        )
        absolute = re.sub(r'\b(href|src)="(?!(?:[a-z][a-z0-9+.-]*:|/|#))', r'\1="/', decorated)
        return absolute.encode("utf-8")

    def static_files(self) -> dict[str, bytes]:
        files = super().static_files()
        files[NOT_FOUND_PATH] = self._not_found_page()
        files[ROBOTS_PATH] = f"User-agent: *\nAllow: /\n\nSitemap: {SITE_ORIGIN}/sitemap.xml\n".encode("utf-8")
        return files


def create_projector() -> PilobolSiteProjector:
    configured = (os.environ.get(STATIC_DIRECTORY_ENVIRONMENT_VARIABLE) or "").strip()
    web_directory = Path(configured) if configured else Path(__file__).resolve().parent
    media = (os.environ.get(MEDIA_DIRECTORY_ENVIRONMENT_VARIABLE) or "").strip()
    return PilobolSiteProjector(web_directory, Path(media) if media else None, public_data_of(web_directory))


def public_data_of(web_directory: Path):
    """The ``publicData`` block of projection.json, or None: the search index and latest list are opt-in."""
    settings_path = web_directory / "projection.json"
    raw = json.loads(settings_path.read_text(encoding="utf-8")) if settings_path.is_file() else {}
    if "publicData" not in raw:
        return None
    from papyrus_content.projection.public_data import public_data_settings_from_mapping

    return public_data_settings_from_mapping(raw["publicData"])
