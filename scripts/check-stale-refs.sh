#!/usr/bin/env bash
#
# check-stale-refs.sh — fail the build if docs/content references symbols
# that have been deleted from the platform. Catches the failure mode where
# a feature gets removed but its docs page lingers, leading to operators
# following an obsolete recipe and filing "this doesn't work" bugs.
#
# Why a deny-list and not a positive index: maintaining an enumeration of
# every live API surface is a much bigger change (would need code-side
# annotations or a generated source-of-truth file). A deny-list catches
# the specific class — "we deleted X, did we also remove its docs?" — at
# the cost of one line per deletion. After three months of accrual, the
# deny-list will be a reliable accuracy gate even without positive
# indexing.
#
# Add a new entry whenever you delete a docs-mentioned symbol, with a
# `# deleted-in <PR-or-date>:` comment to explain provenance. Order does
# not matter; the script greps each pattern independently.
#
# Run:
#   bash scripts/check-stale-refs.sh             # exit 0 if clean, 1 if stale
#   bash scripts/check-stale-refs.sh --self-test # run with synthetic input
#                                                # to verify each pattern fires

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
CONTENT_DIR="${CONTENT_DIR:-$REPO_ROOT/content}"

# Patterns are bash-extended-regex. Each entry: pattern, then a one-line
# comment with provenance + remediation hint.
#
# Format: PAT|HINT  — split on the first | so HINT can contain anything.
PATTERNS=(
  # deleted-in molecule-core#2856 (TeamHandler.Expand backend route).
  '/workspaces/[^"`)]*expand|expand a team|expand_team|TeamHandler\.Expand|POST.*expand|Expand to Team'

  # deleted-in molecule-core#2917 (TeamHandler.Collapse backend route).
  '/workspaces/[^"`)]*collapse|collapse_team|TeamHandler\.Collapse|Collapse a team|Collapse team back'

  # deleted-in docs#127 (page rename + content removed).
  'team-expansion\.md'

  # Wrong canonical hostname. doc.moleculesai.app is the live docs site;
  # docs.molecule.ai NXDOMAIN. Caught in molecule-core#2932.
  'docs\.molecule\.ai'
)

# self-test: run each pattern against a synthetic file containing the
# deleted symbol, assert each one matches. Catches a regression where
# an entry's regex accidentally stops matching the symbol it's meant to
# guard against (typo in pattern, inverted character class, etc.).
if [ "${1:-}" = "--self-test" ]; then
  echo "=== self-test ==="
  fail=0
  declare -a probes=(
    'POST /workspaces/abc/expand'
    'POST /workspaces/abc/collapse'
    'expand_team mcp tool'
    'collapse_team mcp tool'
    'TeamHandler.Expand symbol'
    'TeamHandler.Collapse symbol'
    '../agent-runtime/team-expansion.md'
    'See https://docs.molecule.ai/docs/guides/foo'
  )
  for probe in "${probes[@]}"; do
    matched=0
    for p in "${PATTERNS[@]}"; do
      if echo "$probe" | grep -E -q "$p"; then
        matched=1
        break
      fi
    done
    if [ "$matched" = "0" ]; then
      echo "  FAIL: probe NOT caught by any pattern: $probe"
      fail=1
    else
      echo "  ok:   probe caught: $probe"
    fi
  done
  if [ "$fail" != "0" ]; then
    echo "self-test FAILED — at least one deleted symbol falls through the deny-list."
    exit 2
  fi
  echo "self-test PASSED"
  exit 0
fi

# Real check.
status=0
total_violations=0
echo "=== docs accuracy: scanning $CONTENT_DIR ==="
for pat in "${PATTERNS[@]}"; do
  # grep -E with --include keeps it on docs content (md, mdx). Excludes
  # the content/_meta files where pattern strings sometimes appear in
  # legitimate JSON keys; tighten in future if it bites.
  matches=$(grep -E -rn --include="*.md" --include="*.mdx" "$pat" "$CONTENT_DIR" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    count=$(printf '%s\n' "$matches" | wc -l | tr -d ' ')
    total_violations=$((total_violations + count))
    echo
    echo "::error::$count stale reference(s) match pattern: $pat"
    printf '%s\n' "$matches" | head -10 | sed 's/^/  /'
    if [ "$count" -gt 10 ]; then
      echo "  ... ($((count - 10)) more)"
    fi
    status=1
  fi
done

if [ "$status" = "0" ]; then
  echo "OK — no stale references in $CONTENT_DIR"
fi

if [ "$total_violations" -gt 0 ]; then
  echo
  echo "Total violations: $total_violations"
  echo "Fix: remove the stale reference, or — if it's a comment that intentionally"
  echo "documents the deletion — narrow the pattern in scripts/check-stale-refs.sh"
  echo "to exclude the legitimate context."
fi

exit "$status"
