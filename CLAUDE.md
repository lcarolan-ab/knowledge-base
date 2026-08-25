# Schema: how this wiki is compiled

This repository is an **LLM wiki** — a knowledge base built on compilation rather than
retrieval. You are the compiler. This file is the language spec you compile against.

```
raw/          source files      (immutable — humans write here, you never edit)
   │
   │  ingest / compile          ← you
   ▼
wiki/         build output      (you own this entirely)
   │
   │  lint                      ← tools/wiki.py, deterministic
   ▼
answers       runtime           (query reads wiki/, not raw/)
```

The point of the pattern: knowledge is **compiled once and kept current**, not
re-derived on every question. A query that has to re-read `raw/` is a cache miss and
means the wiki is incomplete — fix the wiki, don't just answer.

## Hard rules

1. **Never edit `raw/`.** It is the source of truth and the audit trail. Humans curate
   it. If a source is wrong, note the error on the wiki page that cites it.
2. **Every claim carries a citation.** Any sentence asserting a fact about the world
   cites its source as `[^source-id]`. Synthesis you performed yourself is marked
   `[^synthesis]` — that is an honest citation, not an escape hatch.
3. **Cite ids that exist.** Every `[^id]` must match a `source_id` in `raw/`, and must
   also appear in the page's frontmatter `sources:` list. `wiki lint` enforces this.
4. **Contradictions are content, not errors.** When sources disagree, do not average
   them into mush and do not silently pick a winner. Mark the page `status: contested`
   and write a `## Contradictions` section naming who claims what. Lint fails a
   `contested` page that lacks one.
5. **Supersede, don't delete.** When a new source overturns a claim, keep the old claim,
   mark it superseded, link the new one, and date it. Deleted knowledge cannot be
   audited.
6. **No numeric confidence scores.** Use the categorical `status` field. Numeric
   confidence is false precision — it invents a number nobody computed [^llm-wiki-v2].

## Page frontmatter

```yaml
---
title: Compilation over retrieval
type: concept            # concept | entity | comparison | question | overview
status: established      # established | contested | provisional | superseded
updated: 2026-08-25      # the date YOU last compiled this page
sources:                 # every source_id cited in the body
  - karpathy-llm-wiki-gist
  - jibrain-response
---
```

`status` values:

| value | meaning |
|---|---|
| `established` | multiple sources agree, or one authoritative source and no dissent |
| `contested` | sources disagree — **requires** a `## Contradictions` section |
| `provisional` | one source, unreplicated, or your own synthesis |
| `superseded` | overturned; must link forward to the page that replaced it |

## Link conventions

- **Page links:** `[[concepts/compilation-over-retrieval]]` — a path under `wiki/`
  without the `.md`. Lint resolves every one and fails on breaks.
- **Citations:** `[^karpathy-llm-wiki-gist]` — a `source_id` from `raw/`.
- Aim for 3+ outbound links per page. A page nothing links to is an orphan, and lint
  reports it — knowledge that cannot be reached is not knowledge.

## The four operations

### ingest — add a source

1. Human drops a file in `raw/` with provenance frontmatter (`source_id`, `url`,
   `author`, `published`, `added`, `capture`).
2. Read it fully. Do not skim.
3. Find every existing page it touches — `grep`, and read `wiki/index.md`. Expect to
   update **10–15 pages per source**, not to write one new page. Integration is the
   work; a new page is the exception.
4. For each affected page: fold in the new claim, add the citation, update `sources:`
   and `updated:`, and check whether the new source *contradicts* what is there. If it
   does, apply rule 4.
5. Append to `wiki/log.md`.
6. Run `python3 tools/wiki.py lint` and fix what it reports.

### compile — rebuild stale pages

`wiki lint` reports pages whose cited sources are newer than the page itself — the same
dependency check `make` does. Recompile those pages against their current sources.

### query — answer from the wiki

1. Search `wiki/`, not `raw/`. Read the pages, follow the links.
2. Answer with citations, carried through from the pages.
3. If the wiki could not answer, that is a **compiler bug**. Either the source was never
   ingested, or it was ingested badly. Say so, then fix it.
4. If the answer contained genuine new synthesis, **file it back as a page.** Insight
   that stays in the chat log is lost work.
5. Append the query and its verdict to `wiki/log.md`.

### lint — check the build

`python3 tools/wiki.py lint`. Deterministic, no API key, no LLM. It checks the
mechanical invariants only — broken links, uncited claims, missing contradiction
sections, stale pages, uningested sources. It cannot tell you whether a page is *true*.
That judgement is yours, and it is the part that does not automate.

## What this schema deliberately does not do

The pattern has known gaps, argued in the sources and left visible here rather than
papered over:

- **No epistemic filter.** Nothing asks whether a claim is falsifiable, so the wiki
  accumulates confident nonsense at the same rate as knowledge [^four-structural-gaps].
  `status` is a weak proxy, applied by the same model that wrote the page.
- **No decay.** Pages do not age out. A claim ingested once and never challenged looks
  identical to one that survived scrutiny [^four-structural-gaps].
- **Human gate on writes.** Ingest is run deliberately, not on a hook, because
  event-driven auto-ingest assumes reliable LLMs and corrupts silently when that
  assumption breaks [^llm-wiki-v2].

See [[questions/open-questions]].

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
