---
title: Knowledge lifecycle
type: concept
status: contested
updated: 2026-08-25
sources:
  - karpathy-llm-wiki-gist
  - four-structural-gaps
  - llm-wiki-v2
---

# Knowledge lifecycle

Whether a compiled page should *age* — and what should happen to it as it does — is the
sharpest open disagreement in the sources. The original pattern has no lifecycle: pages
are created and updated, and the only maintenance operation is a periodic lint for
contradictions, orphans and stale claims [^karpathy-llm-wiki-gist]. Two responses argue
that this is the pattern's central structural omission, and propose incompatible fixes.

## Contradictions

**Does compiled knowledge need explicit lifecycle states?**

- **The gist: no explicit lifecycle.** Pages are durable artifacts; freshness is handled
  by re-ingesting sources and by lint catching stale claims
  [^karpathy-llm-wiki-gist]. The implicit position is that a page updated whenever
  relevant sources arrive is current enough.
- **Four structural gaps: yes, an epistemic lifecycle.** Pages "are created and updated
  but never invalidated or tested against contradictory material", so "there is no
  distinction between an insight that has survived repeated stress-testing and a note
  that was written once and never challenged" [^four-structural-gaps]. Proposed states:
  emergence → validation → crystallisation → dormancy → invalidation. The axis is
  **scrutiny** — how hard a claim has been tested.
- **LLM Wiki v2: yes, a temporal lifecycle.** Facts decay on an Ebbinghaus forgetting
  curve, retention falling exponentially with time and resetting on reinforcement, with
  content consolidating through working → episodic → semantic → procedural tiers
  [^llm-wiki-v2]. The axis is **time and repetition**, borrowed from human memory.

These two proposals are not the same fix and can conflict. A claim can be heavily
reinforced by repetition while never having been stress-tested — v2's curve would
promote it, while the epistemic lifecycle would leave it unvalidated
[^synthesis]. Frequency is not scrutiny.

A further objection lands on the v2 proposal specifically: automatic decay assumes the
machinery driving it is reliable, and a reviewer warns that "event-driven auto-ingest
assumes reliable LLMs", proposing manual human gating on writes to prevent silent
corruption [^llm-wiki-v2]. A system that automatically forgets is a system that can
automatically lose things nobody chose to discard [^synthesis].

## Status in this repository

Unresolved, and deliberately not implemented. This wiki has no decay: a page compiled
once and never revisited looks exactly like one that has survived four sources, which is
precisely the defect identified in the critique [^four-structural-gaps]. The categorical
`status` field is a weak proxy for the scrutiny axis — it records a judgement, but the
judgement is made by the same model that wrote the page [^synthesis]. See
[[concepts/confidence-scoring]] for the parallel dispute about how such judgements
should be represented, and [[questions/open-questions]].

The one lifecycle mechanism adopted here is supersession, described in
[[concepts/contradiction-detection]], because it destroys no information: the old claim
is retained and marked rather than forgotten [^synthesis]. Nothing in
[[concepts/compilation-over-retrieval]] requires decay for the core bet to pay off.

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^synthesis]: compiled in this repository
