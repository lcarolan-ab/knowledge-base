---
title: Contradiction detection
type: concept
status: established
updated: 2026-08-25
sources:
  - karpathy-llm-wiki-gist
  - jibrain-response
  - four-structural-gaps
  - llm-wiki-v2
---

# Contradiction detection

When a new source disagrees with what the wiki already says, the compiler is supposed to
notice and record the disagreement rather than overwrite or average it. The gist places
this in both ingest (integration flags contradictions as pages are updated) and lint
(a periodic health check for contradictions, orphaned pages, stale claims and missing
cross-references) [^karpathy-llm-wiki-gist].

This is the mechanism that most clearly distinguishes compilation from indexing
[^synthesis]. A retriever asked a contested question returns both documents and leaves
the conflict to the reader; an integrating compiler must decide what the page now says.
See [[comparisons/wiki-vs-rag]].

## Why it is the load-bearing operation

It is the feature practitioners single out. A reader running a large operational
knowledge system names contradiction detection as their own system's *biggest gap*,
despite that system having entity resolution across 5,700+ files and hybrid search
[^jibrain-response] — see [[entities/jibrain]]. Their conclusion is that active
knowledge maintenance deserves design attention equal to ingestion pipelines
[^jibrain-response]. That is a notable admission: the hard part was not retrieval
infrastructure but keeping the compiled layer honest.

## How this repository implements it

The schema makes contradictions a typed obligation rather than a good intention. A page
whose sources disagree is marked `status: contested` and must carry a `## Contradictions`
section naming who claims what; `tools/wiki.py lint` fails the build if it does not
[^synthesis]. [[concepts/confidence-scoring]] is itself such a page, and so is
[[concepts/knowledge-lifecycle]].

Enforcing the *form* is mechanical. Detecting that two claims conflict in the first
place is not — the linter can only check that a page which has already been marked
contested does the required bookkeeping [^synthesis].

## Contested extension: supersession

Flagging is where the gist stops. A proposed extension argues flagging is insufficient:
"when new information contradicts or updates an existing claim, the old claim shouldn't
just sit there with a note. The new one should explicitly supersede it. Linked,
timestamped, old version preserved but marked stale" [^llm-wiki-v2]. This repository
adopts supersession as a `status` value with a forward-link requirement
[^synthesis].

A stronger critique holds that neither flagging nor supersession is enough, because the
architecture has no active resistance to entropy — no mechanism to detect redundancy and
"no immune function" working against decay [^four-structural-gaps]. On this reading,
detection that only runs when a human happens to run lint is not an immune system at
all. See [[concepts/knowledge-lifecycle]].

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^synthesis]: compiled in this repository
