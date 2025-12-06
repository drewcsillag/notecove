# Memory Canaries and Learning System - CLAUDE.md Snippet

Copy this section to your CLAUDE.md file:

---

## Memory Canaries (MANDATORY - DO NOT FORGET)

Canaries detect when you've forgotten instructions. By including one, you AFFIRM you've followed that rule.

**Format**: Use environment variable prefix style for Claude Code allowlist compatibility.

### Required Canaries

| Canary                | When Required                 | What You're Affirming             |
| --------------------- | ----------------------------- | --------------------------------- |
| `nc_canary=1`         | ALL bash commands (as prefix) | "I remember CLAUDE.md"            |
| `nc_ci_passed=1`      | `git commit`                  | "CI passed before this commit"    |
| `nc_user_said_push=1` | `git push`                    | "User explicitly told me to push" |

### Examples

```bash
# Basic command - canary as prefix
nc_canary=1 ls -la

# Commit (affirms CI was run and passed)
nc_canary=1 nc_ci_passed=1 git commit -m "feat: add feature"

# Push (affirms user gave permission)
nc_canary=1 nc_user_said_push=1 git push origin main

# Chained commands - canary prefix still works
nc_canary=1 git add . && git status
nc_canary=1 nc_ci_passed=1 git add . && git commit -m "fix: bug"
```

### If You Forget

A hook will catch missing canaries and remind you to re-read this file.
This is a FEATURE - it prevents context degradation from causing mistakes.

### Learning from Mistakes

- Failed commands are logged to shared state (`~/.claude/shared-learning/<project>/pending-lessons.jsonl`)
- Use `/learn-mistake` to record patterns when you discover the right approach
- Use `/review-failures` to periodically extract lessons
- Learned patterns are stored in shared `MISTAKES.md` - read it at session start
- Shared state is accessible from all worktrees of this project
