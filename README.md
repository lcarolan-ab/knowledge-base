# Deliverables library

**Ask what the firm has already made. Get the decks, and the people who made them.**

A tagged, indexed library of a firm's deliverables — credit card analyses, cash flow
projections, giving summaries, estate reviews, primers, memos — with a chat box that
answers questions like *"have we ever done a credit card analysis for a new grad?"* by
surfacing the existing deliverables, with the author's name, email and a Teams link so
you can reach out directly.

Works with no model at all: the search understands the library's tags and their
synonyms. Connect a model for better handling of unusual phrasing. Reads its catalogue
from a bundled demo file or, in production, straight from a **SharePoint document
library**, and hosts on **Azure Static Web Apps**.

**All demo data is synthetic.** Every client, person, email and figure was invented.

## Try it

```bash
python3 tools/build_library.py            # validate the records, build the catalogue
python3 -m http.server -d app 8765        # open http://localhost:8765
```

| tab | what it does |
|---|---|
| **Ask** | plain-language question → short answer, the matching deliverables as cards, the people to contact |
| **Browse** | every deliverable, filterable by type, audience, year, or words |
| **People** | who has made what, with email and Teams links |

Checks: `python3 tools/test_library.py` (the validator), `node tools/test_app.mjs`
(search, model contract, SharePoint mapping). Python 3.9+ and Node 20; nothing to install.

## How it works

```
library/*.md  ──build──▶  app/data/library.json  ──▶  search.js (tags + synonyms)  ──▶  answer + cards + people
SharePoint    ──Graph──▶  same shape, at runtime  ──▶  provider.js (optional model)  ──┘
```

- **Records.** One markdown file per deliverable in `library/` with frontmatter: type,
  audiences, topics, client, date, file, author with email, contributors, plus a summary
  and an outline. `tools/build_library.py` refuses a record with an unknown tag, a
  missing email, or a thin summary.
- **Taxonomy.** `library/taxonomy.json` holds the types, audience tags and topic tags,
  each with aliases. "New grad", "recent graduate", "first job" and "entry level" all
  resolve to the same tag, so the question and the record meet even when the words
  differ.
- **Search.** `app/lib/search.js` parses the question into type, audience and topic,
  scores every record, and drafts the answer. This is what demo mode says.
- **Model.** With a key or a proxy, `app/lib/provider.js` sends the whole catalogue
  (it is small) and the question, and asks for JSON naming the matching deliverables.
  A reply that cannot be parsed falls back to the search, so the page never goes blank.
- **People.** Authors and contributors of the top results, ranked by involvement, with
  `mailto:` and Teams deep links.

## Connect it to SharePoint

Put the deliverables in a document library with a handful of metadata columns
(`python3 tools/sharepoint_columns.py` prints them), register a single-page app in Entra
with delegated `Sites.Read.All`, and point `app/config.js` at the site. Each visitor
signs in with their own account, so they only see what SharePoint already lets them
open. Step by step: [`docs/sharepoint-setup.md`](docs/sharepoint-setup.md).

The connector was written without access to a tenant; its mapping is unit-tested, the
live call is not. Budget an hour for the first connection.

## Host it on Azure

One Azure Static Web App hosts the page, gates it behind Entra sign-in, and runs the
`api/ask` function that holds the model key. The GitHub Actions workflow in
`.github/workflows/azure-static-web-apps.yml` validates, tests and deploys on push.
Step by step: [`docs/deploy-azure.md`](docs/deploy-azure.md).

`.github/workflows/pages.yml` publishes the demo (no SharePoint, no model) to GitHub
Pages, and `proxy/worker.js` is a Cloudflare Worker for hosting the key outside Azure.

## What's here

| path | what it is |
|---|---|
| `library/` | 16 synthetic deliverable records and the taxonomy |
| `app/` | the app: `index.html`, `app.css`, `app.js`, `config.js`, `lib/`, `data/` |
| `api/` | Azure Functions backend (`/api/ask`) |
| `tools/build_library.py` | validate and bundle the records |
| `tools/sharepoint_columns.py` | the SharePoint column spec, generated from the taxonomy |
| `tools/test_library.py`, `tools/test_app.mjs` | tests |
| `docs/` | SharePoint setup, Azure hosting |
| `proxy/worker.js` | optional Cloudflare Worker proxy |
| `archive/llm-wiki/` | the earlier prototype this grew out of, kept for reference |

## Adding a deliverable to the demo

Copy any file in `library/`, keep `id` equal to the file name, use tags from the
taxonomy, give the author an email, write a two-to-four sentence summary of what it
found or recommended, list the slide titles under `## Outline`, then run
`python3 tools/build_library.py`. In production, filing the file in SharePoint with its
columns filled in is the whole step.
