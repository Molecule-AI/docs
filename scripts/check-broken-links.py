#!/usr/bin/env python3
"""
check-broken-links.py — fail the build if any markdown file in content/
links to an internal target that doesn't exist on disk.

Catches the failure mode where a doc gets renamed/deleted and back-
references in other docs are missed (the fumadocs build doesn't fail
on broken cross-links — it just renders them as visible "broken text"
once the user clicks).

This pairs with check-stale-refs.sh: that script catches symbol
references that should be deleted; this one catches link targets that
moved or never existed. Together they cover the two main classes of
"docs got out of sync" drift.

Algorithm:
  - Walk content/**/*.{md,mdx}.
  - For each `[text](./rel/path.md)` or `[text](../rel/path.mdx)` link
    where the target ends in .md or .mdx and is a relative path
    (starting with ./ or ../).
  - Resolve target relative to the source file's directory.
  - If the resolved path is INSIDE content/ AND doesn't exist, fail.
  - If the resolved path escapes content/ (e.g. ../../README.md to the
    repo root), skip — those go through git/repo conventions and are
    out of scope for the docs-site build.

Run:
  python3 scripts/check-broken-links.py            # exit 0 clean, 1 broken
  python3 scripts/check-broken-links.py --self-test
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT = REPO_ROOT / "content"

# Match `](./...)` or `](../...)` for .md / .mdx targets. Greedy at
# the open-paren but stops before # or ? so anchor / query suffixes
# don't bleed into the captured path.
LINK_RE = re.compile(r"\]\((\.{1,2}/[^)#?]+\.mdx?)([)#?])")


def find_broken(content_dir: Path) -> list[str]:
    """Return a list of human-readable broken-link descriptions."""
    out: list[str] = []
    for md in sorted([*content_dir.rglob("*.md"), *content_dir.rglob("*.mdx")]):
        try:
            text = md.read_text(errors="ignore")
        except OSError as e:
            out.append(f"{md}: read error: {e}")
            continue
        for m in LINK_RE.finditer(text):
            rel = m.group(1)
            target = (md.parent / rel).resolve()
            # Skip out-of-tree links; those resolve via filesystem
            # conventions (repo root README, monorepo siblings) and
            # aren't part of the docs build.
            try:
                target.relative_to(content_dir.resolve())
            except ValueError:
                continue
            if not target.exists():
                # Re-derive line number for friendlier output.
                line = text[: m.start()].count("\n") + 1
                rel_md = md.relative_to(REPO_ROOT)
                out.append(f"{rel_md}:{line} → {rel} (resolves to {target})")
    return out


def self_test() -> int:
    """Pin the resolver against synthetic inputs.

    Drops a temp .md file inside content/ that references a known-bogus
    path; the resolver should flag it. Then drops a sibling that does
    point at a real file; should be ignored. The temp files are cleaned
    up regardless of pass/fail.
    """
    import tempfile

    print("=== self-test ===")
    fail = 0

    # Resolve a known-existing target so the negative-case probe doesn't
    # accidentally match the broken-link list.
    real_target = next(CONTENT.rglob("*.md"), None)
    if real_target is None:
        print("  FAIL: no .md files in content/ to use as a real target")
        return 2

    tmp_dir = Path(tempfile.mkdtemp(prefix="brokenlink-selftest-", dir=CONTENT))
    try:
        bogus = tmp_dir / "_bogus_probe.md"
        bogus.write_text(
            "synthetic test file\n"
            "[broken](./does-not-exist.md)\n"
            f"[real]({Path('..') / real_target.relative_to(CONTENT)})\n"
        )
        broken = find_broken(CONTENT)
        bogus_lines = [b for b in broken if "_bogus_probe.md" in b]
        bogus_broken = [b for b in bogus_lines if "does-not-exist.md" in b]
        bogus_real_falsepos = [b for b in bogus_lines if str(real_target.name) in b]

        if not bogus_broken:
            print("  FAIL: synthetic broken link to ./does-not-exist.md NOT caught")
            fail = 1
        else:
            print("  ok: synthetic broken link caught")

        if bogus_real_falsepos:
            print(f"  FAIL: real existing target {real_target} flagged as broken (false positive):")
            for b in bogus_real_falsepos:
                print(f"    {b}")
            fail = 1
        else:
            print("  ok: real existing target not flagged")
    finally:
        # Clean up — never leave probe files behind even if the test
        # bails partway.
        for p in tmp_dir.glob("*"):
            p.unlink()
        tmp_dir.rmdir()

    if fail:
        print("self-test FAILED")
        return 2
    print("self-test PASSED")
    return 0


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--self-test":
        return self_test()

    print(f"=== docs broken-link check: scanning {CONTENT} ===")
    broken = find_broken(CONTENT)
    if not broken:
        print("OK — no broken internal links")
        return 0

    print()
    for b in broken[:50]:
        print(f"::error::broken link: {b}")
    if len(broken) > 50:
        print(f"  ... ({len(broken) - 50} more)")
    print()
    print(f"Total broken: {len(broken)}")
    print(
        "Fix: rename the link to the correct target, or remove the link if the "
        "target was intentionally deleted. Use .mdx if the actual file is .mdx — "
        "this is the most common cause."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
