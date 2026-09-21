// search.js — deterministic search over the deliverables catalogue.
//
// The question "have we ever done a credit card analysis for a new grad?" has to
// work with no model at all, so this understands the taxonomy's synonyms: "new grad"
// matches the audience tag through its aliases, "credit card analysis" matches the
// type, and plain words match titles and summaries. The model, when connected,
// gets the same catalogue and can do better on phrasing — but this is the floor.

const STOP = new Set(('a an and are as at be by did do does for from has have had how in is it ' +
  'of on or our that the their there these this to us was we were what when which who why ' +
  'with about any all tell me show list find give ever done make made anyone someone ' +
  'something before already previously past prior can could would should you your i my ' +
  'like want need looking look').split(' '));

const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}\s()-]/gu, ' ')
  .replace(/\s+/g, ' ').trim();
const stem = t => (t.length > 4 && t.endsWith('s')) ? t.slice(0, -1) : t;
const words = s => norm(s).split(' ').filter(t => t && !STOP.has(t)).map(stem);

// Phrase → canonical value, longest phrases first so "credit card analysis" wins
// over "credit card".
function aliasTable(tax) {
  const rows = [];
  for (const t of tax.types) for (const a of [t.name, ...(t.aliases || [])])
    rows.push({ phrase: norm(a), kind: 'type', value: t.name });
  for (const a of tax.audiences) for (const p of [a.tag, ...(a.aliases || [])])
    rows.push({ phrase: norm(p), kind: 'audience', value: a.tag });
  for (const t of tax.topics) for (const p of [t.tag, ...(t.aliases || [])])
    rows.push({ phrase: norm(p), kind: 'topic', value: t.tag });
  return rows.sort((a, b) => b.phrase.length - a.phrase.length);
}

// What the question is asking for, in taxonomy terms.
export function parseQuery(tax, q) {
  let text = ' ' + norm(q) + ' ';
  const found = { type: new Set(), audience: new Set(), topic: new Set() };
  for (const row of aliasTable(tax)) {
    const needle = ' ' + row.phrase + ' ';
    if (text.includes(needle)) {
      found[row.kind].add(row.value);
      text = text.split(needle).join(' ');          // consume so shorter aliases don't double-match
    }
  }
  return {
    types: [...found.type], audiences: [...found.audience], topics: [...found.topic],
    terms: words(text),
  };
}

function itemText(item) {
  return {
    title: words(item.title), summary: words(item.summary),
    outline: words((item.outline || []).join(' ')), client: words(item.client),
  };
}

export function search(data, q, opts = {}) {
  const parsed = parseQuery(data.taxonomy, q);
  const { types, audiences, topics, terms } = parsed;
  const nothingAsked = !types.length && !audiences.length && !topics.length && !terms.length;
  if (nothingAsked) return { parsed, results: [] };

  const results = [];
  for (const item of data.items) {
    let score = 0;
    const reasons = [];
    if (types.includes(item.type)) { score += 40; reasons.push(item.type); }
    for (const a of audiences) if (item.audiences.includes(a)) { score += 30; reasons.push(a); }
    for (const t of topics) if (item.topics.includes(t)) { score += 15; reasons.push(t); }

    const tx = itemText(item);
    const termHits = [];
    for (const term of terms) {
      let hit = 0;
      if (tx.title.includes(term)) hit += 6;
      if (tx.summary.includes(term)) hit += 2;
      if (tx.outline.includes(term)) hit += 1;
      if (tx.client.includes(term)) hit += 2;
      if (hit) { score += hit; termHits.push(term); }
    }
    if (termHits.length) reasons.push(`mentions ${termHits.join(', ')}`);

    // A type or audience the question named but the item lacks costs it: asking for
    // a card analysis for a new grad should not rank a retiree's card analysis first.
    if (types.length && !types.includes(item.type)) score -= 15;
    if (audiences.length && !audiences.some(a => item.audiences.includes(a))) score -= 10;

    // Without a taxonomy hit, a lone word buried in a summary is noise, not a match:
    // it takes a title hit or two distinct terms to count.
    const taxHit = types.includes(item.type) || audiences.some(a => item.audiences.includes(a)) ||
      topics.some(t => item.topics.includes(t));
    const titleHit = terms.some(t => tx.title.includes(t));
    if (!taxHit && !titleHit && termHits.length < 2) continue;

    if (score > 0) {
      const strong = (types.length ? types.includes(item.type) : true) &&
        (audiences.length ? audiences.some(a => item.audiences.includes(a)) : true) &&
        (types.length || audiences.length || topics.length ? true : termHits.length >= 2);
      results.push({ item, score, reasons, strong });
    }
  }
  results.sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date));
  return { parsed, results: results.slice(0, opts.limit || 8) };
}

