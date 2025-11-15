# CRITICAL RULES - READ FIRST, FOLLOW ALWAYS

## CI - MANDATORY BEFORE EVERY COMMIT

- **BEFORE EVERY COMMIT**: Use Task tool with subagent_type="ci-runner" to run `pnpm ci-local`
- **DO NOT** tail ci-runner output - it provides a summary
- If CI fails: Fix the failures and run ci-runner again
- **NEVER EVER** claim failures are "pre-existing" without verifying against previous commit
- **NEVER EVER** skip tests without asking first
- If tests are broken: FIX THEM, even if unrelated to current work

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

- We use bd (beads) for issue tracking instead of Markdown TODOs or external tools.

### Landing the Plane

**When the user says "let's land the plane"**, follow this clean session-ending protocol:

1. **File beads issues for any remaining work** that needs follow-up
2. **Ensure all quality gates pass** (only if code changes were made) - run tests, linters, builds (file P0 issues if broken)
3. **Update beads issues** - close finished work, update status
4. **Sync the issue tracker carefully** - Work methodically to ensure both local and remote issues merge safely. This may require pulling, handling conflicts (sometimes accepting remote changes and re-importing), syncing the database, and verifying consistency. Be creative and patient - the goal is clean reconciliation where no issues are lost.
5. **Clean up git state** - Clear old stashes and prune dead remote branches:
   ```bash
   git stash clear                    # Remove old stashes
   git remote prune origin            # Clean up deleted remote branches
   ```
6. **Verify clean state** - Ensure all changes are committed and pushed, no untracked files remain
7. **Choose a follow-up issue for next session**
   - Provide a prompt for the user to give to you in the next session
   - Format: "Continue work on bd-X: [issue title]. [Brief context about what's been done and what's next]"

**Example "land the plane" session:**

```bash
# 1. File remaining work
bd create "Add integration tests for sync" -t task -p 2 --json

# 2. Run quality gates (only if code changes were made)
go test -short ./...
golangci-lint run ./...

# 3. Close finished issues
bd close bd-42 bd-43 --reason "Completed" --json

# 4. Sync carefully - example workflow (adapt as needed):
git pull --rebase
# If conflicts in .beads/issues.jsonl, resolve thoughtfully:
#   - git checkout --theirs .beads/issues.jsonl (accept remote)
#   - bd import -i .beads/issues.jsonl (re-import)
#   - Or manual merge, then import
bd sync  # Export/import/verify
git push
# Repeat pull/push if needed until clean

# 5. Verify clean state
git status

# 6. Choose next work
bd ready --json
bd show bd-44 --json
```

**Then provide the user with:**

- Summary of what was completed this session
- What issues were filed for follow-up
- Status of quality gates (all passing / issues filed)
- Recommended prompt for next session

### Agent Session Workflow

**IMPORTANT for AI agents:** When you finish making issue changes, always run:

```bash
bd sync
```

This immediately:

1. Exports pending changes to JSONL (no 30s wait)
2. Commits to git
3. Pulls from remote
4. Imports any updates
5. Pushes to remote

**Example agent session:**

```bash
# Make multiple changes (batched in 30-second window)
bd create "Fix bug" -p 1
bd create "Add tests" -p 1
bd update bd-42 --status in_progress
bd close bd-40 --reason "Completed"

# Force immediate sync at end of session
bd sync

# Now safe to end session - everything is committed and pushed
```

**Why this matters:**

- Without `bd sync`, changes sit in 30-second debounce window
- User might think you pushed but JSONL is still dirty
- `bd sync` forces immediate flush/commit/push

**STRONGLY RECOMMENDED: Install git hooks for automatic sync** (prevents stale JSONL problems):

```bash
# One-time setup - run this in each beads workspace
bd hooks install
```

This installs:

- **pre-commit** - Flushes pending changes immediately before commit (bypasses 30s debounce)
- **post-merge** - Imports updated JSONL after pull/merge (guaranteed sync)
- **pre-push** - Exports database to JSONL before push (prevents stale JSONL from reaching remote)
- **post-checkout** - Imports JSONL after branch checkout (ensures consistency)

**Why git hooks matter:**
Without the pre-push hook, you can have database changes committed locally but stale JSONL pushed to remote, causing multi-workspace divergence. The hooks guarantee DB ↔ JSONL consistency.

**Note:** Hooks are embedded in the bd binary and work for all bd users (not just source repo users).
