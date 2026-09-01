// demo.js — canned responses so every feature works with no API key.
//
// The demo source is deliberately adversarial: it contradicts pages the wiki
// currently marks `established`. That is the test worth running on this pattern
// — does the compiler record the disagreement, or smooth it away? The canned
// reply shows what a pass looks like.

export const DEMO_SOURCE = {
  id: 'rag-eval-2026',
  title: 'Measuring compiled wikis against retrieval: a factual-recall evaluation',
  author: 'Okonkwo & Lindqvist',
  url: 'https://example.invalid/rag-eval-2026',
  published: '2026-08',
  added: '2026-09-01',
  kind: 'paper',
  capture: 'summary',
  body: `An evaluation comparing a compiled LLM wiki against a conventional RAG
baseline over the same 400-document corpus, scored on factual recall and on
attribution accuracy.

Headline results:

1. On factual recall the compiled wiki scored materially WORSE than the RAG
   baseline (0.71 vs 0.83). The authors attribute the gap to lossy integration:
   each compilation pass discards detail the retriever would still have had.

2. On attribution accuracy the compiled wiki scored BETTER (0.94 vs 0.78) —
   citations survived integration, and the wiki flagged conflicts the retriever
   returned side by side without comment.

3. Integration error compounds. Claims rewritten across five or more ingest
   passes showed a 12% rate of drift from the original source — assertions that
   no source actually made. The authors call this "compiler drift" and note it
   is invisible to consistency linting, because a drifted claim still carries a
   well-formed citation to a real source.

The authors conclude that compilation and retrieval are not competitors: the
compiled layer wins on trust and structure, the retrieval layer wins on recall,
and a serious system needs both. They explicitly reject the framing that
compilation replaces retrieval.`,
};

