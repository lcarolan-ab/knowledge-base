// test_app.mjs — logic tests for the web app. No browser, no network, no deps.
//
//   node tools/test_app.mjs
//
// Covers the parts that would silently rot: that the browser linter agrees with
// the Python one, and that an ingest proposal actually applies to a clean wiki.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const W = await import(path.join(ROOT, 'app/lib/wiki.js'));
const P = await import(path.join(ROOT, 'app/lib/provider.js'));
const D = await import(path.join(ROOT, 'app/lib/demo.js'));

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/data/wiki.json'), 'utf8'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message}`); fail++; }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

const clonePages = () => data.pages.map(p => ({ ...p, meta: { ...p.meta } }));

console.log('\nseed data');
test('the shipped wiki lints clean in the browser linter', () => {
  const r = W.lint(clonePages(), data.sources);
  eq(r.errors.length, 0, `errors: ${r.errors.join('; ')}`);
  eq(r.warnings.length, 0, `warnings: ${r.warnings.join('; ')}`);
});
test('nothing is stale or uningested', () => {
  const s = W.staleness(clonePages(), data.sources);
  eq(s.stale.length, 0); eq(s.uningested.length, 0);
});
test('every page renders with no unresolved wikilinks', () => {
  const pages = new Map(data.pages.map(p => [p.slug, p]));
  for (const p of data.pages) {
    const { html } = W.renderMarkdown(p.body, { pages });
    ok(!html.includes('class="broken"'), `broken link in ${p.slug}`);
  }
});

console.log('\nfrontmatter');
test('parse → serialize → parse round-trips', () => {
  const page = { meta: { title: 'T', type: 'concept', status: 'contested',
    updated: '2026-09-01', sources: ['a', 'b'] }, body: '# T\n\nbody\n' };
  const { meta } = W.parseFrontmatter(W.serialize(page));
  eq(meta.title, 'T'); eq(meta.status, 'contested');
  eq(JSON.stringify(meta.sources), JSON.stringify(['a', 'b']));
});
test('empty inline list parses as []', () => {
  const { meta } = W.parseFrontmatter('---\ntitle: X\nsources: []\n---\nbody\n');
  eq(Array.isArray(meta.sources), true); eq(meta.sources.length, 0);
});
test('footnote definitions are not counted as citations', () => {
  const body = 'Claim [^a].\n\n[^a]: raw/a.md\n';
  eq(W.citesOf(body).length, 1);
});
test('wikilinks inside code fences are ignored', () => {
  eq(W.linksOf('```\n[[not/real]]\n```\n[[real/one]]\n').length, 1);
});

console.log('\nlint catches violations');
const SRC = [{ id: 'src-a', file: 'raw/a.md', added: '2026-01-01' }];
const base = () => [{
  slug: 'a', file: 'wiki/a.md',
  meta: { title: 'A', type: 'concept', status: 'established', updated: '2026-02-01', sources: ['src-a'] },
  body: 'Claim [^src-a]. See [[b]] [[c]] [[d]].\n\n[^src-a]: raw/a.md\n',
}, ...['b', 'c', 'd'].map(s => ({
  slug: s, file: `wiki/${s}.md`,
  meta: { title: s, type: 'concept', status: 'established', updated: '2026-02-01', sources: ['src-a'] },
  body: `Claim [^src-a]. See [[a]] [[b]] [[c]] [[d]].\n\n[^src-a]: raw/a.md\n`,
}))];
const flags = (pages, sources, needle, level = 'errors') => {
  const r = W.lint(pages, sources || SRC);
  ok(r[level].join('\n').includes(needle),
    `expected ${level} containing "${needle}", got: ${r[level].join(' | ') || '(none)'}`);
};

