---
title: LLM wiki vs RAG
type: comparison
status: established
updated: 2026-08-25
sources:
  - karpathy-llm-wiki-gist
  - jibrain-response
  - llm-wiki-v2
  - four-structural-gaps
---

# LLM wiki vs RAG

The pattern is defined by contrast with retrieval-augmented generation: instead of
retrieve-augment-generate, an LLM incrementally builds and maintains a persistent wiki
that sits between the user and the raw sources [^karpathy-llm-wiki-gist]. A second
reader states the same distinction as "compilation over retrieval" — rather than
repeatedly deriving answers from raw sources, the LLM maintains a wiki that integrates
new information into existing structures [^jibrain-response]. See
[[concepts/compilation-over-retrieval]].

| | RAG | LLM wiki |
|---|---|---|
| when work happens | at query time | at ingest time [^karpathy-llm-wiki-gist] |
| unit stored | chunk + embedding | interlinked page [^karpathy-llm-wiki-gist] |
| new document | indexed | integrated into 10–15 pages [^karpathy-llm-wiki-gist] |
| conflicting sources | both retrieved, conflict left to reader | flagged and recorded [^karpathy-llm-wiki-gist] |
| artifact over time | index grows | wiki compounds [^karpathy-llm-wiki-gist] |
| human-readable without the model | poorly | yes [^synthesis] |
| cost profile | cheap write, repeated read | expensive write, cheap read [^synthesis] |

## Where the contrast is overdrawn

The dichotomy is cleaner in the framing than in practice, and treating it as exclusive
would be a misreading of the sources themselves [^synthesis]. The gist allows optional
CLI tooling for semantic search at scale [^karpathy-llm-wiki-gist]; the extension
proposal wants BM25, vector search and graph traversal fused by reciprocal rank fusion
[^llm-wiki-v2]; and the most mature reported deployment runs hybrid BM25 + vector search
*alongside* the compiled layer [^jibrain-response]. See [[entities/jibrain]] and
[[entities/agentmemory]].

The reconciliation is that these operate at different layers rather than competing.
Retrieval is how you *find* the right page in a wiki too large to read; compilation is
what made the page worth finding [^synthesis]. What the wiki removes is not retrieval
but the requirement that synthesis happen fresh, under time pressure, on every question.

## What the wiki gives up

RAG's weakness — no integration — is also a safety property. A retriever returns what
the documents said; a compiler returns what it concluded they said, and it can be wrong
in ways that are invisible afterwards, because the compiled page no longer shows its
reasoning [^synthesis]. The critique that the system accumulates "confident nonsense at
the same rate" as knowledge applies specifically to the compiled layer, since a
retriever has no opinions to be confidently wrong with [^four-structural-gaps]. This is
what makes [[concepts/provenance-log]] and citation discipline load-bearing rather than
decorative, and it is the cost side of [[concepts/knowledge-lifecycle]].

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^synthesis]: compiled in this repository
