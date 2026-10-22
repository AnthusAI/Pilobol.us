"""Pilobolus on the standard Papyrus front end: the parts that are this publication's own.

Settings are in projection.json. What lives here is the masthead poem, the cards, the home, archive and 404 bodies, and
the per-article decoration (video embeds, image effects, the Auritus narration player).
"""

from __future__ import annotations

import re
from html import escape

from papyrus_content.projection.standard import components

DEFAULT_AUTHOR = "by various bots and Ryan Porter"
IMAGE_EFFECTS = {"organic", "cinematic", "mask", "pixel", "lenticular"}
POEM_LINES = ("a fungus among us", "feeding on our excrement", "and gradually infecting society.")
MISSION_HREF = "/a-fungus-among-us.html"
AUDIO_STANDALONE_HREFS = frozenset({"a-fungus-among-us.html"})
INSTAGRAM_EMBED_SCRIPT = '<script async src="https://www.instagram.com/embed.js"></script>'

AURITUS_SCRIPT_SOURCE = "https://aurit.us/embed.js"
AURITUS_API_BASE = "https://4o6atlkpeh.execute-api.us-east-1.amazonaws.com"
AURITUS_SITE_KEY = "WuNsWJc9fLoFesPzXkg2BZBurubafE2F"
AURITUS_VOICE = "serious"
AURITUS_TTS_BACKEND = "fish"

# What each page depends on: only the home page and the articles listing read other entries.
DEPENDS_ON = {"home": ["articles"], "listing:articles": ["articles"], "*": []}

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
ARTICLE_HEADER_PATTERN = re.compile(r'(<header class="markus-header">)(.*?)(</header>)', re.S)
ARTICLE_HEADING_PATTERN = re.compile(r"<h1>.*?</h1>", re.S)
ARTICLE_LEDE_PATTERN = re.compile(r'<p class="markus-lede">.*?</p>', re.S)
ARTICLE_BYLINE_PATTERN = re.compile(r'<p class="markus-byline">.*?</p>', re.S)
AUDIO_NATIVE_WIDGET_PATTERN = re.compile(r'<div class="pilo-audio-native"[^>]*>[\s\S]*?</div>\s*', re.I)


def _text(value) -> str:
    return "" if value is None else str(value).strip()


def _is_off(value) -> bool:
    return value is not None and _text(value).lower() in {"false", "0", "no", "off"}


# ---------------------------------------------------------------------------------------------------- chrome

def masthead(page) -> str:
    lines = []
    for line in POEM_LINES:
        if line == "a fungus among us":
            lines.append(f'      <p class="pilo-poem-line">a <a href="{MISSION_HREF}">fungus among us</a></p>')
        else:
            lines.append(f'      <p class="pilo-poem-line">{line}</p>')
    return (
        '  <header class="markus-site-masthead">\n'
        '    <div class="pilo-masthead-poem">\n'
        '      <p class="markus-site-wordmark"><a href="/">Pilobolus</a></p>\n'
        + "\n".join(lines)
        + "\n    </div>\n  </header>"
    )


def footer(page) -> str:
    return (
        "<!-- background credit host -->"
        '<p class="pilo-footer-links"><a href="https://anth.us/privacy/">Privacy</a> <a href="#cookie-settings">Cookie settings</a></p>'
    )


# ---------------------------------------------------------------------------------------------------- listings

def _slug_id(title: str) -> str:
    return re.sub(r"[\s_]+", "-", re.sub(r"[^\w\s-]", "", title.lower()).strip())


def _on_home(entry) -> bool:
    """Articles only, and not those that opt out with ``feed: false`` or ``home: false``."""
    in_articles = entry.section is not None and entry.section.name == "articles"
    return in_articles and not (_is_off(entry.data.get("feed")) or _is_off(entry.data.get("home")))


def _card_image(entry) -> str | None:
    return _text(entry.data.get("card_image")) or _text(entry.data.get("cover")) or None


def _entry_image(entry, *, link: str | None) -> str:
    source = _card_image(entry)
    if not source:
        return ""
    source = source if source.startswith(("http://", "https://", "/")) else "/" + source
    alt = escape(_text(entry.data.get("card_image_alt")), quote=True)
    tag = f'<img src="{escape(source, quote=True)}" alt="{alt}" />'
    if link:
        tag = f'<a href="{escape(link, quote=True)}">{tag}</a>'
    return f"<p>{tag}</p>\n"


