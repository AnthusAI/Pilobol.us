"""Generate Pilobolus homepage and archive listings from article Markdown."""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

DEFAULT_AUTHOR = "by various bots and Ryan Porter"
_DEFAULT_SITE_DESCRIPTION = (
    "Glimpses of our moldy future, as our society is gradually infected by a "
    "fungus that grows on its own bullshit."
)
_DEFAULT_SITE_COVER = "assets/og-default.jpg"
_DATE_FORMATS = (
    "%A, %B %d, %Y",
    "%Y-%m-%d",
)


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end < 0:
        return {}, text
    block = text[3:end]
    body = text[end + 4 :].lstrip("\n")
    out: dict[str, str] = {}
    key: str | None = None
    buf: list[str] = []

    def flush() -> None:
        nonlocal key, buf
        if key is None:
            return
        out[key] = " ".join(x for x in buf if x).strip()
        key = None
        buf = []

    for line in block.splitlines():
        if key is not None and (line.startswith("  ") or line.startswith("\t")):
            piece = line.strip()
            if piece:
                buf.append(piece)
            continue
        flush()
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        k = k.strip()
        v = v.strip()
        if v in (">-", ">", "|", ""):
            key = k
            buf = []
            continue
        if len(v) >= 2 and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
            v = v[1:-1]
        key = k
        buf = [v]
    flush()
    return out, body


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def is_draft(front_matter: dict[str, str]) -> bool:
    if _is_truthy(front_matter.get("draft")):
        return True
    status = (front_matter.get("status") or "").strip().lower()
    return status == "draft"


def feed_hidden(front_matter: dict[str, str]) -> bool:
    for key in ("feed", "home"):
        val = front_matter.get(key)
        if val is None:
            continue
        if str(val).strip().lower() in {"false", "0", "no", "off"}:
            return True
    return False


def parse_article_date(front_matter: dict[str, str]) -> datetime:
    raw = (front_matter.get("date") or "").strip().strip("'\"")
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return datetime.min


def discover_articles(articles_dir: Path) -> list[tuple[str, Path, dict[str, str]]]:
    found: list[tuple[str, Path, dict[str, str]]] = []
    for path in sorted(articles_dir.glob("*.md")):
        if path.name == "index.md":
            continue
        slug = path.stem
        fm, _ = parse_front_matter(path.read_text(encoding="utf-8"))
        if is_draft(fm):
            continue
        found.append((slug, path, fm))
    return found


def _card_image(fm: dict[str, str]) -> str | None:
    for key in ("card_image", "cover"):
        value = fm.get(key)
        if value:
            return value
    return None


def _card_blurb(fm: dict[str, str]) -> str:
    if fm.get("description"):
        return fm["description"]
    if fm.get("standfirst"):
        return fm["standfirst"]
    return ""


def _image_alt(fm: dict[str, str], *, title: str) -> str:
    if fm.get("card_image_alt"):
        return fm["card_image_alt"]
    body_match = re.search(r':::figure\{[^}]*\balt="([^"]+)"', fm.get("_body", ""))
    if body_match:
        return body_match.group(1)
    return title


def _attach_body(
    articles: list[tuple[str, Path, dict[str, str]]],
) -> list[tuple[str, Path, dict[str, str]]]:
    enriched: list[tuple[str, Path, dict[str, str]]] = []
    for slug, path, fm in articles:
        fm = dict(fm)
        _, body = parse_front_matter(path.read_text(encoding="utf-8"))
        fm["_body"] = body
        enriched.append((slug, path, fm))
    return enriched


def generate_homepage_markdown(
    *,
    site_description: str,
    articles: list[tuple[str, Path, dict[str, str]]],
) -> str:
    feed_articles = [
        item for item in articles if not feed_hidden(item[2])
    ]
    feed_articles.sort(key=lambda item: parse_article_date(item[2]), reverse=True)

    cover = _DEFAULT_SITE_COVER
    if feed_articles:
        img = _card_image(feed_articles[0][2])
        if img:
            cover = img

    lines = [
        "---",
        'title: ""',
        "description: >-",
        f"  {site_description}",
        f"cover: {cover}",
        "---",
        "",
        ':::card-grid{columns="6"}',
    ]

    for slug, _path, fm in feed_articles:
        title = fm.get("title") or slug.replace("-", " ").title()
        blurb = _card_blurb(fm)
        date = fm.get("date", "").strip("'\"")
        img = _card_image(fm)
        lines.append(':::card{span="full"}')
        lines.append(
            f"### [{title}](articles/{slug}.html)"
        )
        lines.append("")
        if img:
            alt = _image_alt(fm, title=title)
            lines.append(f"![{alt}]({img})")
            lines.append("")
        if blurb:
            lines.append(blurb)
            lines.append("")
        if date:
            lines.append(f"*{date}*")
        lines.append(":::")

    lines.append(":::")
    lines.append("")
    return "\n".join(lines)


def generate_archive_markdown(
    *,
    title: str,
    description: str,
    articles: list[tuple[str, Path, dict[str, str]]],
) -> str:
    ordered = sorted(articles, key=lambda item: parse_article_date(item[2]), reverse=True)
    lines = [
        "---",
        f"title: {title}",
        f"description: {description}",
        "---",
        "",
    ]
    for slug, _path, fm in ordered:
        article_title = fm.get("title") or slug.replace("-", " ").title()
        blurb = _card_blurb(fm)
        date = fm.get("date", "").strip("'\"")
        img = _card_image(fm)
        lines.append(f"### [{article_title}]({slug}.html)")
        lines.append("")
        if img:
            alt = _image_alt(fm, title=article_title)
            rel = img if img.startswith("../") else f"../{img.lstrip('/')}"
            lines.append(f"[![{alt}]({rel})]({slug}.html)")
            lines.append("")
        if blurb:
            lines.append(blurb)
            lines.append("")
        if date:
            lines.append(f"*{date}*")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def write_generated_feed_pages(content_dir: Path) -> list[tuple[str, Path, dict[str, str]]]:
    articles_dir = content_dir / "articles"
    articles = _attach_body(discover_articles(articles_dir))

    home_path = content_dir / "index.md"
    home_path.write_text(
        generate_homepage_markdown(
            site_description=_DEFAULT_SITE_DESCRIPTION,
            articles=articles,
        ),
        encoding="utf-8",
    )

    archive_path = articles_dir / "index.md"
    archive_path.write_text(
        generate_archive_markdown(
            title="Spores",
            description="Glimpses of our moldy future.",
            articles=articles,
        ),
        encoding="utf-8",
    )
    return articles
