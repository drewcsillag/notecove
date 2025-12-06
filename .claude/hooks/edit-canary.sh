#!/bin/bash
# Edit Canary Check
# Verifies that a file was read before being edited
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
  echo '{}'
  exit 0
fi

# Check if the file was recently read
if [ -f "$LOCAL_RECENT_READS" ]; then
  # Check if file path exists in recent reads
  if grep -qF "$FILE_PATH" "$LOCAL_RECENT_READS" 2>/dev/null; then
    # File was read - allow the edit
    echo '{}'
    exit 0
  fi
fi

# File was NOT read before edit - warn
cat <<EOF
{
  "additionalContext": "EDIT WITHOUT READ: You're editing '$FILE_PATH' but haven't read it first in this session.\n\nCLAUDE.md requires reading files before editing. This ensures you understand current state.\n\nPlease use the Read tool on this file first, then retry the edit."
}
EOF
