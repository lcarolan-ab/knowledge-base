---
title: Compilation over retrieval
type: concept
status: established
updated: 2026-08-25
sources:
  - karpathy-llm-wiki-gist
  - jibrain-response
  - llm-wiki-v2
---

# Compilation over retrieval

The central claim of the pattern: knowledge should be **compiled once and kept
current**, not re-derived on every query [^karpathy-llm-wiki-gist]. An LLM reads raw
sources and integrates them into a persistent set of interlinked markdown pages; queries
then read those pages rather than the sources. The wiki is described as "a persistent,
compounding artifact" [^karpathy-llm-wiki-gist].

This inverts the usual arrangement [^synthesis]. See [[comparisons/wiki-vs-rag]] for the
contrast with retrieval-augmented generation, which re-derives an answer from raw
documents each time it is asked.

## The compiler analogy

The architecture maps onto an ordinary build system, and the mapping is load-bearing
rather than decorative:

| build system | LLM wiki |
|---|---|
| source files | `raw/` — immutable, human-curated [^karpathy-llm-wiki-gist] |
| compiler | the LLM |
| object files / binary | `wiki/` — LLM-owned [^karpathy-llm-wiki-gist] |
| language spec / build config | the schema, e.g. `CLAUDE.md` [^karpathy-llm-wiki-gist] |
| test suite | lint [^karpathy-llm-wiki-gist] |
| running the program | query |

Taking the analogy seriously produces a real dependency check: a page is **stale** when a
source it cites was added after the page was last compiled, exactly as an object file is
stale when its source is newer [^synthesis]. This repository implements that check in
`tools/wiki.py status`, which is why staleness here is mechanical rather than a matter
of judgement [^synthesis].

## Why it is claimed to work

The argument is economic rather than technical. Wikis fail because the bookkeeping —
updating cross-references, holding terminology consistent, noticing that a new document
contradicts an old page — is tedious enough that humans stop doing it. Handing that
bookkeeping to the LLM is what removes the maintenance burden that usually causes wikis
to be abandoned [^karpathy-llm-wiki-gist]. Humans keep the parts they are good at:
sourcing, direction, interpretation [^karpathy-llm-wiki-gist]. See
[[concepts/the-maintenance-burden]].

Independent practitioner readings converge on the same summary of the core idea, which
is weak evidence that the idea is at least clearly stated: one describes it as
"compilation over retrieval" and adopts five of its mechanisms [^jibrain-response], and
another retains "stop re-deriving, start compiling" as the invariant while arguing the
surrounding machinery needs replacing at scale [^llm-wiki-v2].

## The cost

Compilation front-loads work. Every source must be integrated into an estimated 10–15
existing pages rather than simply indexed [^karpathy-llm-wiki-gist], which is far more
expensive per document than embedding it. The bet is that this cost is paid once while
retrieval cost is paid on every query — and that integration catches contradictions a
retriever would silently return side by side. See
[[concepts/contradiction-detection]].

The unresolved half of the bet is what happens to compiled pages over time, since
compilation produces an artifact that can rot [^synthesis]. See
[[concepts/knowledge-lifecycle]] and [[questions/open-questions]].

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^synthesis]: compiled in this repository