// The people behind the top results, most-involved first.
export function people(results, limit = 4) {
  const byEmail = new Map();
  const add = (p, weight, item, role) => {
    const key = p?.email || p?.name;
    if (!key) return;
    const rec = byEmail.get(key) || { ...p, weight: 0, items: [] };
    rec.weight += weight;
    rec.items.push({ id: item.id, title: item.title, role });
    if (!rec.role && p.role) rec.role = p.role;
    byEmail.set(key, rec);
  };
  results.forEach((r, i) => {
    const w = (results.length - i);
    add(r.item.author, w * 2, r.item, 'author');
    for (const c of r.item.contributors || []) add(c, w, r.item, 'contributor');
  });
  return [...byEmail.values()].sort((a, b) => b.weight - a.weight).slice(0, limit);
}

export function filterItems(items, f = {}) {
  const text = f.text ? words(f.text) : [];
  return items.filter(it =>
    (!f.type || it.type === f.type) &&
    (!f.audience || it.audiences.includes(f.audience)) &&
    (!f.year || it.date.startsWith(f.year)) &&
    (!f.author || it.author.email === f.author) &&
    (!text.length || text.every(t => {
      const tx = itemText(it);
      return tx.title.includes(t) || tx.summary.includes(t) || tx.outline.includes(t) ||
        it.audiences.some(a => words(a).includes(t)) || it.topics.some(a => words(a).includes(t)) ||
        words(it.type).includes(t);
    })));
}

// A plain-language answer built from the search alone. This is what demo mode says
// and what live mode falls back to if the model's reply cannot be parsed.
export function templateAnswer(q, { parsed, results }) {
  const asked = [...parsed.types, ...parsed.audiences, ...parsed.topics];
  const askedText = asked.length ? asked.join(' · ') : (parsed.terms.join(' ') || 'that');
  const strong = results.filter(r => r.strong);
  if (!results.length) {
    return `No — nothing in the library covers ${askedText}. Nobody has filed a deliverable ` +
      `on it yet, so this would be new work.`;
  }
  const fmt = it => `**${it.title}** (${monthName(it.date)}, ${it.author.name})`;
  if (strong.length) {
    const [top, ...rest] = strong;
    let s = `Yes. ${strong.length === 1 ? 'One deliverable matches' : `${strong.length} deliverables match`} ` +
      `${askedText}. The closest is ${fmt(top.item)}, ${top.item.pages ? `${top.item.pages} ${top.item.format === 'slides' ? 'slides' : 'pages'}` : top.item.format}` +
      `${top.item.client ? `, prepared for ${top.item.client}` : ''}.`;
    if (rest.length) s += ` Also relevant: ${rest.slice(0, 2).map(r => fmt(r.item)).join('; ')}.`;
    s += ` ${top.item.author.name} is the person to talk to.`;
    return s;
  }
  return `Not exactly. Nothing in the library is a ${askedText} as such, but the closest ` +
    `related work is ${fmt(results[0].item)}` +
    (results[1] ? ` and ${fmt(results[1].item)}` : '') +
    `. Their authors would know whether a version for your case exists outside the library.`;
}

export function monthName(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function teamsLink(email) {
  return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}`;
}

export function initials(name) {
  // Ignore credentials after a comma ("Jane Doe, CFA").
  return String(name || '?').split(',')[0].trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}
