#!/bin/bash
# Post-Bash Hook: Log failures for learning
# Captures failed commands so Claude can learn from mistakes
# Uses shared state so failures from any worktree are visible

set -euo pipefail

# Source common configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
ensure_dirs

INPUT=$(cat)

# Extract relevant fields
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
STDOUT=$(echo "$INPUT" | jq -r '.tool_response.stdout // empty')
STDERR=$(echo "$INPUT" | jq -r '.tool_response.stderr // empty')

# Try to get exit code - it might be in different places
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_response.exit_code // .tool_response.exitCode // "0"')

# Skip if command is empty
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Only log failures (non-zero exit)
if [ "$EXIT_CODE" != "0" ] && [ "$EXIT_CODE" != "null" ]; then
  # Create a truncated output snippet (first 500 chars of combined output)
  OUTPUT_SNIPPET=$(echo "${STDERR}${STDOUT}" | head -c 500 | tr '\n' ' ' | sed 's/"/\\"/g')

  # Get timestamp
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Get worktree identifier (last component of pwd)
  WORKTREE=$(basename "$(pwd)")

  # Escape command for JSON
  COMMAND_ESCAPED=$(echo "$COMMAND" | sed 's/"/\\"/g' | tr '\n' ' ')

  # Append to shared pending lessons
  cat >> "$SHARED_PENDING_LESSONS" <<EOF
{"timestamp":"$TIMESTAMP","worktree":"$WORKTREE","command":"$COMMAND_ESCAPED","exit_code":"$EXIT_CODE","output_snippet":"$OUTPUT_SNIPPET","status":"pending"}
EOF
fi

# PostToolUse hooks don't return anything meaningful
exit 0
