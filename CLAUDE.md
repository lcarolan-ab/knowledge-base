# Deliverables library

A firm's library of deliverables (slides, PDFs, spreadsheets, memos), tagged and
indexed, with a chat box that answers "have we ever done X for Y?" by surfacing the
existing deliverables and the people who made them.

```
library/*.md            one record per deliverable (demo data; SharePoint in production)
library/taxonomy.json   the tags and their synonyms — what makes "new grad" find "recent graduate"
tools/build_library.py  validates records, bundles app/data/library.json
app/                    the static app: Ask · Browse · People
app/lib/search.js       taxonomy-aware search; the floor that works with no model
app/lib/provider.js     optional model over the catalogue (direct key or proxy)
app/lib/sharepoint.js   read the catalogue from a SharePoint library via Graph
api/                    Azure Functions: /api/ask holds the model key server-side
docs/                   SharePoint setup, Azure hosting
archive/llm-wiki/       the earlier LLM-wiki prototype, kept for reference only
```

## Working on it

- **Everything in `library/` is synthetic.** Clients, people, emails and figures are
  invented. Never add real client data to this repo; in production the catalogue comes
  from SharePoint.
- **Adding a demo deliverable:** copy a file in `library/`, keep `id` equal to the file
  name, use only tags from `library/taxonomy.json`, give the author an email, write a
  two-to-four sentence summary and an `## Outline` list. Then
  `python3 tools/build_library.py` (it lints first and refuses bad records).
- **Adding a tag or synonym:** edit `library/taxonomy.json`. Aliases are matched as
  whole phrases, longest first. If you add a type, `python3 tools/sharepoint_columns.py`
  regenerates the column spec for the docs.
- **Checks:** `python3 tools/test_library.py`, `python3 tools/build_library.py --check`,
  `node tools/test_app.mjs`. Both workflows run all three before deploying.
- **Run it:** `python3 tools/build_library.py && python3 -m http.server -d app 8765`.
- No build step, no dependencies in the app: plain ES modules, standard-library Python.
  Keep it that way.
- The model is `claude-opus-5`; the function and the proxy fix it server-side. Search
  must keep working with no model at all.
