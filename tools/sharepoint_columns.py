#!/usr/bin/env python3
"""sharepoint_columns.py — the SharePoint columns the app expects, generated from
library/taxonomy.json so the choices stay in sync with the demo taxonomy.

    python3 tools/sharepoint_columns.py            # markdown table for the docs
    python3 tools/sharepoint_columns.py --json     # Graph column payloads
    python3 tools/sharepoint_columns.py --az SITE_ID LIST_ID   # az rest commands

Graph reference: POST /sites/{site-id}/lists/{list-id}/columns with a columnDefinition.
Multi-value tags are text columns holding semicolon-separated values, because the
Graph v1.0 column API does not create multi-select choice columns; the app also
accepts a multi-choice column if you create one in the SharePoint UI instead.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAX = json.loads((ROOT / "library" / "taxonomy.json").read_text(encoding="utf-8"))


def columns() -> list[dict]:
    types = [t["name"] for t in TAX["types"]]
    fmts = TAX["formats"]
    aud = ", ".join(a["tag"] for a in TAX["audiences"])
    top = ", ".join(t["tag"] for t in TAX["topics"])
    return [
        {"name": "DeliverableType", "displayName": "Deliverable type", "required": True,
         "choice": {"allowTextEntry": False, "choices": types, "displayAs": "dropDownMenu"},
         "_doc": "one of the types in the taxonomy"},
        {"name": "Audiences", "displayName": "Audiences", "text": {"allowMultipleLines": False},
         "_doc": f"semicolon-separated tags: {aud}"},
        {"name": "Topics", "displayName": "Topics", "text": {"allowMultipleLines": False},
         "_doc": f"semicolon-separated tags: {top}"},
        {"name": "Client", "displayName": "Client", "text": {},
         "_doc": "anonymised client label, or 'Internal' / 'Reusable template'"},
        {"name": "DeliveredOn", "displayName": "Delivered on", "text": {},
         "_doc": "YYYY-MM; falls back to the file's created date if empty"},
        {"name": "Pages", "displayName": "Pages", "number": {"decimalPlaces": "none"},
         "_doc": "slide or page count"},
        {"name": "Summary", "displayName": "Summary", "text": {"allowMultipleLines": True},
         "_doc": "two to four sentences: what it found or recommended"},
        {"name": "Outline", "displayName": "Outline", "text": {"allowMultipleLines": True},
         "_doc": "one slide or section title per line"},
        {"name": "AuthorName", "displayName": "Author name", "text": {},
         "_doc": "leave empty to use the file's Created By"},
        {"name": "AuthorRole", "displayName": "Author role", "text": {}, "_doc": "e.g. Senior Analyst, Client Analytics"},
        {"name": "AuthorEmail", "displayName": "Author email", "text": {},
         "_doc": "leave empty to use the file's Created By"},
        {"name": "Contributors", "displayName": "Contributors", "text": {"allowMultipleLines": True},
         "_doc": "one per line as 'Name <email>'"},
    ]


def main() -> int:
    args = sys.argv[1:]
    cols = columns()
    if args[:1] == ["--json"]:
        print(json.dumps([{k: v for k, v in c.items() if k != "_doc"} for c in cols], indent=2))
        return 0
    if args[:1] == ["--az"]:
        if len(args) != 3:
            print("usage: --az SITE_ID LIST_ID", file=sys.stderr)
            return 2
        site, lst = args[1], args[2]
        for c in cols:
            body = json.dumps({k: v for k, v in c.items() if k != "_doc"})
            print(f"az rest --method POST --url "
                  f"'https://graph.microsoft.com/v1.0/sites/{site}/lists/{lst}/columns' "
                  f"--headers 'Content-Type=application/json' --body '{body}'")
        return 0
    print("| column (internal name) | type | what to put in it |")
    print("|---|---|---|")
    for c in cols:
        kind = "choice" if "choice" in c else "number" if "number" in c else \
            "multi-line text" if c.get("text", {}).get("allowMultipleLines") else "text"
        print(f"| `{c['name']}` | {kind} | {c['_doc']} |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
