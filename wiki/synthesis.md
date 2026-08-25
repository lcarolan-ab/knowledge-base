---
title: Synthesis
type: overview
status: established
updated: 2026-08-25
sources:
  - karpathy-llm-wiki-gist
  - four-structural-gaps
  - jibrain-response
  - llm-wiki-v2
---

# Synthesis

*What this wiki currently believes about the LLM wiki pattern, compiled from four
sources. Start here; follow the links.*

## The idea

Stop re-deriving answers from raw documents on every question. Have an LLM compile the
documents once into interlinked markdown pages, keep those pages current as new sources
arrive, and answer from the pages [^karpathy-llm-wiki-gist]. The originating document is
an idea file meant to be pasted into a coding agent, not an implementation
[^karpathy-llm-wiki-gist] — see [[entities/karpathy-llm-wiki-gist]].

Full argument in [[concepts/compilation-over-retrieval]]; the contrast that defines it in
[[comparisons/wiki-vs-rag]].

## What is agreed

All four sources restate the core the same way and disagree only about what to add
[^synthesis]:

- **Compilation beats retrieval for durable knowledge** [^karpathy-llm-wiki-gist]
  [^jibrain-response] [^llm-wiki-v2].
- **The real problem is maintenance, not generation** — wikis die of bookkeeping, and
  the bet is that an LLM will do bookkeeping tirelessly
  [^karpathy-llm-wiki-gist]. This is a claim about labour, not intelligence
  [^synthesis]. See [[concepts/the-maintenance-burden]].
- **Contradiction handling is the load-bearing operation.** The one practitioner report
  from a mature deployment names it as their biggest gap despite having solved retrieval
  [^jibrain-response]. See [[concepts/contradiction-detection]] and [[entities/jibrain]].
- **Provenance must be append-only**, because the compiled layer is mutable by design
  [^karpathy-llm-wiki-gist] [^jibrain-response]. See [[concepts/provenance-log]].

## What is contested

- **Should pages decay?** Two incompatible lifecycles are proposed — one ordered by
  scrutiny [^four-structural-gaps], one by time and reinforcement [^llm-wiki-v2]. See
  [[concepts/knowledge-lifecycle]].
- **Numbers or labels for trust?** Computed confidence scores [^llm-wiki-v2] against the
  objection that they are "false precision" [^llm-wiki-v2]. See
  [[concepts/confidence-scoring]].
- **How automatic should ingest be?** Event-driven hooks [^llm-wiki-v2] against manual
  human gating on writes [^llm-wiki-v2]. See [[concepts/the-maintenance-burden]].

## The strongest objection

That the architecture has no immune system. It lacks epistemic filters, a knowledge
lifecycle, negentropy and grounding verification, so it accumulates "confident nonsense
at the same rate" as knowledge and cannot distinguish an insight that survived
stress-testing from a note written once and never challenged [^four-structural-gaps].

This objection is not answered by the sources, and it is not answered by this repository
either [^synthesis]. What can be automated here is *consistency* — links resolve,
citations exist, contested pages show their contradictions. Whether a page is **true**
is checked by nobody but the reader. That gap is the honest state of the pattern, and
pretending otherwise would be the most likely way for a wiki like this to mislead
someone [^synthesis]. See [[questions/open-questions]].

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^synthesis]: compiled in this repository
