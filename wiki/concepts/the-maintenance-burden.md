---
title: The maintenance burden
type: concept
status: established
updated: 2026-08-25
sources:
  - karpathy-llm-wiki-gist
  - llm-wiki-v2
  - jibrain-response
---

# The maintenance burden

The pattern's motivating problem. Wikis are not abandoned because writing pages is hard;
they are abandoned because *keeping them consistent* is hard. Cross-references rot,
terminology drifts, and new documents quietly contradict old pages. The claim is that
handing this bookkeeping to the LLM removes the burden that usually causes wikis to be
abandoned, leaving humans with sourcing, direction and interpretation
[^karpathy-llm-wiki-gist].

This is the pattern's actual bet, and it is a claim about **labour economics rather than
about model capability** [^synthesis]. It does not require the LLM to be insightful. It
requires it to be tireless at work humans find boring, which is a much weaker
requirement and correspondingly more plausible. See
[[concepts/compilation-over-retrieval]].

## Where the burden reappears

Automation moves the burden rather than deleting it, and the sources disagree about how
far it can move:

- **Toward review.** If ingest updates 10–15 pages per source
  [^karpathy-llm-wiki-gist], a human who wants to verify the compiler's work must read
  10–15 diffs. Trusting it unread is cheaper but converts the wiki into an artifact
  nobody has checked [^synthesis].
- **Toward hooks.** One proposal removes the remaining manual step with event-driven
  workflows firing on new sources, session boundaries, queries and schedules,
  eliminating "the manual bookkeeping that causes wikis to rot" [^llm-wiki-v2]. A
  reviewer of that same proposal objects that this assumes reliable LLMs, and wants
  manual human gating on writes to prevent silent corruption [^llm-wiki-v2].
- **Toward infrastructure.** A practitioner running the mature end of this spectrum
  reports entity resolution, hybrid search and seven-tier quality gating — and still
  names active knowledge maintenance as their biggest gap [^jibrain-response]. The
  burden survived the tooling. See [[entities/jibrain]].

This repository takes the conservative position: ingest is run deliberately rather than
on a hook, and `tools/wiki.py lint` exists so that the mechanical share of review is
done by a program instead of by a person reading diffs [^synthesis]. What the linter
cannot check is whether a page is true, which is exactly the residue that does not
automate — see [[concepts/knowledge-lifecycle]] and [[concepts/contradiction-detection]].

[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md
[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md
[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md
[^synthesis]: compiled in this repository
