---
title: Log
type: overview
status: established
updated: 2026-09-21
sources: []
---

# Log

Append-only. Never rewrite an entry; correct it with a later one.

---

**2026-09-21 · bootstrap** — Corpus replaced. The previous demo (the LLM wiki pattern
compiled from its own literature) moved to `examples/llm-wiki-pattern/`. New subject:
a library of the firm's deliverables for three synthetic client households. Page types
changed to `client | service | topic | question | overview`.

**2026-09-21 · ingest** `kessler-cash-flow-2025-11`, `kessler-card-analysis-2025`,
`abernathy-ruiz-card-analysis-2025` — First three deliverables. Created
`clients/kessler`, `clients/abernathy-ruiz`, `services/credit-card-spend-analysis`,
`services/cash-flow-projection`, `topics/unused-subscriptions`. No contradictions.

**2026-09-21 · ingest** `abernathy-ruiz-cash-flow-2026`,
`okonkwo-estate-liquidity-2026` — Created `clients/okonkwo`,
`services/estate-and-liquidity-review` (provisional, one source),
`topics/concentrated-stock-positions`. The Abernathy-Ruiz projection names its own
flat-spend assumption as fragile; filed as open question 1.

**2026-09-21 · ingest** `abernathy-ruiz-philanthropy-2025` — **Contradiction.** The
giving summary deducts $2,900 of a $4,500 gala table the card analysis had categorised
as charitable in full, and excludes $600 of raffle purchases the card analysis counted.
Created `topics/spend-categorisation` as `contested` with both positions. Created
`services/philanthropic-giving-summary`, `topics/giving-appreciated-shares`.

**2026-09-21 · ingest** `kessler-cash-flow-2026-05` — **Supersession.** The May
revision withdraws the November edition's "sustainable indefinitely" verdict after the
lake house purchase. Kept the old claim on `clients/kessler`, marked superseded and
dated; added the side-by-side table. Created `topics/funding-a-large-purchase`.

**2026-09-21 · ingest** `okonkwo-philanthropy-2025` — Confirms share-giving in
practice ($96,000 of gains avoided) and quantifies the foundation's 14% admin ratio.
Updated `clients/okonkwo`, `services/philanthropic-giving-summary`,
`topics/giving-appreciated-shares`, `topics/concentrated-stock-positions`,
`services/estate-and-liquidity-review`.

**2026-09-21 · ingest** `kessler-performance-2026q2` — First deliverable that checks an
earlier projection: realised gains $118,000 against $210,000 estimated. Not a
contradiction (same plan, better lot selection); recorded as a refinement on
`topics/funding-a-large-purchase` and `services/cash-flow-projection`. Created
`services/investment-performance-summary` (provisional).

**2026-09-21 · ingest** `firm-spend-categorisation-standard-v3` — Third position on the
gala table ("events & memberships"). `topics/spend-categorisation` stays contested with
three positions; the standard says 2025 analyses are not restated, so the disagreement
is permanent. Filed open question 3 (cross-version comparison). Touched 6 pages.

**2026-09-21 · compile** — `synthesis` rewritten as "What the library knows";
`questions/open-questions` compiled with five questions; index regenerated; lint clean.