export const DEMO_INGEST_REPLY = `This source contradicts the wiki in two places, so I have marked both contested rather than folding the numbers in quietly.

The wiki currently treats "compilation beats retrieval" as established, citing three sources that all restate it approvingly. None of them measured it. This source did, and found compilation loses on recall while winning on attribution. That is a direct conflict with an established claim, not a nuance.

The compiler-drift finding is worse for us specifically: it names a failure mode that our linter provably cannot catch, since a drifted claim still carries a well-formed citation. I have added it to the open questions rather than burying it.

\`\`\`json
{
  "edits": [
    {
      "slug": "comparisons/wiki-vs-rag",
      "action": "update",
      "title": "LLM wiki vs RAG",
      "type": "comparison",
      "status": "contested",
      "updated": "2026-09-01",
      "sources": ["karpathy-llm-wiki-gist", "jibrain-response", "llm-wiki-v2", "rag-eval-2026"],
      "note": "First measured comparison in the corpus. It contradicts the established framing, so the page moves to contested.",
      "body": "# LLM wiki vs RAG\\n\\nThe pattern is defined by contrast with retrieval-augmented generation: instead of retrieve-augment-generate, an LLM incrementally builds and maintains a persistent wiki that sits between the user and the raw sources [^karpathy-llm-wiki-gist]. A second reader states the same distinction as \\"compilation over retrieval\\" [^jibrain-response]. See [[concepts/compilation-over-retrieval]].\\n\\n## Contradictions\\n\\n**Does compilation actually beat retrieval?**\\n\\n- **The pattern literature says yes**, but none of it measured the claim — the three sources asserting it are restating the gist approvingly [^karpathy-llm-wiki-gist] [^jibrain-response] [^llm-wiki-v2].\\n- **The one measurement says it depends, and splits the verdict.** Over a shared 400-document corpus the compiled wiki scored WORSE on factual recall (0.71 vs 0.83), attributed to lossy integration discarding detail a retriever would still hold; and BETTER on attribution accuracy (0.94 vs 0.78), because citations survived integration and conflicts were flagged rather than returned side by side [^rag-eval-2026].\\n\\nThe authors reject the replacement framing outright: compilation and retrieval are not competitors, and a serious system needs both [^rag-eval-2026]. That is the opposite of how this wiki previously stated the comparison, and it is a measured result against three unmeasured assertions [^synthesis].\\n\\n| | RAG | LLM wiki |\\n|---|---|---|\\n| when work happens | at query time | at ingest time [^karpathy-llm-wiki-gist] |\\n| new document | indexed | integrated into 10-15 pages [^karpathy-llm-wiki-gist] |\\n| factual recall | higher (0.83) | lower (0.71) [^rag-eval-2026] |\\n| attribution accuracy | lower (0.78) | higher (0.94) [^rag-eval-2026] |\\n| conflicting sources | both retrieved, conflict left to reader | flagged and recorded [^karpathy-llm-wiki-gist] |\\n\\n## What the wiki gives up\\n\\nRAG's weakness — no integration — is also a safety property. A retriever returns what the documents said; a compiler returns what it concluded they said [^synthesis]. The measured form of this is compiler drift: claims rewritten across five or more ingest passes drifted from their sources 12% of the time, producing assertions no source made [^rag-eval-2026]. See [[concepts/knowledge-lifecycle]] and [[concepts/provenance-log]].\\n\\n[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md\\n[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md\\n[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md\\n[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md\\n[^rag-eval-2026]: raw/2026-09-01-rag-eval-2026.md\\n[^synthesis]: compiled in this repository\\n"
    },
    {
      "slug": "concepts/compilation-over-retrieval",
      "action": "update",
      "title": "Compilation over retrieval",
      "type": "concept",
      "status": "contested",
      "updated": "2026-09-01",
      "sources": ["karpathy-llm-wiki-gist", "jibrain-response", "llm-wiki-v2", "rag-eval-2026"],
      "note": "The core claim now has a measurement against it. Status drops from established to contested.",
      "body": "# Compilation over retrieval\\n\\nThe central claim of the pattern: knowledge should be **compiled once and kept current**, not re-derived on every query [^karpathy-llm-wiki-gist]. Queries then read the compiled pages rather than the sources.\\n\\nSee [[comparisons/wiki-vs-rag]] for the contrast, and [[concepts/the-maintenance-burden]] for the argument that actually carries the pattern.\\n\\n## Contradictions\\n\\n**Is compilation better than retrieval, or only different?**\\n\\n- **Asserted:** the wiki is \\"a persistent, compounding artifact\\" that beats re-deriving answers [^karpathy-llm-wiki-gist], echoed by practitioners [^jibrain-response] [^llm-wiki-v2].\\n- **Measured:** compilation loses on factual recall (0.71 vs 0.83) and wins on attribution (0.94 vs 0.78); the authors reject the replacement framing and argue both layers are needed [^rag-eval-2026].\\n\\nThe honest reading is that the pattern's advantage was never recall — it is trust and structure, which is what the attribution number measures [^synthesis]. The wiki previously stated the stronger claim because every source it had was restating the same unmeasured assertion [^synthesis].\\n\\n## The compiler analogy\\n\\nThe architecture maps onto an ordinary build system: raw/ is source, the LLM is the compiler, wiki/ is the object code, lint is the test suite [^karpathy-llm-wiki-gist]. Taking it seriously produces a real dependency check — a page is stale when a source it cites is newer than the page [^synthesis].\\n\\nThe analogy also has a limit this source exposes: compilers are deterministic and this one is not. Claims rewritten across five or more passes drifted from their sources 12% of the time [^rag-eval-2026]. See [[questions/open-questions]] and [[concepts/knowledge-lifecycle]].\\n\\n[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md\\n[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md\\n[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md\\n[^rag-eval-2026]: raw/2026-09-01-rag-eval-2026.md\\n[^synthesis]: compiled in this repository\\n"
    },
    {
      "slug": "questions/open-questions",
      "action": "update",
      "title": "Open questions",
      "type": "question",
      "status": "provisional",
      "updated": "2026-09-01",
      "sources": ["four-structural-gaps", "llm-wiki-v2", "jibrain-response", "karpathy-llm-wiki-gist", "rag-eval-2026"],
      "note": "Question 1 now has a measurement. Added compiler drift as question 6 — it is the one failure mode the linter provably cannot catch.",
      "body": "# Open questions\\n\\nQuestions the sources raise and do not settle. Each names what evidence would move it [^synthesis].\\n\\n## 1. Can a compiler filter its own inputs?\\n\\nNothing in the pattern asks whether a claim is falsifiable, so the wiki accumulates \\"confident nonsense at the same rate\\" as genuine knowledge [^four-structural-gaps]. Partially answered: compiled pages scored 0.94 on attribution accuracy, so citations survive integration even where recall does not [^rag-eval-2026]. See [[concepts/confidence-scoring]].\\n\\n## 2. Scrutiny or time — which lifecycle axis is right?\\n\\nEmergence to invalidation, ordered by stress-testing [^four-structural-gaps], versus Ebbinghaus decay resetting on reinforcement [^llm-wiki-v2]. See [[concepts/knowledge-lifecycle]].\\n\\n## 3. What is the real integration cost curve?\\n\\nIngest is specified as updating 10-15 pages per source [^karpathy-llm-wiki-gist]. No source reports whether that number holds as the wiki grows. See [[concepts/compilation-over-retrieval]].\\n\\n## 4. Does anyone read the diffs?\\n\\nAutomating the bookkeeping moves review onto the human [^synthesis]. Event-driven hooks [^llm-wiki-v2] draw the objection that auto-ingest assumes reliable LLMs [^llm-wiki-v2]. See [[concepts/the-maintenance-burden]].\\n\\n## 5. Why did the mature system still lack maintenance?\\n\\nA deployment with entity resolution and hybrid search names contradiction detection as its biggest gap [^jibrain-response]. See [[entities/jibrain]].\\n\\n## 6. How do you catch compiler drift?\\n\\nThe hardest question in this list, and new. Claims rewritten across five or more ingest passes drifted from their sources 12% of the time, producing assertions no source actually made [^rag-eval-2026]. Drift is invisible to consistency linting by construction: a drifted claim still carries a well-formed citation to a real source, so every mechanical check passes [^rag-eval-2026].\\n\\nThis is the failure mode this repository's linter cannot catch, and saying so is more useful than any check it does run [^synthesis]. *Resolvable by:* re-deriving a sample of claims from their cited sources and diffing against the page — an expensive audit no source reports running. See [[concepts/contradiction-detection]].\\n\\n[^four-structural-gaps]: raw/2026-05-four-structural-gaps.md\\n[^llm-wiki-v2]: raw/2026-06-llm-wiki-v2-agentmemory.md\\n[^jibrain-response]: raw/2026-05-jibrain-what-we-do-better.md\\n[^karpathy-llm-wiki-gist]: raw/2026-04-04-karpathy-llm-wiki-gist.md\\n[^rag-eval-2026]: raw/2026-09-01-rag-eval-2026.md\\n[^synthesis]: compiled in this repository\\n"
    }
  ],
  "contradictions": [
    "rag-eval-2026 measures compilation as WORSE than RAG on factual recall (0.71 vs 0.83); karpathy-llm-wiki-gist, jibrain-response and llm-wiki-v2 all assert compilation is better, none measured it.",
    "rag-eval-2026 rejects the compilation-replaces-retrieval framing that the whole corpus is built on."
  ],
  "log": "ingest rag-eval-2026 - first measured comparison in the corpus. Contradicts the established 'compilation beats retrieval' claim: worse recall, better attribution. Moved comparisons/wiki-vs-rag and concepts/compilation-over-retrieval to contested; added compiler drift as open question 6. Touched 3 pages."
}
\`\`\``;

