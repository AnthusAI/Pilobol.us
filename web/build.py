#!/usr/bin/env python3
"""Build script for the Pilobol.us Markus site layer.

Runs `markus convert --fragment --no-css` on each Markdown source, then
wraps the resulting fragment in a page shell (masthead, nav, footer) that
loads the vendored Markus CSS layer and the Pilobol.us theme layer on top
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

NAV_ITEMS = [
    ("Front", "index.html"),
    ("A fungus among us", "articles/fungus-among-us.html"),
    ("The infiltrated circle", "articles/infiltrated-circle.html"),
]

THEME_TOGGLE_SCRIPT = """
<script>
(function () {
  var root = document.documentElement;
  var key = "pilobil-theme";
  var stored = null;
  try { stored = localStorage.getItem(key); } catch (e) {}
  if (stored === "light" || stored === "dark") {
    root.setAttribute("data-theme", stored);
  }
  var btn = document.querySelector("[data-pilo-theme-toggle]");
  if (!btn) return;
  function current() {
    var attr = root.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function label() {
    btn.textContent = current() === "dark" ? "\\u2600 Light mode" : "\\u2600\\ufe0e\\u25cf Dark mode";
  }
  label();
  btn.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(key, next); } catch (e) {}
    label();
  });
})();
</script>
""".strip()


def run_markus(src: Path) -> str:
    result = subprocess.run(
        ["markus", "convert", str(src), "--fragment", "--no-css"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


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
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Pilobol.us</title>
<link rel="stylesheet" href="{prefix}css/markus-vendor.css">
<link rel="stylesheet" href="{prefix}css/pilobil-theme.css">
</head>
<body class="markus-body markus-site">
  <div class="pilo-masthead">
    <div class="pilo-masthead-row">
      <a class="pilo-wordmark" href="{prefix}index.html">
        <span class="pilo-wordmark-mark" aria-hidden="true"></span>
        Pilobol<span class="pilo-wordmark-us">.us</span>
      </a>
      <button type="button" class="pilo-theme-toggle" data-pilo-theme-toggle>Dark mode</button>
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
    <p>Pilobol.us is a Papyrus local pod. Reader-facing copy publishes through
    Markus, a Markdown-and-directives renderer — this page is that render,
    not a Pretext layout. Doctrine and the concept wiki are the source of
    truth for what this publication is.</p>
  </footer>
{THEME_TOGGLE_SCRIPT}
</body>
</html>
"""


def main() -> int:
    DIST.mkdir(parents=True, exist_ok=True)
    (DIST / "articles").mkdir(exist_ok=True)
    (DIST / "assets").mkdir(exist_ok=True)
    (DIST / "css").mkdir(exist_ok=True)

    for asset in (CONTENT / "assets").glob("*"):
        (DIST / "assets" / asset.name).write_bytes(asset.read_bytes())
    for css in (ROOT / "css").glob("*.css"):
        (DIST / "css" / css.name).write_bytes(css.read_bytes())

    index_fragment = run_markus(CONTENT / "index.md")
    (DIST / "index.html").write_text(
        page("Front page", index_fragment, active="index.html", depth=0), encoding="utf-8"
    )

    for slug in ("fungus-among-us", "infiltrated-circle"):
        src = CONTENT / "articles" / f"{slug}.md"
        fragment = run_markus(src)
        title = {"fungus-among-us": "A fungus among us",
                  "infiltrated-circle": "When the circle stops trusting itself"}[slug]
        (DIST / "articles" / f"{slug}.html").write_text(
            page(title, fragment, active=f"articles/{slug}.html", depth=1), encoding="utf-8"
        )

    print("Built:", DIST)
    return 0


if __name__ == "__main__":
    sys.exit(main())
