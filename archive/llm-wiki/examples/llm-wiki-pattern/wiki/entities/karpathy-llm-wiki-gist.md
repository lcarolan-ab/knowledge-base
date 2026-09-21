---
title: llm-wiki.md (Karpathy gist)
type: entity
status: established
updated: 2026-08-25
sources:
  - karpathy-llm-wiki-gist
  - jibrain-response
  - four-structural-gaps
  - llm-wiki-v2
---

# llm-wiki.md (Karpathy gist)

The originating document, published 2026-04-04 [^karpathy-llm-wiki-gist]. It is an
*idea file* rather than an implementation: written to be pasted into a coding agent —
Codex, Claude Code, OpenCode — to communicate the high-level idea, with the agent
building the specifics in collaboration with the user [^karpathy-llm-wiki-gist].

That framing explains much of the response literature. A document that deliberately
under-specifies will be read by implementers as incomplete, and every critique below is
in some measure a critique of a spec that declined to be one [^synthesis].

## What it specifies

- **Three layers**: raw sources (immutable, curated) → the wiki (LLM-owned markdown:
  summaries, entity pages, concept pages, comparisons, an overview, a synthesis) → the
  schema, a config document such as `CLAUDE.md` [^karpathy-llm-wiki-gist]. See
  [[concepts/compilation-over-retrieval]].
- **Three operations**: ingest (one source at a time, updating 10–15 related pages),
  query (search the wiki, answer with citations, file discoveries back as pages), lint
  (health-check for contradictions, orphans, stale claims, missing cross-references)
  [^karpathy-llm-wiki-gist]. See [[concepts/contradiction-detection]].
- **Two support files**: `index.md`, a content-oriented catalog, and `log.md`, an
  append-only record of ingests and queries [^karpathy-llm-wiki-gist]. See
  [[concepts/provenance-log]].
- Optional CLI tooling such as `qmd` for semantic search at scale
  [^karpathy-llm-wiki-gist].

## Reception

Widely circulated on publication, accumulating thousands of stars and forks and many
community re-implementations [^karpathy-llm-wiki-gist]. Reported engagement figures vary
between secondary accounts and are not independently verified here
[^karpathy-llm-wiki-gist].

The substantive responses fall into two groups. Practitioners with existing systems
adopted specific mechanisms from it while claiming more mature infrastructure of their
own [^jibrain-response] — see [[entities/jibrain]]. Extenders kept the core invariant
and rebuilt the surroundings for scale [^llm-wiki-v2] — see [[entities/agentmemory]].
The dissenting reading rejects the architecture rather than its details, arguing it
lacks epistemic filters, a knowledge lifecycle, negentropy and grounding verification
[^four-structural-gaps]; see [[concepts/knowledge-lifecycle]].

Notably, all three responses restate the core idea the same way, and disagree only about
what must be added to it [^synthesis].

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^synthesis]: compiled in this repository
