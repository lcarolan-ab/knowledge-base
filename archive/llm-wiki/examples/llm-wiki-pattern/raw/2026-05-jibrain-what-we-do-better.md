---
source_id: jibrain-response
title: "What I Learned from Karpathy's LLM Wiki — and What We Already Do Better"
author: Joi
url: https://gist.github.com/Joi/120f86eb39758ef75deb5e6145e5a717
published: 2026-05
added: 2026-08-25
kind: gist
capture: summary
---

# jibrain response — capture notes

> **Capture fidelity: SUMMARY.** Fetched summary, not verbatim.

A practitioner response from someone already running a large personal knowledge system
("jibrain"), reading the gist against an existing operational deployment.

## Key learning taken from the gist

The core pattern is **compilation over retrieval** rather than RAG: instead of
repeatedly deriving answers from raw sources, an LLM maintains a persistent wiki that
integrates new information into existing structures — updating pages, revising
summaries, noting conflicts.

## Five ideas adopted from the gist

1. **Chapter-level book extraction** — process books semantically by chapter rather than
   by page, to build coherent summaries and cross-references.
2. **Contradiction detection** — explicitly check for conflicts between pages, outdated
   claims and missing connections. The author names this as *their own system's biggest
   gap*.
3. **Knowledge provenance log** — an append-only chronological record of ingestion
   events, greppable.
4. **Query answers as wiki content** — conversations producing genuine insight should
   become permanent pages, not vanish into chat history.
5. **Type-specific extraction depth** — research reports and blog posts warrant
   fundamentally different processing.

## Claims of a more mature implementation

The author asserts jibrain is "significantly more mature" than the pattern:

- Senzing-powered entity resolution across 5,700+ vault files
- QMD hybrid BM25 + vector search
- Multi-source extraction (URLs, transcripts, APIs, articles)
- Seven-tier quality gating with frontmatter requirements
- Tiered access control with confidential workstreams

Framing: Karpathy's is "the pattern"; theirs is "the operational system".

## Acknowledged gap

The author concedes their system lacks *active knowledge maintenance* — contradiction
detection and provenance tracking — the very operations the gist emphasises. They
conclude those deserve design attention equal to ingestion pipelines.
