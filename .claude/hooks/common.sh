#!/bin/bash
# Common configuration for Claude Code learning hooks
# Shared across all hooks to ensure consistent paths

# Project identifier - used for shared state directory
# Override with CLAUDE_LEARNING_PROJECT env var if needed
PROJECT_ID="${CLAUDE_LEARNING_PROJECT:-notecove}"

# NOTE: This is the installed version for notecove. The template version in
# learning-system/hooks/common.sh uses __PROJECT_ID_PLACEHOLDER__ which the
# installer replaces with the actual project ID.

# Shared state location (across all worktrees)
# This is where MISTAKES.md and pending-lessons.jsonl live
SHARED_STATE_DIR="$HOME/.claude/shared-learning/$PROJECT_ID"

# Local state location (per worktree, transient)
# This is for session-specific tracking like recent-reads.txt
LOCAL_STATE_DIR="${CLAUDE_LOCAL_STATE_DIR:-.claude/state}"

# Ensure directories exist
ensure_dirs() {
  mkdir -p "$SHARED_STATE_DIR"
  mkdir -p "$LOCAL_STATE_DIR"
}

# Paths to key files
SHARED_MISTAKES_FILE="$SHARED_STATE_DIR/MISTAKES.md"
SHARED_PENDING_LESSONS="$SHARED_STATE_DIR/pending-lessons.jsonl"
LOCAL_RECENT_READS="$LOCAL_STATE_DIR/recent-reads.txt"

# Initialize shared MISTAKES.md if it doesn't exist
init_mistakes_file() {
  if [ ! -f "$SHARED_MISTAKES_FILE" ]; then
    cat > "$SHARED_MISTAKES_FILE" << 'TEMPLATE'
# Learned Mistakes

This file contains patterns of mistakes I've made and learned from.
Shared across all worktrees. Reviewed at session start.

---

## How to Use This File

When about to take an action, consider: "Does this match any pattern below?"
If so, use the **Correct approach** instead.

When you make a mistake and figure out the fix, add it here using `/learn-mistake`.

---

## Recorded Patterns

<!-- New mistakes go below this line -->

TEMPLATE
  fi
}
