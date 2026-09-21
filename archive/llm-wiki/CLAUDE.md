# Schema: how this library is compiled

This repository is a **deliverables library built as an LLM wiki** — a knowledge base
built on compilation rather than retrieval. The raw sources are the deliverables a
firm has produced for its clients (credit card spend analyses, cash flow projections,
philanthropic giving summaries, estate reviews, performance summaries, internal
methodology memos). You are the compiler. This file is the language spec you compile
against.

```
raw/          the deliverables   (immutable — humans add them, you never edit)
   │
   │  ingest / compile           ← you
   ▼
wiki/         compiled pages     (you own this entirely: clients, services, topics)
   │
   │  lint                       ← tools/wiki.py, deterministic
   ▼
answers       runtime            (query reads wiki/, not raw/)
```

The point of the pattern: what the firm knows across its deliverables is **compiled
once and kept current**, not re-derived from the documents on every question. A query
that has to re-read `raw/` is a cache miss and means the library is incomplete — fix
the library, don't just answer.

**Everything in `raw/` and `wiki/` is synthetic.** The clients, the company names and
every figure were invented for this demonstration. The previous demo corpus (the LLM
wiki pattern compiled from its own literature) is kept under `examples/llm-wiki-pattern/`.

## Hard rules

1. **Never edit `raw/`.** A deliverable is the record of what the firm told a client.
   If a deliverable is wrong, note the error on the page that cites it; if a later
   deliverable revises it, that is a supersession (rule 5), not an edit.
2. **Every claim carries a citation.** Any sentence asserting a fact — a figure, a
   recommendation, a finding — cites the deliverable it came from as `[^source-id]`.
   Synthesis you performed yourself is marked `[^synthesis]` — that is an honest
   citation, not an escape hatch.
3. **Cite ids that exist.** Every `[^id]` must match a `source_id` in `raw/`, and must
   also appear in the page's frontmatter `sources:` list. `wiki lint` enforces this.
4. **Contradictions are content, not errors.** When two deliverables disagree about the
   same thing — the same charge categorised two ways, a projection's assumption
   contradicted by a later measurement — do not average them and do not silently pick a
   winner. Mark the page `status: contested` and write a `## Contradictions` section
   naming which deliverable claims what. Lint fails a `contested` page that lacks one.
5. **Supersede, don't delete.** When a revised deliverable overturns an earlier one,
   keep the old conclusion on the page, mark it superseded, link the revision, and date
   it. The firm's earlier advice cannot be audited if it disappears.
6. **No numeric confidence scores.** Use the categorical `status` field. A score
   assembled from source count and recency has no units and no calibration.
7. **Never invent a client, a figure or a deliverable.** If the library cannot answer,
   say so and name which deliverable is missing.

## Page types

| type | one page per | what it compiles |
|---|---|---|
| `client` | client household or entity | everything the firm has told that client, across deliverables; open items; superseded advice |
| `service` | kind of deliverable | what it covers, the method, who has one, what it reliably finds, how it has held up |
| `topic` | recurring theme | a finding or piece of advice that recurs across clients or deliverables |
| `question` | — | what the deliverables raise and do not settle, each with the deliverable that would settle it |
| `overview` | — | `synthesis` (start here), `index` (generated), `log` (append-only) |

## Page frontmatter

```yaml
---
title: Kessler family
type: client              # client | service | topic | question | overview
status: established       # established | contested | provisional | superseded
updated: 2026-09-21       # the date YOU last compiled this page
sources:                  # every source_id cited in the body
  - kessler-card-analysis-2025
  - kessler-cash-flow-2026-05
---
```

`status` values:

| value | meaning |
|---|---|
| `established` | multiple deliverables agree, or one authoritative deliverable and no dissent |
| `contested` | deliverables disagree — **requires** a `## Contradictions` section |
| `provisional` | one deliverable, unreplicated, or your own synthesis |
| `superseded` | overturned; must link forward to the page that replaced it |

## Deliverable frontmatter (`raw/`)

```yaml
---
source_id: kessler-cash-flow-2026-05         # client-deliverable-period; the citation key
title: "Cash flow projection 2026–2035 — Kessler family trust (May 2026 revision)"
author: Planning team
client: Kessler family
deliverable: Cash flow projection
period: 2026-2035
published: 2026-05-20                         # delivered on
added: 2026-05-20                             # added to the library; drives staleness
kind: deliverable
capture: synthetic                            # synthetic | verbatim | summary
---
```

File name: `raw/<added>-<source_id>.md`.

## Link conventions

- **Page links:** `[[clients/kessler]]` — a path under `wiki/` without the `.md`. Lint
  resolves every one and fails on breaks.
- **Citations:** `[^kessler-cash-flow-2026-05]` — a `source_id` from `raw/`.
- Aim for 3+ outbound links per page. A page nothing links to is an orphan, and lint
  reports it — knowledge that cannot be reached is not knowledge.

## The four operations

### ingest — add a deliverable

1. Human drops a file in `raw/` with the provenance frontmatter above.
2. Read it fully. Do not skim. Figures matter; carry them over exactly.
3. Find every existing page it touches — `grep`, and read `wiki/index.md`. A deliverable
   touches **at least** its client page, its service page and every topic page whose
   theme it bears on. Expect to update several pages, not to write one new one. A new
   client or service page is the exception, created only when none exists.
4. For each affected page: fold in the new claim, add the citation, update `sources:`
   and `updated:`, and ask explicitly whether the deliverable *contradicts* or
   *supersedes* what is there. If it does, apply rule 4 or rule 5.
5. Append to `wiki/log.md`.
6. Run `python3 tools/wiki.py lint` and fix what it reports.

### compile — rebuild stale pages

`wiki lint` reports pages whose cited deliverables are newer than the page itself —
the same dependency check `make` does. Recompile those pages against their current
deliverables.

### query — answer from the library

1. Search `wiki/`, not `raw/`. Read the pages, follow the links.
2. Answer with citations, carried through from the pages. Citations are deliverable
   ids, so the reader can open the deliverable itself. For "which clients" and "what
   have we done" questions, answer with a list or table naming the deliverable behind
   each row.
3. If the library could not answer, that is a **compiler bug**. Either the deliverable
   was never ingested, or it was ingested badly. Say so, then fix it.
4. If the answer contained genuine new synthesis, **file it back as a page.** Insight
   that stays in the chat log is lost work.
5. Append the query and its verdict to `wiki/log.md`.

### lint — check the build

`python3 tools/wiki.py lint`. Deterministic, no API key, no LLM. It checks the
mechanical invariants only — broken links, uncited claims, missing contradiction
sections, stale pages, uningested deliverables. It cannot tell you whether a page is
*true*, or whether a figure was carried over correctly. That judgement is yours, and it
is the part that does not automate.

## What this schema deliberately does not do

- **No epistemic filter.** Nothing checks that a figure on a page matches the
  deliverable. A well-formed citation to a real deliverable can still sit next to a
  wrong number. `status` is a weak proxy, applied by the same model that wrote the page.
- **No decay.** Pages do not age out. A client page compiled once and never revisited
  looks identical to one that survived four deliverables.
- **Human gate on writes.** Ingest is run deliberately, not on a hook, because
  event-driven auto-ingest assumes reliable LLMs and corrupts silently when that
  assumption breaks.

See [[questions/open-questions]].
