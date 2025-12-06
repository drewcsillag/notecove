# Memory Canaries and Learning System - CLAUDE.md Snippet

Copy this section to your CLAUDE.md file:

---

## Memory Canaries (MANDATORY - DO NOT FORGET)

Canaries detect when you've forgotten instructions. By including one, you AFFIRM you've followed that rule.

### Required Canaries

| Canary | When Required | What You're Affirming |
|--------|--------------|----------------------|
| `nc-canary` | ALL bash commands | "I remember CLAUDE.md" |
| `nc-ci-passed` | `git commit` | "CI passed before this commit" |
| `nc-user-said-push` | `git push` | "User explicitly told me to push" |

### Situational Canaries

| Canary | When Appropriate | What You're Affirming |
|--------|-----------------|----------------------|
| `nc-test-first` | Running tests for a bug fix | "I wrote a failing test first" |
| `nc-checked-mistakes` | After recovering from a failure | "I checked shared MISTAKES.md" |

### Examples

```bash
# Basic command
ls -la # nc-canary

# Commit (affirms CI was run and passed)
git commit -m "feat: add feature" # nc-canary nc-ci-passed

# Push (affirms user gave permission)
git push origin main # nc-canary nc-user-said-push

# Chained commands - canary at end
git add . && git commit -m "fix: bug" # nc-canary nc-ci-passed
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
