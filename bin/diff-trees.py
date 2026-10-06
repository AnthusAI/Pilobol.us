#!/usr/bin/env python3
"""Byte-diff two built-site directories, or a built site against the live site.

One-time sanity check, run by hand at the import step. Not a gate.

    diff-trees.py A B
    diff-trees.py --dist DIR --live https://pilobol.us

Lists files only in A, only in B, and differing files; exits 1 on any.
With --live, each file of DIR is fetched from the live site and compared.

Scratch recipe (never build in the working checkout; the build rewrites content):
    git clone git@github.com:AnthusAI/Pilobol.us.git scratch
    git -C scratch archive origin/main web/content | tar -x -C import-source
    build in scratch only (cd scratch/web && python3 build_via_papyrus.py)
"""
import argparse
import sys
import urllib.error
import urllib.request
from pathlib import Path


def relative_files(root):
    root = Path(root)
    return {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}


def diff_trees(first, second):
    first_files = relative_files(first)
    second_files = relative_files(second)
    only_first = sorted(first_files - second_files)
    only_second = sorted(second_files - first_files)
    differing = sorted(
        name
        for name in first_files & second_files
        if (Path(first) / name).read_bytes() != (Path(second) / name).read_bytes()
    )
    return only_first, only_second, differing


def fetch_live(base_url, name):
    url = base_url.rstrip("/") + "/" + name
    try:
        with urllib.request.urlopen(url) as response:
            return response.read()
    except urllib.error.URLError:
        return None


def diff_live(dist, base_url, fetch=fetch_live):
    names = sorted(relative_files(dist))
    missing_live = []
    differing = []
    for name in names:
        live_bytes = fetch(base_url, name)
        if live_bytes is None:
            missing_live.append(name)
        elif live_bytes != (Path(dist) / name).read_bytes():
            differing.append(name)
    return names, missing_live, differing


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("trees", nargs="*", help="A B directories to compare")
    parser.add_argument("--dist", help="built site directory (with --live)")
    parser.add_argument("--live", help="live site base URL")
    args = parser.parse_args(argv)

    if args.live:
        if not args.dist or args.trees:
            parser.error("--live requires --dist DIR and no positional directories")
        names, missing, differing = diff_live(args.dist, args.live)
        for name in missing:
            print(f"missing on live: {name}")
        for name in differing:
            print(f"differs: {name}")
        identical = len(names) - len(missing) - len(differing)
        print(f"{identical}/{len(names)} identical")
        return 1 if missing or differing else 0

    if len(args.trees) != 2:
        parser.error("expected A B directories, or --dist DIR --live URL")
    only_first, only_second, differing = diff_trees(*args.trees)
    for name in only_first:
        print(f"only in A: {name}")
    for name in only_second:
        print(f"only in B: {name}")
    for name in differing:
        print(f"differs: {name}")
    return 1 if only_first or only_second or differing else 0


if __name__ == "__main__":
    sys.exit(main())
