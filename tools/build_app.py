#!/usr/bin/env python3
"""build_app.py — bundle raw/ and wiki/ into the web app's seed data.

The app is a real client of this repo: it loads the compiled wiki as JSON,
then lets you query it, lint it, and compile new sources into it in the
browser. This script produces that JSON.

    python3 tools/build_app.py [--out app/data/wiki.json]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wiki  # noqa: E402


def repo_url() -> str:
    try:
        remote = subprocess.run(["git", "remote", "get-url", "origin"],
                                capture_output=True, text=True, cwd=wiki.ROOT,
                                check=True).stdout.strip()
        return re.sub(r"\.git$", "",
                      remote.replace("git@github.com:", "https://github.com/"))
    except Exception:
        return ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="app/data/wiki.json")
    args = ap.parse_args()

    pages, sources = wiki.load()
    if not pages:
        print("No pages in wiki/", file=sys.stderr)
        return 1

    data = {
        "built": dt.date.today().isoformat(),
        "repo": repo_url(),
        "schema": (wiki.ROOT / "CLAUDE.md").read_text(encoding="utf-8"),
        "sources": [
            {
                "id": sid,
                "file": src.path.relative_to(wiki.ROOT).as_posix(),
                "title": str(src.meta.get("title", sid)),
                "author": str(src.meta.get("author", "")),
                "url": str(src.meta.get("url", "")),
                "published": str(src.meta.get("published", "")),
                "added": str(src.meta.get("added", "")),
                "kind": str(src.meta.get("kind", "")),
                "capture": str(src.meta.get("capture", "")),
                "body": src.path.read_text(encoding="utf-8").split("---", 2)[-1].strip(),
            }
            for sid, src in sorted(sources.items())
        ],
        "pages": [
            {
                "slug": slug,
                "file": pg.path.relative_to(wiki.ROOT).as_posix(),
                "meta": {
                    "title": str(pg.meta.get("title", slug)),
                    "type": str(pg.meta.get("type", "")),
                    "status": str(pg.meta.get("status", "")),
                    "updated": str(pg.meta.get("updated", "")),
                    "sources": (pg.meta.get("sources") or []) if not isinstance(
                        pg.meta.get("sources"), str) else [pg.meta["sources"]],
                },
                "body": pg.body,
            }
            for slug, pg in sorted(pages.items())
        ],
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    kb = out.stat().st_size / 1024
    print(f"Wrote {out} — {len(data['pages'])} pages, "
          f"{len(data['sources'])} sources, {kb:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
