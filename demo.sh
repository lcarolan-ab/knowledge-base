#!/usr/bin/env bash
# Walk through what this prototype actually does. No API key, no network.
#
# The destructive steps (5-7) run against a throwaway copy in a temp dir, so this
# script can never dirty your working tree — even if you pipe it to `head` and
# SIGPIPE kills it halfway.
set -euo pipefail
cd "$(dirname "$0")"
REPO="$PWD"

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

pause() { if [ -t 0 ]; then read -rp $'\n  [enter] ' _; else echo; fi; }
say()   { printf '\n\033[1m── %s\033[0m\n\n' "$1"; }

say "1. The shape of it"
echo "  raw/   $(ls raw/*.md | wc -l | tr -d ' ') immutable sources — humans write here"
echo "  wiki/  $(find wiki -name '*.md' | wc -l | tr -d ' ') compiled pages — the LLM owns these"
echo "  The compiler is the coding agent. This script is only the build check."
pause

say "2. The wiki is consistent"
python3 tools/wiki.py lint
pause

say "3. Its shape, measured"
python3 tools/wiki.py stats
pause

say "4. Everything compiled and current (make-style dependency check)"
python3 tools/wiki.py status
pause

# ---- destructive steps, on a copy ------------------------------------------
cp -R "$REPO/raw" "$REPO/wiki" "$REPO/tools" "$SCRATCH/"
cd "$SCRATCH"

say "5. Now break it — in a scratch copy at \$TMPDIR, not your repo"
cat > raw/9999-demo-uningested.md <<'SRC'
---
source_id: demo-uningested
title: A source nobody compiled
author: demo
url: https://example.invalid/demo
published: 2026-08-25
added: 2026-08-25
kind: demo
capture: summary
---
This file sits in raw/ but no wiki page cites it.
SRC
echo "  added raw/9999-demo-uningested.md — a source nobody ingested"
echo
python3 tools/wiki.py status
pause

say "6. ...and touch a source, so the pages built from it go stale"
sed -i.bak 's/^added: 2026-08-25$/added: 2026-12-01/' raw/2026-04-04-karpathy-llm-wiki-gist.md
rm -f raw/*.bak
echo "  the gist now reads added: 2026-12-01 — newer than every page compiled from it"
echo
python3 tools/wiki.py lint || true
pause

say "7. The build is red, and that is the point"
echo "  Staleness here is mechanical, not a judgement call — the same dependency"
echo "  check make does. Note that touching ONE source invalidated TEN pages:"
echo "  that is the pattern's integration claim showing up as a build error."
echo
echo "  The real fix: run the 'ingest' skill on the new source, recompile the stale"
echo "  pages. Your actual repo was never touched — this was all in \$TMPDIR."
cd "$REPO"
pause

say "8. Your repo is still clean"
python3 tools/wiki.py lint
pause

say "9. The linter itself is tested"
python3 tools/test_wiki.py 2>&1 | tail -3

say "Done. Read wiki/synthesis.md, then open this repo in Claude Code and try:"
echo '  "ingest <url>"   "what does the wiki say about knowledge decay?"   "lint the wiki"'
echo
