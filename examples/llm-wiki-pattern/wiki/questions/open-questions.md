---
title: Open questions
type: question
status: provisional
updated: 2026-08-25
sources:
  - four-structural-gaps
  - llm-wiki-v2
  - jibrain-response
  - karpathy-llm-wiki-gist
---

# Open questions

Questions the sources raise and do not settle. Each names what evidence would move it,
because a question with no such answer is a mood rather than a question [^synthesis].

## 1. Can a compiler filter its own inputs?

Nothing in the pattern asks whether a claim is falsifiable, so the wiki accumulates
"confident nonsense at the same rate" as genuine knowledge [^four-structural-gaps]. The
`status` field is a weak answer, since the model applying the label is the model that
wrote the page [^synthesis]. *Resolvable by:* seeding a wiki with known-false sources
and measuring whether they are marked contested or absorbed silently. See
[[concepts/confidence-scoring]].

## 2. Scrutiny or time — which lifecycle axis is right?

The two proposed lifecycles measure different things and disagree about which claims to
promote: emergence → validation → crystallisation → dormancy → invalidation, ordered by
stress-testing [^four-structural-gaps], versus Ebbinghaus decay resetting on
reinforcement, ordered by recency and repetition [^llm-wiki-v2]. *Resolvable by:*
running both over the same corpus and checking which one demotes claims that later
turned out wrong. See [[concepts/knowledge-lifecycle]].

## 3. What is the real integration cost curve?

Ingest is specified as updating 10–15 pages per source [^karpathy-llm-wiki-gist]. If
that number is roughly constant the pattern scales; if it grows with wiki size, ingest
eventually costs more than the wiki returns [^synthesis]. No source reports measurements.
*Resolvable by:* instrumenting pages-touched per ingest against total page count. See
[[concepts/compilation-over-retrieval]].

## 4. Does anyone read the diffs?

Automating the bookkeeping moves review onto the human: 10–15 changed pages per source
is a real reading burden, and skipping it yields an artifact nobody has checked
[^synthesis]. The proposed remedy of event-driven hooks [^llm-wiki-v2] draws the
objection that auto-ingest assumes reliable LLMs and wants manual gating on writes
[^llm-wiki-v2]. *Resolvable by:* observing whether long-running wikis show evidence of
unreviewed drift. See [[concepts/the-maintenance-burden]].

## 5. Why did the mature system still lack maintenance?

A deployment with entity resolution, hybrid search and seven-tier quality gating names
contradiction detection and provenance as its biggest gap [^jibrain-response]. Either
maintenance is genuinely harder than retrieval, or it is merely less legible as
engineering work and so gets built last [^synthesis]. These have different implications
for anyone starting now. See [[entities/jibrain]] and
[[concepts/contradiction-detection]].

[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^synthesis]: compiled in this repository
