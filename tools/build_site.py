#!/usr/bin/env python3
"""build_site.py — render wiki/ as a static site for GitHub Pages.

Stdlib only, like the rest of the tooling. The job that matters is resolving
[[wikilinks]] into real hyperlinks: GitHub's own markdown view renders them as
literal brackets, which kills the link graph — and the link graph is how you
navigate a compiled wiki.

    python3 tools/build_site.py [--out site] [--base-url URL]
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import posixpath
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wiki  # noqa: E402

PLURAL = {"concept": "concepts", "entity": "entities", "comparison": "comparisons",
          "question": "questions", "overview": "overviews"}

STATUS_BLURB = {
    "established": "multiple sources agree, or one authoritative source and no dissent",
    "contested": "sources disagree — see the Contradictions section",
    "provisional": "one source, unreplicated, or the compiler's own synthesis",
    "superseded": "overturned — follow the forward link",
}


# ------------------------------------------------------------------ inline

CODE_RE = re.compile(r"`([^`]+)`")
WIKILINK_RE = re.compile(r"\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]")
MDLINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)]+|[^)]+\.md)\)")
CITE_RE = re.compile(r"\[\^([A-Za-z0-9._-]+)\]")
BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
ITAL_RE = re.compile(r"(?<![*\w])\*([^*\n]+)\*(?!\*)")


def inline(text: str, slug: str, pages: dict, repo_url: str) -> str:
    """Render inline markdown. Order matters: protect code, then link, then style."""
    out = html.escape(text, quote=False)

    stash: list[str] = []

    def keep(m):
        stash.append(f"<code>{m.group(1)}</code>")
        return f"\x00{len(stash) - 1}\x00"

    out = CODE_RE.sub(keep, out)

    def wikilink(m):
        target = m.group(1).strip().lstrip("/")
        label = (m.group(2) or "").strip()
        if target in pages:
            label = label or pages[target].meta.get("title", target)
            cls = f' class="s-{pages[target].meta.get("status", "")}"'
            return f'<a href="{rel(slug, target)}"{cls}>{html.escape(label)}</a>'
        # A broken link is a lint error; show it rather than hiding it.
        return (f'<span class="broken" title="broken link — run wiki.py lint">'
                f'[[{html.escape(target)}]]</span>')

    out = WIKILINK_RE.sub(wikilink, out)

    def mdlink(m):
        label, href = m.group(1), m.group(2)
        if not href.startswith("http"):
            href = f"{repo_url}/blob/main/{href.lstrip('./')}"
        return f'<a href="{href}">{label}</a>'

    out = MDLINK_RE.sub(mdlink, out)

    def cite(m):
        cid = m.group(1)
        return (f'<a href="#fn-{cid}" class="cite" id="ref-{cid}">'
                f'<sup>{html.escape(cid)}</sup></a>')

    out = CITE_RE.sub(cite, out)
    out = BOLD_RE.sub(r"<strong>\1</strong>", out)
    out = ITAL_RE.sub(r"<em>\1</em>", out)

    for i, frag in enumerate(stash):
        out = out.replace(f"\x00{i}\x00", frag)
    return out


def rel(from_slug: str, to_slug: str) -> str:
    """Relative href between two page slugs."""
    from_dir = posixpath.dirname(from_slug)
    return posixpath.relpath(f"{to_slug}.html", from_dir or ".")


# ------------------------------------------------------------------- blocks

FENCE_RE = re.compile(r"^\s*```\s*(\w*)")
HEAD_RE = re.compile(r"^(#{1,6})\s+(.*)$")
FOOTDEF_RE = re.compile(r"^\[\^([A-Za-z0-9._-]+)\]:\s*(.*)$")
ULI_RE = re.compile(r"^\s*[-*]\s+(.*)$")
OLI_RE = re.compile(r"^\s*\d+\.\s+(.*)$")


def render(body: str, slug: str, pages: dict, repo_url: str) -> tuple[str, dict]:
    """Markdown → HTML for the subset this wiki actually uses."""
    lines = body.splitlines()
    out: list[str] = []
    notes: dict[str, str] = {}
    i = 0
    para: list[str] = []
    list_kind: str | None = None

    def flush_para():
        nonlocal para
        if para:
            out.append(f"<p>{inline(' '.join(para), slug, pages, repo_url)}</p>")
            para = []

    def close_list():
        nonlocal list_kind
        if list_kind:
            out.append(f"</{list_kind}>")
            list_kind = None

    while i < len(lines):
        line = lines[i]

        m = FENCE_RE.match(line)
        if m:
            flush_para(); close_list()
            lang = m.group(1)
            i += 1
            buf = []
            while i < len(lines) and not FENCE_RE.match(lines[i]):
                buf.append(lines[i]); i += 1
            i += 1
            code = html.escape("\n".join(buf), quote=False)
            if lang == "mermaid":
                out.append(f'<pre class="mermaid">{code}</pre>')
            else:
                out.append(f"<pre><code>{code}</code></pre>")
            continue

        m = FOOTDEF_RE.match(line.strip())
        if m:
            flush_para(); close_list()
            notes[m.group(1)] = m.group(2)
            i += 1
            continue

        # GFM pipe table
        if (line.strip().startswith("|") and i + 1 < len(lines)
                and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1])):
            flush_para(); close_list()
            header = [c.strip() for c in line.strip().strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            out.append("<div class='tw'><table><thead><tr>" + "".join(
                f"<th>{inline(c, slug, pages, repo_url)}</th>" for c in header)
                + "</tr></thead><tbody>")
            for r in rows:
                out.append("<tr>" + "".join(
                    f"<td>{inline(c, slug, pages, repo_url)}</td>" for c in r) + "</tr>")
            out.append("</tbody></table></div>")
            continue

        m = HEAD_RE.match(line)
        if m:
            flush_para(); close_list()
            lvl = len(m.group(1))
            txt = inline(m.group(2), slug, pages, repo_url)
            anchor = re.sub(r"[^a-z0-9]+", "-", m.group(2).lower()).strip("-")
            out.append(f'<h{lvl} id="{anchor}">{txt}</h{lvl}>')
            i += 1
            continue

        if line.strip().startswith(">"):
            flush_para(); close_list()
            buf = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip().lstrip(">").strip()); i += 1
            out.append(f"<blockquote><p>"
                       f"{inline(' '.join(buf), slug, pages, repo_url)}</p></blockquote>")
            continue

        m = ULI_RE.match(line) or OLI_RE.match(line)
        if m and line.strip():
            kind = "ul" if ULI_RE.match(line) else "ol"
            flush_para()
            if list_kind != kind:
                close_list()
                out.append(f"<{kind}>")
                list_kind = kind
            item = [m.group(1)]
            i += 1
            # continuation lines of the same bullet
            while (i < len(lines) and lines[i].strip()
                   and not ULI_RE.match(lines[i]) and not OLI_RE.match(lines[i])
                   and not HEAD_RE.match(lines[i]) and lines[i].startswith((" ", "\t"))):
                item.append(lines[i].strip()); i += 1
            out.append(f"<li>{inline(' '.join(item), slug, pages, repo_url)}</li>")
            continue

        if not line.strip():
            flush_para(); close_list()
            i += 1
            continue

        para.append(line.strip())
        i += 1

    flush_para(); close_list()
    return "\n".join(out), notes


# --------------------------------------------------------------------- page

CSS = """
:root{--bg:#fdfdfc;--fg:#1a1a18;--dim:#6b6b66;--line:#e4e4df;--card:#fff;
--accent:#0b6b5f;--code:#f4f4f0;
--est:#1a7f5a;--con:#b06000;--prov:#5a5aa8;--sup:#a03030;}
@media(prefers-color-scheme:dark){:root{--bg:#16171a;--fg:#e6e6e2;--dim:#9a9a94;
--line:#2c2e33;--card:#1c1e22;--accent:#4fd1bd;--code:#22242a;
--est:#4fd1a0;--con:#e0a04a;--prov:#9a9ae0;--sup:#e08080;}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.wrap{max-width:1140px;margin:0 auto;padding:0 24px;display:grid;
grid-template-columns:230px 1fr;gap:44px}
header{border-bottom:1px solid var(--line);margin-bottom:32px}
header .wrap{display:block;padding-top:20px;padding-bottom:20px}
header a.home{font-weight:650;text-decoration:none;color:var(--fg)}
header .tag{color:var(--dim);font-size:13px;margin-top:2px}
nav{font-size:13.5px;position:sticky;top:24px;align-self:start;max-height:90vh;
overflow-y:auto}
nav h4{text-transform:uppercase;letter-spacing:.07em;font-size:10.5px;color:var(--dim);
margin:20px 0 7px}
nav a{display:block;padding:2.5px 0;color:var(--fg);text-decoration:none}
nav a:hover{color:var(--accent)}
nav a.here{color:var(--accent);font-weight:640}
main{min-width:0;padding-bottom:80px}
h1{font-size:31px;line-height:1.2;margin:0 0 6px}
h2{font-size:20px;margin:34px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--line)}
h3{font-size:16.5px;margin:26px 0 8px}
a{color:var(--accent)}
code{background:var(--code);padding:1.5px 5px;border-radius:4px;font-size:13.5px}
pre{background:var(--code);padding:14px 16px;border-radius:8px;overflow-x:auto;
font-size:13px;line-height:1.5}
pre code{background:none;padding:0}
pre.mermaid{display:none;text-align:center}
blockquote{border-left:3px solid var(--line);margin:16px 0;padding:2px 0 2px 16px;
color:var(--dim)}
.tw{overflow-x:auto;margin:16px 0}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th,td{border:1px solid var(--line);padding:7px 11px;text-align:left;vertical-align:top}
th{background:var(--code);font-weight:620}
.meta{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:0 0 26px;
font-size:12.5px;color:var(--dim)}
.badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11.5px;
font-weight:640;border:1px solid currentColor}
.s-established,.b-established{color:var(--est)}
.s-contested,.b-contested{color:var(--con)}
.s-provisional,.b-provisional{color:var(--prov)}
.s-superseded,.b-superseded{color:var(--sup)}
sup{font-size:10.5px}
.cite{text-decoration:none;padding:0 1px;white-space:nowrap}
.broken{color:var(--sup);border-bottom:1.5px dotted var(--sup)}
.notes{margin-top:44px;border-top:1px solid var(--line);padding-top:18px;
font-size:13.5px;color:var(--dim)}
.notes h2{border:0;font-size:13px;text-transform:uppercase;letter-spacing:.07em;
margin:0 0 10px}
.notes li{margin-bottom:4px}
.backlinks{margin-top:26px;padding:14px 16px;background:var(--card);
border:1px solid var(--line);border-radius:8px;font-size:13.5px}
.backlinks h2{border:0;margin:0 0 7px;font-size:11px;text-transform:uppercase;
letter-spacing:.07em;color:var(--dim)}
.backlinks a{margin-right:12px;white-space:nowrap}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:14px;
margin:16px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:14px 16px}
.card a{font-weight:620;text-decoration:none;font-size:15px}
.card p{margin:6px 0 0;font-size:13px;color:var(--dim);line-height:1.5}
.stats{display:flex;flex-wrap:wrap;gap:26px;margin:22px 0;padding:16px 18px;
background:var(--card);border:1px solid var(--line);border-radius:9px}
.stat b{display:block;font-size:23px;font-weight:660;line-height:1.2}
.stat span{font-size:11.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em}
footer{border-top:1px solid var(--line);margin-top:50px;padding:20px 0 40px;
font-size:12.5px;color:var(--dim)}
@media(max-width:820px){.wrap{grid-template-columns:1fr;gap:0}
nav{position:static;max-height:none;border-bottom:1px solid var(--line);
padding-bottom:14px;margin-bottom:22px}}
"""

MERMAID = """
<script type="module">
// The diagram is progressive enhancement: pre.mermaid is display:none until the
// library actually loads. If the CDN is unreachable the import throws, the raw
// graph source stays hidden, and the text table below is the content.
const pres = [...document.querySelectorAll('pre.mermaid')];
try {
  const url = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  const m = (await import(url)).default;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  m.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral' });
  pres.forEach(p => { p.style.display = 'block'; });   // reveal before measuring
  await m.run({ nodes: pres });
  document.querySelectorAll('.if-no-diagram').forEach(e => e.remove());
} catch (e) {
  pres.forEach(p => p.remove());
  document.querySelectorAll('.if-diagram').forEach(e => e.remove());
}
</script>
"""


def nav_html(pages: dict, here: str) -> str:
    groups: dict[str, list] = defaultdict(list)
    for slug, pg in sorted(pages.items()):
        if slug in ("index", "log"):
            continue
        groups[str(pg.meta.get("type", "other"))].append((slug, pg))
    parts = [f'<nav><h4>Start</h4>'
             f'<a href="{rel(here, "synthesis")}"'
             f'{" class=here" if here == "synthesis" else ""}>Synthesis</a>'
             f'<a href="{rel(here, "log")}"'
             f'{" class=here" if here == "log" else ""}>Log</a>'
             f'<a href="{rel(here, "graph")}"'
             f'{" class=here" if here == "graph" else ""}>Link graph</a>']
    for ptype in ("concept", "entity", "comparison", "question", "overview"):
        items = [x for x in groups.get(ptype, []) if x[0] != "synthesis"]
        if not items:
            continue
        parts.append(f"<h4>{PLURAL.get(ptype, ptype + 's')}</h4>")
        for slug, pg in items:
            cls = " class=here" if slug == here else ""
            parts.append(f'<a href="{rel(here, slug)}"{cls}>'
                         f'{html.escape(str(pg.meta.get("title", slug)))}</a>')
    parts.append("</nav>")
    return "".join(parts)


def shell(title: str, slug: str, pages: dict, body: str, repo_url: str,
          mermaid: bool = False) -> str:
    depth = slug.count("/")
    up = "../" * depth
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)} · LLM wiki</title>
<style>{CSS}</style></head><body>
<header><div class="wrap">
<a class="home" href="{up}index.html">knowledge-base</a>
<div class="tag">an LLM wiki — knowledge compiled once, kept current</div>
</div></header>
<div class="wrap">{nav_html(pages, slug)}<main>{body}</main></div>
<footer><div class="wrap" style="display:block">
Compiled from <code>raw/</code> by an LLM; consistency checked by
<code>tools/wiki.py lint</code>. The linter checks that links resolve and citations
exist — <strong>not</strong> that any page is true.
· <a href="{repo_url}">source on GitHub</a>
</div></footer>
{MERMAID if mermaid else ""}
</body></html>"""


