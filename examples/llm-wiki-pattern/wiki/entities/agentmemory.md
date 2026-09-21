---
title: agentmemory / LLM Wiki v2
type: entity
status: established
updated: 2026-08-25
sources:
  - llm-wiki-v2
  - four-structural-gaps
---

# agentmemory / LLM Wiki v2

A persistent memory engine for AI coding agents, whose author published "LLM Wiki v2"
extending the original pattern with production lessons [^llm-wiki-v2]. It keeps the core
invariant — "stop re-deriving, start compiling" — and replaces the surrounding machinery
with mechanisms aimed at what breaks at scale [^llm-wiki-v2]. See
[[entities/karpathy-llm-wiki-gist]] and [[concepts/compilation-over-retrieval]].

## Proposed mechanisms

- **Confidence scores** on facts, from supporting source count, recency of confirmation
  and contradicting evidence [^llm-wiki-v2]. Disputed — see
  [[concepts/confidence-scoring]].
- **Decay** on an Ebbinghaus forgetting curve, exponential with time, resetting on
  reinforcement [^llm-wiki-v2].
- **Consolidation tiers**: working → episodic → semantic → procedural memory,
  progressively more compressed and longer-lived [^llm-wiki-v2]. See
  [[concepts/knowledge-lifecycle]].
- **Supersession over deletion**, with the old claim preserved, linked, timestamped and
  marked stale [^llm-wiki-v2]. Adopted in this repository — see
  [[concepts/contradiction-detection]].
- **Hybrid search**: BM25, vector and graph traversal fused by reciprocal rank fusion
  [^llm-wiki-v2].
- **Automated ingestion hooks** on new sources, session boundaries, queries and
  schedules [^llm-wiki-v2]. See [[concepts/the-maintenance-burden]].

## Criticism

The comment thread on the proposal is unusually pointed, and the objections are recorded
here because they shaped this repository's schema [^synthesis]. Numeric confidence is
called "false precision", with evidential chains via version control preferred
[^llm-wiki-v2]. Event-driven auto-ingest is said to assume reliable LLMs, with manual
human gating on writes proposed instead [^llm-wiki-v2]. A summary critique lists the
missing specifics — undefined confidence computation, no latency targets, no accuracy
metrics such as NDCG or MRR, no versioning strategy, no access control, no recovery
mechanism — and concludes: "Great direction, terrible blueprint" [^llm-wiki-v2].

The borrowed cognitive-science vocabulary is doing rhetorical work that the mechanisms
do not obviously earn [^synthesis]. Naming a tier "episodic memory" does not establish
that compressed session summaries behave like episodic memory, and a separate critique
makes the general form of this objection: LLM output is statistically probable tokens,
and words like "understand" produce "fluent approximations" masking gaps in shared
concepts [^four-structural-gaps].

[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^synthesis]: compiled in this repository