def card(entry, page) -> str:
    """One article: a grid card on the home page, a plain entry on the archive."""
    href = escape(entry.url, quote=True)
    title = escape(entry.title)
    heading = f'<h3 id="{_slug_id(entry.title)}"><a href="{href}">{title}</a></h3>\n'
    text = _text(entry.data.get("description")) or _text(entry.data.get("standfirst"))
    blurb = f"<p>{escape(text)}</p>\n" if text else ""
    date = _text(entry.data.get("date"))
    stamp = f"<p><em>{escape(date)}</em></p>\n" if date else ""
    if page.kind == "home":
        return (
            f'<article class="markus-card" data-span="full"><div class="markus-card-body">{heading}'
            f"{_entry_image(entry, link=None)}{blurb}{stamp}</div></article>"
        )
    return f"{heading}{_entry_image(entry, link=entry.url)}{blurb}{stamp}"


def _shell(page, main_html: str) -> str:
    return (
        f"{page.skip_link}\n{masthead(page)}\n"
        f'  <main id="main">\n{main_html}\n  </main>\n'
        f'  <footer class="markus-site-footer">\n    {footer(page)}\n  </footer>'
    )


def _newest_first(entries):
    """Newest first; entries on the same day run A to Z."""
    return sorted(sorted(entries, key=lambda entry: entry.slug), key=lambda entry: entry.date, reverse=True)


def page_body(page) -> str | None:
    if page.kind == "home":
        entries = [entry for entry in _newest_first(page.entries) if _on_home(entry)]
        cards = "".join(card(entry, page) for entry in entries)
        return _shell(
            page,
            '<article class="markus-document"><section class="markus-card-grid" aria-label="Related items" '
            f'style="--markus-columns: 6">{cards}</section></article>',
        )
    if page.kind == "listing":
        view = page.listing
        if view.section == "effects":  # the authored effects/index item is the section's introduction: the whole page
            return _shell(page, page.fragment)
        label = components.esc(view.label)
        lede = page.description
        header = f'<header class="markus-header"><h1>{label}</h1>' + (f'<p class="markus-lede">{components.esc(lede)}</p>' if lede else "") + "</header>"
        entries = _newest_first(view.all_entries)
        return _shell(page, f'<article class="markus-document">{header}{"".join(card(entry, page) for entry in entries)}</article>')
    if page.kind == "not_found":
        return _shell(
            page,
            '<article class="markus-document"><header class="markus-header"><h1>Page not found</h1>'
            '<p class="markus-lede">Nothing grows at this address.</p></header>'
            '<p>The spore landed somewhere there is no page. <a href="/">Back to the surface.</a></p></article>',
        )
    return None


# ---------------------------------------------------------------------------------------------------- articles

def _rewrite_youtube(html: str) -> str:
    def replace(match: re.Match[str]) -> str:
        attributes = f'{match.group("pre")}{match.group("mid")}{match.group("post")}'
        title_match = re.search(r'\btitle="([^"]*)"', attributes)
        title = escape(title_match.group(1) if title_match else "YouTube video", quote=True)
        return (
            f'<div class="pilo-youtube">'
            f'<iframe src="https://www.youtube-nocookie.com/embed/{match.group("id")}" title="{title}" '
            f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
            f'allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'
        )

    return YOUTUBE_VIDEO_PATTERN.sub(replace, html)


def _rewrite_instagram(html: str) -> str:
    def replace(match: re.Match[str]) -> str:
        permalink = f'https://www.instagram.com/{match.group("kind").lower()}/{match.group("id")}/'
        attributes = f'{match.group("pre")}{match.group("mid")}{match.group("post")}'
        title_match = re.search(r'\btitle="([^"]*)"', attributes)
        title = escape(title_match.group(1) if title_match else "Instagram post", quote=True)
        return (
            f'<div class="pilo-instagram"><blockquote class="instagram-media" data-instgrm-captioned '
            f'data-instgrm-permalink="{permalink}?utm_source=ig_embed" data-instgrm-version="14">'
            f'<a href="{permalink}" target="_blank" rel="noopener">{title} — view this post on Instagram</a>'
            f"</blockquote></div>"
        )

    rewritten = INSTAGRAM_VIDEO_PATTERN.sub(replace, html)
    return rewritten + INSTAGRAM_EMBED_SCRIPT if rewritten != html else rewritten


