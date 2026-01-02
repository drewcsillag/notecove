#!/bin/bash
# Parse a Playwright test output log and generate commands to re-run failed tests
# Usage: ./scripts/rerun-failed-tests.sh testout.log

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <test-output-log>" >&2
    exit 1
fi

if [ ! -f "$1" ]; then
    echo "Error: File '$1' not found" >&2
    exit 1
fi

# The summary section looks like (after stripping turborepo prefix):
#   5 failed
#   e2e/file.spec.ts:123:7 › describe › test name
#   16 flaky
#   e2e/file.spec.ts:456:7 › ...
#
# We want to extract ONLY lines between "N failed" and "N flaky" that start with e2e/

failed_tests=$(
    # Strip ANSI codes
    sed 's/\x1b\[[0-9;]*m//g' "$1" | \
    # Strip turborepo prefix (e.g., "@notecove/desktop:test:e2e: ")
    sed 's/^@[^:]*:[^:]*:[^:]*:[[:space:]]*//' | \
    # Extract lines between "N failed" and "N flaky/skipped", excluding boundaries
    awk '/^[0-9]+ failed$/{p=1; next} /^[0-9]+ (flaky|skipped|passed)/{p=0} p' | \
    # Only keep lines that start with e2e/
    grep -E '^e2e/' | \
    # Extract file:line (without column)
    sed 's/^\(e2e\/[^:]*:[0-9]*\):.*/\1/' | \
    # Remove duplicates
    sort -u
)

if [ -z "$failed_tests" ]; then
    echo "No failed tests found in $1" >&2
    exit 0
fi

# Count unique tests
count=$(echo "$failed_tests" | wc -l | tr -d ' ')

# Join on single line
tests_line=$(echo "$failed_tests" | tr '\n' ' ')

echo "# Re-run $count failed test(s):"
echo "pnpm --filter @notecove/desktop test:e2e --workers=1 $tests_line"
