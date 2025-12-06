---
description: Record a mistake pattern to prevent repeating it
---

# Learning from a Mistake

I need to record a mistake pattern to prevent it in future sessions.

## Instructions

1. **Review what happened**: Look at recent command history or the context that led to this
2. **Identify the pattern**: What was the wrong approach? What should have been done instead?
3. **Determine when it applies**: Under what circumstances should future Claude avoid this?
4. **Record to MISTAKES.md**: Append to `.claude/MISTAKES.md` in the standard format

## Standard Format for MISTAKES.md

```markdown
### [Short descriptive title]

- **Wrong approach**: What I did that was wrong
- **Why wrong**: Why this was the wrong approach
- **Correct approach**: What I should have done instead
- **Pattern**: When to apply this lesson (trigger conditions)
- **Discovered**: [date]
```

## If provided with arguments

$ARGUMENTS

Use these to fill in the mistake details. If not provided, analyze recent context.

## After recording

1. Append the new entry to shared `~/.claude/shared-learning/notecove/MISTAKES.md`
2. Check shared `~/.claude/shared-learning/notecove/pending-lessons.jsonl` for related unresolved failures
3. Mark any resolved failures as "learned" in the pending file
4. Confirm what was recorded

Note: Shared state is in `~/.claude/shared-learning/notecove/` - accessible from all worktrees.

## Example

If I ran `pnpm ci-local` when I should have run targeted tests:

```markdown
### Running full CI during feature development

- **Wrong approach**: Running `pnpm ci-local` while still developing a feature
- **Why wrong**: Wastes time testing incomplete code; should iterate quickly
- **Correct approach**: Run targeted tests (`pnpm test <specific-test>`) during development, full CI only before commit
- **Pattern**: If feature is incomplete, use targeted tests not full CI
- **Discovered**: 2024-12-06
```