def _wrap_effect_image(image_tag: str, source: str, effect: str) -> str:
    wrappers = {
        "cinematic": "pilo-cinematic-gallery",
        "mask": "pilo-mask-reveal",
        "pixel": "pilo-pixel-dissolve",
        "lenticular": "pilo-lenticular",
    }
    if effect in wrappers:
        return f'<span class="{wrappers[effect]}">{image_tag}</span>'
    return (
        f'<span class="pilo-organic-image" data-src="{escape(source, quote=True)}">'
        f'<img class="pilo-organic-fallback" {image_tag[4:]}'
        f"</span>"
    )


def _decorate_media(html: str, effect: str) -> str:
    if effect not in IMAGE_EFFECTS:
        return html
    figure = re.compile(r'(<figure\b[^>]*>\s*)(<img\b([^>]*\bsrc="([^"]+)"[^>]*)>)(.*?</figure>)', re.S | re.I)

    def replace(match: re.Match[str]) -> str:
        prefix, image_tag, _attributes, source, tail = match.groups()
        if "pilo-" in prefix or "pilo-" in image_tag:
            return match.group(0)
        return f"{prefix}{_wrap_effect_image(image_tag, source, effect)}{tail}"

    decorated, count = figure.subn(replace, html, count=1)
    if count:
        return decorated
    bare = re.compile(r'(<img\b([^>]*\bsrc="([^"]+)"[^>]*)>)', re.I)
    return bare.sub(lambda match: _wrap_effect_image(match.group(1), match.group(3), effect), html, count=1)


def _auritus_widget(*, title: str, author: str) -> str:
    return (
        '<div class="pilo-audio-native">'
        f'<script src="{AURITUS_SCRIPT_SOURCE}" data-auritus-site-key="{AURITUS_SITE_KEY}" '
        f'data-auritus-api="{AURITUS_API_BASE}" data-auritus-name="{escape(title, quote=True)}" '
        f'data-auritus-byline="{escape(author, quote=True)}" data-auritus-voice="{AURITUS_VOICE}" '
        f'data-auritus-tts-backend="{AURITUS_TTS_BACKEND}" data-auritus-root=".markus-document" '
        'data-auritus-ignore-selectors=".markus-lede,.markus-byline"></script>'
        "<script>(function(){"
        "var s=document.currentScript.previousElementSibling;"
        "function go(){if(s&&window.Auritus&&window.Auritus.boot){window.Auritus.boot({script:s});}}"
        "if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',go);}else{go();}"
        "})();</script>"
        "</div>\n"
    )


def _href_has_audio(href: str, section: str | None) -> bool:
    if section == "articles":
        return not href.endswith("/index.html")
    return section is None and href in AUDIO_STANDALONE_HREFS


def _fix_article_header(html: str, summary, front_matter: dict) -> str:
    header = ARTICLE_HEADER_PATTERN.search(html)
    if not header:
        return html
    author = _text(front_matter.get("author") or front_matter.get("authors")) or DEFAULT_AUTHOR
    inner = AUDIO_NATIVE_WIDGET_PATTERN.sub("", header.group(2))
    heading = ARTICLE_HEADING_PATTERN.search(inner)
    byline = ARTICLE_BYLINE_PATTERN.search(inner)
    lede = ARTICLE_LEDE_PATTERN.search(inner)
    subheadline = (_text(front_matter.get("standfirst")) or _text(front_matter.get("description")))
    parts: list[str] = []
    if heading:
        parts.append(heading.group(0))
    if subheadline:
        parts.append(f'<p class="markus-lede">{escape(subheadline)}</p>')
    elif lede:
        parts.append(lede.group(0))
    if byline:
        parts.append(byline.group(0))
    else:
        date = _text(front_matter.get("date"))
        parts.append(f'<p class="markus-byline">{escape(author)}' + (f" · {escape(date)}" if date else "") + "</p>")
    if not _is_off(front_matter.get("audio")):
        parts.append(_auritus_widget(title=_text(front_matter.get("title")) or summary.slug.replace("-", " ").title(), author=author))
    return html[: header.start()] + f"{header.group(1)}{''.join(parts)}{header.group(3)}" + html[header.end() :]


def item_decorator(html: str, summary) -> str:
    front_matter = summary.front_matter
    href = f"{summary.section}/{summary.slug}.html" if summary.section else f"{summary.slug}.html"
    decorated = _rewrite_instagram(_rewrite_youtube(html))
    decorated = _decorate_media(decorated, _text(front_matter.get("image_effect")))
    if _href_has_audio(href, summary.section):
        decorated = _fix_article_header(decorated, summary, front_matter)
    return decorated
