// wiki.js — the compiled-wiki model, in the browser.
//
// A port of tools/wiki.py: same frontmatter subset, same markdown subset, same
// invariants. It has to live here because the app compiles NEW pages client-side
// during ingest, and those pages must be rendered and linted before they exist
// on disk.

export const PAGE_TYPES = ['concept', 'entity', 'comparison', 'question', 'overview'];
export const STATUSES = ['established', 'contested', 'provisional', 'superseded'];
export const REQUIRED = ['title', 'type', 'status', 'updated', 'sources'];
const INFRA = new Set(['index', 'log', 'synthesis']);
const SPECIAL_CITES = new Set(['synthesis']);

// ---------------------------------------------------------------- frontmatter

export function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { meta: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: text };
  const block = text.slice(3, end).replace(/^\n+|\n+$/g, '');
  const body = text.slice(end + 4).replace(/^\n+/, '');

  const meta = {};
  let key = null;
  for (const line of block.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^[ \t]/.test(line) && line.trimStart().startsWith('- ') && key) {
      if (!Array.isArray(meta[key])) meta[key] = [];
      meta[key].push(line.trimStart().slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const i = line.indexOf(':');
    if (i === -1) continue;
    key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val.slice(1, -1).split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, '');
      meta[key] = val || [];
    }
  }
  return { meta, body };
}

export function serialize(page) {
  const m = page.meta;
  const srcs = (m.sources || []).map(s => `  - ${s}`).join('\n');
  return `---\ntitle: ${m.title}\ntype: ${m.type}\nstatus: ${m.status}\n` +
    `updated: ${m.updated}\nsources:${srcs ? '\n' + srcs : ' []'}\n---\n\n` +
    page.body.replace(/^\n+/, '');
}

export function stripCode(body) {
  const out = [];
  let fenced = false;
  for (const line of body.split('\n')) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    if (!fenced) out.push(line);
  }
  return out.join('\n');
}

export const LINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g;
export const CITE_RE = /\[\^([A-Za-z0-9._-]+)\]/g;
const FOOTDEF_RE = /^\[\^([A-Za-z0-9._-]+)\]:\s*(.*)$/;

export function linksOf(body) {
  return [...stripCode(body).matchAll(LINK_RE)].map(m => m[1].trim().replace(/^\//, ''));
}

export function citesOf(body) {
  const out = [];
  for (const line of stripCode(body).split('\n')) {
    if (FOOTDEF_RE.test(line.trim())) continue;
    for (const m of line.matchAll(CITE_RE)) out.push(m[1]);
  }
  return out;
}

export function asDate(v) {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], (+m[2] || 1) - 1, +m[3] || 1));
}

// ----------------------------------------------------------------------- lint
// Same invariants as tools/wiki.py lint. Consistency only — never truth.

