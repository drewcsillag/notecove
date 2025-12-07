# Learned Mistakes

This file contains patterns of mistakes I've made and learned from.
Reviewed automatically at session start and referenced when making decisions.

---

## How to Use This File

When about to take an action, consider: "Does this match any pattern below?"
If so, use the **Correct approach** instead.

When you make a mistake and figure out the fix, add it here using `/learn-mistake`.

---

## Recorded Patterns

### Template (copy this for new entries)

- **Wrong approach**: [What was done incorrectly]
- **Why wrong**: [Why this approach failed or was suboptimal]
- **Correct approach**: [What should be done instead]
- **Pattern**: [When to apply this lesson - the trigger conditions]
- **Discovered**: [YYYY-MM-DD]

---

<!-- New mistakes go below this line -->

### Forgetting to include CI-generated fixes in the commit

- **Wrong approach**: Running CI, having it auto-fix lint/type issues, then committing only the original changes without the fixes
- **Why wrong**: Leaves the codebase with uncommitted fixes that the CI runner made; next CI run may fail or show different results
- **Correct approach**: After CI runs and makes fixes, include those fixes in the commit we're preparing (the whole point of running CI was to validate this commit)
- **Pattern**: When committing after a CI run that modified files, check `git status` and include any CI-generated fixes in the same commit
- **Discovered**: 2024-12-06
