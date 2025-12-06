---
description: Review recent failures and extract lessons learned
---

# Reviewing Recent Failures

Time to review unresolved failures and extract any lessons.

## Instructions

1. **Read pending lessons**: Check shared pending-lessons.jsonl for failures
2. **For each failure, determine**:
   - Was this resolved? If so, how?
   - Was it a preventable mistake (wrong approach) or normal iteration?
   - If preventable, what's the generalizable pattern?
3. **Record valuable lessons**: Use `/learn-mistake` format in shared MISTAKES.md
4. **Clean up**: Remove resolved/processed entries from pending-lessons.jsonl

## Distinguishing Mistakes from Normal Iteration

**IS a recordable mistake:**

- Ran wrong command when I should have known the right one
- Forgot to check something before acting
- Used wrong approach when project conventions specify otherwise
- Made same error I've made before

**Is NOT a recordable mistake (just iteration):**

- Test failed during TDD (expected)
- Build error while developing (normal)
- Typo in a command (not a pattern)
- Exploring/debugging to find solution (discovery process)

## Process

1. Read shared `~/.claude/shared-learning/__PROJECT_ID__/pending-lessons.jsonl`
2. For each entry, analyze if it represents a learnable pattern
3. If learnable, add to shared `~/.claude/shared-learning/__PROJECT_ID__/MISTAKES.md`
4. Clear processed entries from pending-lessons.jsonl
5. Report summary: X failures reviewed, Y lessons recorded, Z cleared as normal iteration

Note: Shared state is in `~/.claude/shared-learning/__PROJECT_ID__/` - failures from all worktrees are visible here.
