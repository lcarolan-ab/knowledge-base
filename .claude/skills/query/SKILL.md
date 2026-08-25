---
name: query
description: Answer a question from the compiled wiki. Use when the user asks a research question this knowledge base covers, or says "what does the wiki say about X", "ask the wiki", or "query the kb". Answers from wiki/ pages with citations and files genuine new synthesis back as pages.
---

# query

Answer from `wiki/`, not from `raw/`. Reading `raw/` to answer a question is a **cache
miss**: it means the wiki failed, and the failure is more important than the answer.

## Steps

1. **Search the compiled layer.** Start at `wiki/synthesis.md` and `wiki/index.md`, then
   `grep -ril "<term>" wiki/`. Follow `[[links]]` outward from what you find — the link
   graph is the retrieval mechanism.

2. **Answer with citations carried through.** Every factual claim keeps its
   `[^source-id]` from the page it came from. Distinguish what the sources say from what
   you concluded (`[^synthesis]`).

3. **Report contested ground as contested.** If the pages disagree, say so and name both
   sides. Do not resolve a `contested` page into a confident answer just because the
   question wanted one.

4. **If the wiki could not answer, say so plainly and diagnose it.** One of:
   - the source was never ingested → ingest it
   - it was ingested but the claim never made it onto a page → recompile that page
   - no source covers this → the gap is in `raw/`, and that is the human's job

   Then fix it if you can. An unanswerable query is a compiler bug report.

5. **File genuine synthesis back.** If answering produced a real insight — a connection
   across pages that no page states — write it as a page or fold it into an existing
   one. Insight left in the chat log is lost work. This is the operation that makes the
   wiki compound.

6. **Log it.** Append the question and its verdict (answered / partial / miss) to
   `wiki/log.md`. Misses accumulate into a work queue.

7. If you wrote anything: `python3 tools/wiki.py index && python3 tools/wiki.py lint`.
