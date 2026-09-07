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
from html import escape
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



_POEM_LINES = (
    "a fungus among us",
    "feeding on our excrement",
    "and gradually infecting society.",
)


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
    return _rewrite_youtube_videos(html2)


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


def main() -> int:
    result = build_markus_site(
        content_dir=POD_ROOT / "content",
        out_dir=POD_ROOT / "dist-papyrus",
        theme=None,
        site_css=POD_ROOT / "css" / "pilobil-theme-v10.css",
        chrome=PILOBOL_CHROME,
        sections=("effects",),
    )
    _build_standalone_page(
        result,
        POD_ROOT / "content" / "a-fungus-among-us.md",
        "a-fungus-among-us.html",
    )
    print(f"Built Pilobol.us via Papyrus renderer: {result.out_dir}")
    for page in result.pages:
        print("  -", page.relative_to(result.out_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
