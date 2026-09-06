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

from papyrus_content.markus_renderer.build import build_markus_site  # noqa: E402
from papyrus_content.markus_renderer.shell import SiteChrome  # noqa: E402

# Publication identity. This is the ONLY thing Pilobol.us contributes to the
# render; everything else comes from Papyrus's renderer.
PILOBOL_CHROME = SiteChrome(
    site_name="Pilobol.us",
    tagline="a fungus among us",
    footer_html=(
        "<p>Pilobol.us is a Papyrus publication. Reader-facing copy publishes "
        "through Markus, a Markdown-and-directives renderer &mdash; this page is "
        "that render, not a Pretext layout.</p>"
    ),
    # Site chrome only. These are never derived from article Markdown; Markus
    # runs with raw HTML disabled precisely so authors cannot inject scripts.
    scripts=(
        "assets/theme-toggle.js",
        "assets/background-manager.js",
        "assets/organic-image.js",
        "assets/cinematic-gallery.js",
    ),
)


def main() -> int:
    result = build_markus_site(
        content_dir=POD_ROOT / "content",
        out_dir=POD_ROOT / "dist-papyrus",
        # No baked Markus theme: pilobil-theme-v10.css owns the palette
        # (base tokens + its own light/dark rules), matching the live site.
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
