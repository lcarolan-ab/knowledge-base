// demo.js — canned responses so every feature works with no API key.
//
// The demo deliverable is deliberately awkward: it is the first analysis produced
// under the new categorisation standard, and its numbers contradict an assumption a
// compiled page currently carries. That is the test worth running on this pattern —
// does the compiler record the disagreement, or smooth it away?
//
// Everything here is synthetic. No real client, firm or figure.

const today = () => new Date().toISOString().slice(0, 10);

export const DEMO_SOURCE = {
  id: 'abernathy-ruiz-card-analysis-2026h1',
  title: 'Credit card spend analysis — Abernathy-Ruiz household, first half 2026',
  author: 'Client analytics team',
  client: 'Abernathy-Ruiz household',
  deliverable: 'Credit card spend analysis',
  period: '2026 H1',
  url: '',
  published: today(),
  added: today(),
  kind: 'deliverable',
  capture: 'synthetic',
  body: `Credit card spend analysis — Abernathy-Ruiz household, 1 January to 30 June 2026.
Produced under spend categorisation standard version 3. The 2025 analysis used
version 2; charitable and dining totals are not directly comparable.

Headline: first-half spend was $107,200 on two cards (the recommended consolidation
from three cards was completed in February). Annualised, that is $214,400 — 14%
above the $187,400 the 2026–2030 cash flow projection carries forward as flat.

Category detail (H1 2026, annualised in brackets):
- Travel $31,800 ($63,600). 300,000 of the 412,000 unredeemed points were redeemed
  against the April trip, worth about $4,500.
- Household & retail $22,100 ($44,200).
- Dining $16,900 ($33,800) — 29% above the 2025 run rate of $26,200. The standing
  Friday reservation and weekday lunches identified last year continue.
- Children & education $9,400 ($18,800).
- Subscriptions $5,100 ($10,200). Of the nine subscriptions flagged for cancellation
  in the 2025 analysis, six were cancelled and three are still billing — $780 a year
  annualised.
- Events & memberships $4,800: the 2026 Harbor Arts Gala table, categorised under
  version 3 as events & memberships and flagged possible-charitable. Deductibility is
  for the giving summary to determine.
- Other $17,100 ($34,200).

Findings:
1. Spending is running well ahead of the cash flow projection's flat assumption. At
   the H1 run rate, savings capacity falls from about $107,600 to about $80,600 before
   any school decision.
2. Dining is the fastest-growing category for the second year.
3. Three cancellations did not stick; two of the three have re-billed under a
   different merchant name.

Recommendations: revisit the cash flow projection with H1 actuals; cancel the three
remaining subscriptions at the card level rather than with the merchant; set a dining
budget for H2.`,
};

// ---------------------------------------------------------------- ingest

const SID = DEMO_SOURCE.id;
const cite = `[^${SID}]`;

function bodyOf(pages, slug) {
  const pg = pages.find(p => p.slug === slug);
  return pg ? pg.body : '';
}

function withFootnote(body, added) {
  const def = `[^${SID}]: raw/${added}-${SID}.md`;
  if (body.includes(def)) return body;
  // Insert before the synthesis footnote so the definitions stay grouped.
  const marker = '[^synthesis]: compiled in this repository';
  return body.includes(marker)
    ? body.replace(marker, `${def}\n${marker}`)
    : body.trimEnd() + `\n${def}\n`;
}

function replaceOrAppend(body, needle, replacement, appendUnder) {
  if (needle && body.includes(needle)) return body.replace(needle, replacement);
  if (appendUnder && body.includes(appendUnder))
    return body.replace(appendUnder, `${appendUnder}\n\n${replacement}`);
  return body.trimEnd() + `\n\n${replacement}\n`;
}

