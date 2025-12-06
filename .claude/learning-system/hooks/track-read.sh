#!/bin/bash
# Track Read Tool Calls
# PostToolUse hook that records which files have been read
# Uses local state since this is session-specific

set -euo pipefail

# Source common configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
ensure_dirs

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if no file path
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Add this file to recent reads (with timestamp for potential cleanup)
TIMESTAMP=$(date +%s)
echo "$TIMESTAMP:$FILE_PATH" >> "$LOCAL_RECENT_READS"

# Keep only last 100 entries to prevent unbounded growth
if [ -f "$LOCAL_RECENT_READS" ]; then
  tail -100 "$LOCAL_RECENT_READS" > "$LOCAL_RECENT_READS.tmp" 2>/dev/null || true
  mv "$LOCAL_RECENT_READS.tmp" "$LOCAL_RECENT_READS" 2>/dev/null || true
fi

exit 0
