#!/usr/bin/env python3
"""Build script for the Pilobol.us Markus site layer."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
DIST = ROOT / "dist"

NAV_ITEMS = [
    ("Front", "index.html"),
    ("Stories", "articles/index.html"),
    ("A fungus among us", "articles/fungus-among-us.html"),
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
        if depth == 0:
            full_href = href
        elif href == "index.html":
            full_href = prefix + "index.html"
        else:
            full_href = prefix + href
        current = ' aria-current="page"' if href == active else ""
        links.append(f'<a href="{full_href}"{current}>{label_}</a>')
    return "\n      ".join(links)


def page(title: str, fragment: str, *, active: str, depth: int = 0) -> str:
    prefix = "../" * depth
    safe_title = title.replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{safe_title} · Pilobol.us</title>
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
    <p>Pilobol.us — a fungus among us. Weird specimens with receipts.
    Built with Markus from a Papyrus local pod.</p>
  </footer>
{THEME_TOGGLE_SCRIPT}
</body>
</html>
"""


def title_from_md(src: Path) -> str:
    text = src.read_text(encoding="utf-8")
    m = re.search(r"^title:\s*[\"']?(.*?)[\"']?\s*$", text, re.M)
    if m:
        return m.group(1).strip().strip('"').strip("'")
    return src.stem.replace("-", " ").title()


def main() -> int:
    DIST.mkdir(parents=True, exist_ok=True)
    (DIST / "articles").mkdir(exist_ok=True)
    (DIST / "assets").mkdir(exist_ok=True)
    (DIST / "css").mkdir(exist_ok=True)

    # Site-wide assets (mycelium diagram, etc.)
    assets_dir = CONTENT / "assets"
    if assets_dir.exists():
        for asset in assets_dir.glob("*"):
            if asset.is_file():
                (DIST / "assets" / asset.name).write_bytes(asset.read_bytes())

    # Per-article image trees (e.g. articles/assets/father-justin/*.jpg)
    # HTML lives at dist/articles/<slug>.html and img src is assets/...
    article_assets = CONTENT / "articles" / "assets"
    if article_assets.exists():
        dest = DIST / "articles" / "assets"
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(article_assets, dest)
    for css in (ROOT / "css").glob("*.css"):
        (DIST / "css" / css.name).write_bytes(css.read_bytes())

    index_fragment = run_markus(CONTENT / "index.md")
    (DIST / "index.html").write_text(
        page("Front page", index_fragment, active="index.html", depth=0), encoding="utf-8"
    )

    for src in sorted((CONTENT / "articles").glob("*.md")):
        slug = src.stem
        try:
            fragment = run_markus(src)
        except subprocess.CalledProcessError as e:
            print("FAIL", src, e.stderr, file=sys.stderr)
            raise
        title = title_from_md(src)
        active = f"articles/{slug}.html" if slug != "index" else "articles/index.html"
        (DIST / "articles" / f"{slug}.html").write_text(
            page(title, fragment, active=active, depth=1), encoding="utf-8"
        )
        print(" ", slug)

    print("Built:", DIST)
    return 0


if __name__ == "__main__":
    sys.exit(main())
