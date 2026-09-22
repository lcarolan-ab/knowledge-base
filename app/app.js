// app.js — the deliverables library: ask what exists, find the deck, see who made it.

import * as S from './lib/search.js';
import * as P from './lib/provider.js';
import * as SP from './lib/sharepoint.js';

const CFG = window.LIBRARY_CONFIG || { source: 'demo', model: {} };
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== false && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid);
  return n;
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

const State = { data: null, source: 'demo file', thread: [] };

// ------------------------------------------------------------------ pieces

function person(p, contributors = []) {
  if (!p?.name) return null;
  const withNames = contributors.map(c => c.name.split(',')[0]).filter(Boolean);
  return el('div', { class: 'person' },
    el('span', { class: 'avatar', 'aria-hidden': 'true' }, S.initials(p.name)),
    el('span', { class: 'who' },
      el('b', {}, p.name), p.role ? el('span', {}, ` · ${p.role}`) : null,
      withNames.length ? el('span', { class: 'with' }, ` · with ${withNames.join(', ')}`) : null));
}

function card(item, { matched = [], why = null } = {}) {
  const pages = item.pages ? `${item.pages} ${item.format === 'slides' ? 'slides' : item.format === 'spreadsheet' ? 'sheet' : 'pages'}` : item.format;
  const href = item.file || '#';
  const open = { href, target: item.file ? '_blank' : null, rel: 'noopener',
    title: item.file?.startsWith('http') ? '' : 'Demo placeholder — in production this opens the file in SharePoint' };
  const outline = el('ul', { class: 'outline', hidden: true }, ...(item.outline || []).map(o => el('li', {}, o)));
  const toggle = el('a', { href: '#', class: 'quiet', onclick: e => { e.preventDefault(); outline.hidden = !outline.hidden; } }, 'Outline');
  const tags = [...item.audiences, ...item.topics.filter(t => !item.audiences.includes(t)).slice(0, 3)];
  return el('article', { class: 'card' },
    el('div', { class: 'top' },
      el('span', { class: 'badge type' }, item.type || 'Deliverable'),
      el('span', { class: 'when' }, `${S.monthName(item.date)} · ${pages}`)),
    el('h3', {}, el('a', open, item.title)),
    el('p', { class: 'sum' }, item.summary),
    el('div', { class: 'tags' }, ...tags.map(t => el('span', { class: matched.includes(t) ? 'hit' : '' }, t))),
    why ? el('div', { class: 'why' }, why) : null,
    el('div', { class: 'foot' },
      person(item.author, item.contributors),
      el('span', { class: 'links' }, (item.outline || []).length ? toggle : null, el('a', open, 'Open'))),
    outline);
}

// --------------------------------------------------------------------- ask

const VIEWS = {};

VIEWS.ask = () => {
  const input = el('input', { type: 'text', id: 'ask-input', autocomplete: 'off',
    placeholder: 'Have we ever done a credit card analysis for a new grad?' });
  const go = el('button', { class: 'btn', id: 'ask-btn' }, 'Ask');
  const thread = el('div', { class: 'thread' });

  async function ask(q) {
    q = (q || input.value).trim();
    if (!q) return;
    input.value = q;
    go.disabled = true;
    const turn = el('section', { class: 'turn' }, el('div', { class: 'q' }, q));
    const answer = el('div', { class: 'answer streaming' }, el('span', { class: 'muted' }, 'Looking through the library…'));
    turn.append(answer);
    thread.prepend(turn);

    const found = S.search(State.data, q);
    let text = S.templateAnswer(q, found);
    let results = found.results.map(r => ({ item: r.item, matched: r.reasons.filter(x => !x.startsWith('mentions ')), strong: r.strong }));
    let src = '';
    try {
      const raw = await P.ask({ question: q, data: State.data });
      if (raw !== null) {
        const parsed = P.parseReply(raw, State.data);
        if (parsed.ok) {
          text = parsed.answer;
          results = parsed.matches.map((m, i) => ({ item: m.item, why: m.reason, strong: i === 0 }));
        } else {
          src = 'The model’s reply could not be read; showing the search result instead.';
        }
      }
    } catch (e) {
      src = `Model call failed (${e.message}); showing the search result instead.`;
    }

    answer.className = 'answer';
    answer.innerHTML = `<div>${md(text)}</div>${src ? `<div class="src">${esc(src)}</div>` : ''}`;
    if (results.length) {
      const close = results.filter(r => r.strong).length;
      const heading = results.length === 1 ? 'The deliverable'
        : close && close < results.length ? `${close} close match${close === 1 ? '' : 'es'}, ${results.length - close} related`
        : close ? `${results.length} close matches` : `${results.length} related deliverables`;
      turn.append(el('h2', {}, heading));
      turn.append(el('div', { class: 'cards list' }, ...results.map(r => card(r.item, { matched: r.matched || [], why: r.why }))));
    }
    go.disabled = false;
    input.focus();
  }

  go.addEventListener('click', () => ask());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });

  const examples = el('div', { class: 'examples' });
  for (const q of ['Credit card analysis for a new grad',
                   'Student loans for a doctor',
                   'Founder with concentrated stock',
                   'Buying a first home']) {
    examples.append(el('button', { onclick: () => ask(q) }, q));
  }

  return el('div', {},
    el('div', { class: 'hero' },
      el('h1', {}, 'What have we already made?'),
      el('p', {}, 'Search the firm’s deliverables in plain language.')),
    el('div', { class: 'askbox' }, input, go),
    examples, thread);
};

