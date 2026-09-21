#!/usr/bin/env python3
"""Tests for the library validator: prove it catches each mistake a record can have.

    python3 tools/test_library.py
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_library as bl  # noqa: E402

TAX = {
    "types": [{"name": "Credit card analysis", "aliases": ["credit card"]}],
    "audiences": [{"tag": "new grad", "aliases": ["recent graduate"]}],
    "topics": [{"tag": "credit cards", "aliases": ["card"]}],
    "formats": ["slides", "pdf"],
}

GOOD = """---
id: good
title: "A good record"
type: Credit card analysis
audiences: [new grad]
topics: [credit cards]
client: Client 1 (anonymised)
date: 2026-01
format: slides
pages: 10
file: files/good.pptx
author: Ada Example
author_role: Analyst
author_email: ada@example.com
contributors: [Bo Example <bo@example.com>]
---

A summary long enough to count as a real summary of what the deliverable found and
what it recommended for the client in question, in plain words.

## Outline

- One
- Two
"""


class LintTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        bl.ROOT, bl.LIBRARY, bl.TAXONOMY = root, root / "library", root / "library" / "taxonomy.json"
        bl.LIBRARY.mkdir()
        bl.TAXONOMY.write_text(json.dumps(TAX))
        self.write("good", GOOD)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, stem, text):
        (bl.LIBRARY / f"{stem}.md").write_text(text)

    def errors(self):
        return bl.lint(bl.load_records(), bl.load_taxonomy())

    def assertFlags(self, needle):
        blob = "\n".join(self.errors())
        self.assertIn(needle, blob, f"expected an error containing {needle!r}, got:\n{blob}")

    def test_clean_record_passes(self):
        self.assertEqual(self.errors(), [])

    def test_bundle_shape(self):
        data = bl.bundle(bl.load_records(), bl.load_taxonomy())
        item = data["items"][0]
        self.assertEqual(item["author"]["email"], "ada@example.com")
        self.assertEqual(item["contributors"][0]["name"], "Bo Example")
        self.assertEqual(item["outline"], ["One", "Two"])
        self.assertTrue(item["summary"].startswith("A summary"))

    def test_unknown_audience(self):
        self.write("good", GOOD.replace("audiences: [new grad]", "audiences: [astronaut]"))
        self.assertFlags("audience 'astronaut' not in taxonomy")

    def test_unknown_type(self):
        self.write("good", GOOD.replace("type: Credit card analysis", "type: Horoscope"))
        self.assertFlags("type 'Horoscope' not in taxonomy")

    def test_author_email_is_optional(self):
        self.write("good", GOOD.replace("author_email: ada@example.com\n", ""))
        self.assertEqual(self.errors(), [])

    def test_bad_email(self):
        self.write("good", GOOD.replace("ada@example.com", "ada at example"))
        self.assertFlags("is not an email address")

    def test_bad_date(self):
        self.write("good", GOOD.replace("date: 2026-01", "date: Jan 2026"))
        self.assertFlags("must be YYYY-MM")

    def test_id_must_match_filename(self):
        self.write("other", GOOD)
        self.assertFlags("does not match file name 'other'")

    def test_duplicate_id(self):
        self.write("other", GOOD.replace("id: good", "id: good\n").replace("other", "good"))
        # two files, same id
        (bl.LIBRARY / "other.md").write_text(GOOD)
        self.assertFlags("duplicate id 'good'")

    def test_missing_outline(self):
        self.write("good", GOOD.split("## Outline")[0])
        self.assertFlags("no '## Outline' list")

    def test_short_summary(self):
        self.write("good", GOOD.replace("A summary long enough to count as a real summary of what the deliverable found and\nwhat it recommended for the client in question, in plain words.", "Too short."))
        self.assertFlags("summary is under 20 words")

    def test_contributor_may_omit_email_but_a_bad_one_is_flagged(self):
        self.write("good", GOOD.replace("Bo Example <bo@example.com>", "Bo Example"))
        self.assertEqual(self.errors(), [])
        self.write("good", GOOD.replace("Bo Example <bo@example.com>", "Bo Example <not an email>"))
        self.assertFlags("must be 'Name' or 'Name <email>'")


if __name__ == "__main__":
    unittest.main(verbosity=1)
