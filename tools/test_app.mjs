// test_app.mjs — logic tests for the app. No browser, no network, no dependencies.
//
//   node tools/test_app.mjs
//
// Covers what would silently rot: that the search understands the taxonomy's
// synonyms, that the headline question finds the right deck, that model replies
// parse, and that SharePoint items map to catalogue items.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const S = await import(path.join(ROOT, 'app/lib/search.js'));
const P = await import(path.join(ROOT, 'app/lib/provider.js'));
const SP = await import(path.join(ROOT, 'app/lib/sharepoint.js'));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/data/library.json'), 'utf8'));

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message}`); fail++; }
};
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'not equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const top = q => S.search(data, q).results[0]?.item.id;

console.log('\ncatalogue');
test('every item has a type, an audience, an author with a role, and an outline', () => {
  for (const it of data.items) {
    ok(it.type, `${it.id} has no type`); ok(it.audiences.length, `${it.id} has no audience`);
    ok(it.author.name && it.author.role, `${it.id} author lacks a name or role`); ok(it.outline.length, `${it.id} has no outline`);
  }
});
test('tags all come from the taxonomy', () => {
  const aud = new Set(data.taxonomy.audiences.map(a => a.tag)), top = new Set(data.taxonomy.topics.map(t => t.tag));
  for (const it of data.items) {
    it.audiences.forEach(a => ok(aud.has(a), `${it.id}: audience ${a}`));
    it.topics.forEach(t => ok(top.has(t), `${it.id}: topic ${t}`));
  }
});

console.log('\nsearch');
test('the headline question finds the new-grad card analysis first', () => {
  eq(top('Have we ever done a credit card analysis for a new grad?'), 'cc-analysis-new-grad-2025');
});
test('synonyms: recent graduate, first job, entry level all mean new grad', () => {
  for (const q of ['credit card work for a recent graduate', 'card strategy for someone in their first job',
                   'credit cards, entry level client']) eq(top(q), 'cc-analysis-new-grad-2025', q);
});
test('the parsed query names the type and audience it recognised', () => {
  const { parsed } = S.search(data, 'credit card analysis for a new grad');
  ok(parsed.types.includes('Credit card analysis')); ok(parsed.audiences.includes('new grad'));
});
test('a strong match is flagged strong; a related one is not', () => {
  const { results } = S.search(data, 'credit card analysis for a new grad');
  ok(results[0].strong, 'top result should be strong');
  const retiree = results.find(r => r.item.id === 'cc-analysis-retired-couple-2026');
  ok(!retiree || !retiree.strong, 'a retiree card analysis is not a strong match for a new grad');
});
test('audience-only questions work', () => {
  const { results } = S.search(data, 'what do we have for doctors?');
  ok(results.length >= 1); eq(results[0].item.id, 'student-loans-new-physician-2025');
});
test('topic phrasing works: company stock → concentrated stock', () => {
  const ids = S.search(data, 'a founder with a lot of company stock').results.map(r => r.item.id);
  ok(ids[0] === 'estate-review-founder-2026' || ids[0] === 'giving-summary-founder-foundation-2026', ids.join(','));
});
test('a question about nothing in the library returns no results', () => {
  eq(S.search(data, 'sourdough starter').results.length, 0);
  eq(S.search(data, 'have we ever').results.length, 0);
});
test('template answer says yes, no, or not exactly', () => {
  ok(S.templateAnswer('q', S.search(data, 'credit card analysis for a new grad')).startsWith('Yes.'));
  ok(S.templateAnswer('q', S.search(data, 'sourdough')).startsWith('No'));
  ok(S.templateAnswer('q', S.search(data, 'cash flow for someone retiring to Portugal')).startsWith('Not exactly') ||
     S.templateAnswer('q', S.search(data, 'cash flow for someone retiring to Portugal')).startsWith('Yes'));
});
test('people are ranked from the results', () => {
  const ppl = S.people(S.search(data, 'credit card analysis for a new grad').results);
  eq(ppl[0].name, data.items.find(i => i.id === 'cc-analysis-new-grad-2025').author.name); ok(ppl[0].items.length >= 1);
});
test('browse filters compose', () => {
  eq(S.filterItems(data.items, { audience: 'new grad' }).length, 3);
  eq(S.filterItems(data.items, { audience: 'new grad', type: 'Cash flow projection' }).length, 1);
  eq(S.filterItems(data.items, { text: 'gala' }).length >= 1, true);
  eq(S.filterItems(data.items, {}).length, data.items.length);
});
test('helpers', () => {
  eq(S.monthName('2025-09'), 'Sep 2025'); eq(S.initials('Priya Natarajan'), 'PN'); eq(S.initials('Jane Doe, CFA, CFP'), 'JD');
  ok(S.teamsLink('a@b.c').includes(encodeURIComponent('a@b.c')));
});

console.log('\nmodel contract');
test('the prompt carries the whole catalogue with authors', () => {
  const { system } = P.askPrompt('q', data);
  for (const it of data.items) ok(system.includes(`id: ${it.id}`), `missing ${it.id}`);
  ok(system.includes(data.items[0].author.name));
  ok(system.includes('Never invent'));
});
test('a well-formed reply parses and resolves ids to items', () => {
  const r = P.parseReply('Sure:\n{"answer":"Yes, see below.","matches":[{"id":"cc-analysis-new-grad-2025","reason":"exact"},{"id":"nope","reason":"x"}]}', data);
  ok(r.ok, r.error); eq(r.matches.length, 1); eq(r.matches[0].item.author.name, data.items.find(i => i.id === 'cc-analysis-new-grad-2025').author.name);
});
test('malformed replies fail gracefully', () => {
  for (const bad of ['no json', '{"answer": 1}', '{"matches": []}', '']) {
    const r = P.parseReply(bad, data); eq(r.ok, false, bad); ok(r.error);
  }
});

console.log('\nsharepoint mapping');
const driveItem = {
  id: '01ABC', name: 'Credit card strategy new grad.pptx', webUrl: 'https://contoso.sharepoint.com/sites/x/Deliverables/cc.pptx',
  createdDateTime: '2025-09-03T10:00:00Z', lastModifiedDateTime: '2025-09-04T10:00:00Z',
  createdBy: { user: { displayName: 'Priya Natarajan', email: 'priya.natarajan@example.com' } },
  file: { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  listItem: { fields: { Title: 'Credit card strategy for a new graduate', DeliverableType: 'Credit card analysis',
    Audiences: 'new grad; early career', Topics: ['credit cards', 'rewards'], Client: 'Client 0417', DeliveredOn: '2025-09',
    Pages: 14, Summary: 'Two-card setup for a first job.', Outline: '- One\n- Two\nThree', Contributors: 'Marcus Bell <marcus.bell@example.com>' } },
};
test('a Graph drive item maps to a catalogue item', () => {
  const it = SP.mapDriveItem(driveItem);
  eq(it.id, 'credit-card-strategy-new-grad'); eq(it.type, 'Credit card analysis');
  eq(it.audiences.join('|'), 'new grad|early career'); eq(it.topics.join('|'), 'credit cards|rewards');
  eq(it.date, '2025-09'); eq(it.format, 'slides'); eq(it.pages, 14);
  eq(it.file, driveItem.webUrl); eq(it.outline.join('|'), 'One|Two|Three');
  eq(it.contributors[0].email, 'marcus.bell@example.com');
});
test('author falls back to Created By when the author columns are empty', () => {
  const it = SP.mapDriveItem(driveItem);
  eq(it.author.name, 'Priya Natarajan'); eq(it.author.email, 'priya.natarajan@example.com');
  const withCols = SP.mapDriveItem({ ...driveItem, listItem: { fields: { ...driveItem.listItem.fields, AuthorName: 'Someone Else', AuthorEmail: 'else@example.com' } } });
  eq(withCols.author.name, 'Someone Else');
});
test('date falls back to the created date; format comes from the extension', () => {
  const it = SP.mapDriveItem({ ...driveItem, name: 'x.pdf', listItem: { fields: {} } });
  eq(it.date, '2025-09'); eq(it.format, 'pdf'); eq(it.title, 'x');
});
test('custom column names are honoured', () => {
  const it = SP.mapDriveItem({ ...driveItem, listItem: { fields: { Kind: 'Insurance review' } } }, { ...SP.DEFAULT_COLUMNS, type: 'Kind' });
  eq(it.type, 'Insurance review');
});
test('mapped items search like demo items', () => {
  const it = SP.mapDriveItem(driveItem);
  const d = { taxonomy: data.taxonomy, items: [it] };
  eq(S.search(d, 'credit card analysis for a new grad').results[0]?.item.id, it.id);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