export function lint(pages, sources) {
  const errors = [], warnings = [];
  const bySlug = new Map(pages.map(p => [p.slug, p]));
  const bySid = new Map(sources.map(s => [s.id, s]));
  const inbound = new Map();
  const err = (w, m) => errors.push(`${w}: ${m}`);
  const warn = (w, m) => warnings.push(`${w}: ${m}`);

  for (const pg of pages) {
    const where = pg.file || `wiki/${pg.slug}.md`;
    const meta = pg.meta || {};
    const isInfra = INFRA.has(pg.slug);

    for (const f of REQUIRED) {
      const v = meta[f];
      if (v === undefined || v === '') err(where, `frontmatter missing '${f}'`);
    }
    if (meta.type && !PAGE_TYPES.includes(meta.type))
      err(where, `type '${meta.type}' not in ${PAGE_TYPES.join(', ')}`);
    if (meta.status && !STATUSES.includes(meta.status))
      err(where, `status '${meta.status}' not in ${STATUSES.join(', ')}`);
    if (meta.updated && !asDate(meta.updated))
      err(where, `updated '${meta.updated}' is not a date`);

    const declared = Array.isArray(meta.sources) ? meta.sources
      : (meta.sources ? [meta.sources] : []);
    const links = linksOf(pg.body);
    const cites = citesOf(pg.body);

    for (const l of links) {
      if (!bySlug.has(l)) err(where, `broken link [[${l}]]`);
      else {
        if (!inbound.has(l)) inbound.set(l, new Set());
        inbound.get(l).add(pg.slug);
      }
    }

    for (const c of new Set(cites)) {
      if (SPECIAL_CITES.has(c)) continue;
      if (!bySid.has(c)) err(where, `citation [^${c}] has no source in raw/`);
      else if (!declared.includes(c))
        err(where, `cites [^${c}] but omits it from frontmatter sources`);
    }
    for (const s of declared) {
      if (!bySid.has(s)) err(where, `frontmatter lists unknown source '${s}'`);
      else if (!cites.includes(s) && !isInfra)
        warn(where, `declares source '${s}' but never cites it`);
    }

    const clean = stripCode(pg.body);
    if (meta.status === 'contested' && !/^##+\s*Contradictions/im.test(clean))
      err(where, "status 'contested' requires a '## Contradictions' section");
    if (meta.status === 'superseded' && links.length === 0)
      err(where, "status 'superseded' must link forward to its replacement");

    const pdate = asDate(meta.updated);
    if (pdate) {
      for (const s of declared) {
        const src = bySid.get(s);
        const sdate = src ? asDate(src.added) : null;
        if (sdate && sdate > pdate)
          err(where, `stale: source '${s}' added ${src.added} but page compiled ` +
            `${meta.updated} — recompile`);
      }
    }

    if (!isInfra) {
      for (const para of clean.split(/\n\s*\n/)) {
        const p = para.trim();
        if (!p || /^[#>|\-*[]/.test(p) || /^\d+\./.test(p)) continue;
        if (p.split(/\s+/).length < 25) continue;
        if (!/\[\^[A-Za-z0-9._-]+\]/.test(p))
          warn(where, `uncited assertion: "${p.replace(/\s+/g, ' ').slice(0, 60)}…"`);
      }
    }
  }

  for (const pg of pages) {
    if (INFRA.has(pg.slug)) continue;
    const where = pg.file || `wiki/${pg.slug}.md`;
    const ins = inbound.get(pg.slug);
    const outs = linksOf(pg.body).length;
    if (!ins || ins.size === 0) warn(where, 'orphan — no page links here');
    else if (outs < 3) warn(where, `only ${outs} outbound links (aim for 3+)`);
  }

  const cited = new Set(pages.flatMap(p => citesOf(p.body)));
  for (const s of sources) {
    if (!cited.has(s.id))
      err(s.file || `raw/${s.id}.md`,
        `source '${s.id}' is in raw/ but no wiki page cites it — not ingested`);
  }

  return { errors, warnings, inbound };
}

export function staleness(pages, sources) {
  const bySid = new Map(sources.map(s => [s.id, s]));
  const stale = [], uningested = [];
  const cited = new Set(pages.flatMap(p => citesOf(p.body)));
  for (const pg of pages) {
    const pdate = asDate(pg.meta?.updated);
    const declared = Array.isArray(pg.meta?.sources) ? pg.meta.sources : [];
    for (const s of declared) {
      const src = bySid.get(s);
      const sdate = src ? asDate(src.added) : null;
      if (pdate && sdate && sdate > pdate)
        stale.push({ slug: pg.slug, source: s, page: pg.meta.updated, added: src.added });
    }
  }
  for (const s of sources) if (!cited.has(s.id)) uningested.push(s.id);
  return { stale, uningested };
}

// ------------------------------------------------------------------- markdown

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Private-use sentinels: safe to round-trip through the inline formatters
// without colliding with real page text.
const OPEN = '\uE000', CLOSE = '\uE001';

function inline(text, ctx) {
  let out = esc(text);
  const stash = [];
  out = out.replace(/`([^`]+)`/g, (_, c) => {
    stash.push(`<code>${c}</code>`);
    return OPEN + (stash.length - 1) + CLOSE;
  });

  out = out.replace(LINK_RE, (_, target, label) => {
    const t = target.trim().replace(/^\//, '');
    const pg = ctx.pages?.get(t);
    if (pg) {
      const text2 = (label || '').trim() || pg.meta.title || t;
      return `<a href="#/page/${encodeURIComponent(t)}" class="s-${pg.meta.status}">` +
        `${esc(text2)}</a>`;
    }
    return `<span class="broken" title="broken link — this is a lint error">` +
      `[[${esc(t)}]]</span>`;
  });

  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_, l, h) => `<a href="${h}" target="_blank" rel="noopener">${l}</a>`);

  out = out.replace(CITE_RE, (_, id) =>
    `<a href="#/source/${encodeURIComponent(id)}" class="cite"><sup>${esc(id)}</sup></a>`);

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  out = out.replace(new RegExp(OPEN + '(\\d+)' + CLOSE, 'g'), (_, i) => stash[+i]);
  return out;
}

export function renderMarkdown(body, ctx = {}) {
  const lines = body.split('\n');
  const out = [];
  const notes = {};
  let i = 0, para = [], listKind = null;

  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '), ctx)}</p>`); para = []; }
  };
  const closeList = () => { if (listKind) { out.push(`</${listKind}>`); listKind = null; } };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      flush(); closeList();
      i++;
      const buf = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const fd = line.trim().match(FOOTDEF_RE);
    if (fd) { flush(); closeList(); notes[fd[1]] = fd[2]; i++; continue; }

    if (line.trim().startsWith('|') && i + 1 < lines.length &&
        /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flush(); closeList();
      const head = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
        i++;
      }
      out.push('<div class="tw"><table><thead><tr>' +
        head.map(c => `<th>${inline(c, ctx)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${inline(c, ctx)}</td>`).join('') +
          '</tr>').join('') + '</tbody></table></div>');
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush(); closeList();
      out.push(`<h${h[1].length}>${inline(h[2], ctx)}</h${h[1].length}>`);
      i++; continue;
    }

    if (line.trim().startsWith('>')) {
      flush(); closeList();
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, '')); i++;
      }
      out.push(`<blockquote><p>${inline(buf.join(' '), ctx)}</p></blockquote>`);
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if ((ul || ol) && line.trim()) {
      const kind = ul ? 'ul' : 'ol';
      flush();
      if (listKind !== kind) { closeList(); out.push(`<${kind}>`); listKind = kind; }
      const item = [(ul || ol)[1]];
      i++;
      while (i < lines.length && lines[i].trim() && /^[ \t]/.test(lines[i]) &&
             !/^\s*[-*]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) &&
             !/^#{1,6}\s/.test(lines[i])) {
        item.push(lines[i].trim()); i++;
      }
      out.push(`<li>${inline(item.join(' '), ctx)}</li>`);
      continue;
    }

    if (!line.trim()) { flush(); closeList(); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flush(); closeList();
  return { html: out.join('\n'), notes };
}

// --------------------------------------------------------------------- search

export function search(pages, q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits = [];
  for (const pg of pages) {
    const title = (pg.meta.title || pg.slug).toLowerCase();
    const body = pg.body.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 10;
      score += Math.min(body.split(t).length - 1, 8);
    }
    if (score > 0) {
      const idx = body.indexOf(terms[0]);
      const snippet = idx >= 0
        ? pg.body.slice(Math.max(0, idx - 70), idx + 130).replace(/\s+/g, ' ')
        : pg.body.slice(0, 180).replace(/\s+/g, ' ');
      hits.push({ page: pg, score, snippet });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}