// ------------------------------------------------------------------ browse

VIEWS.browse = () => {
  const items = State.data.items;
  const tax = State.data.taxonomy;
  const opt = (v, label) => el('option', { value: v }, label || v);
  const f = {
    text: el('input', { type: 'search', id: 'f-text', placeholder: 'Filter by words…' }),
    type: el('select', { id: 'f-type' }, opt('', 'All types'), ...tax.types.map(t => opt(t.name))),
    audience: el('select', { id: 'f-aud' }, opt('', 'All audiences'), ...tax.audiences.map(a => opt(a.tag))),
    year: el('select', { id: 'f-year' }, opt('', 'All years'),
      ...[...new Set(items.map(i => i.date.slice(0, 4)))].sort().reverse().map(y => opt(y))),
  };
  const count = el('div', { class: 'count' });
  const grid = el('div', { class: 'cards' });
  const render = () => {
    const shown = S.filterItems(items, { text: f.text.value, type: f.type.value, audience: f.audience.value, year: f.year.value });
    count.textContent = `${shown.length} of ${items.length} deliverables`;
    grid.replaceChildren(...shown.map(i => card(i)));
    if (!shown.length) grid.append(el('div', { class: 'empty' }, 'Nothing matches those filters.'));
  };
  Object.values(f).forEach(c => c.addEventListener('input', render));
  render();
  return el('div', {},
    el('h1', {}, 'Browse'),
    el('div', { class: 'filters' }, f.text, f.type, f.audience, f.year),
    count, grid);
};

// ------------------------------------------------------------------ router

const Router = {
  go() {
    const h = location.hash.replace(/^#\/?/, '') || 'ask';
    const view = VIEWS[h] ? h : 'ask';
    $('#view').replaceChildren(VIEWS[view]());
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === view));
    window.scrollTo(0, 0);
    if (view === 'ask') $('#ask-input')?.focus();
  },
};

// ---------------------------------------------------------------- settings

function syncModeChip() {
  const mode = P.getMode();
  const chip = $('#mode-chip');
  chip.textContent = { demo: 'Demo', direct: 'Live', proxy: 'Live' }[mode];
  chip.className = 'chip' + (mode === 'demo' ? '' : ' live');
}

function initSettings() {
  const dlg = $('#settings'), sel = $('#mode-select');
  const toggle = () => { $('#key-field').hidden = sel.value !== 'direct'; $('#proxy-field').hidden = sel.value !== 'proxy'; };
  sel.addEventListener('change', toggle);
  $('#open-settings').addEventListener('click', () => {
    sel.value = P.getMode(); $('#api-key').value = P.getKey();
    $('#proxy-url').value = P.getProxy() || CFG.model?.proxyUrl || '';
    toggle(); dlg.showModal();
  });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'save') return;
    P.setMode(sel.value); P.setKey($('#api-key').value); P.setProxy($('#proxy-url').value);
    syncModeChip();
  });
}

// -------------------------------------------------------------------- boot

async function loadDemo() {
  const res = await fetch('data/library.json');
  if (!res.ok) throw new Error(`data/library.json → ${res.status}. Run python3 tools/build_library.py.`);
  State.data = await res.json();
  State.source = 'demo file';
}

async function loadSharePoint() {
  const demo = await (await fetch('data/library.json')).json().catch(() => ({ taxonomy: null }));
  const taxonomy = demo.taxonomy;
  const { items, source, siteUrl } = await SP.loadCatalogue(CFG.sharepoint);
  State.data = { built: new Date().toISOString().slice(0, 10), taxonomy, items };
  State.source = source;
  const fl = $('#foot-links');
  fl.append(el('a', { href: siteUrl, target: '_blank', rel: 'noopener' }, 'open the library in SharePoint'));
  fl.append(el('a', { href: '#', onclick: async e => { e.preventDefault(); await SP.signOut(CFG.sharepoint); location.reload(); } }, 'sign out'));
}

async function boot() {
  try {
    if (!P.getMode() || !localStorage.getItem(P.MODE_STORAGE)) P.setMode(CFG.model?.mode || 'demo');
  } catch { /* storage unavailable: defaults apply */ }
  if (CFG.model?.proxyUrl && !P.getProxy()) P.setProxy(CFG.model.proxyUrl);

  try {
    if (CFG.source === 'sharepoint') await loadSharePoint(); else await loadDemo();
  } catch (e) {
    const box = el('div', { class: 'err' },
      el('p', {}, el('b', {}, 'Could not load the library. '), esc(e.message)));
    if (CFG.source === 'sharepoint') {
      box.append(el('p', { class: 'muted' }, 'Check app/config.js and docs/sharepoint-setup.md. '),
        el('button', { class: 'btn ghost small', onclick: async () => { await loadDemo(); finish(); } }, 'Use the demo catalogue instead'));
    } else {
      box.append(el('p', { class: 'muted' }, 'Serve the app over HTTP (python3 -m http.server -d app 8765) after building the catalogue.'));
    }
    $('#view').replaceChildren(box);
    return;
  }
  finish();
}

function finish() {
  const fl = $('#foot-links');
  if (State.data.repo && !fl.querySelector('.repo'))
    fl.append(el('a', { class: 'repo', href: State.data.repo, target: '_blank', rel: 'noopener' }, 'source on GitHub'));
  initSettings();
  syncModeChip();
  addEventListener('hashchange', () => Router.go());
  Router.go();
}

boot();
