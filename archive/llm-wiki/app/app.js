// app.js — a deliverables library, built as an LLM wiki, in the browser.
//
// Browse / Ask / Add / Lint over a compiled wiki of the firm's deliverables. The
// seed corpus ships as
// data/wiki.json (built by tools/build_app.py); anything you compile in the
// browser is layered on top in localStorage and exported as .md files you can
// commit back to the repo. A static page cannot write to your git history, so
// the loop ends with an export rather than pretending otherwise.

import * as W from './lib/wiki.js';
import * as P from './lib/provider.js';
import { DEMO_SOURCE, demoIngestReply, demoAnswer } from './lib/demo.js';

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== false) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid);
  return n;
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- state

const OVERLAY_KEY = 'llmwiki.overlay';
const State = {
  seed: null,          // as shipped
  pages: [],           // seed + overlay
  sources: [],
  overlay: { pages: {}, sources: {}, log: [] },

  load(seed) {
    this.seed = seed;
    try { this.overlay = JSON.parse(localStorage.getItem(OVERLAY_KEY)) || this.overlay; }
    catch { /* corrupt or unavailable storage: fall back to the seed */ }
    this.rebuild();
  },
  rebuild() {
    const byS = new Map(this.seed.pages.map(p => [p.slug, structuredClone(p)]));
    for (const [slug, pg] of Object.entries(this.overlay.pages || {})) byS.set(slug, pg);
    this.pages = [...byS.values()].sort((a, b) => a.slug.localeCompare(b.slug));
    const bySrc = new Map(this.seed.sources.map(s => [s.id, structuredClone(s)]));
    for (const [id, s] of Object.entries(this.overlay.sources || {})) bySrc.set(id, s);
    this.sources = [...bySrc.values()].sort((a, b) => a.id.localeCompare(b.id));
  },
  save() {
    try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(this.overlay)); }
    catch (e) { console.warn('Could not persist changes:', e); }
    this.rebuild();
    renderDirty();
  },
  applyEdits(edits, source) {
    if (source) this.overlay.sources[source.id] = { ...source, file: `raw/${source.added}-${source.id}.md` };
    for (const e of edits) {
      this.overlay.pages[e.slug] = {
        slug: e.slug,
        file: `wiki/${e.slug}.md`,
        meta: {
          title: e.title, type: e.type, status: e.status,
          updated: e.updated || today(), sources: e.sources || [],
        },
        body: e.body,
      };
    }
    this.save();
  },
  reset() {
    this.overlay = { pages: {}, sources: {}, log: [] };
    try { localStorage.removeItem(OVERLAY_KEY); } catch {}
    this.rebuild();
    renderDirty();
  },
  get dirty() {
    return Object.keys(this.overlay.pages).length + Object.keys(this.overlay.sources).length;
  },
  pageMap() { return new Map(this.pages.map(p => [p.slug, p])); },
};

function renderDirty() {
  const n = State.dirty;
  const bar = $('#dirty-bar');
  bar.hidden = n === 0;
  if (n) {
    const p = Object.keys(State.overlay.pages).length;
    const s = Object.keys(State.overlay.sources).length;
    $('#dirty-text').textContent =
      `${p} page${p === 1 ? '' : 's'}${s ? ` and ${s} source${s === 1 ? '' : 's'}` : ''} ` +
      `changed in this browser only — not yet in the repo.`;
  }
}

// ---------------------------------------------------------------- export

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportChanges() {
  const files = [];
  for (const pg of Object.values(State.overlay.pages))
    files.push([`${pg.slug.replace(/\//g, '__')}.md`, W.serialize(pg)]);
  for (const s of Object.values(State.overlay.sources)) {
    const fm = `---\nsource_id: ${s.id}\ntitle: "${s.title}"\nauthor: ${s.author || ''}\n` +
      `client: ${s.client || ''}\ndeliverable: ${s.deliverable || ''}\n` +
      `period: ${s.period || ''}\nurl: ${s.url || ''}\npublished: ${s.published || ''}\n` +
      `added: ${s.added}\nkind: ${s.kind || 'deliverable'}\n` +
      `capture: ${s.capture || 'verbatim'}\n---\n\n${s.body}\n`;
    files.push([`RAW__${s.added}-${s.id}.md`, fm]);
  }
  if (State.overlay.log.length) {
    files.push(['LOG__append-to-wiki-log.md',
      State.overlay.log.map(l => `**${l.date} · ${l.op}** — ${l.text}\n`).join('\n')]);
  }
  if (!files.length) return;
  files.forEach(([n, t], i) => setTimeout(() => download(n, t), i * 220));
}

