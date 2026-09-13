#!/usr/bin/env python3
"""Local development server for Pilobol.us.

Serves built files from web/dist-papyrus, with live fallback to web/content/assets
so changes to background effect scripts and gallery pages take effect immediately
without caching or full rebuilds.
"""

from __future__ import annotations

import argparse
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = REPO_ROOT / "web" / "dist-papyrus"
CONTENT_ASSETS_DIR = REPO_ROOT / "web" / "content" / "assets"
CONTENT_CSS_DIR = REPO_ROOT / "web" / "css"


class PilobolDevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def end_headers(self) -> None:
        # Prevent browser caching of scripts/styles during development
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0]
        # Live override for assets (JS, gallery HTML, images)
        if clean.startswith("/assets/"):
            rel = clean[len("/assets/"):]
            candidate = CONTENT_ASSETS_DIR / rel
            if candidate.is_file():
                return str(candidate)
        # Live override for CSS
        if clean.startswith("/css/"):
            rel = clean[len("/css/"):]
            candidate = CONTENT_CSS_DIR / rel
            if candidate.is_file():
                return str(candidate)
            if rel == "site-theme.css" and (CONTENT_CSS_DIR / "pilobolus-theme.css").is_file():
                return str(CONTENT_CSS_DIR / "pilobolus-theme.css")
        return super().translate_path(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Pilobol.us local dev server")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind (default: 8080)")
    parser.add_argument("--bind", type=str, default="0.0.0.0", help="Address to bind (default: 0.0.0.0)")
    args = parser.parse_args()

    if not DIST_DIR.is_dir():
        print(f"Error: {DIST_DIR} not found. Build the site first.")
        return 1

    server_address = (args.bind, args.port)
    # A browser can leave a slow or abandoned asset request open while it is
    # navigating (the effects lab loads several large images and canvases).
    # The plain HTTPServer handles one connection at a time, which lets that
    # single request make the entire dev site appear to be down. Keep each
    # client on its own daemon thread so one stalled tab cannot block `/` or
    # any other page.
    httpd = ThreadingHTTPServer(server_address, PilobolDevHandler)
    httpd.daemon_threads = True
    print(f"Pilobol.us dev server running at http://{args.bind}:{args.port}/")
    print(f"Serving from: {DIST_DIR}")
    print(f"Live assets from: {CONTENT_ASSETS_DIR}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping dev server.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
