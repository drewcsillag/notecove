#!/bin/bash
# Memory Canary Check for Bash Commands
# Detects when Claude has forgotten CLAUDE.md instructions by checking for canary markers
#
# Uses environment variable prefix style for better Claude Code allowlist compatibility:
#   nc_canary=1 git status
#   nc_canary=1 nc_ci_passed=1 git commit -m "..."
#   nc_canary=1 nc_user_said_push=1 git push

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

# === REQUIRED CANARIES (prefix style: VAR=1 command) ===

# nc_canary=1: Always required as prefix - proves CLAUDE.md is remembered
if ! echo "$COMMAND" | grep -qE "^nc_canary=1 "; then
  MISSING="nc_canary=1"
  WARNINGS="You may have forgotten CLAUDE.md instructions."
fi

# nc_ci_passed=1: Required for git commit - affirms CI was run
if echo "$COMMAND" | grep -qE "git commit"; then
  if ! echo "$COMMAND" | grep -qE "nc_ci_passed=1 "; then
    if [ -n "$MISSING" ]; then
      MISSING="$MISSING, nc_ci_passed=1"
    else
      MISSING="nc_ci_passed=1"
    fi
    WARNINGS="$WARNINGS Did you run CI first? (CLAUDE.md requires ci-runner before commits)"
  fi
fi

# nc_user_said_push=1: Required for git push - affirms user permission
if echo "$COMMAND" | grep -qE "git push"; then
  if ! echo "$COMMAND" | grep -qE "nc_user_said_push=1 "; then
    if [ -n "$MISSING" ]; then
      MISSING="$MISSING, nc_user_said_push=1"
    else
      MISSING="nc_user_said_push=1"
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
  "additionalContext": "CANARY CHECK FAILED - Missing: $MISSING_JSON\n\n$WARNINGS_JSON\n\nSTOP. Re-read CLAUDE.md and check $SHARED_MISTAKES_FILE for learned patterns.\nThen retry your command WITH the appropriate canary prefix.\n\nCanary format (env var prefix style):\n  nc_canary=1 git status\n  nc_canary=1 nc_ci_passed=1 git commit -m '...'\n  nc_canary=1 nc_user_said_push=1 git push\n\nCanary reference:\n- nc_canary=1: Always required as prefix (proves you remember instructions)\n- nc_ci_passed=1: Required for git commit (affirms CI passed)\n- nc_user_said_push=1: Required for git push (affirms user permission)"
}
EOF
else
  echo '{}'
fi