def page_html(slug: str, pg, pages: dict, backlinks: dict, repo_url: str,
              sources: dict) -> str:
    body, notes = render(pg.body, slug, pages, repo_url)
    status = str(pg.meta.get("status", ""))
    title = str(pg.meta.get("title", slug))

    meta = [f'<span class="badge b-{status}" title="{STATUS_BLURB.get(status,"")}">'
            f'{status}</span>',
            f'<span>{pg.meta.get("type","")}</span>',
            f'<span>compiled {pg.meta.get("updated","?")}</span>']
    declared = pg.meta.get("sources") or []
    if isinstance(declared, str):
        declared = [declared]
    if declared:
        meta.append(f'<span>{len(declared)} source'
                    f'{"s" if len(declared) != 1 else ""}</span>')
    head = f"<h1>{html.escape(title)}</h1><div class='meta'>{''.join(meta)}</div>"

    # strip the leading duplicate <h1> the markdown body carries
    body = re.sub(r"^\s*<h1[^>]*>.*?</h1>", "", body, count=1, flags=re.S)

    extra = ""
    if notes:
        items = []
        for cid, target in notes.items():
            if cid == "synthesis":
                link = "the compiler's own synthesis, not a source"
            else:
                src = sources.get(cid)
                href = f"{repo_url}/blob/main/{target}"
                label = html.escape(str(src.meta.get("title", target))) if src else target
                link = f'<a href="{href}">{label}</a>'
            items.append(f'<li id="fn-{cid}"><code>{html.escape(cid)}</code> — {link} '
                         f'<a href="#ref-{cid}" class="cite">↩</a></li>')
        extra += ("<div class='notes'><h2>Sources cited</h2><ul>"
                  + "".join(items) + "</ul></div>")

    back = sorted(backlinks.get(slug, []))
    if back:
        links = " ".join(
            f'<a href="{rel(slug, b)}">{html.escape(str(pages[b].meta.get("title", b)))}</a>'
            for b in back)
        extra += f"<div class='backlinks'><h2>Linked from</h2>{links}</div>"
    elif slug not in ("index", "log", "synthesis"):
        extra += ("<div class='backlinks'><h2>Linked from</h2>"
                  "<em>Nothing links here — this page is an orphan.</em></div>")

    return shell(title, slug, pages, head + body + extra, repo_url)


