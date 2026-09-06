#!/usr/bin/env python3
"""Build script for the Pilobil.us Markus site layer.

Runs `markus convert --fragment --no-css` on each Markdown source, then
wraps the resulting fragment in a page shell (masthead, nav, footer) that
loads the vendored Markus CSS layer and the Pilobil.us theme layer on top
of it. No Papyrus code involved — this is CSS + Markdown + Markus only,
per PPY-5e8072.

Usage: python3 build.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
DIST = ROOT / "dist"

# Cache-busting token for the CSS links. Derived from the newest mtime under
# css/ so a stylesheet edit always produces a new URL. Without this, browsers
# happily serve a stale theme and a CSS fix appears not to have worked.
def css_version() -> str:
    files = sorted((ROOT / "css").glob("*.css"))
    newest = max((f.stat().st_mtime for f in files), default=0)
    return str(int(newest))


NAV_ITEMS = [
    ("Front", "index.html"),
    ("A fungus among us", "articles/fungus-among-us.html"),
    ("The infiltrated circle", "articles/infiltrated-circle.html"),
    ("Effects Index", "effects/index.html"),
]



def run_markus(src: Path) -> str:
    result = subprocess.run(
        ["markus", "convert", str(src), "--fragment", "--no-css"],
        capture_output=True,
        text=True,
        check=True,
    )
    out = result.stdout.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
    return out


def nav_html(active: str, depth: int) -> str:
    prefix = "../" * depth
    links = []
    for label_, href in NAV_ITEMS:
        full_href = href if depth == 0 else (prefix + href if href != "index.html" else prefix + "index.html")
        current = ' aria-current="page"' if href == active else ""
        links.append(f'<a href="{full_href}"{current}>{label_}</a>')
    return "\n      ".join(links)


def page(title: str, fragment: str, *, active: str, depth: int = 0) -> str:
    prefix = "../" * depth
    cssver = css_version()
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Pilobil.us</title>
<link rel="stylesheet" href="{prefix}css/markus-vendor.css?v={cssver}">
<link rel="stylesheet" href="{prefix}css/pilobil-theme-v10.css?v={cssver}">
</head>
<body class="markus-body markus-site">
  
  <canvas id="pilo-physarum-bg" class="pilo-physarum-canvas" aria-hidden="true"></canvas>
  <div class="pilo-page-wrapper">
    <div class="pilo-masthead">
      <div class="pilo-masthead-row">
        <a class="pilo-wordmark" href="{prefix}index.html">
          <span class="pilo-wordmark-mark" aria-hidden="true"></span>
          Pilobil<span class="pilo-wordmark-us">.us</span>
        </a>
      </div>
      <p class="pilo-tagline">a fungus among us</p>
      <nav class="pilo-nav" aria-label="Sections">
        {nav_html(active, depth)}
      </nav>
    </div>
    <main>
{fragment}
    </main>
    <footer class="pilo-footer">
      <div class="pilo-footer-mycelium" aria-hidden="true"></div>
      <p>Pilobil.us is a Papyrus local pod. Reader-facing copy publishes through
      Markus, a Markdown-and-directives renderer — this page is that render,
      not a Pretext layout. Doctrine and the concept wiki are the source of
      truth for what this publication is.</p>
    </footer>
  </div>
<script src="{prefix}assets/background-manager.js?v=4"></script>
<script src="{prefix}assets/organic-image.js?v=2"></script>
<script src="{prefix}assets/cinematic-gallery.js?v=2"></script>
</body>
</html>
"""


def main() -> int:
    DIST.mkdir(parents=True, exist_ok=True)
    (DIST / "articles").mkdir(exist_ok=True)
    (DIST / "effects").mkdir(exist_ok=True)
    
    # Build the effects index
    index_src = CONTENT / "effects" / "index.md"
    index_fragment = run_markus(index_src)
    (DIST / "effects" / "index.html").write_text(
        page("Generative Art Effects", index_fragment, active="effects/index.html", depth=1), encoding="utf-8"
    )

    for effect in ("physarum", "reaction-diffusion", "cellular-automata"):
        src = CONTENT / "effects" / f"{effect}.md"
        fragment = run_markus(src)
        title = {"physarum": "Effect: Physarum Polycephalum",
                  "reaction-diffusion": "Effect: Reaction-Diffusion",
                  "cellular-automata": "Effect: Continuous Cellular Automata"}[effect]
        (DIST / "effects" / f"{effect}.html").write_text(
            page(title, fragment, active="", depth=1), encoding="utf-8"
        )

        (DIST / "effects").mkdir(exist_ok=True)
    
    # Build the effects index
    index_src = CONTENT / "effects" / "index.md"
    index_fragment = run_markus(index_src)
    (DIST / "effects" / "index.html").write_text(
        page("Generative Art Effects", index_fragment, active="effects/index.html", depth=1), encoding="utf-8"
    )

    for effect in ("physarum", "reaction-diffusion", "cellular-automata"):
        src = CONTENT / "effects" / f"{effect}.md"
        fragment = run_markus(src)
        title = {"physarum": "Effect: Physarum Polycephalum",
                  "reaction-diffusion": "Effect: Reaction-Diffusion",
                  "cellular-automata": "Effect: Continuous Cellular Automata"}[effect]
        (DIST / "effects" / f"{effect}.html").write_text(
            page(title, fragment, active="", depth=1), encoding="utf-8"
        )

    print("Built:", DIST)
    return 0


if __name__ == "__main__":
    sys.exit(main())