// Builds the canned compiler reply against the wiki AS IT CURRENTLY STANDS, so the
// page bodies in the proposal are complete and the diffs show only what changed.
export function demoIngestReply(added, pages) {
  const edits = [];

  // 1. The client page: the projection's assumption is now contradicted → contested.
  {
    let b = bodyOf(pages, 'clients/abernathy-ruiz');
    b = replaceOrAppend(b,
      'See [[services/credit-card-spend-analysis]] and\n[[topics/unused-subscriptions]].',
      'See [[services/credit-card-spend-analysis]] and\n[[topics/unused-subscriptions]].\n\n' +
      'First-half 2026 spend was $107,200 on the two remaining cards, annualising to ' +
      '$214,400, with dining running 29% above its 2025 rate; the analysis is the first ' +
      `for the household under version 3 of the categorisation standard ${cite}.`);
    b = replaceOrAppend(b,
      '## Open items across deliverables',
      '## Contradictions\n\n' +
      '**Is card spend flat?**\n\n' +
      '- **The cash flow projection assumes it is.** Card spend is carried forward at the ' +
      '2025 level of $187,400 for the whole 2026–2030 horizon, and savings capacity of ' +
      '$107,600 depends on it [^abernathy-ruiz-cash-flow-2026].\n' +
      '- **The H1 2026 card analysis says it is not.** The first-half run rate annualises to ' +
      '$214,400, 14% higher, which alone takes savings capacity to about $80,600 before the ' +
      `school decision ${cite}.\n\n` +
      'The projection itself named this assumption as its most fragile input ' +
      '[^abernathy-ruiz-cash-flow-2026]. The two deliverables are not reconciled until the ' +
      'projection is revised; until then the client page carries both [^synthesis].\n\n' +
      '## Open items across deliverables');
    b = replaceOrAppend(b,
      '- The cash flow\'s flat-spend assumption has not yet been checked against 2026 card\n' +
      '  data [^synthesis]. See [[questions/open-questions]].',
      '- The cash flow\'s flat-spend assumption is contradicted by the H1 2026 card data; ' +
      `see Contradictions above ${cite}. A revised projection is the open item ` +
      '[^synthesis]. See [[questions/open-questions]].');
    b = withFootnote(b, added);
    edits.push({
      slug: 'clients/abernathy-ruiz', action: 'update', title: 'Abernathy-Ruiz household',
      type: 'client', status: 'contested', updated: added,
      sources: ['abernathy-ruiz-card-analysis-2025', 'abernathy-ruiz-cash-flow-2026',
                'abernathy-ruiz-philanthropy-2025', SID],
      note: 'The projection carries card spend flat; the new analysis measures it 14% higher. ' +
            'Recorded as a contradiction rather than silently updating the projection\'s number.',
      body: b,
    });
  }

  // 2. The categorisation topic: a third treatment of the same recurring charge.
  {
    let b = bodyOf(pages, 'topics/spend-categorisation');
    b = replaceOrAppend(b,
      '## Why it matters beyond one table',
      '## Why it matters beyond one table\n\n' +
      'The first analysis produced under version 3, the Abernathy-Ruiz H1 2026 card ' +
      'analysis, categorises the 2026 gala table of $4,800 as events & memberships and ' +
      `flags it possible-charitable ${cite}. The client page therefore carries three ` +
      'treatments of the same annual charge across two years, and the H1 analysis itself ' +
      `warns that its dining and charitable totals are not comparable with 2025 ${cite}.`);
    b = withFootnote(b, added);
    edits.push({
      slug: 'topics/spend-categorisation', action: 'update', title: 'Spend categorisation',
      type: 'topic', status: 'contested', updated: added,
      sources: ['abernathy-ruiz-card-analysis-2025', 'abernathy-ruiz-philanthropy-2025',
                'firm-spend-categorisation-standard-v3', SID],
      note: 'Stays contested. Version 3 is now applied in practice, which makes the ' +
            'cross-version comparison problem concrete.',
      body: b,
    });
  }

  // 3. Unused subscriptions: the first follow-up data on whether cancellations happen.
  {
    let b = bodyOf(pages, 'topics/unused-subscriptions');
    b = replaceOrAppend(b,
      'Whether the cancellations happen: no follow-up analysis is in the library yet, so the\n' +
      '$2,340 and $860 are recommendations, not realised savings [^synthesis]. See\n' +
      '[[services/credit-card-spend-analysis]] and [[questions/open-questions]].',
      'Partly answered for one household. The Abernathy-Ruiz H1 2026 analysis found six ' +
      'of the nine flagged subscriptions cancelled and three still billing, two of them ' +
      `re-billed under a different merchant name, for $780 a year annualised ${cite}. ` +
      'Its recommendation is to cancel at the card level rather than with the merchant ' +
      `${cite}. The Kessler follow-up is still outstanding [^synthesis]. See\n` +
      '[[services/credit-card-spend-analysis]] and [[questions/open-questions]].');
    b = withFootnote(b, added);
    edits.push({
      slug: 'topics/unused-subscriptions', action: 'update', title: 'Unused subscriptions',
      type: 'topic', status: 'established', updated: added,
      sources: ['abernathy-ruiz-card-analysis-2025', 'kessler-card-analysis-2025',
                'firm-spend-categorisation-standard-v3', SID],
      note: 'First evidence on whether recommended cancellations actually happen: two thirds did.',
      body: b,
    });
  }

  // 4. Open questions: two of them move.
  {
    let b = bodyOf(pages, 'questions/open-questions');
    b = replaceOrAppend(b,
      'about $17,000 a year, compounding [^abernathy-ruiz-cash-flow-2026]. *Settled by:* the\n' +
      '2026 card analysis for the household. See [[services/cash-flow-projection]].',
      'about $17,000 a year, compounding [^abernathy-ruiz-cash-flow-2026]. **Answered for ' +
      'H1 2026: it does not.** Spend annualises to $214,400, 14% above the assumption ' +
      `${cite}. *Still open:* the revised projection. See [[services/cash-flow-projection]] ` +
      'and [[clients/abernathy-ruiz]].');
    b = replaceOrAppend(b,
      '[^abernathy-ruiz-card-analysis-2025] [^kessler-card-analysis-2025]. *Settled by:* the\n' +
      'next card analysis for either household. See [[topics/unused-subscriptions]].',
      '[^abernathy-ruiz-card-analysis-2025] [^kessler-card-analysis-2025]. **Partly ' +
      `answered:** six of nine happened for one household, three re-billed ${cite}. ` +
      '*Still open:* the Kessler follow-up. See [[topics/unused-subscriptions]].');
    b = withFootnote(b, added);
    edits.push({
      slug: 'questions/open-questions', action: 'update', title: 'Open questions',
      type: 'question', status: 'provisional', updated: added,
      sources: ['abernathy-ruiz-cash-flow-2026', 'firm-spend-categorisation-standard-v3',
                'abernathy-ruiz-card-analysis-2025', 'kessler-card-analysis-2025',
                'okonkwo-estate-liquidity-2026', SID],
      note: 'Questions 1 and 2 now have partial answers; neither is closed.',
      body: b,
    });
  }

  const payload = {
    edits,
    contradictions: [
      `${SID} measures annualised card spend of $214,400; abernathy-ruiz-cash-flow-2026 ` +
      'carries it flat at $187,400 and derives savings capacity from that figure.',
    ],
    log: `ingest ${SID} - first H1 2026 card analysis, first under standard v3. Contradicts ` +
      'the cash flow projection\'s flat-spend assumption: clients/abernathy-ruiz moved to ' +
      'contested. Partial answers to open questions 1 and 2. Touched 4 pages.',
  };

  return `This deliverable contradicts one compiled page, so I have recorded the disagreement rather than quietly replacing the number.

The cash flow projection for this household carries card spend forward flat at $187,400 and builds its savings-capacity figure on that. The new analysis measures a first-half run rate of $214,400. That is a direct conflict with a page the library marks established, so the client page moves to contested and names both sides; the projection is not edited, because it is a record of what was advised in March.

Two open questions gain partial answers (spending is not flat; two thirds of recommended cancellations happened). The categorisation topic stays contested and gets its first version-3 data point.

\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\``;
}

