# knowledge-base — a working LLM wiki

A prototype of [Karpathy's LLM wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
knowledge **compiled once and kept current**, not re-derived from raw documents on every
question.

```
raw/          source files      immutable, human-curated
   │
   │  ingest / compile          ← the coding agent, driven by CLAUDE.md
   ▼
wiki/         build output      interlinked markdown, agent-owned
   │
   │  lint                      ← tools/wiki.py, deterministic
   ▼
answers       runtime           queries read wiki/, never raw/
```

The demo corpus is self-referential: this wiki's subject is the LLM wiki pattern itself,
compiled from the original gist and three responses to it — including two that disagree
with it and with each other. So you can read [`wiki/synthesis.md`](wiki/synthesis.md) and
judge both the idea and the machinery at once.

## Try it

```bash
./demo.sh                      # guided walkthrough — no API key, no network
python3 tools/wiki.py lint     # check the build
python3 tools/wiki.py status   # what needs recompiling
python3 tools/test_wiki.py     # 20 tests proving the linter catches violations
```

Then open the repo in Claude Code and talk to it:

- `ingest https://…` — fold a new source in across existing pages
- `what does the wiki say about knowledge decay?` — answer from the compiled layer
- `lint the wiki` — mechanical checks, then the judgement pass

Requires Python 3.9+. Standard library only — nothing to install.

## What's here

| path | what it is |
|---|---|
| `CLAUDE.md` | **the schema** — the contract the agent compiles against |
| `raw/` | 4 source captures with provenance frontmatter |
| `wiki/` | 14 compiled pages: concepts, entities, a comparison, open questions |
| `wiki/synthesis.md` | start here — what the wiki currently believes |
| `wiki/log.md` | append-only record of every ingest and query |
| `tools/wiki.py` | lint · status · index · graph · stats · new |
| `tools/test_wiki.py` | negative tests for the linter |
| `.claude/skills/` | the four operations: ingest, query, lint |

## What makes this more than a folder of markdown

The compiler analogy is implemented, not just described. `tools/wiki.py lint` enforces:

- **Citation integrity** — every `[^source-id]` resolves to a real file in `raw/` *and*
  appears in the page's frontmatter. You cannot invent a citation.
- **Link integrity** — every `[[wikilink]]` resolves; orphan pages are reported.
- **Contradiction bookkeeping** — a page marked `status: contested` **must** carry a
  `## Contradictions` section naming who claims what. The build fails otherwise.
- **Staleness as a dependency check** — a page whose cited source was added after the
  page was last compiled is stale, exactly as an object file is stale when its source is
  newer. `wiki status` is `make -n` for knowledge.
- **Uningested sources** — a file in `raw/` that no page cites is a build error.

Two deliberate departures from the sources, both argued in
[`CLAUDE.md`](CLAUDE.md) and traceable to criticism recorded in the wiki:

- **Categorical `status`, not numeric confidence scores.** A score assembled from source
  count and recency has no units and no calibration; `0.82` invites arithmetic that means
  nothing. See [`wiki/concepts/confidence-scoring.md`](wiki/concepts/confidence-scoring.md).
- **Ingest is run deliberately, not on a hook.** Event-driven auto-ingest assumes
  reliable LLMs and corrupts silently when that assumption breaks. See
  [`wiki/concepts/the-maintenance-burden.md`](wiki/concepts/the-maintenance-burden.md).

## What it does not do

Stated plainly, because a knowledge base that oversells its own reliability is the
failure mode worth worrying about:

- **The linter checks consistency, not truth.** Links resolve and citations exist. Whether
  a page is *right* is checked by nobody but you.
- **No epistemic filter.** Nothing asks whether a claim is falsifiable, so the wiki
  accumulates confident nonsense at the same rate as knowledge — the central criticism of
  the pattern, recorded in [`wiki/questions/open-questions.md`](wiki/questions/open-questions.md)
  rather than papered over.
- **No decay.** A page compiled once and never revisited looks identical to one that
  survived four sources.
- **`raw/` here holds fetched summaries, not verbatim originals.** Each capture is marked
  `capture: summary` in its frontmatter and carries a fidelity warning. Quoted phrases came
  through a summarisation step — re-capture as `verbatim` before relying on exact wording.

## Where to take it next

- Re-capture `raw/` verbatim, then re-run ingest and watch which pages change.
- Ingest a source that contradicts an `established` page and see whether the agent marks
  it contested or smooths it over. That is the real test of the pattern.
- Instrument pages-touched-per-ingest against wiki size — open question 3, which no source
  answers with data.
- Swap the corpus for something you actually research. The schema and tooling are
  corpus-agnostic; only `raw/` and `wiki/` are about this topic.
