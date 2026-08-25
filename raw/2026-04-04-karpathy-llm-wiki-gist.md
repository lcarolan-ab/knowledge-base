---
source_id: karpathy-llm-wiki-gist
title: "llm-wiki.md"
author: Andrej Karpathy
url: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
published: 2026-04-04
added: 2026-08-25
kind: gist
capture: summary
---

# llm-wiki.md — capture notes

> **Capture fidelity: SUMMARY.** This file is a fetched summary of the gist, not a
> verbatim copy. Quoted phrases below appeared as quotes in the fetched summary.
> Re-capture as `verbatim` before relying on exact wording.

## The core pattern

Instead of traditional RAG (retrieve-augment-generate), an LLM **incrementally builds
and maintains a persistent wiki** — a structured collection of markdown files that sits
between the user and the raw sources. As new documents arrive, the LLM does not merely
index them: it reads, extracts, and integrates them into existing pages, updating
cross-references and flagging contradictions.

Stated insight: "the wiki is a persistent, compounding artifact" rather than something
re-derived on every query.

The gist is explicitly written to be pasted into a coding agent (Codex, Claude Code,
OpenCode). It communicates the high-level idea; the agent builds the specifics in
collaboration with the user.

## Three-layer architecture

1. **Raw sources** — immutable, curated documents (articles, papers, data).
2. **The wiki** — LLM-generated and maintained markdown: summaries, entity pages,
   concept pages, comparisons, an overview, a synthesis. The LLM owns this layer
   entirely.
3. **The schema** — a configuration document (e.g. `CLAUDE.md` / `AGENTS.md`) telling
   the LLM how to structure the work and hold consistency.

## Main operations

- **Ingest** — process new sources one at a time, updating 10–15 related wiki pages
  per source.
- **Query** — search the wiki for relevant pages, synthesise an answer with citations,
  and file valuable discoveries back as new pages.
- **Lint** — periodically health-check for contradictions, orphaned pages, stale
  claims, and missing cross-references.

## Supporting infrastructure

- `index.md` — a content-oriented catalog of all wiki pages.
- `log.md` — an append-only chronological record of ingests and queries.
- Optional CLI tools (e.g. `qmd`) for semantic search at scale.

## Why it is claimed to work

The tedious bookkeeping — updating cross-references, holding consistency — becomes the
LLM's responsibility, while humans focus on sourcing, direction and interpretation.
This is claimed to remove the maintenance burden that usually causes wikis to be
abandoned.

## Reception

Widely circulated in April 2026; the companion post reported very large view counts and
the gist accumulated thousands of stars and forks, plus many community
re-implementations. (Engagement figures vary between secondary reports and are not
independently verified here.)
