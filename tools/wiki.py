#!/usr/bin/env python3
"""wiki.py — deterministic tooling for an LLM wiki.

The LLM compiles raw/ into wiki/. This script checks the build.
No API key, no network, no LLM: it verifies mechanical invariants only.
It cannot tell you whether a page is true.

    lint     check every invariant; exit 1 on errors
    status   what needs recompiling (make-style dependency check)
    index    regenerate wiki/index.md from frontmatter
    graph    emit the link graph as mermaid
    stats    counts and coverage
    new      scaffold a page with correct frontmatter
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
WIKI = ROOT / "wiki"

PAGE_TYPES = {"concept", "entity", "comparison", "question", "overview"}
STATUSES = {"established", "contested", "provisional", "superseded"}
REQUIRED = ("title", "type", "status", "updated", "sources")
# Pages exempt from the orphan check and from body-level citation rules.
INFRA = {"index", "log", "synthesis"}
SPECIAL_CITES = {"synthesis"}

LINK_RE = re.compile(r"\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]")
CITE_RE = re.compile(r"\[\^([A-Za-z0-9._-]+)\]")
FOOTNOTE_DEF_RE = re.compile(r"^\[\^([A-Za-z0-9._-]+)\]:")
FENCE_RE = re.compile(r"^\s*```")


# ---------------------------------------------------------------- frontmatter

def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Parse the YAML subset we actually use: scalars and '- ' lists."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block = text[3:end].strip("\n")
    body = text[end + 4:].lstrip("\n")

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
            key = key.strip()
            val = val.strip()
            if val.startswith("[") and val.endswith("]"):
                # inline list: [] or [a, b]
                inner = val[1:-1].strip()
                meta[key] = [i.strip().strip("\"'")
                             for i in inner.split(",") if i.strip()]
            else:
                val = val.strip("\"'")
                meta[key] = val if val else []
    return meta, body


def strip_code(body: str) -> str:
    """Remove fenced code blocks so examples in docs don't trip the checks."""
    out, fenced = [], False
    for line in body.splitlines():
        if FENCE_RE.match(line):
            fenced = not fenced
            continue
        if not fenced:
            out.append(line)
    return "\n".join(out)


def as_date(val) -> dt.date | None:
    if not isinstance(val, str):
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return dt.datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------- model

@dataclass
class Page:
    slug: str
    path: Path
    meta: dict
    body: str
    links: list[str] = field(default_factory=list)
    cites: list[str] = field(default_factory=list)

    @property
    def is_infra(self) -> bool:
        return self.slug in INFRA


@dataclass
class Source:
    sid: str
    path: Path
    meta: dict


def load() -> tuple[dict[str, Page], dict[str, Source]]:
    pages: dict[str, Page] = {}
    for p in sorted(WIKI.rglob("*.md")):
        text = p.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)
        slug = p.relative_to(WIKI).with_suffix("").as_posix()
        clean = strip_code(body)
        # Citations, ignoring footnote-definition lines at the page foot.
        cites = []
        for line in clean.splitlines():
            if FOOTNOTE_DEF_RE.match(line.strip()):
                continue
            cites.extend(CITE_RE.findall(line))
        pages[slug] = Page(slug, p, meta, body, LINK_RE.findall(clean), cites)

    sources: dict[str, Source] = {}
    for p in sorted(RAW.glob("*.md")):
        meta, _ = parse_frontmatter(p.read_text(encoding="utf-8"))
        sid = meta.get("source_id")
        if isinstance(sid, str) and sid:
            sources[sid] = Source(sid, p, meta)
    return pages, sources


# ----------------------------------------------------------------------- lint