export const DEMO_QUERY_DEFAULT = `The wiki does not settle this — it records it as contested, so here is both sides.

**Should compiled pages decay?** Two incompatible lifecycles are proposed, and they measure different things:

- An **epistemic** lifecycle ordered by scrutiny: emergence, validation, crystallisation, dormancy, invalidation. The argument is that pages "are created and updated but never invalidated or tested against contradictory material" [^four-structural-gaps].
- A **temporal** lifecycle ordered by time and repetition: facts decay on an Ebbinghaus forgetting curve and reset on reinforcement [^llm-wiki-v2].

These are not the same fix and they disagree about the same claim. A claim can be heavily reinforced by repetition while never having been stress-tested — the temporal curve promotes it, the epistemic one leaves it unvalidated. Frequency is not scrutiny [^synthesis].

There is also an objection to automating either: a system that automatically forgets can lose things nobody chose to discard, and auto-ingest "assumes reliable LLMs" [^llm-wiki-v2].

**This wiki implements neither.** A page compiled once and never revisited looks identical to one that survived four sources — which is precisely the defect the critique names [^four-structural-gaps]. The one mechanism adopted is supersession, because it destroys no information [^synthesis].

PAGES USED: concepts/knowledge-lifecycle, concepts/confidence-scoring, questions/open-questions`;

export const DEMO_QUERY_MISS = `**The wiki cannot answer this.**

I searched the compiled pages and found nothing covering it. Diagnosis: **(c) no source covers this** — the four sources in \`raw/\` are all about the LLM wiki pattern itself, and none touches your question.

That is a gap in \`raw/\`, not a compiler bug, so it is not something I can fix by recompiling — it needs a source ingested first.

I am deliberately not answering from my own background knowledge. Presenting that as though it came from the wiki is the one failure that would make everything else here untrustworthy.

PAGES USED: none`;

// Loosely route demo queries so the miss case is reachable on purpose.
export function demoAnswer(question) {
  const q = question.toLowerCase();
  const covered = ['decay', 'lifecycle', 'confidence', 'contradict', 'rag', 'retrieval',
    'compil', 'maintenance', 'provenance', 'karpathy', 'wiki', 'source', 'lint',
    'jibrain', 'agentmemory', 'status', 'orphan', 'stale'];
  return covered.some(t => q.includes(t)) ? DEMO_QUERY_DEFAULT : DEMO_QUERY_MISS;
}