// ------------------------------------------------------------------ views

const VIEWS = {};

function nav(here) {
  const groups = {};
  for (const pg of State.pages) {
    if (['index', 'log'].includes(pg.slug)) continue;
    (groups[pg.meta.type] ||= []).push(pg);
  }
  const link = pg => el('a', {
    href: `#/page/${encodeURIComponent(pg.slug)}`,
    class: pg.slug === here ? 'here' : '',
  }, pg.meta.title || pg.slug);

  const side = el('nav', { class: 'side' },
    el('input', {
      class: 'searchbox', type: 'text', placeholder: 'Search pages and deliverables…',
      value: Router.q || '',
      oninput: e => {
        const v = e.target.value;
        clearTimeout(side._t);
        side._t = setTimeout(() => {
          Router.q = v;
          location.hash = v ? `#/search/${encodeURIComponent(v)}` : '#/';
        }, 220);
      },
    }));

  for (const t of W.PAGE_TYPES) {
    const items = (groups[t] || []).filter(p => p.slug !== 'synthesis');
    if (t === 'overview' && groups.overview?.some(p => p.slug === 'synthesis')) {
      side.append(el('h4', {}, 'start'),
        link(State.pageMap().get('synthesis')));
    }
    if (!items.length) continue;
    side.append(el('h4', {}, W.TYPE_LABEL[t] || t));
    items.forEach(p => side.append(link(p)));
  }
  return side;
}

function pageBody(pg) {
  const { html, notes } = W.renderMarkdown(pg.body, { pages: State.pageMap() });
  const wrap = el('div', {});
  wrap.append(el('h1', {}, pg.meta.title || pg.slug));
  wrap.append(el('div', { class: 'meta' },
    el('span', { class: `badge b-${pg.meta.status}` }, pg.meta.status),
    el('span', {}, pg.meta.type),
    el('span', {}, `compiled ${pg.meta.updated}`),
    el('span', {}, `${(pg.meta.sources || []).length} sources`)));

  const bodyHtml = html.replace(/^\s*<h1>[\s\S]*?<\/h1>/, '');
  wrap.append(el('div', { html: bodyHtml }));

  if (Object.keys(notes).length) {
    const ul = el('ul', {});
    for (const [id, target] of Object.entries(notes)) {
      const src = State.sources.find(s => s.id === id);
      ul.append(el('li', {
        html: id === 'synthesis'
          ? `<code>synthesis</code> — the compiler's own reasoning, not a source`
          : `<code>${esc(id)}</code> — <a href="#/source/${encodeURIComponent(id)}">` +
            `${esc(src ? src.title : target)}</a>` +
            (src && src.client ? ` <span class="muted">· ${esc(src.client)}</span>` : ''),
      }));
    }
    wrap.append(el('div', { class: 'notes' }, el('h2', {}, 'Deliverables cited'), ul));
  }

  const { inbound } = W.lint(State.pages, State.sources);
  const back = [...(inbound.get(pg.slug) || [])].sort();
  const bl = el('div', { class: 'backlinks' }, el('h2', {}, 'Linked from'));
  if (back.length) {
    back.forEach(s => bl.append(el('a', { href: `#/page/${encodeURIComponent(s)}` },
      State.pageMap().get(s)?.meta.title || s)));
  } else {
    bl.append(el('em', {}, 'Nothing links here — this page is an orphan.'));
  }
  wrap.append(bl);
  return wrap;
}

