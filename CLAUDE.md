# CRITICAL RULES - READ FIRST, FOLLOW ALWAYS

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

- Failed commands are logged to shared state (`~/.claude/shared-learning/notecove/pending-lessons.jsonl`)
- Use `/learn-mistake` to record patterns when you discover the right approach
- Use `/review-failures` to periodically extract lessons
- Learned patterns are stored in shared `~/.claude/shared-learning/notecove/MISTAKES.md` - read it at session start
- Shared state is accessible from all notecove worktrees

## CI - MANDATORY BEFORE EVERY COMMIT

- **BEFORE EVERY COMMIT**: Use Task tool with subagent_type="ci-runner" to run `pnpm ci-local`
- **DO NOT** tail ci-runner output - it provides a summary
- If CI fails: Fix the failures and run ci-runner again
- **NEVER EVER** claim failures are "pre-existing" without verifying against previous commit
- **NEVER EVER** skip tests without asking first
- If tests are broken: FIX THEM, even if unrelated to current work
- **ALWAYS** ask before running CI, it's expensive in time and CPU and there may be other CI runs going at the same time.

## Test-Driven Development - MANDATORY

1. **Fixing bugs I report**: Write FAILING test first → Fix bug → Test passes
2. **New features**: Write tests → Implement feature → Tests pass
3. **Before commit**: Run ci-runner (all tests must pass)

## Documentation Website

- Location: `website/` folder at repo root
- Built with VitePress (Vue-based static site generator)
- After each feature: Update docs, landing page, add screenshots
- Build with: `pnpm --filter @notecove/website build`
- Dev server: `pnpm --filter @notecove/website dev`
- Version controlled like everything else

## Git Workflow

- **DO NOT** push to GitHub unless I explicitly tell you to
- Create feature branch for all work
- Only merge to main after I approve
- Commit only after ci-runner passes

## Plans

- All plans version controlled (PLAN.md, phase files, etc.)
- When implementation differs from plan: UPDATE the plan files
- Changes in early phases may cascade to later phases
- **ALWAYS** reload plan files from disk before modifying (I may have edited)

## STOP AND ASK BEFORE:

- Rolling back changes (explain the problem in detail first)
- Skipping any tests
- Claiming test failures are pre-existing

## Other Rules

- **DO NOT** make time estimates - you're rubbish at that

# Who you are

- You're a staff engineer, so follow best practices, including TDD

# Before implementing a feature, fixing a bug reported by me

- Any time you are going to fix a bug (except for bugs in tests), add a test first. It obviously should fail at first -- this way you know you fixed the bug.
- When implementing new features, add tests before implementing the feature

# After a feature is done being coded

- Before saying that a feature is completed, run all tests to ensure we didn't break anything, you should have a script that acts like a CI build until we have a real CI system
- After "CI" has run, do a code review of what you've done, and show me what you found. After code review, run the CI tests again

# Plan updates

Our plan is a large one that will necessitate multiple phases. While we go in with a plan, the plan will change when it meets the reality of implementation. Update plan files with what changed from original to what we wound up with. This includes the notion that if we have a top level plan file PLAN.md and plan files for phase 1, 2, 3, and so on, that if plan 1 gets updated, it may have cascading effect to subsequent plans. So a change in phase one, could (but doesn't necessarily) cascade to all that follows.

All of the plan files should be version controlled.

Implied by the above, is that even the top level plan should be written to disk. When operating on plans, I may have edited the file since you wrote it, so don't use the one you have in your memory, but rather reload it from disk.

# Features should be implemented in a new git branch

And only merged to main when I've accepted that the feature is acceptable.

# Tooling

Build tooling as you see fit to help debug.
Suggest tooling that might be applicable where I've not considered it.

# Overall

If I ask you to make a change, and you start doing it, NEVER start rolling back the change without asking me and explaining in detail what the problem is.

When you complete a phase (or subphase), tell me you're done before proceeding so I can look and make a git commit, or I can approve and you can commit after I say ok.

- NEVER run CI tests unless you're ready to commit. You should run more targeted tests otherwise. More targeted could be all ios depending on the nature of the change you made, but ideally it should be narrowed to the feature you're working on.
