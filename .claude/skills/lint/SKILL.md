---
name: lint
description: Health-check the wiki and fix what it reports. Use when the user says "lint the wiki", "check the knowledge base", "what needs recompiling", or after a batch of ingests. Runs the deterministic checks, then does the judgement work the linter cannot.
---

# lint

Two passes. The program checks consistency; you check truth. Only the first is automated.

## Pass 1 — mechanical

```
python3 tools/wiki.py lint      # invariants; exit 1 on error
python3 tools/wiki.py status    # what is stale or uningested
python3 tools/wiki.py stats     # shape of the wiki
```

Fix every error. Common causes:

| report | fix |
|---|---|
| `broken link [[x]]` | create the page, or repair the link |
| `cites [^x] but omits it from frontmatter` | add it to `sources:` |
| `citation [^x] has no source in raw/` | you invented a citation — find the real source or drop the claim |
| `status 'contested' requires a '## Contradictions' section` | write it, naming who claims what |
| `stale: source newer than page` | recompile the page against that source |
| `source is in raw/ but no wiki page cites it` | run the ingest skill on it |
| `orphan — no page links here` | link it from a relevant page, or delete it |
| `uncited assertion` | cite it, or mark it `[^synthesis]` if it is your own reasoning |

## Pass 2 — judgement

The linter cannot tell you a page is wrong. Read for what it cannot see:

- **Confident nonsense.** Is any claim asserted more firmly than its single source
  supports? Downgrade to `provisional`.
- **Unmarked contradictions.** Two pages quietly saying incompatible things — the linter
  only checks that *already-marked* contested pages do their bookkeeping.
- **Drift.** Terminology that has diverged between pages compiled at different times.
- **Never-challenged claims.** A page with one source, cited once, never revisited, is
  indistinguishable from a well-tested one. Flag the ones you would not bet on.
- **Synthesis passed off as sourced.** `[^synthesis]` is honest; a source citation on
  your own inference is not.

Log what you changed in `wiki/log.md`, then re-run pass 1.
