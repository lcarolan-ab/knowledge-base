---
title: jibrain
type: entity
status: provisional
updated: 2026-08-25
sources:
  - jibrain-response
  - karpathy-llm-wiki-gist
---

# jibrain

A personal knowledge system whose author read the gist against an already-running
deployment and published the comparison [^jibrain-response]. Its evidential value is as
a field report: it is the one source describing what the compiled-knowledge problem
looks like after the infrastructure is already built [^synthesis].

Marked `provisional`: every claim about it comes from its own author, and none is
independently verified [^synthesis].

## Claimed capabilities

Entity resolution across 5,700+ vault files, hybrid BM25 + vector search, multi-source
extraction from URLs, transcripts, APIs and articles, seven-tier quality gating with
frontmatter requirements, and tiered access control with confidential workstreams
[^jibrain-response]. The author frames the distinction as Karpathy's being "the pattern"
and theirs "the operational system" [^jibrain-response]. See
[[entities/karpathy-llm-wiki-gist]].

## What it adopted, and what it concedes

Five mechanisms were taken from the gist: chapter-level book extraction, contradiction
detection, a knowledge provenance log, filing query answers back as wiki content, and
type-specific extraction depth [^jibrain-response]. See [[concepts/provenance-log]].

The concession is the more useful finding. Despite that infrastructure, the author names
contradiction detection and provenance tracking — *active knowledge maintenance* — as
their system's biggest gap, and concludes those operations deserve design attention
equal to ingestion pipelines [^jibrain-response].

This is the strongest available evidence for the gist's actual priority ordering
[^synthesis]. A system that solved retrieval thoroughly still lacked the maintenance
operations the gist put at the centre [^jibrain-response] [^karpathy-llm-wiki-gist],
which suggests the two problems are independent and that solving the better-understood
one does not deliver the other. See [[concepts/contradiction-detection]] and
[[concepts/the-maintenance-burden]].

[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^synthesis]: compiled in this repository
