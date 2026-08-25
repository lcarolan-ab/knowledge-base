---
title: Provenance log
type: concept
status: established
updated: 2026-08-25
sources:
  - karpathy-llm-wiki-gist
  - jibrain-response
  - llm-wiki-v2
---

# Provenance log

An append-only chronological record of every ingest and query, kept as `wiki/log.md`
[^karpathy-llm-wiki-gist]. It answers the question a compiled artifact cannot answer
about itself: *when did this enter the wiki, and what did it change?*

A practitioner adopted precisely this — a knowledge provenance log of ingestion events,
greppable — as one of five mechanisms taken from the gist [^jibrain-response]. Its value
is that it is cheap and append-only: unlike the pages themselves, it is never rewritten,
so it survives a compiler that makes mistakes [^synthesis].

## Why append-only matters

The compiled layer is mutable by design, since integration means rewriting pages
[^karpathy-llm-wiki-gist]. That mutability is what makes the wiki useful and also what
makes it untrustworthy in isolation: a page shows its current state and not how it got
there. The log is the audit trail that lets a reader reconstruct the sequence, which is
the same argument made against numeric scoring — evidential chains via version control
rather than a summary number [^llm-wiki-v2]. See [[concepts/confidence-scoring]].

Under git, the log and the diff history together give something stronger than either:
the log records intent, the diff records effect [^synthesis].

## Queries belong in it too

The log covers queries as well as ingests [^karpathy-llm-wiki-gist], which matters
because a query that the wiki answered badly is evidence about the wiki. Recording
questions the compiled layer failed to answer turns the log into a work queue for
[[concepts/compilation-over-retrieval]] — each miss names a source that was never
ingested or was ingested badly [^synthesis]. This pairs with the gist's rule that
valuable query results are filed back as pages rather than left in chat history
[^karpathy-llm-wiki-gist] [^jibrain-response]; see
[[concepts/the-maintenance-burden]] and [[entities/karpathy-llm-wiki-gist]].

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^synthesis]: compiled in this repository