def home_html(pages: dict, sources: dict, repo_url: str) -> str:
    groups: dict[str, list] = defaultdict(list)
    for slug, pg in sorted(pages.items()):
        if slug in ("index", "log", "synthesis"):
            continue
        groups[str(pg.meta.get("type", "other"))].append((slug, pg))

    words = sum(len(wiki.strip_code(p.body).split()) for p in pages.values())
    links = sum(len(p.links) for p in pages.values())
    cites = sum(len(p.cites) for p in pages.values())

    body = ["<h1>knowledge-base</h1>",
            "<p>A working prototype of the <strong>LLM wiki</strong> pattern: knowledge "
            "compiled once from raw sources and kept current, rather than re-derived "
            "from documents on every question. Its subject is the pattern itself — "
            "compiled from the original gist and three responses, two of which disagree "
            "with it and with each other.</p>",
            "<pre>raw/    source files, immutable      humans curate\n"
            "wiki/   build output, interlinked     the agent owns\n"
            "lint    the test suite               tools/wiki.py, deterministic</pre>",
            f"<div class='stats'>"
            f"<div class='stat'><b>{len(pages)}</b><span>pages</span></div>"
            f"<div class='stat'><b>{len(sources)}</b><span>sources</span></div>"
            f"<div class='stat'><b>{links}</b><span>links</span></div>"
            f"<div class='stat'><b>{cites}</b><span>citations</span></div>"
            f"<div class='stat'><b>{words:,}</b><span>words</span></div></div>",
            "<p>Start with <a href='synthesis.html'><strong>the synthesis</strong></a> — "
            "what this wiki currently believes — or browse "
            "<a href='graph.html'>the link graph</a>. Every page carries a status: "
            "<span class='badge b-established'>established</span> "
            "<span class='badge b-contested'>contested</span> "
            "<span class='badge b-provisional'>provisional</span>. A page marked "
            "contested <em>must</em> name who claims what, or the build fails.</p>"]

    for ptype in ("concept", "entity", "comparison", "question", "overview"):
        items = groups.get(ptype)
        if not items:
            continue
        body.append(f"<h2>{PLURAL.get(ptype, ptype + 's').capitalize()}</h2><div class='cards'>")
        for slug, pg in items:
            status = str(pg.meta.get("status", ""))
            first = next((ln for ln in wiki.strip_code(pg.body).splitlines()
                          if ln.strip() and not ln.startswith(("#", ">", "*", "-", "|"))),
                         "")
            first = re.sub(r"\[\^[^\]]+\]", "", first)
            first = re.sub(r"\[\[([^\]|]+?)(\|[^\]]*)?\]\]", r"\1", first)
            first = re.sub(r"[*`]", "", first)
            body.append(
                f"<div class='card'><a href='{slug}.html'>"
                f"{html.escape(str(pg.meta.get('title', slug)))}</a> "
                f"<span class='badge b-{status}'>{status}</span>"
                f"<p>{html.escape(first[:135])}…</p></div>")
        body.append("</div>")

    body.append("<h2>Sources</h2><div class='tw'><table><thead><tr><th>id</th>"
                "<th>title</th><th>added</th><th>capture</th></tr></thead><tbody>")
    for sid, src in sorted(sources.items()):
        url = str(src.meta.get("url", ""))
        title = html.escape(str(src.meta.get("title", sid)))
        cap = str(src.meta.get("capture", "?"))
        warn = (" <span class='badge b-contested'>summary</span>"
                if cap == "summary" else "")
        body.append(f"<tr><td><code>{sid}</code></td>"
                    f"<td><a href='{url}'>{title}</a></td>"
                    f"<td>{src.meta.get('added','?')}</td><td>{cap}{warn}</td></tr>")
    body.append("</tbody></table></div>"
                "<p><em>Sources marked <strong>summary</strong> are fetched summaries, "
                "not verbatim originals — quoted wording passed through a summarisation "
                "step. Re-capture as <code>verbatim</code> before relying on exact "
                "quotes.</em></p>")

    return shell("Home", "index", pages, "".join(body), repo_url)


