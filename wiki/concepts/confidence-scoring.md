---
title: Confidence scoring
type: concept
status: contested
updated: 2026-08-25
sources:
  - llm-wiki-v2
  - four-structural-gaps
---

# Confidence scoring

How should a compiled page record how much trust a claim deserves? The proposals split
between a computed number and a categorical label, and the dispute is visible inside a
single source and its own comment thread [^synthesis].

## Contradictions

**Numeric confidence scores, or not?**

- **For.** Facts should carry confidence scores reflecting how many sources support
  them, the recency of confirmation, and contradicting evidence [^llm-wiki-v2]. Every
  LLM-generated fact is additionally scored for structure, source citation and
  consistency, with contradictions flagged and resolutions proposed by recency and
  authority [^llm-wiki-v2].
- **Against.** "Numeric confidence scores are false precision"; the reviewer advocates
  explicit evidential chains via version control instead [^llm-wiki-v2]. A broader
  critique of the same document notes that the confidence computation is never defined,
  alongside missing latency targets, accuracy metrics, versioning and access control —
  concluding "Great direction, terrible blueprint" [^llm-wiki-v2].

The objection is well-aimed. A score assembled from source count, recency and
contradiction count has no units and no calibration, so `0.82` invites arithmetic that
means nothing while concealing which of the three inputs moved [^synthesis]. Source
count in particular measures citation, not truth: four sources copying one gist agree
about nothing [^synthesis].

The critique from the other direction is that the problem is upstream of the
representation. Nothing in the pattern asks whether a claim is falsifiable, so the
system accumulates "confident nonsense at the same rate" as genuine knowledge
[^four-structural-gaps]. On that reading, scoring the output of an unfiltered pipeline
misplaces the fix regardless of whether the score is a float or a word.

## Resolution adopted here

This repository takes the "against" side and uses a categorical `status` —
`established`, `contested`, `provisional`, `superseded` — with the evidential chain
carried by citations and git history rather than by a number [^synthesis]. The label
survives being wrong more gracefully than a number does: `contested` invites a reader to
go look, while `0.82` invites them to stop [^synthesis].

This is a choice, not a settled result, and it inherits the upstream problem untouched:
`status` is applied by the same model that wrote the page, so it filters nothing
[^four-structural-gaps]. See [[concepts/knowledge-lifecycle]] for the related dispute
about decay, [[concepts/contradiction-detection]] for what the label obliges a page to
do, and [[questions/open-questions]].

[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^synthesis]: compiled in this repository