VIEWS.home = () => {
  const v = el('div', { class: 'cols' }, nav(''));
  const main = el('div', {});
  const words = State.pages.reduce((a, p) => a + W.stripCode(p.body).split(/\s+/).length, 0);
  const links = State.pages.reduce((a, p) => a + W.linksOf(p.body).length, 0);
  const cites = State.pages.reduce((a, p) => a + W.citesOf(p.body).length, 0);

  main.append(
    el('h1', {}, 'The deliverables library'),
    el('p', {
      html: 'Everything the firm has produced for its clients — credit card analyses, ' +
        'cash flow projections, philanthropic summaries, reviews — <b>compiled once</b> ' +
        'into client, service and topic pages and kept current, rather than re-read from ' +
        'the documents on every question. Ask it something in plain language, or add a ' +
        'new deliverable and watch which pages change. ' +
        '<span class="muted">All clients and figures are synthetic.</span>',
    }),
    el('div', { class: 'stats' },
      el('div', { class: 'stat' }, el('b', {}, String(State.pages.length)), el('span', {}, 'pages')),
      el('div', { class: 'stat' }, el('b', {}, String(State.sources.length)), el('span', {}, 'deliverables')),
      el('div', { class: 'stat' }, el('b', {}, String(links)), el('span', {}, 'links')),
      el('div', { class: 'stat' }, el('b', {}, String(cites)), el('span', {}, 'citations')),
      el('div', { class: 'stat' }, el('b', {}, words.toLocaleString()), el('span', {}, 'words'))),
    el('div', { class: 'row' },
      el('a', { class: 'btn', href: '#/ask' }, 'Ask the library'),
      el('a', { class: 'btn ghost', href: '#/ingest' }, 'Add a deliverable'),
      el('a', { class: 'btn ghost', href: '#/page/synthesis' }, 'What the library knows')));

  const groups = {};
  for (const pg of State.pages) {
    if (['index', 'log', 'synthesis'].includes(pg.slug)) continue;
    (groups[pg.meta.type] ||= []).push(pg);
  }
  const ordered = [...W.PAGE_TYPES, ...Object.keys(groups).filter(t => !W.PAGE_TYPES.includes(t))];
  for (const t of ordered) {
    const items = groups[t];
    if (!items?.length) continue;
    main.append(el('h2', {}, W.TYPE_LABEL[t] || t));
    const cards = el('div', { class: 'cards' });
    for (const pg of items) {
      const first = W.stripCode(pg.body).split('\n')
        .find(l => l.trim() && !/^[#>*\-|]/.test(l.trim())) || '';
      cards.append(el('div', { class: 'card' },
        el('a', { href: `#/page/${encodeURIComponent(pg.slug)}` }, pg.meta.title),
        ' ', el('span', { class: `badge b-${pg.meta.status}` }, pg.meta.status),
        el('p', { class: 'muted' },
          first.replace(/\[\^[^\]]+\]/g, '').replace(/\[\[([^\]|]+)\]\]/g, '$1')
            .replace(/[*`]/g, '').slice(0, 130) + '…')));
    }
    main.append(cards);
  }
  v.append(main);
  return v;
};

VIEWS.page = slug => {
  const pg = State.pageMap().get(slug);
  if (!pg) return el('div', {}, el('h1', {}, 'Not found'),
    el('p', {}, `No page ${slug}. `, el('a', { href: '#/' }, 'Back to the index')));
  return el('div', { class: 'cols' }, nav(slug), pageBody(pg));
};

function sourceCard(s, extra) {
  const cited = State.pages.filter(p => W.citesOf(p.body).includes(s.id)).length;
  return el('div', { class: 'card' },
    el('a', { href: `#/source/${encodeURIComponent(s.id)}` }, s.title), ' ',
    s.deliverable ? el('span', { class: 'badge b-established' }, s.deliverable) : null,
    s.period ? el('span', { class: 'badge' }, s.period) : null,
    el('p', { class: 'muted' },
      `${s.client ? s.client + ' · ' : ''}${s.author || 'unknown'} · ${s.published || 'n.d.'} · ` +
      `cited by ${cited} page${cited === 1 ? '' : 's'}${extra ? ' · ' + extra : ''}`));
}

VIEWS.search = q => {
  const hits = W.search(State.pages, q);
  const docs = W.searchSources(State.sources, q);
  const main = el('div', {}, el('h1', {}, 'Search'),
    el('p', { class: 'muted' },
      `${hits.length} page${hits.length === 1 ? '' : 's'} and ${docs.length} deliverable` +
      `${docs.length === 1 ? '' : 's'} matching “${q}”. This is keyword search — use Ask ` +
      `for a synthesised answer with citations.`));
  if (docs.length) main.append(el('h2', {}, 'Deliverables'));
  for (const d of docs) main.append(sourceCard(d.source));
  if (hits.length) main.append(el('h2', {}, 'Compiled pages'));
  for (const h of hits) {
    main.append(el('div', { class: 'card' },
      el('a', { href: `#/page/${encodeURIComponent(h.page.slug)}` }, h.page.meta.title),
      ' ', el('span', { class: `badge b-${h.page.meta.status}` }, h.page.meta.status),
      el('p', { class: 'muted' }, '…' + h.snippet.replace(/\[\^[^\]]+\]/g, '') + '…')));
  }
  if (!hits.length && !docs.length) main.append(el('p', {}, 'Nothing matched.'));
  return el('div', { class: 'cols' }, nav(''), main);
};

VIEWS.source = id => {
  const s = State.sources.find(x => x.id === id);
  if (!s) return el('div', {}, el('h1', {}, 'Unknown deliverable'), el('a', { href: '#/sources' }, 'All deliverables'));
  const citedBy = State.pages.filter(p => W.citesOf(p.body).includes(id));
  const main = el('div', {},
    el('h1', {}, s.title),
    el('div', { class: 'meta' },
      el('span', { class: 'mono' }, s.id),
      s.client ? el('span', {}, s.client) : null,
      s.deliverable ? el('span', { class: 'badge b-established' }, s.deliverable) : null,
      s.period ? el('span', {}, s.period) : null,
      el('span', {}, s.author || 'unknown author'),
      el('span', {}, `delivered ${s.published || 'n.d.'}`),
      el('span', {}, `added ${s.added}`),
      s.capture === 'summary'
        ? el('span', { class: 'badge b-contested', title: 'not a verbatim capture' }, 'summary')
        : s.capture === 'synthetic'
          ? el('span', { class: 'badge b-provisional', title: 'invented for the demo' }, 'synthetic')
          : el('span', { class: 'badge b-established' }, s.capture || 'capture')),
    s.capture === 'summary'
      ? el('p', { class: 'warn', html: '<b>Capture fidelity: summary.</b> This is a fetched summary, not the original text. Quoted wording passed through a summarisation step — re-capture as <code>verbatim</code> before relying on exact quotes.' })
      : s.capture === 'synthetic'
        ? el('p', { class: 'muted', html: '<b>Synthetic demo data.</b> This deliverable, its client and every figure in it were invented for this demonstration.' })
        : null,
    s.url ? el('p', {}, el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.url)) : null,
    el('h2', {}, 'Cited by'),
    citedBy.length
      ? el('div', {}, ...citedBy.map(p =>
          el('div', {}, el('a', { href: `#/page/${encodeURIComponent(p.slug)}` }, p.meta.title))))
      : el('p', { class: 'err' }, 'No page cites this deliverable — it is in raw/ but never ingested.'),
    el('h2', {}, 'Deliverable text'),
    el('pre', {}, el('code', {}, s.body)));
  return el('div', { class: 'cols' }, nav(''), main);
};

VIEWS.sources = () => {
  const main = el('div', {}, el('h1', {}, 'Deliverables'),
    el('p', { class: 'muted' },
      'The immutable layer: the documents the firm actually delivered. Humans add them; ' +
      'the compiler never edits them. Every citation on a compiled page points at one of these.'));
  const byClient = new Map();
  for (const s of State.sources) {
    const k = s.client || 'Unassigned';
    if (!byClient.has(k)) byClient.set(k, []);
    byClient.get(k).push(s);
  }
  for (const [client, items] of [...byClient.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    main.append(el('h2', {}, client));
    items.sort((a, b) => String(b.published).localeCompare(String(a.published)));
    for (const s of items) main.append(sourceCard(s));
  }
  return el('div', { class: 'cols' }, nav(''), main);
};

// ------------------------------------------------------------------- ask

VIEWS.ask = () => {
  const box = el('textarea', { rows: 3, placeholder: 'Ask in plain language — which clients, what did we find, what did we recommend…' });
  const out = el('div', { class: 'answer', html: '<span class="muted">The answer will appear here.</span>' });
  const used = el('div', { class: 'used' });
  const matches = el('div', {});

  function showMatches(q) {
    matches.replaceChildren();
    const docs = W.searchSources(State.sources, q).slice(0, 5);
    if (!docs.length) return;
    matches.append(el('h2', {}, 'Deliverables that match'),
      el('p', { class: 'muted' },
        'Keyword matches over the deliverables themselves — deterministic, no model. ' +
        'The answer below is compiled from the pages; these are the documents to open.'));
    for (const d of docs) matches.append(sourceCard(d.source, `${d.matched} term${d.matched === 1 ? '' : 's'} matched`));
  }
  const go = el('button', { class: 'btn' }, 'Ask');
  let controller = null;

  async function ask() {
    const q = box.value.trim();
    if (!q) return;
    go.disabled = true; go.textContent = 'Thinking…';
    out.className = 'answer streaming'; out.textContent = '';
    used.textContent = '';
    showMatches(q);
    controller = new AbortController();
    let acc = '';
    try {
      const { system, user } = P.queryPrompt(q, State.pages, State.sources);
      await P.run({
        system, user, maxTokens: 16000, signal: controller.signal,
        demo: demoAnswer(q),
        onText: t => {
          acc += t;
          out.innerHTML = W.renderMarkdown(acc.replace(/PAGES USED:.*$/s, ''),
            { pages: State.pageMap() }).html;
          out.scrollIntoView({ block: 'nearest' });
        },
      });
      const m = acc.match(/PAGES USED:\s*(.+)$/s);
      if (m) {
        const slugs = m[1].split(',').map(s => s.trim()).filter(s => s && s !== 'none');
        if (slugs.length) {
          used.append('Answered from: ');
          slugs.forEach(s => {
            const pg = State.pageMap().get(s);
            used.append(pg
              ? el('a', { href: `#/page/${encodeURIComponent(s)}` }, pg.meta.title)
              : el('span', { class: 'mono' }, s + ' '));
          });
        } else {
          used.append('The library could not answer — either no deliverable covers it, or one ' +
            'was ingested badly. Add the missing deliverable.');
        }
      }
    } catch (e) {
      out.className = 'answer';
      out.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    } finally {
      out.classList.remove('streaming');
      go.disabled = false; go.textContent = 'Ask';
    }
  }

  go.addEventListener('click', ask);
  box.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask();
  });

  const examples = el('div', { class: 'examples' });
  for (const q of ['Which clients have we done philanthropic summaries for?',
                   'What did we tell the Kesslers about funding the lake house?',
                   'How much did the Abernathy-Ruiz household spend on dining?',
                   'What is the best recipe for sourdough?']) {
    examples.append(el('button', { onclick: () => { box.value = q; ask(); } }, q));
  }

  return el('div', {},
    el('h1', {}, 'Ask the library'),
    el('p', { class: 'muted' },
      'Natural-language search over what the firm has produced. Answers come from the ' +
      'compiled client, service and topic pages, with a citation to the deliverable behind ' +
      'every figure — not from the model\'s own background knowledge. If the library cannot ' +
      'answer, it says so and names why.'),
    box,
    el('div', { class: 'row' }, go, el('span', { class: 'hint' }, '⌘/Ctrl + Enter')),
    examples,
    out, used, matches);
};

// ---------------------------------------------------------------- ingest

function diffLines(before, after) {
  // Small LCS line diff — enough to show what the compiler actually changed.
  const a = before.split('\n'), b = after.split('\n');
  const n = a.length, m = b.length;
  const MAX = 900;
  if (n > MAX || m > MAX) return [['~', `(${n} → ${m} lines; too large to diff inline)`]];
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([' ', a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['-', a[i++]]); }
    else { out.push(['+', b[j++]]); }
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out;
}

VIEWS.ingest = () => {
  const f = {
    id: el('input', { type: 'text', placeholder: 'client-deliverable-period, e.g. kessler-card-analysis-2026' }),
    title: el('input', { type: 'text', placeholder: 'Title as it appears on the deliverable' }),
    client: el('input', { type: 'text', placeholder: 'Client household or “Internal”' }),
    deliverable: el('input', { type: 'text', placeholder: 'e.g. Cash flow projection' }),
    period: el('input', { type: 'text', placeholder: 'e.g. 2026 or 2026 Q3' }),
    author: el('input', { type: 'text', placeholder: 'Team or author' }),
    published: el('input', { type: 'text', placeholder: 'YYYY-MM-DD delivered' }),
    body: el('textarea', { rows: 11, placeholder: 'Paste the deliverable text here…' }),
  };
  const out = el('div', {});
  const go = el('button', { class: 'btn' }, 'Compile into the library');

  const fill = el('button', { class: 'btn ghost' }, 'Load the demo deliverable');
  fill.addEventListener('click', () => {
    f.id.value = DEMO_SOURCE.id; f.title.value = DEMO_SOURCE.title;
    f.client.value = DEMO_SOURCE.client; f.deliverable.value = DEMO_SOURCE.deliverable;
    f.period.value = DEMO_SOURCE.period; f.author.value = DEMO_SOURCE.author;
    f.published.value = DEMO_SOURCE.published; f.body.value = DEMO_SOURCE.body;
    out.innerHTML = '<div class="ok">Loaded. This deliverable <b>contradicts</b> an assumption ' +
      'a page the library marks <code>established</code> relies on. Compile it and check the ' +
      'result: does the compiler record the disagreement, or smooth it away? Only the first ' +
      'is a pass.</div>';
  });

  async function ingest() {
    const meta = {
      id: f.id.value.trim(), title: f.title.value.trim(), author: f.author.value.trim(),
      client: f.client.value.trim(), deliverable: f.deliverable.value.trim(),
      period: f.period.value.trim(), url: '', published: f.published.value.trim(),
      added: today(), kind: 'deliverable',
      capture: f.id.value.trim() === DEMO_SOURCE.id ? 'synthetic' : 'verbatim',
    };
    const text = f.body.value.trim();
    if (!meta.id || !text) {
      out.innerHTML = '<div class="err">A deliverable id and some text are required.</div>';
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(meta.id)) {
      out.innerHTML = '<div class="err">Deliverable id must be lowercase letters, digits and hyphens.</div>';
      return;
    }
    if (State.sources.some(s => s.id === meta.id)) {
      out.innerHTML = '<div class="err">That id is already in the library. Deliverables are ' +
        'immutable — add a revision under a new id and let the compiler supersede the old one.</div>';
      return;
    }
    go.disabled = true; go.textContent = 'Compiling…';
    out.innerHTML = '<div class="answer streaming"></div>';
    const live = out.querySelector('.answer');
    let acc = '';
    try {
      const { system, user } = P.ingestPrompt(text, meta, State.pages, State.sources);
      await P.run({
        system, user, maxTokens: 32000, demo: demoIngestReply(meta.added, State.pages),
        onText: t => {
          acc += t;
          live.textContent = acc.replace(/```json[\s\S]*$/, '\n\n[building page edits…]');
        },
      });
      renderProposal(acc, meta, text);
    } catch (e) {
      out.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    } finally {
      go.disabled = false; go.textContent = 'Compile into the library';
    }
  }

  function renderProposal(reply, meta, text) {
    const parsed = P.parseEdits(reply);
    out.innerHTML = '';
    if (!parsed.ok) {
      out.append(el('div', { class: 'err' }, parsed.error),
        el('pre', {}, el('code', {}, reply)));
      return;
    }
    const { data } = parsed;
    out.append(el('div', { class: 'answer', html: W.renderMarkdown(parsed.text, {}).html }));

    if (data.contradictions?.length) {
      out.append(el('h2', {}, 'Contradictions found'));
      const ul = el('ul', {});
      data.contradictions.forEach(c => ul.append(el('li', {}, c)));
      out.append(ul);
    }

    // Lint the proposal BEFORE offering to apply it.
    const source = { ...meta, body: text };
    const trial = State.pages.map(p => ({ ...p, meta: { ...p.meta } }));
    for (const e of data.edits) {
      const pg = {
        slug: e.slug, file: `wiki/${e.slug}.md`,
        meta: { title: e.title, type: e.type, status: e.status, updated: e.updated, sources: e.sources || [] },
        body: e.body,
      };
      const i = trial.findIndex(p => p.slug === e.slug);
      if (i >= 0) trial[i] = pg; else trial.push(pg);
    }
    const check = W.lint(trial, [...State.sources, source]);

    out.append(el('h2', {}, `Proposed changes — ${data.edits.length} page${data.edits.length === 1 ? '' : 's'}`));
    out.append(el('div', {
      class: check.errors.length ? 'err' : 'ok',
      html: check.errors.length
        ? `<b>Lint fails on this proposal: ${check.errors.length} error(s).</b> ` +
          `Applying it would break the library's invariants.<br>` +
          check.errors.slice(0, 6).map(esc).join('<br>')
        : `<b>Lint passes on this proposal</b> — ${check.warnings.length} warning(s). ` +
          `Links resolve, citations exist, contested pages carry their contradictions. ` +
          `That does not mean the content is <i>true</i>; read the diffs.`,
    }));

    for (const e of data.edits) {
      const before = State.pageMap().get(e.slug);
      const box = el('div', { class: 'edit' });
      box.append(el('div', { class: 'edit-head' },
        el('b', {}, e.slug),
        el('span', { class: 'badge b-' + e.status }, e.status),
        before && before.meta.status !== e.status
          ? el('span', { class: 'muted' }, `was ${before.meta.status}`) : null,
        el('span', { class: 'muted' }, e.action === 'create' ? 'new page' : 'updated')));
      if (e.note) box.append(el('div', { class: 'edit-note' }, e.note));
      const d = el('div', { class: 'diff' });
      for (const [k, line] of diffLines(before ? before.body : '', e.body)) {
        if (k === ' ') continue;                       // changed lines only
        d.append(el('div', { class: k === '+' ? 'add' : 'del' },
          (k === '+' ? '+ ' : '- ') + line));
      }
      if (!d.children.length) d.append(el('div', {}, '(no textual change)'));
      box.append(d);
      out.append(box);
    }

    const apply = el('button', { class: 'btn' }, `Apply ${data.edits.length} changes`);
    apply.addEventListener('click', () => {
      State.overlay.log.push({ date: today(), op: 'ingest', text: data.log || `ingest ${meta.id}` });
      State.applyEdits(data.edits, source);
      location.hash = '#/lint';
    });
    out.append(el('div', { class: 'row' }, apply,
      el('span', { class: 'hint' },
        'Applies to this browser only. Export afterwards to commit them to the repo.')));
  }

  go.addEventListener('click', ingest);

  return el('div', {},
    el('h1', {}, 'Add a deliverable'),
    el('p', { class: 'muted' },
      'Integration is the work: one deliverable should update the client page, the ' +
      'service page and every topic it touches — not create one new page. The compiler ' +
      'must also decide whether it contradicts or supersedes what the library already ' +
      'says, and record which.'),
    el('div', { class: 'row' }, fill),
    el('div', { class: 'grid2' },
      el('label', { class: 'field' }, el('span', {}, 'Deliverable id'), f.id),
      el('label', { class: 'field' }, el('span', {}, 'Title'), f.title),
      el('label', { class: 'field' }, el('span', {}, 'Client'), f.client),
      el('label', { class: 'field' }, el('span', {}, 'Deliverable type'), f.deliverable),
      el('label', { class: 'field' }, el('span', {}, 'Period covered'), f.period),
      el('label', { class: 'field' }, el('span', {}, 'Author / team'), f.author),
      el('label', { class: 'field' }, el('span', {}, 'Delivered on'), f.published)),
    el('label', { class: 'field' }, el('span', {}, 'Deliverable text'), f.body),
    el('div', { class: 'row' }, go),
    out);
};

// ------------------------------------------------------------------ lint

VIEWS.lint = () => {
  const { errors, warnings } = W.lint(State.pages, State.sources);
  const { stale, uningested } = W.staleness(State.pages, State.sources);
  const main = el('div', {},
    el('h1', {}, 'Lint'),
    el('p', { class: 'muted' },
      'Deterministic checks over the library as it stands in this browser. Identical rules ' +
      'to tools/wiki.py — links resolve, every citation points at a real deliverable and is ' +
      'declared, contested pages carry a Contradictions section, no page is older than a ' +
      'deliverable it cites.'),
    el('div', {
      class: errors.length ? 'err' : 'ok',
      html: errors.length
        ? `<b>${errors.length} error(s), ${warnings.length} warning(s).</b> The build is broken.`
        : `<b>Consistent.</b> ${State.pages.length} pages, ${State.sources.length} deliverables, ` +
          `0 errors, ${warnings.length} warning(s).<br>` +
          `<i>Consistent is not the same as true — no check here reads a page for accuracy.</i>`,
    }));

  if (errors.length) {
    main.append(el('h2', {}, 'Errors'));
    errors.forEach(e => main.append(el('div', { class: 'lintline e' }, e)));
  }
  if (warnings.length) {
    main.append(el('h2', {}, 'Warnings'));
    warnings.forEach(w => main.append(el('div', { class: 'lintline w' }, w)));
  }

  main.append(el('h2', {}, 'Build status'));
  if (!stale.length && !uningested.length) {
    main.append(el('p', {}, 'Up to date — every deliverable is compiled, every page current.'));
  } else {
    if (uningested.length) {
      main.append(el('p', { html: '<b>Never ingested:</b> ' +
        uningested.map(u => `<code>${esc(u)}</code>`).join(', ') }));
    }
    stale.forEach(s => main.append(el('div', { class: 'lintline w' },
      `${s.slug} depends on ${s.source} (${s.added}) but was compiled ${s.page}`)));
  }

  main.append(el('h2', {}, 'What this cannot check'),
    el('p', { class: 'muted' },
      'Whether a page is true. Whether a figure was carried over correctly from the ' +
      'deliverable. Whether two pages quietly say incompatible things without either ' +
      'being marked contested. Whether the compiler drifted from what a deliverable ' +
      'actually said while keeping a well-formed citation to it. Those are read by a ' +
      'person, and that is the part that does not automate.'));
  return el('div', { class: 'cols' }, nav(''), main);
};

// ---------------------------------------------------------------- router

const Router = {
  q: '',
  go() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [, head, ...rest] = h.split('/');
    const arg = decodeURIComponent(rest.join('/') || '');
    let node, tab = 'read';
    switch (head) {
      case 'page': node = VIEWS.page(arg); break;
      case 'source': node = VIEWS.source(arg); tab = 'sources'; break;
      case 'sources': node = VIEWS.sources(); tab = 'sources'; break;
      case 'search': this.q = arg; node = VIEWS.search(arg); break;
      case 'ask': node = VIEWS.ask(); tab = 'ask'; break;
      case 'ingest': node = VIEWS.ingest(); tab = 'ingest'; break;
      case 'lint': node = VIEWS.lint(); tab = 'lint'; break;
      default: node = VIEWS.home();
    }
    const view = $('#view');
    view.replaceChildren(node);
    document.querySelectorAll('.tabs a').forEach(a =>
      a.classList.toggle('on', a.dataset.tab === tab));
    window.scrollTo(0, 0);
  },
};

// -------------------------------------------------------------- settings

function syncModeChip() {
  const mode = P.getMode();
  const chip = $('#mode-chip');
  const label = { demo: 'demo mode', direct: 'live · your key', proxy: 'live · proxy' }[mode];
  chip.textContent = label;
  chip.className = 'chip' + (mode === 'demo' ? '' : ' live');
  chip.title = mode === 'demo'
    ? 'Canned responses. No key, no network. Open Settings to connect a real compiler.'
    : 'Calls the Claude API for real.';
}

function initSettings() {
  const dlg = $('#settings');
  const sel = $('#mode-select');
  const toggle = () => {
    $('#key-field').hidden = sel.value !== 'direct';
    $('#proxy-field').hidden = sel.value !== 'proxy';
  };
  sel.addEventListener('change', toggle);
  $('#open-settings').addEventListener('click', () => {
    sel.value = P.getMode();
    $('#api-key').value = P.getKey();
    $('#proxy-url').value = P.getProxy();
    toggle();
    dlg.showModal();
  });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'save') return;
    P.setMode(sel.value);
    P.setKey($('#api-key').value.trim());
    P.setProxy($('#proxy-url').value.trim());
    syncModeChip();
  });
}

// ------------------------------------------------------------------ boot

async function boot() {
  try {
    const res = await fetch('data/wiki.json');
    if (!res.ok) throw new Error(`data/wiki.json → ${res.status}`);
    State.load(await res.json());
  } catch (e) {
    $('#view').innerHTML =
      `<div class="err"><b>Could not load the library.</b> ${esc(e.message)}<br>` +
      `Run <code>python3 tools/build_app.py</code>, then serve the directory over HTTP ` +
      `(<code>python3 -m http.server</code>) — opening index.html from the filesystem ` +
      `will not work, because module and fetch requests are blocked on file:// URLs.</div>`;
    return;
  }
  const fl = $('#foot-links');
  if (State.seed.repo)
    fl.append(el('a', { href: State.seed.repo, target: '_blank', rel: 'noopener' },
      'source on GitHub'));
  // Published alongside the app by the Pages workflow; absent in local dev.
  fetch('read/index.html', { method: 'HEAD' })
    .then(r => { if (r.ok) fl.append(el('a', { href: 'read/' }, 'no-JavaScript archive')); })
    .catch(() => {});

  initSettings();
  syncModeChip();
  renderDirty();
  $('#export-btn').addEventListener('click', exportChanges);
  $('#reset-btn').addEventListener('click', () => {
    if (confirm('Discard all changes compiled in this browser? The shipped library is unaffected.'))
      { State.reset(); Router.go(); }
  });
  addEventListener('hashchange', () => Router.go());
  Router.go();
}

boot();
