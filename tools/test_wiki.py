#!/usr/bin/env python3
"""Negative tests: prove the linter catches each violation class.

A linter nobody has tried to fool is decoration. Each test builds a tiny
wiki in a temp dir, breaks exactly one invariant, and asserts lint flags it.

    python3 tools/test_wiki.py
"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wiki  # noqa: E402

SOURCE = """---
source_id: src-a
title: Source A
added: 2026-01-01
capture: summary
---
body
"""

GOOD = """---
title: Good page
type: concept
status: established
updated: 2026-02-01
sources:
  - src-a
---

# Good page

A claim [^src-a]. Links to [[other]], [[third]] and [[fourth]].

[^src-a]: raw/a.md
"""

def stub(title, extra_links=""):
    return f"""---
title: {title}
type: concept
status: established
updated: 2026-02-01
sources:
  - src-a
---

# {title}

A claim [^src-a]. {extra_links}

[^src-a]: raw/a.md
"""


class LintTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        (root / "raw").mkdir()
        (root / "wiki").mkdir()
        wiki.ROOT, wiki.RAW, wiki.WIKI = root, root / "raw", root / "wiki"
        (root / "raw" / "a.md").write_text(SOURCE)
        self.page("good", GOOD)
        # neighbours so the good page's links resolve
        for n in ("other", "third", "fourth"):
            self.page(n, stub(n, "[[good]] [[other]] [[third]] [[fourth]]"))

    def tearDown(self):
        self.tmp.cleanup()

    def page(self, slug, text):
        p = wiki.WIKI / f"{slug}.md"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        return p

    def run_lint(self):
        pages, sources = wiki.load()
        return wiki.lint(pages, sources)

    def assertFlags(self, needle, r, level="errors"):
        blob = "\n".join(getattr(r, level))
        self.assertIn(needle, blob, f"expected {level} containing {needle!r}\ngot:\n{blob}")

    # ---------------------------------------------------------- baseline
    def test_clean_wiki_passes(self):
        r = self.run_lint()
        self.assertEqual(r.errors, [], f"clean wiki should pass: {r.errors}")

    # ---------------------------------------------------------- failures
    def test_broken_link(self):
        self.page("good", GOOD.replace("[[other]]", "[[nonexistent]]"))
        self.assertFlags("broken link [[nonexistent]]", self.run_lint())

    def test_citation_without_source(self):
        self.page("good", GOOD.replace("[^src-a]. Links", "[^ghost]. Links"))
        self.assertFlags("citation [^ghost] has no source", self.run_lint())

    def test_citation_missing_from_frontmatter(self):
        (wiki.RAW / "b.md").write_text(SOURCE.replace("src-a", "src-b"))
        self.page("good", GOOD.replace("A claim [^src-a].", "A claim [^src-b]."))
        r = self.run_lint()
        self.assertFlags("omits it from frontmatter sources", r)

    def test_unknown_source_in_frontmatter(self):
        self.page("good", GOOD.replace("  - src-a", "  - src-a\n  - src-zzz"))
        self.assertFlags("unknown source 'src-zzz'", self.run_lint())

    def test_contested_without_contradictions_section(self):
        self.page("good", GOOD.replace("status: established", "status: contested"))
        self.assertFlags("requires a '## Contradictions' section", self.run_lint())

    def test_contested_with_contradictions_section_passes(self):
        self.page("good", GOOD.replace("status: established", "status: contested")
                              .replace("# Good page", "# Good page\n\n## Contradictions"))
        r = self.run_lint()
        self.assertNotIn("Contradictions' section", "\n".join(r.errors))

    def test_stale_page(self):
        # source added 2026-03-01, page compiled 2026-02-01
        (wiki.RAW / "a.md").write_text(SOURCE.replace("added: 2026-01-01",
                                                      "added: 2026-03-01"))
        self.assertFlags("stale: source 'src-a'", self.run_lint())

    def test_uningested_source(self):
        (wiki.RAW / "orphan.md").write_text(SOURCE.replace("src-a", "src-never"))
        self.assertFlags("not ingested", self.run_lint())

    def test_missing_frontmatter_field(self):
        self.page("good", GOOD.replace("status: established\n", ""))
        self.assertFlags("frontmatter missing 'status'", self.run_lint())

    def test_bad_type_value(self):
        self.page("good", GOOD.replace("type: concept", "type: banana"))
        self.assertFlags("type 'banana' not in", self.run_lint())

    def test_bad_status_value(self):
        self.page("good", GOOD.replace("status: established", "status: pretty-sure"))
        self.assertFlags("status 'pretty-sure' not in", self.run_lint())

    def test_superseded_needs_forward_link(self):
        self.page("lonely", """---
title: Lonely
type: concept
status: superseded
updated: 2026-02-01
sources: []
---

# Lonely

Nothing here.
""")
        self.assertFlags("must link forward", self.run_lint())

    def test_orphan_page_warns(self):
        self.page("unreachable", stub("Unreachable", "[[good]] [[other]] [[third]]"))
        self.assertFlags("orphan", self.run_lint(), level="warnings")

    def test_uncited_assertion_warns(self):
        long_claim = " ".join(["knowledge"] * 30) + "."
        self.page("good", GOOD.replace("A claim [^src-a].", long_claim + " [^src-a]\n\n" + long_claim))
        self.assertFlags("uncited assertion", self.run_lint(), level="warnings")

    def test_code_blocks_are_ignored(self):
        self.page("good", GOOD.replace("# Good page",
                                       "# Good page\n\n```\n[[not-a-real-page]]\n```"))
        r = self.run_lint()
        self.assertNotIn("not-a-real-page", "\n".join(r.errors))

    # ---------------------------------------------------------- parser
    def test_inline_empty_list_parses(self):
        meta, _ = wiki.parse_frontmatter("---\ntitle: X\nsources: []\n---\nbody\n")
        self.assertEqual(meta["sources"], [])

    def test_inline_list_parses(self):
        meta, _ = wiki.parse_frontmatter("---\nsources: [a, b]\n---\n")
        self.assertEqual(meta["sources"], ["a", "b"])

    def test_block_list_parses(self):
        meta, _ = wiki.parse_frontmatter("---\nsources:\n  - a\n  - b\n---\n")
        self.assertEqual(meta["sources"], ["a", "b"])

    def test_footnote_defs_not_counted_as_citations(self):
        pages, _ = wiki.load()
        # the good page cites src-a once in the body; the [^src-a]: line is a def
        self.assertEqual(pages["good"].cites.count("src-a"), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
