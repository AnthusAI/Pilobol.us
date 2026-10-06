#!/usr/bin/env python3
"""Reader build entrypoint for the Pilobol.us static site.

The Amplify reader app runs `papyrus content export-published` first (guest
export into `content-export/`), then this script. It copies that export into a
work directory, overlays the reader-owned files from `web/reader-assets/`
without overwriting anything the export already provides, and renders the site
through `web/build_via_papyrus.py`.

Usage:
    python3 reader/build.py --content content-export --out dist
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
READER_ASSETS_DIRECTORY = REPOSITORY_ROOT / "web" / "reader-assets"
SITE_BUILD_SCRIPT = REPOSITORY_ROOT / "web" / "build_via_papyrus.py"


def overlay_reader_assets_without_clobbering(work_content_directory: Path) -> int:
    copied_file_count = 0
    for source in sorted(READER_ASSETS_DIRECTORY.rglob("*")):
        if not source.is_file():
            continue
        destination = work_content_directory / "assets" / source.relative_to(READER_ASSETS_DIRECTORY)
        if destination.exists():
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied_file_count += 1
    return copied_file_count


def parse_arguments(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the Pilobol.us reader from a Papyrus content export.")
    parser.add_argument("--content", required=True, type=Path, help="Directory written by `papyrus content export-published`.")
    parser.add_argument("--out", required=True, type=Path, help="Directory for the built static site.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    arguments = parse_arguments(argv)
    export_directory = arguments.content.resolve()
    output_directory = arguments.out.resolve()
    if not export_directory.is_dir():
        print(f"Content export directory not found: {export_directory}", file=sys.stderr)
        return 1
    if not any(export_directory.rglob("*.md")):
        print(f"Content export has no Markdown items: {export_directory}", file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory(prefix="pilobol-reader-") as work_root:
        work_content_directory = Path(work_root) / "content"
        shutil.copytree(export_directory, work_content_directory)
        copied_file_count = overlay_reader_assets_without_clobbering(work_content_directory)
        print(f"Overlaid {copied_file_count} reader-owned asset files onto the export.")
        if output_directory.exists():
            shutil.rmtree(output_directory)
        completed = subprocess.run(
            [sys.executable, str(SITE_BUILD_SCRIPT), "--content", str(work_content_directory), "--out", str(output_directory)],
            check=False,
        )
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main())