test('clean fixture passes', () => eq(W.lint(base(), SRC).errors.length, 0));
test('broken link', () => {
  const p = base(); p[0].body = p[0].body.replace('[[b]]', '[[nope]]');
  flags(p, null, 'broken link [[nope]]');
});
test('citation with no source', () => {
  const p = base(); p[0].body = p[0].body.replace('[^src-a].', '[^ghost].');
  flags(p, null, 'citation [^ghost] has no source');
});
test('citation missing from frontmatter', () => {
  const p = base(); p[0].meta.sources = [];
  flags(p, null, 'omits it from frontmatter sources');
});
test('contested without a Contradictions section', () => {
  const p = base(); p[0].meta.status = 'contested';
  flags(p, null, "requires a '## Contradictions' section");
});
test('contested WITH a Contradictions section passes', () => {
  const p = base();
  p[0].meta.status = 'contested';
  p[0].body = '## Contradictions\n\n' + p[0].body;
  ok(!W.lint(p, SRC).errors.join('\n').includes('Contradictions'));
});
test('stale page (source newer than page)', () => {
  flags(base(), [{ id: 'src-a', file: 'raw/a.md', added: '2026-06-01' }], "stale: source 'src-a'");
});
test('uningested source', () => {
  flags(base(), [...SRC, { id: 'never', file: 'raw/n.md', added: '2026-01-01' }], 'not ingested');
});
test('bad status value', () => {
  const p = base(); p[0].meta.status = 'pretty-sure';
  flags(p, null, "status 'pretty-sure' not in");
});
test('superseded needs a forward link', () => {
  const p = base();
  p.push({ slug: 'z', file: 'wiki/z.md',
    meta: { title: 'Z', type: 'concept', status: 'superseded', updated: '2026-02-01', sources: [] },
    body: 'nothing\n' });
  flags(p, null, 'must link forward');
});
test('orphan page warns', () => {
  const p = base();
  p.push({ slug: 'lonely', file: 'wiki/lonely.md',
    meta: { title: 'L', type: 'concept', status: 'established', updated: '2026-02-01', sources: ['src-a'] },
    body: 'Claim [^src-a]. [[a]] [[b]] [[c]]\n\n[^src-a]: raw/a.md\n' });
  flags(p, null, 'orphan', 'warnings');
});

console.log('\ningest');
test('the demo reply parses into edits', () => {
  const r = P.parseEdits(D.DEMO_INGEST_REPLY);
  ok(r.ok, r.error); eq(r.data.edits.length, 3);
  ok(r.data.log, 'no log line'); ok(r.data.contradictions.length >= 1);
});
test('malformed replies fail gracefully, never throw', () => {
  for (const bad of ['no json here', '```json\n{oops\n```', '', '```json\n{"edits":"nope"}\n```']) {
    const r = P.parseEdits(bad);
    eq(r.ok, false, `should not parse: ${bad.slice(0, 20)}`);
    ok(typeof r.error === 'string' && r.error.length > 0);
  }
});
test('applying the demo ingest leaves the wiki lint-clean', () => {
  const { data: d } = P.parseEdits(D.DEMO_INGEST_REPLY);
  const pages = clonePages();
  const sources = [...data.sources, { ...D.DEMO_SOURCE, file: 'raw/2026-09-01-rag-eval-2026.md' }];
  for (const e of d.edits) {
    const pg = { slug: e.slug, file: `wiki/${e.slug}.md`, body: e.body,
      meta: { title: e.title, type: e.type, status: e.status, updated: e.updated, sources: e.sources } };
    const i = pages.findIndex(p => p.slug === e.slug);
    if (i >= 0) pages[i] = pg; else pages.push(pg);
  }
  const r = W.lint(pages, sources);
  eq(r.errors.length, 0, `errors: ${r.errors.join('; ')}`);
  eq(r.warnings.length, 0, `warnings: ${r.warnings.join('; ')}`);
});
test('the demo ingest marks contradicted pages contested', () => {
  const { data: d } = P.parseEdits(D.DEMO_INGEST_REPLY);
  const contested = d.edits.filter(e => e.status === 'contested').map(e => e.slug);
  ok(contested.includes('comparisons/wiki-vs-rag'), 'wiki-vs-rag not contested');
  ok(contested.includes('concepts/compilation-over-retrieval'), 'core claim not contested');
  for (const e of d.edits) {
    if (e.status === 'contested') ok(/^##+\s*Contradictions/m.test(e.body),
      `${e.slug} contested with no Contradictions section`);
  }
});
test('the demo ingest touches several pages, not one', () => {
  const { data: d } = P.parseEdits(D.DEMO_INGEST_REPLY);
  ok(d.edits.length >= 3, `only ${d.edits.length} edits — that is filing, not compiling`);
});

console.log('\nprompts');
test('query prompt carries the wiki and forbids outside knowledge', () => {
  const { system } = P.queryPrompt('q', data.pages, data.sources);
  ok(system.includes('COMPILED WIKI'));
  ok(system.includes('not from your own background knowledge'));
  ok(system.includes('karpathy-llm-wiki-gist'), 'source ids not listed');
});
test('ingest prompt states the contradiction rule', () => {
  const { system } = P.ingestPrompt('text', { id: 'x', title: 'T', added: '2026-09-01', capture: 'summary' },
    data.pages, data.sources);
  ok(system.toLowerCase().includes('contradict'));
  ok(system.includes('"edits"'), 'no json contract');
});
test('demo router returns an honest miss for uncovered questions', () => {
  ok(D.demoAnswer('best sourdough recipe').includes('cannot answer'));
  ok(!D.demoAnswer('should pages decay?').includes('cannot answer'));
});

console.log('\nsearch');
test('search ranks the right page first', () => {
  eq(W.search(data.pages, 'decay')[0].page.slug, 'concepts/knowledge-lifecycle');
});
test('empty query returns nothing', () => eq(W.search(data.pages, '  ').length, 0));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