def graph_html(pages: dict, repo_url: str) -> str:
    lines = ["graph LR"]
    for slug, pg in sorted(pages.items()):
        if pg.is_infra:
            continue
        node = slug.replace("/", "_").replace("-", "_")
        lines.append(f'  {node}["{pg.meta.get("title", slug)}"]')
        lines.append(f'  click {node} "{rel("graph", slug)}"')
    for slug, pg in sorted(pages.items()):
        if pg.is_infra:
            continue
        a = slug.replace("/", "_").replace("-", "_")
        for link in sorted(set(pg.links)):
            if link in pages and link not in wiki.INFRA:
                lines.append(f'  {a} --> {link.replace("/", "_").replace("-", "_")}')
    # Text fallback: the diagram needs a CDN, this does not.
    rows = []
    for slug, pg in sorted(pages.items()):
        if pg.is_infra:
            continue
        outs = sorted({l for l in pg.links if l in pages and l not in wiki.INFRA})
        ins = sorted({s for s, o in pages.items()
                      if not o.is_infra and slug in o.links})
        title = html.escape(str(pg.meta.get("title", slug)))
        rows.append(
            f'<tr><td><a href="{rel("graph", slug)}">{title}</a></td>'
            f'<td>{len(ins)}</td><td>{len(outs)}</td><td>' +
            ", ".join(f'<a href="{rel("graph", o)}">'
                      f'{html.escape(str(pages[o].meta.get("title", o)))}</a>'
                      for o in outs) + "</td></tr>")

    body = ("<h1>Link graph</h1><p>Every edge is a <code>[[wikilink]]</code> the linter "
            "resolved. Orphans — pages with no inbound edge — are a lint warning: "
            "knowledge that cannot be reached is not knowledge."
            "<span class='if-diagram'> Click a node to open the page.</span></p>"
            f'<pre class="mermaid">{chr(10).join(lines)}</pre>'
            "<h2>Edges, as text</h2>"
            "<p class='if-no-diagram'>The diagram needs a CDN that is not reachable "
            "right now, so here is the same graph as a table.</p>"
            "<div class='tw'><table><thead><tr><th>page</th><th>in</th><th>out</th>"
            "<th>links to</th></tr></thead><tbody>" + "".join(rows) +
            "</tbody></table></div>")
    return shell("Link graph", "graph", pages, body, repo_url, mermaid=True)


