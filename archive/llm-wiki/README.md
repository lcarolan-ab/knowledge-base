# knowledge-base — a deliverables library built as an LLM wiki

A demo of a firm's **library of deliverables** — credit card spend analyses, cash flow
projections, philanthropic giving summaries, estate reviews, performance summaries —
that you can **search in plain language**, built on
[Karpathy's LLM wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
what the firm knows is **compiled once and kept current**, not re-derived from the
documents on every question.

```
raw/          the deliverables   immutable, humans add them
   │
   │  ingest / compile           ← the coding agent, driven by CLAUDE.md
   ▼
wiki/         compiled pages     clients · services · topics — agent-owned
   │
   │  lint                       ← tools/wiki.py, deterministic
   ▼
answers       runtime            queries read wiki/, never raw/
```

**Everything here is synthetic.** Three invented client households, one invented
company, ten invented deliverables. No real client, firm or figure appears anywhere.

## Why compile a deliverables library

A folder of PDFs answers "find me the Kessler cash flow". It does not answer "what have
we told clients about funding a large purchase", or "which of our projections has a
later deliverable checked", or "do two of our deliverables disagree about the same
client". Those answers live *across* documents. The compiled layer holds them:

- **Client pages** — everything the firm has told one household, with superseded advice
  kept and dated rather than deleted.
- **Service pages** — what a kind of deliverable covers, who has one, what it reliably
  finds, and how its projections have held up.
- **Topic pages** — advice that recurs across clients (give appreciated shares, not
  cash; every card analysis finds unused subscriptions).
- **Open questions** — what the deliverables raise and do not settle, each with the
  deliverable that would settle it.

Every figure on every page cites the deliverable it came from, so a natural-language
answer ends with the documents to open. The demo corpus includes one genuine
**supersession** (a cash flow projection revised after a house purchase) and one genuine
**contradiction** (a charity gala table categorised three different ways), because a
library that never disagrees with itself is not being tested.

## Try it

```bash
./demo.sh                      # guided walkthrough — no API key, no network
python3 tools/wiki.py lint     # check the build
python3 tools/wiki.py status   # what needs recompiling
python3 tools/test_wiki.py     # 20 tests proving the linter catches violations
node tools/test_app.mjs        # 33 tests for the app logic
```

Then open the repo in Claude Code and talk to it:

- `ingest raw/<file>.md` — fold a new deliverable in across client, service and topic pages
- `which clients have we done giving summaries for?` — answer from the compiled layer
- `lint the wiki` — mechanical checks, then the judgement pass

Requires Python 3.9+. Standard library only — nothing to install.

## Run it as a web app

```bash
python3 tools/build_app.py                 # bundle wiki/ + raw/ into app seed data
python3 -m http.server -d app 8765         # then open http://localhost:8765
```

It opens in **demo mode**: canned compiler responses, no API key, no network. Every
feature works. Open Settings to connect a real compiler.

| tab | what it does |
|---|---|
| **Browse** | the compiled pages, grouped by client, service and topic, with status badges and backlinks |
| **Ask** | natural-language search: a compiled answer with a citation behind every figure, plus a deterministic list of the deliverables that match |
| **Deliverables** | the library itself, grouped by client, each showing which pages cite it |
| **Add** | paste a deliverable; the compiler proposes edits across pages, shows a diff, and **lints the proposal before you can apply it** |
| **Lint** | the same invariants as `tools/wiki.py`, run client-side |

The demo deliverable on the Add tab is a half-year card analysis whose numbers
contradict an assumption the client's cash flow projection relies on. The pass
condition is that the compiler marks the client page contested and names both
deliverables, rather than quietly updating the number.

Anything you compile in the browser is layered over the shipped library in
`localStorage` and can be exported as `.md` files to commit back. A static page cannot
write to your git history, so the loop ends with an export rather than pretending
otherwise.

### The API key question

GitHub Pages is **static hosting — no server, no secrets**. So a genuinely working
compiler there has two honest options, and the app supports both:

- **Direct** — the visitor supplies their own key; the browser calls the Claude API
  itself. Suitable for a personal tool only. **Never deploy a build with your own key
  in it.**
- **Proxy** — point the app at an endpoint you control that holds the key server-side.
  [`proxy/worker.js`](proxy/worker.js) is a starting point. Note that as written it
  gates on the `Origin` header only, which a non-browser caller can omit; put real
  authentication in front of it before exposing it. For a Microsoft-hosted version of
  this whole system, see [`docs/azure-microsoft-plan.md`](docs/azure-microsoft-plan.md).

Model: `claude-opus-5` with adaptive thinking, streamed.

## Publish it

Enable Pages under **Settings → Pages → Source: GitHub Actions**, then merge to
`main`. [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes the app at
`/` and a no-JavaScript static rendering at `/read/`. The deploy is **lint-gated**: a
library that fails its own invariants does not get published.

## What's here

| path | what it is |
|---|---|
| `CLAUDE.md` | **the schema** — the contract the agent compiles against |
| `raw/` | 10 synthetic deliverables for three client households, plus one internal standard |
| `wiki/` | 17 compiled pages: 3 clients, 5 services, 5 topics, open questions, overview, index, log |
| `wiki/synthesis.md` | start here — what the library currently knows |
| `wiki/log.md` | append-only record of every ingest and query |
| `tools/wiki.py` | lint · status · index · graph · stats · new |
| `tools/test_wiki.py` | negative tests for the linter |
| `app/` | the web app — Browse, Ask, Deliverables, Add, Lint |
| `tools/build_app.py` | bundles `wiki/` + `raw/` into the app's seed data |
| `tools/test_app.mjs` | tests for the app logic, its linter, the demo ingest and search |
| `tools/build_site.py` | renders `wiki/` to the static no-JS archive |
| `proxy/worker.js` | optional Cloudflare Worker so the key lives server-side |
| `docs/azure-microsoft-plan.md` | how to build this on Azure / Microsoft 365 instead of as a static web app |
| `examples/llm-wiki-pattern/` | the previous demo corpus: the LLM wiki pattern compiled from its own literature |
| `.claude/skills/` | the operations: ingest, query, lint |

## What makes this more than a folder of documents

`tools/wiki.py lint` enforces:

- **Citation integrity** — every `[^source-id]` resolves to a real deliverable in `raw/`
  *and* appears in the page's frontmatter. You cannot invent a citation.
- **Link integrity** — every `[[wikilink]]` resolves; orphan pages are reported.
- **Contradiction bookkeeping** — a page marked `status: contested` **must** carry a
  `## Contradictions` section naming which deliverable claims what.
- **Staleness as a dependency check** — a page whose cited deliverable was added after
  the page was last compiled is stale, exactly as an object file is stale when its
  source is newer.
- **Uningested deliverables** — a file in `raw/` that no page cites is a build error.

## What it does not do

- **The linter checks consistency, not truth.** Whether a figure was carried over from
  the deliverable correctly is checked by nobody but you.
- **No epistemic filter, no decay.** A page compiled once and never revisited looks
  identical to one that survived four deliverables. See
  [`wiki/questions/open-questions.md`](wiki/questions/open-questions.md).
- **It is a demo corpus.** Ten deliverables is enough to show supersession,
  contradiction and cross-client synthesis; it is not enough to show how the pattern
  scales. Swap in your own deliverables — the schema and tooling are corpus-agnostic.