// ----------------------------------------------------------------- query

const A = {
  giving: `**Two households have a philanthropic giving summary in the library, both for tax year 2025.**

- **Abernathy-Ruiz household** — giving of $23,800 (3.9% of AGI), of which $22,200 was deductible; only $2,900 of a $4,500 gala table counted because $1,600 of dinner was received [^abernathy-ruiz-philanthropy-2025]. It produced almost no tax benefit, so the recommendation is to bunch 2026 and 2027 giving into the donor-advised fund in 2026 and to give appreciated RSU shares instead of cash [^abernathy-ruiz-philanthropy-2025].
- **Okonkwo family** — household giving of $162,000 (18% of AGI), $412,000 including the family foundation's grants [^okonkwo-philanthropy-2025]. $110,000 was given in Larkspur Systems shares, avoiding about $96,000 of capital gains; the foundation's 14% administrative cost ratio is the problem, and small grants should move to the DAF [^okonkwo-philanthropy-2025].

Both summaries make the same recommendation: give shares, not cash [^abernathy-ruiz-philanthropy-2025] [^okonkwo-philanthropy-2025]. The Kessler family has no giving summary in the library [^synthesis].

PAGES USED: services/philanthropic-giving-summary, clients/abernathy-ruiz, clients/okonkwo, topics/giving-appreciated-shares`,

  lakehouse: `**The Kesslers were told to liquidate part and borrow the rest, not to sell $1.9 million of appreciated holdings.**

The May 2026 revision of their cash flow projection recommended liquidating $1,000,000 from the taxable portfolio, selling the highest-basis lots first, and borrowing $900,000 on a pledged-asset line at about 6.1%, repaid from RMDs and portfolio income over five to seven years [^kessler-cash-flow-2026-05]. Paying in full from the portfolio would have realised an estimated $210,000 of gains and pushed the net draw above 4%, past the firm's 3.5% ceiling [^kessler-cash-flow-2026-05].

**What happened:** the June sale realised $118,000 of gains, well under the estimate, because of lot selection; the line was set up in June for the July closing [^kessler-performance-2026q2].

**What it cost the plan:** the household moved from a 2.1% net draw with $70,000 of spending headroom to a 3.5% draw with none. The November 2025 projection's "sustainable indefinitely" verdict is **superseded** and the library keeps it as the record of what was advised then [^kessler-cash-flow-2025-11] [^kessler-cash-flow-2026-05].

PAGES USED: topics/funding-a-large-purchase, clients/kessler, services/cash-flow-projection`,

  spending: `**Abernathy-Ruiz dining spend in 2025 was $26,200, 14% of card spend and up 22% on 2024 — the fastest-growing category.**

The 2025 card analysis attributes the rise to weekday lunches near Marco's hospital and a standing Friday reservation, and notes it is the only category growing faster than household income [^abernathy-ruiz-card-analysis-2025]. Total card spend was $187,400 across three cards; travel was the largest category at 31% [^abernathy-ruiz-card-analysis-2025].

For comparison, the Kesslers' 2025 dining was $11,600 (12% of $96,300), with travel at 44% because of a six-week trip to Europe [^kessler-card-analysis-2025].

Two cautions the library records: the cash flow projection carries the $187,400 forward flat and calls that its most fragile assumption [^abernathy-ruiz-cash-flow-2026], and version 3 of the categorisation standard bars comparing dining totals across versions without adjustment, which affects the 2026 analysis [^firm-spend-categorisation-standard-v3].

PAGES USED: clients/abernathy-ruiz, services/credit-card-spend-analysis, topics/spend-categorisation`,

  concentration: `**The Okonkwo family holds 48% of its investable assets in one stock, and every recommendation in the library reduces that position.**

Larkspur Systems shares are $11.2 million at a $1.4 million basis; a 40% fall would remove about $4.5 million of net worth [^okonkwo-estate-liquidity-2026]. The March 2026 estate and liquidity review recommends three channels at once: a 10b5-1 plan selling 10% of the holding a year for four years, a two-year GRAT funded with $3 million of shares, and all charitable giving made in shares [^okonkwo-estate-liquidity-2026].

The giving channel is already in use: $110,000 of shares went to the donor-advised fund in 2025, avoiding about $96,000 of gains, and the 2026 budget is $250,000 of shares aligned with the sale schedule [^okonkwo-philanthropy-2025].

The library records a second, different kind of concentration: the Abernathy-Ruiz household's income depends on $132,000 a year of RSU vesting that ends in March 2028 [^abernathy-ruiz-cash-flow-2026].

Open item: only the giving action is confirmed by a later deliverable; the 10b5-1 filing, GRAT and ILIT are not yet [^synthesis].

PAGES USED: topics/concentrated-stock-positions, clients/okonkwo, services/estate-and-liquidity-review, questions/open-questions`,

  library: `**The library holds ten deliverables for three client households plus one internal standard.**

| client | deliverables in the library |
|---|---|
| Abernathy-Ruiz household | 2025 card analysis, 2026–2030 cash flow projection, 2025 giving summary |
| Kessler family | 2025 card analysis, cash flow projection (Nov 2025 edition, superseded, and May 2026 revision), Q2 2026 performance summary |
| Okonkwo family | March 2026 estate and liquidity review, 2025 giving summary (household and foundation) |
| Internal | spend categorisation standard v3 |

Deliverable types so far: credit card spend analysis, cash flow projection, philanthropic giving summary, estate and liquidity review, investment performance summary, methodology memo [^synthesis].

One item is contested (how a charity gala table is categorised, three answers) and one is superseded (the Kesslers' November 2025 projection) [^firm-spend-categorisation-standard-v3] [^kessler-cash-flow-2026-05]. Ask a narrower question to get the figures.

PAGES USED: synthesis, clients/abernathy-ruiz, clients/kessler, clients/okonkwo`,

  miss: `**The library cannot answer this.**

I searched the compiled pages and found nothing covering it. Diagnosis: **(c) no deliverable covers this** — the ten deliverables in \`raw/\` are the firm's client work and one internal standard, and none touches your question.

That is a gap in \`raw/\`, not a compiler bug, so it is not something I can fix by recompiling — it needs a deliverable added first.

I am deliberately not answering from my own background knowledge. Presenting that as though it came from the library is the one failure that would make everything else here untrustworthy.

PAGES USED: none`,
};

// Loosely route demo queries so each canned answer, and the miss, is reachable.
export function demoAnswer(question) {
  const q = question.toLowerCase();
  const any = (...ts) => ts.some(t => q.includes(t));
  if (any('philanthrop', 'giving', 'charit', 'donor', 'daf', 'foundation', 'gala'))
    return A.giving;
  if (any('lake', 'kessler', 'borrow', 'pledged', 'purchase', 'house', 'supersed'))
    return A.lakehouse;
  if (any('dining', 'credit card', 'card spend', 'subscription', 'points', 'restaurant',
          'abernathy', 'ruiz', 'spend'))
    return A.spending;
  if (any('concentrat', 'larkspur', 'okonkwo', 'estate', 'grat', 'stock', 'rsu', '10b5'))
    return A.concentration;
  if (any('client', 'deliverable', 'library', 'what do we have', 'which', 'list', 'report',
          'analysis', 'projection', 'summary', 'cash flow', 'have we'))
    return A.library;
  return A.miss;
}
