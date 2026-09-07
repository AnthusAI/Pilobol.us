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
from papyrus_content.markus_renderer.shell import NavItem, SiteChrome  # noqa: E402

# Papyrus only auto-builds Home + Stories into the header. Background pages
# live under /effects/ but need an explicit nav entry.
_orig_nav = markus_build._build_nav_items


def _build_nav_items_with_effects(articles):
    items = list(_orig_nav(articles))
    if not any(item.href == "effects/index.html" for item in items):
        items.append(NavItem("Backgrounds", "effects/index.html"))
    return items


markus_build._build_nav_items = _build_nav_items_with_effects

# Publication identity. Tagline is None: the left-side masthead poem carries
# wordmark + lines so we don't double "a fungus among us" via Papyrus's
# single tagline slot. footer_html can't be "" (falsy → Papyrus default).
PILOBOL_CHROME = SiteChrome(
    site_name="Pilobolus",
    tagline=None,
    footer_html="<p>Pilobolus</p>",
    scripts=(
        "assets/background-manager.js",
        "assets/organic-image.js",
        "assets/cinematic-gallery.js",
    ),
)

_orig_render_page = markus_shell.render_page

_POEM_LINES = (
    "a fungus among us",
    "feeding on our excrement",
    "and gradually infecting society.",
)


def render_page_with_poem(**kwargs):
    """Stack Pilobolus + poem lines on the left; nav sits under the poem."""
    html = _orig_render_page(**kwargs)
    depth = kwargs.get("depth", 0) or 0
    prefix = "../" * depth
    lines = "\n".join(
        f'      <p class="pilo-poem-line">{line}</p>' for line in _POEM_LINES
    )
    poem = (
        '    <div class="pilo-masthead-poem">\n'
        f'      <p class="markus-site-wordmark"><a href="{prefix}index.html">Pilobolus</a></p>\n'
        f"{lines}\n"
        "    </div>"
    )
    html2, n = re.subn(
        r'<header class="markus-site-masthead">\s*'
        r'<p class="markus-site-wordmark">.*?</p>\s*'
        r'(?:<p class="markus-site-tagline">.*?</p>\s*)?'
        r'(<nav class="markus-site-nav")',
        rf'<header class="markus-site-masthead">\n{poem}\n    \1',
        html,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise RuntimeError(f"masthead poem inject failed (n={n})")
    return html2


markus_shell.render_page = render_page_with_poem
# build.py binds render_page at import time; patch that name too.
markus_build.render_page = render_page_with_poem


def main() -> int:
    result = build_markus_site(
        content_dir=POD_ROOT / "content",
        out_dir=POD_ROOT / "dist-papyrus",
        theme=None,
        site_css=POD_ROOT / "css" / "pilobil-theme-v10.css",
        chrome=PILOBOL_CHROME,
        sections=("effects",),
    )
    print(f"Built Pilobol.us via Papyrus renderer: {result.out_dir}")
    for page in result.pages:
        print("  -", page.relative_to(result.out_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
