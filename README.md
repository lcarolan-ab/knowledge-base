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
node tools/test_app.mjs        # 28 tests for the app logic
```

Then open the repo in Claude Code and talk to it:

- `ingest https://…` — fold a new source in across existing pages
- `what does the wiki say about knowledge decay?` — answer from the compiled layer
- `lint the wiki` — mechanical checks, then the judgement pass

Requires Python 3.9+. Standard library only — nothing to install.

## Run it as a web app

The repo ships a **working LLM wiki** — not a rendering of one. Browse, search,
ask it questions, and compile new sources into it, in the browser.

```bash
python3 tools/build_app.py                 # bundle wiki/ + raw/ into app seed data
python3 -m http.server -d app 8765         # then open http://localhost:8765
```

It opens in **demo mode**: canned compiler responses, no API key, no network. Every
feature works — including a prepared adversarial ingest. Open Settings to connect a
real compiler.

| tab | what it does |
|---|---|
| **Read** | the compiled pages, with resolved `[[wikilinks]]`, status badges and backlinks |
| **Ask** | a question answered *from the compiled pages*, with citations carried through |
| **Ingest** | paste a source; the compiler proposes edits across many pages, shows a diff, and **lints the proposal before you can apply it** |
| **Lint** | the same invariants as `tools/wiki.py`, run client-side |

Anything you compile in the browser is layered over the shipped wiki in
`localStorage` and can be exported as `.md` files to commit back. A static page
cannot write to your git history, so the loop ends with an export rather than
pretending otherwise.

### The API key question

GitHub Pages is **static hosting — no server, no secrets**. So a genuinely working
compiler there has two honest options, and the app supports both:

- **Direct** — the visitor supplies their own key; the browser calls the Claude API
  itself. Anthropic's SDK gates this behind `dangerouslyAllowBrowser` because the key
  is readable by anyone with devtools on that device, and scopes it to internal or
  personal tools. That is what this is. **Never deploy a build with your own key in
  it** — there is nowhere on a static page to hide one.
- **Proxy** — point the app at an endpoint you control that holds the key
  server-side. [`proxy/worker.js`](proxy/worker.js) is a ready-to-deploy Cloudflare
  Worker; set the origin allowlist, `wrangler secret put ANTHROPIC_API_KEY`, deploy,
  and paste the URL into Settings. Nothing else changes. This is the path to a real
  deployment with users.

Model: `claude-opus-5` with adaptive thinking, streamed.

## Publish it

Enable Pages under **Settings → Pages → Source: GitHub Actions**, then merge to
`main`. [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes:

- `/` — the app
- `/read/` — a no-JavaScript static rendering of the same wiki, for reading and indexing

The deploy is **lint-gated**: `test_wiki.py`, `wiki.py lint`, `wiki.py status` and
`test_app.mjs` all run first. A wiki that fails its own invariants does not get
published, which is the whole argument for having invariants. Pull requests run the
checks without deploying.

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
| `app/` | the web app — Read, Ask, Ingest, Lint |
| `tools/build_app.py` | bundles `wiki/` + `raw/` into the app's seed data |
| `tools/test_app.mjs` | 28 tests for the app logic and its linter |
| `tools/build_site.py` | renders `wiki/` to the static no-JS archive |
| `proxy/worker.js` | optional Cloudflare Worker so the key lives server-side |
| `.github/workflows/pages.yml` | lint-gated build and deploy |
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
