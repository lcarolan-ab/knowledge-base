---
title: Log
type: overview
status: established
updated: 2026-08-25
sources: []
---

# Log

Append-only. Never rewrite an entry — correct it with a later one. See
[[concepts/provenance-log]].

---

**2026-08-25 · bootstrap** — Repository initialised. Schema written to `CLAUDE.md`;
`tools/wiki.py` implemented (lint, status, index, graph, stats, new). Empty wiki linted
clean apart from four uningested sources, which was the expected failure.

**2026-08-25 · ingest** `karpathy-llm-wiki-gist` — The originating gist. Created
`concepts/compilation-over-retrieval`, `concepts/contradiction-detection`,
`concepts/provenance-log`, `concepts/the-maintenance-burden`,
`entities/karpathy-llm-wiki-gist`, `comparisons/wiki-vs-rag`, `synthesis`. No
contradictions — nothing to contradict yet.

**2026-08-25 · ingest** `four-structural-gaps` — First dissent. Marked
`concepts/knowledge-lifecycle` `contested` on ingest: the source's lifecycle proposal
directly opposes the gist's position that no explicit lifecycle is needed. Added the
"what this schema deliberately does not do" section to `CLAUDE.md` rather than quietly
dropping the critique. Updated `comparisons/wiki-vs-rag` with the "confident nonsense"
objection.

**2026-08-25 · ingest** `jibrain-response` — Practitioner field report. Created
`entities/jibrain` (`provisional`: single self-reported source). Its concession —
contradiction detection as its own biggest gap — strengthened
`concepts/contradiction-detection` and became open question 5. Touched 6 pages.

**2026-08-25 · ingest** `llm-wiki-v2` — Created `entities/agentmemory` and
`concepts/confidence-scoring`. **Second contradiction found:** this source proposes a
temporal (Ebbinghaus) lifecycle while `four-structural-gaps` proposes an epistemic one.
They are not the same fix and can disagree about the same claim, so
`concepts/knowledge-lifecycle` now records both under `## Contradictions` rather than
merging them. Its own comment thread contradicts its confidence-score proposal
("false precision"), which decided the `status`-not-scores rule in `CLAUDE.md`. Touched
8 pages.

**2026-08-25 · lint** — Clean. 13 pages, 4 sources, 0 errors.

**2026-08-25 · query** — *"Do the sources agree on what the pattern is?"* Answered from
`synthesis` and `entities/karpathy-llm-wiki-gist` without reading `raw/`: yes on the
core, no on every extension. Finding filed back into `synthesis` ("What is agreed") per
the query rule, rather than left in chat.
