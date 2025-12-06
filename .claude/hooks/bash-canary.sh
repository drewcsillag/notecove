#!/bin/bash
# Memory Canary Check for Bash Commands
# Detects when Claude has forgotten CLAUDE.md instructions by checking for canary markers

set -euo pipefail

# Source common configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Skip if no command (shouldn't happen, but be safe)
if [ -z "$COMMAND" ]; then
  echo '{}'
  exit 0
fi

# Track missing canaries
MISSING=""
WARNINGS=""

# === REQUIRED CANARIES ===

# nc-canary: Always required - proves CLAUDE.md is remembered
if ! echo "$COMMAND" | grep -q "nc-canary"; then
  MISSING="nc-canary"
  WARNINGS="You may have forgotten CLAUDE.md instructions."
fi

# nc-ci-passed: Required for git commit - affirms CI was run
if echo "$COMMAND" | grep -qE "git commit"; then
  if ! echo "$COMMAND" | grep -q "nc-ci-passed"; then
    if [ -n "$MISSING" ]; then
      MISSING="$MISSING, nc-ci-passed"
    else
      MISSING="nc-ci-passed"
    fi
    WARNINGS="$WARNINGS Did you run CI first? (CLAUDE.md requires ci-runner before commits)"
  fi
fi

# nc-user-said-push: Required for git push - affirms user permission
if echo "$COMMAND" | grep -qE "git push"; then
  if ! echo "$COMMAND" | grep -q "nc-user-said-push"; then
    if [ -n "$MISSING" ]; then
      MISSING="$MISSING, nc-user-said-push"
    else
      MISSING="nc-user-said-push"
    fi
    WARNINGS="$WARNINGS Did user explicitly say to push? (CLAUDE.md forbids pushing without permission)"
  fi
fi

# === OUTPUT ===

if [ -n "$MISSING" ]; then
  # Escape for JSON
  MISSING_JSON=$(echo "$MISSING" | sed 's/"/\\"/g')
  WARNINGS_JSON=$(echo "$WARNINGS" | sed 's/"/\\"/g')

  cat <<EOF
{
  "additionalContext": "CANARY CHECK FAILED - Missing: $MISSING_JSON\n\n$WARNINGS_JSON\n\nSTOP. Re-read CLAUDE.md and check $SHARED_MISTAKES_FILE for learned patterns.\nThen retry your command WITH the appropriate canaries.\n\nCanary reference:\n- nc-canary: Always required (proves you remember instructions)\n- nc-ci-passed: Required for git commit (affirms CI passed)\n- nc-user-said-push: Required for git push (affirms user permission)\n- nc-test-first: For tests when fixing bugs (affirms TDD)\n- nc-checked-mistakes: After recovering from failure (affirms you checked MISTAKES.md)"
}
EOF
else
  echo '{}'
fi
