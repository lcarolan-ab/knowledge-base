---
name: ingest
description: Compile a new source from raw/ into the wiki. Use when the user adds a document to raw/, says "ingest this", "add this source", or pastes a URL/article to fold into the knowledge base. Integrates the source across existing pages rather than filing it as one new page.
---

# ingest

Compile one source from `raw/` into `wiki/`. Read `CLAUDE.md` first — it is the schema
you compile against.

**The default outcome is that many existing pages change and no new page is created.**
If you find yourself writing one new page and stopping, you indexed instead of
compiling. Target 10–15 touched pages per source.

## Steps

1. **Capture** (if the source is not yet in `raw/`). Write it with full provenance
   frontmatter: `source_id`, `title`, `author`, `url`, `published`, `added` (today),
   `kind`, and `capture: verbatim|summary`. Be honest in `capture` — a fetched summary
   is not the original. Never edit an existing `raw/` file.

2. **Read it fully.** Not the first screen. You are about to assert things on its behalf.

3. **Find what it touches.** Read `wiki/index.md`, then grep for the entities and
   concepts it mentions:
   ```
   grep -ril "<term>" wiki/
   ```
   List the candidate pages before editing any of them.

4. **Integrate, page by page.** For each affected page:
   - Fold the new claim into the prose. Do not append a "New source says…" paragraph —
     that is filing, not compiling.
   - Cite it `[^source-id]`, add the id to frontmatter `sources:`, set `updated:` to today.
   - **Ask explicitly: does this contradict what the page already says?** If yes, set
     `status: contested` and write or extend a `## Contradictions` section naming who
     claims what. Never average two sources into a compromise neither one made.
   - If the new source overturns an old claim outright, mark the old page
     `status: superseded` and link forward to its replacement. Do not delete it.

5. **Create pages only for genuinely new subjects** — an entity or concept with nothing
   to attach to. Use `python3 tools/wiki.py new <slug> --type <type>`. Then link it from
   at least one existing page, or it is born an orphan.

6. **Log it.** Append one entry to `wiki/log.md`: source id, pages touched, and any
   contradiction you found. Never rewrite earlier entries.

7. **Rebuild and check:**
   ```
   python3 tools/wiki.py index && python3 tools/wiki.py lint
   ```
   Fix every error. Warnings are judgement calls — an uncited-assertion warning on your
   own synthesis means you should be citing `[^synthesis]`.

## Failure modes

- **Filing, not integrating** — one new page, nothing else touched.
- **Silent contradiction** — you noticed the conflict and smoothed it over. The conflict
  is the most valuable thing in the source.
- **Citation drift** — claims from the new source appearing on pages without its citation.