# --------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="site")
    ap.add_argument("--base-url", default=None,
                    help="repo URL for source links (default: from git remote)")
    args = ap.parse_args()

    repo_url = args.base_url
    if not repo_url:
        try:
            remote = subprocess.run(["git", "remote", "get-url", "origin"],
                                    capture_output=True, text=True, cwd=wiki.ROOT,
                                    check=True).stdout.strip()
            repo_url = re.sub(r"\.git$", "", remote.replace("git@github.com:",
                                                            "https://github.com/"))
        except Exception:
            repo_url = "https://github.com"

    pages, sources = wiki.load()
    if not pages:
        print("No pages found in wiki/", file=sys.stderr)
        return 1

    report = wiki.lint(pages, sources)
    if report.errors:
        print(f"warning: wiki has {len(report.errors)} lint errors; "
              f"building anyway (broken links render in red)", file=sys.stderr)

    backlinks: dict[str, set] = defaultdict(set)
    for slug, pg in pages.items():
        for link in pg.links:
            if link in pages and link != slug:
                backlinks[link].add(slug)

    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    n = 0
    for slug, pg in pages.items():
        if slug == "index":
            continue  # replaced by the generated home page
        dest = out / f"{slug}.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page_html(slug, pg, pages, backlinks, repo_url, sources),
                        encoding="utf-8")
        n += 1

    (out / "index.html").write_text(home_html(pages, sources, repo_url),
                                    encoding="utf-8")
    (out / "graph.html").write_text(graph_html(pages, repo_url), encoding="utf-8")
    (out / ".nojekyll").write_text("", encoding="utf-8")

    print(f"Built {n + 2} pages into {out}/ "
          f"({dt.date.today().isoformat()}, links resolved against {repo_url})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
