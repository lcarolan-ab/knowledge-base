---
source_id: llm-wiki-v2
title: "LLM Wiki v2 — extending Karpathy's LLM Wiki pattern with lessons from building agentmemory"
author: rohitg00
url: https://gist.github.com/rohitg00/2067ab416f7bbe447c1977edaaa681e2
published: 2026-06
added: 2026-08-25
kind: gist
capture: summary
---

# LLM Wiki v2 — capture notes

> **Capture fidelity: SUMMARY.** Fetched summary, not verbatim. Includes commentary
> from the gist's comment thread, which is itself secondary.

Extends the original pattern with production lessons from **agentmemory**, a persistent
memory engine for AI coding agents. Keeps the core insight — "stop re-deriving, start
compiling" — and addresses what breaks at scale.

## Memory lifecycle

Rather than treating all wiki content as equally permanent, introduces temporal
dynamics. Facts carry **confidence scores** reflecting how many sources support them,
recency of confirmation, and contradicting evidence. Implements "Ebbinghaus's forgetting
curve": retention decays exponentially with time, and resets on reinforcement.

## Consolidation tiers

Information moves through progressively more compressed, longer-lived stages:

- Working memory (recent observations)
- Episodic memory (compressed session summaries)
- Semantic memory (cross-session facts)
- Procedural memory (workflows and patterns)

## Supersession over deletion

"When new information contradicts or updates an existing claim, the old claim shouldn't
just sit there with a note. The new one should explicitly supersede it. Linked,
timestamped, old version preserved but marked stale."

## Hybrid search

Combine BM25 (keyword), vector search (semantic) and graph traversal (relationship),
fused with reciprocal rank fusion.

## Automated ingestion hooks

Event-driven workflows triggering on new sources, session start/end, queries and
scheduled intervals — eliminating the manual bookkeeping that causes wikis to rot.

## Quality controls

Every LLM-generated fact is scored for structure, source citation and consistency. The
system flags contradictions and proposes resolutions based on recency and authority.

## Critical commentary (from the comment thread)

- "Numeric confidence scores are false precision" — one reviewer advocates explicit
  evidential chains via version control instead.
- "Event-driven auto-ingest assumes reliable LLMs" — another proposes manual human
  gating on write operations to prevent silent corruption.
- A broader critique notes missing specifics: undefined confidence computation, no
  latency targets, no accuracy metrics (NDCG/MRR), no versioning strategy, no access
  control, no recovery mechanism. Verdict: "Great direction, terrible blueprint."
