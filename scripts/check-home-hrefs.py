#!/usr/bin/env python3
"""
check-home-hrefs.py — verify every internal /docs/<slug> href in the
home page (`app/(home)/page.tsx`) resolves to an actual content file.

Catches the "vivid card on the home page links to a 404 page" failure
mode that the broader broken-link gate doesn't catch — that gate
walks `content/**`, but the home cards live in `app/`.

This gate is narrower (one file, one regex) but high-value because
the home cards are the most-clicked surface on the site. A 404 here
is the worst place for one to be.

Run:
  python3 scripts/check-home-hrefs.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HOME_FILE = REPO_ROOT / "app" / "(home)" / "page.tsx"
CONTENT = REPO_ROOT / "content"

# Match `href: '/docs/<path>'` in the home page's lanes config.
# Single OR double quotes; ignore /api/, anchor-only, or external
# (https?:) hrefs.
HREF_RE = re.compile(r"""href:\s*['"](/docs/[^'"#?]*)['"]""")


def slug_to_paths(slug: str) -> list[Path]:
    """Map /docs/foo or /docs/foo/bar to candidate content/ files."""
    rel = slug.removeprefix("/docs/")
    if rel == "":
        return [CONTENT / "docs" / "index.md", CONTENT / "docs" / "index.mdx"]
    base = CONTENT / "docs" / rel
    return [
        base.with_suffix(".md"),
        base.with_suffix(".mdx"),
        base / "index.md",
        base / "index.mdx",
    ]


def main() -> int:
    if not HOME_FILE.exists():
        print(f"::error::home page not found at {HOME_FILE}", file=sys.stderr)
        return 2

    src = HOME_FILE.read_text()
    hrefs = HREF_RE.findall(src)
    if not hrefs:
        print(f"::error::no /docs/* hrefs found in {HOME_FILE}; gate misconfigured?", file=sys.stderr)
        return 2

    print(f"=== home-href check: {len(hrefs)} hrefs in {HOME_FILE.relative_to(REPO_ROOT)} ===")
    bad: list[tuple[str, list[Path]]] = []
    for h in hrefs:
        candidates = slug_to_paths(h)
        if not any(p.exists() for p in candidates):
            bad.append((h, candidates))
            print(f"  ✗ {h}")
            for p in candidates:
                print(f"      tried: {p.relative_to(REPO_ROOT)}")
        else:
            for p in candidates:
                if p.exists():
                    print(f"  ✓ {h} → {p.relative_to(REPO_ROOT)}")
                    break

    if bad:
        print()
        print(f"::error::{len(bad)} home-page card href(s) point at non-existent docs.")
        print("Fix: update the `href:` in app/(home)/page.tsx to a real /docs/<slug> path,")
        print("or create the missing content file.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
