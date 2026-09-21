#!/usr/bin/env python3
"""build_library.py — validate the deliverable records and bundle them for the app.

    python3 tools/build_library.py            # lint, then write app/data/library.json
    python3 tools/build_library.py --check    # lint only; exit 1 on any error

One markdown file per deliverable in library/, with frontmatter for the index fields
and a short body: a summary paragraph, then an "## Outline" list of slide titles.
Tags must come from library/taxonomy.json, so the search can rely on them.
Standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY = ROOT / "library"
TAXONOMY = LIBRARY / "taxonomy.json"
OUT = ROOT / "app" / "data" / "library.json"

REQUIRED = ("id", "title", "type", "audiences", "topics", "client", "date", "format",
            "file", "author", "author_role", "author_email")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CONTRIB_RE = re.compile(r"^\s*(.+?)\s*<([^>]+)>\s*$")


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Scalars, inline lists [a, b], and '- ' block lists. Nothing nested."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block, body = text[3:end].strip("\n"), text[end + 4:].lstrip("\n")
    meta: dict = {}
    key = None
    for line in block.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith((" ", "\t")) and line.lstrip().startswith("- ") and key:
            meta.setdefault(key, [])
            if isinstance(meta[key], list):
                meta[key].append(line.lstrip()[2:].strip().strip("\"'"))
            continue
        if ":" in line:
            key, _, val = line.partition(":")
            key, val = key.strip(), val.strip()
            if val.startswith("[") and val.endswith("]"):
                meta[key] = [v.strip().strip("\"'") for v in val[1:-1].split(",") if v.strip()]
            else:
                meta[key] = val.strip("\"'") if val else []
    return meta, body


def parse_body(body: str) -> tuple[str, list[str]]:
    head, _, tail = body.partition("## Outline")
    summary = " ".join(p.strip() for p in head.split("\n\n") if p.strip())
    summary = re.sub(r"\s+", " ", summary)
    outline = [ln.strip()[2:].strip() for ln in tail.splitlines()
               if ln.strip().startswith(("- ", "* "))]
    return summary, outline


def load_taxonomy() -> dict:
    return json.loads(TAXONOMY.read_text(encoding="utf-8"))


def load_records() -> list[tuple[Path, dict, str]]:
    return [(p, *parse_frontmatter(p.read_text(encoding="utf-8")))
            for p in sorted(LIBRARY.glob("*.md"))]


def lint(records, tax) -> list[str]:
    errors: list[str] = []
    types = {t["name"] for t in tax["types"]}
    audiences = {a["tag"] for a in tax["audiences"]}
    topics = {t["tag"] for t in tax["topics"]}
    formats = set(tax["formats"])
    seen: dict[str, Path] = {}

    for path, meta, body in records:
        where = path.relative_to(ROOT).as_posix()
        err = lambda m: errors.append(f"{where}: {m}")  # noqa: E731
        if not meta:
            err("no frontmatter"); continue
        for f in REQUIRED:
            if f not in meta or meta[f] in ("", []):
                err(f"missing '{f}'")
        rid = str(meta.get("id", ""))
        if rid and rid != path.stem:
            err(f"id '{rid}' does not match file name '{path.stem}'")
        if rid in seen:
            err(f"duplicate id '{rid}' (also in {seen[rid].name})")
        seen[rid] = path
        if meta.get("type") and meta["type"] not in types:
            err(f"type '{meta['type']}' not in taxonomy")
        for a in meta.get("audiences") or []:
            if a not in audiences:
                err(f"audience '{a}' not in taxonomy")
        for t in meta.get("topics") or []:
            if t not in topics:
                err(f"topic '{t}' not in taxonomy")
        if meta.get("format") and meta["format"] not in formats:
            err(f"format '{meta['format']}' not in {sorted(formats)}")
        if meta.get("date") and not re.match(r"^\d{4}-\d{2}$", str(meta["date"])):
            err(f"date '{meta['date']}' must be YYYY-MM")
        if meta.get("author_email") and not EMAIL_RE.match(str(meta["author_email"])):
            err(f"author_email '{meta['author_email']}' is not an email address")
        for c in meta.get("contributors") or []:
            if not CONTRIB_RE.match(c):
                err(f"contributor '{c}' must be 'Name <email>'")
        summary, outline = parse_body(body)
        if len(summary.split()) < 20:
            err("summary is under 20 words — say what the deliverable found or recommends")
        if not outline:
            err("no '## Outline' list — add the slide or section titles")
    return errors


def repo_url() -> str:
    try:
        remote = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True,
                                text=True, cwd=ROOT, check=True).stdout.strip()
        return re.sub(r"\.git$", "", remote.replace("git@github.com:", "https://github.com/"))
    except Exception:
        return ""


def bundle(records, tax) -> dict:
    items = []
    for path, meta, body in records:
        summary, outline = parse_body(body)
        contributors = []
        for c in meta.get("contributors") or []:
            m = CONTRIB_RE.match(c)
            if m:
                contributors.append({"name": m.group(1), "email": m.group(2)})
        items.append({
            "id": meta["id"], "title": meta["title"], "type": meta["type"],
            "audiences": meta.get("audiences") or [], "topics": meta.get("topics") or [],
            "client": meta.get("client", ""), "date": str(meta["date"]),
            "format": meta.get("format", ""), "pages": int(meta.get("pages") or 0),
            "file": meta.get("file", ""),
            "author": {"name": meta["author"], "role": meta.get("author_role", ""),
                       "email": meta.get("author_email", "")},
            "contributors": contributors,
            "summary": summary, "outline": outline,
            "source": path.relative_to(ROOT).as_posix(),
        })
    items.sort(key=lambda i: i["date"], reverse=True)
    return {"built": dt.date.today().isoformat(), "repo": repo_url(),
            "taxonomy": tax, "items": items}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="lint only")
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    tax = load_taxonomy()
    records = load_records()
    errors = lint(records, tax)
    for e in errors:
        print(f"  ERROR {e}")
    if errors:
        print(f"\n{len(records)} records, {len(errors)} error(s). Fix them, then re-run.")
        return 1
    print(f"{len(records)} records, 0 errors.")
    if args.check:
        return 0
    data = bundle(records, tax)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out} — "
          f"{len(data['items'])} deliverables, {out.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