class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, where: str, msg: str) -> None:
        self.errors.append(f"{where}: {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"{where}: {msg}")


def lint(pages: dict[str, Page], sources: dict[str, Source]) -> Report:
    r = Report()
    inbound: dict[str, set[str]] = defaultdict(set)

    for slug, pg in sorted(pages.items()):
        where = pg.path.relative_to(ROOT).as_posix()

        # -- frontmatter ------------------------------------------------
        if not pg.meta:
            r.err(where, "no frontmatter")
            continue
        for fld in REQUIRED:
            if fld not in pg.meta:
                r.err(where, f"frontmatter missing '{fld}'")
        ptype = pg.meta.get("type")
        if ptype and ptype not in PAGE_TYPES:
            r.err(where, f"type '{ptype}' not in {sorted(PAGE_TYPES)}")
        status = pg.meta.get("status")
        if status and status not in STATUSES:
            r.err(where, f"status '{status}' not in {sorted(STATUSES)}")
        if "updated" in pg.meta and as_date(pg.meta["updated"]) is None:
            r.err(where, f"updated '{pg.meta['updated']}' is not a date")

        declared = pg.meta.get("sources") or []
        if isinstance(declared, str):
            declared = [declared] if declared else []

        # -- links ------------------------------------------------------
        for link in pg.links:
            target = link.strip().lstrip("/")
            if target not in pages:
                r.err(where, f"broken link [[{target}]]")
            else:
                inbound[target].add(slug)

        # -- citations --------------------------------------------------
        for cid in set(pg.cites):
            if cid in SPECIAL_CITES:
                continue
            if cid not in sources:
                r.err(where, f"citation [^{cid}] has no source in raw/")
            elif cid not in declared:
                r.err(where, f"cites [^{cid}] but omits it from frontmatter sources")
        for sid in declared:
            if sid not in sources:
                r.err(where, f"frontmatter lists unknown source '{sid}'")
            elif sid not in pg.cites and not pg.is_infra:
                r.warn(where, f"declares source '{sid}' but never cites it")

        # -- status obligations -----------------------------------------
        clean = strip_code(pg.body)
        if status == "contested" and not re.search(r"^##+\s*Contradictions",
                                                   clean, re.M | re.I):
            r.err(where, "status 'contested' requires a '## Contradictions' section")
        if status == "superseded" and not pg.links:
            r.err(where, "status 'superseded' must link forward to its replacement")

        # -- staleness (make-style dependency check) --------------------
        pdate = as_date(pg.meta.get("updated", ""))
        if pdate:
            for sid in declared:
                src = sources.get(sid)
                if not src:
                    continue
                sdate = as_date(src.meta.get("added", ""))
                if sdate and sdate > pdate:
                    r.err(where, f"stale: source '{sid}' added {sdate} "
                                 f"but page compiled {pdate} — recompile")

        # -- uncited assertions (heuristic, warning only) ----------------
        if not pg.is_infra:
            for para in re.split(r"\n\s*\n", clean):
                p = para.strip()
                if (not p or p.startswith(("#", ">", "|", "-", "*", "1.", "["))
                        or len(p.split()) < 25):
                    continue
                if not CITE_RE.search(p):
                    r.warn(where, f"uncited assertion: \"{' '.join(p.split())[:60]}…\"")

    # -- orphans --------------------------------------------------------
    for slug, pg in sorted(pages.items()):
        if pg.is_infra or not pg.meta:
            continue
        if not inbound.get(slug):
            r.warn(pg.path.relative_to(ROOT).as_posix(),
                   "orphan — no page links here")
        elif len(pg.links) < 3:
            r.warn(pg.path.relative_to(ROOT).as_posix(),
                   f"only {len(pg.links)} outbound links (aim for 3+)")

    # -- uningested sources ---------------------------------------------
    cited = {c for pg in pages.values() for c in pg.cites}
    for sid, src in sorted(sources.items()):
        if sid not in cited:
            r.err(src.path.relative_to(ROOT).as_posix(),
                  f"source '{sid}' is in raw/ but no wiki page cites it — not ingested")
    return r


def cmd_lint(args) -> int:
    pages, sources = load()
    r = lint(pages, sources)
    for w in r.warnings:
        print(f"  warn  {w}")
    for e in r.errors:
        print(f"  ERROR {e}")
    print()
    print(f"{len(pages)} pages, {len(sources)} sources, "
          f"{len(r.errors)} errors, {len(r.warnings)} warnings")
    if r.errors:
        print("\nBuild is broken. Fix the errors, then re-run.")
        return 1
    print("Wiki is consistent. (Consistent is not the same as true.)")
    return 0


def cmd_status(args) -> int:
    """make-style: which pages are older than the sources they depend on."""
    pages, sources = load()
    stale, uningested = [], []
    cited = {c for pg in pages.values() for c in pg.cites}
    for slug, pg in sorted(pages.items()):
        pdate = as_date(pg.meta.get("updated", ""))
        declared = pg.meta.get("sources") or []
        if isinstance(declared, str):
            declared = [declared]
        for sid in declared:
            src = sources.get(sid)
            sdate = as_date(src.meta.get("added", "")) if src else None
            if pdate and sdate and sdate > pdate:
                stale.append((slug, sid, pdate, sdate))
    for sid, src in sorted(sources.items()):
        if sid not in cited:
            uningested.append(sid)

    if not stale and not uningested:
        print("Up to date — every source is compiled, every page current.")
        return 0
    if uningested:
        print("Never ingested:")
        for sid in uningested:
            print(f"  {sid}  ({sources[sid].path.relative_to(ROOT)})")
    if stale:
        print("Stale (source newer than page):")
        for slug, sid, pdate, sdate in stale:
            print(f"  {slug}  depends on {sid} ({sdate}) but compiled {pdate}")
    print("\nRun the compile operation on these pages.")
    return 0


def cmd_index(args) -> int:
    pages, sources = load()
    by_type: dict[str, list[Page]] = defaultdict(list)
    for slug, pg in sorted(pages.items()):
        if pg.is_infra or not pg.meta:
            continue
        by_type[str(pg.meta.get("type", "unknown"))].append(pg)

    today = dt.date.today().isoformat()
    out = [
        "---",
        "title: Index",
        "type: overview",
        "status: established",
        f"updated: {today}",
        "sources: []",
        "---",
        "",
        "# Index",
        "",
        f"*Generated by `tools/wiki.py index` on {today}. Do not hand-edit.*",
        "",
        f"{len(pages)} pages compiled from {len(sources)} sources in `raw/`.",
        "",
    ]
    for ptype in ("concept", "entity", "comparison", "question", "overview"):
        group = by_type.get(ptype)
        if not group:
            continue
        out.append(f"## {ptype.capitalize()}s")
        out.append("")
        out.append("| page | status | updated | sources |")
        out.append("|---|---|---|---|")
        for pg in group:
            srcs = pg.meta.get("sources") or []
            if isinstance(srcs, str):
                srcs = [srcs]
            out.append(f"| [[{pg.slug}]] | `{pg.meta.get('status','?')}` "
                       f"| {pg.meta.get('updated','?')} | {len(srcs)} |")
        out.append("")

    out += ["## Sources", "", "| id | title | added | capture |", "|---|---|---|---|"]
    for sid, src in sorted(sources.items()):
        out.append(f"| `{sid}` | {src.meta.get('title','?')} "
                   f"| {src.meta.get('added','?')} | {src.meta.get('capture','?')} |")
    out.append("")

    (WIKI / "index.md").write_text("\n".join(out), encoding="utf-8")
    print(f"Wrote wiki/index.md — {len(pages)} pages, {len(sources)} sources.")
    return 0


def cmd_graph(args) -> int:
    pages, _ = load()
    print("```mermaid")
    print("graph LR")
    for slug, pg in sorted(pages.items()):
        if pg.is_infra:
            continue
        node = slug.replace("/", "_").replace("-", "_")
        label = pg.meta.get("title", slug)
        print(f'  {node}["{label}"]')
    for slug, pg in sorted(pages.items()):
        if pg.is_infra:
            continue
        a = slug.replace("/", "_").replace("-", "_")
        for link in sorted(set(pg.links)):
            if link in pages and link not in INFRA:
                b = link.replace("/", "_").replace("-", "_")
                print(f"  {a} --> {b}")
    print("```")
    return 0


def cmd_stats(args) -> int:
    pages, sources = load()
    types: dict[str, int] = defaultdict(int)
    statuses: dict[str, int] = defaultdict(int)
    words = links = cites = 0
    for pg in pages.values():
        types[str(pg.meta.get("type", "?"))] += 1
        statuses[str(pg.meta.get("status", "?"))] += 1
        words += len(strip_code(pg.body).split())
        links += len(pg.links)
        cites += len(pg.cites)
    raw_words = sum(len(p.read_text(encoding="utf-8").split())
                    for p in RAW.glob("*.md"))
    print(f"pages       {len(pages)}")
    print(f"sources     {len(sources)}")
    print(f"raw words   {raw_words}")
    print(f"wiki words  {words}  ({words / raw_words:.2f}x raw)"
          if raw_words else f"wiki words  {words}")
    print(f"links       {links}  ({links / max(len(pages),1):.1f} per page)")
    print(f"citations   {cites}  ({cites / max(len(pages),1):.1f} per page)")
    print("types       " + ", ".join(f"{k}={v}" for k, v in sorted(types.items())))
    print("status      " + ", ".join(f"{k}={v}" for k, v in sorted(statuses.items())))
    return 0


def cmd_new(args) -> int:
    slug = args.slug.strip("/").removesuffix(".md")
    path = WIKI / f"{slug}.md"
    if path.exists():
        print(f"{path.relative_to(ROOT)} already exists", file=sys.stderr)
        return 1
    path.parent.mkdir(parents=True, exist_ok=True)
    title = args.title or slug.rsplit("/", 1)[-1].replace("-", " ").capitalize()
    path.write_text(
        "---\n"
        f"title: {title}\n"
        f"type: {args.type}\n"
        f"status: {args.status}\n"
        f"updated: {dt.date.today().isoformat()}\n"
        "sources: []\n"
        "---\n\n"
        f"# {title}\n\n"
        "<!-- Every claim needs a [^source-id]. Link 3+ related pages. -->\n",
        encoding="utf-8")
    print(f"Created {path.relative_to(ROOT)}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="wiki", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("lint", help="check every invariant").set_defaults(fn=cmd_lint)
    sub.add_parser("status", help="what needs recompiling").set_defaults(fn=cmd_status)
    sub.add_parser("index", help="regenerate wiki/index.md").set_defaults(fn=cmd_index)
    sub.add_parser("graph", help="emit link graph as mermaid").set_defaults(fn=cmd_graph)
    sub.add_parser("stats", help="counts and coverage").set_defaults(fn=cmd_stats)
    n = sub.add_parser("new", help="scaffold a page")
    n.add_argument("slug", help="e.g. concepts/knowledge-decay")
    n.add_argument("--title")
    n.add_argument("--type", default="concept", choices=sorted(PAGE_TYPES))
    n.add_argument("--status", default="provisional", choices=sorted(STATUSES))
    n.set_defaults(fn=cmd_new)
    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
