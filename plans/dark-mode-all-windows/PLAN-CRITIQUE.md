# Plan Critique

## Ordering Issues

**Issue 1: TDD ordering needs adjustment**

Current Step 2 says "Write tests" before implementation. But the tests need to call `window.electronAPI.theme.onChanged()` which doesn't exist yet.

**Fix:** Step 1 should create the API signatures/types (but not implementation), then tests can be written against those interfaces.

**Issue 2: Steps 3-6 could be partially parallelized**

- Step 3 (menu broadcast) and Step 5 (App.tsx listener) are tightly coupled - need both for menu toggle to work
- Step 4 (theme:set handler) and Step 6 (Settings update) are tightly coupled - need both for Settings to work

**Suggested reordering:**

1. Add IPC types/signatures
2. Implement menu broadcast + App.tsx listener together (one testable unit)
3. Write/run tests for menu
4. Implement theme:set handler + Settings update together
5. Write/run tests for Settings
6. Integration test

## Feedback Loop

**Current:** Tests written first, but can't run until Steps 3+5 done.

**Better:** Implement menu→listener first (Steps 3+5), manually verify it works, then write tests that codify the behavior. This gets us to "interactive testing" faster.

Given TDD requirements in CLAUDE.md, we should write the test first but recognize it will fail until implementation is complete.

## Redundant Save Analysis

**Problem identified:** App.tsx has a useEffect that saves `themeMode` to database whenever it changes (lines 319-331). With the new design:

- Main process saves before broadcasting
- Window receives broadcast, updates state
- useEffect triggers, saves again (redundant)

**Solutions:**

1. **Use a ref to skip save on broadcast** - cleanest, matches plan's intent
2. **Remove save useEffect entirely** - risky, might break edge cases
3. **Accept redundant saves** - simplest, no bugs, just extra DB writes

**Recommendation:** Option 1 - use a ref. It's clean and explicit.

## Missing Items

1. **Type definitions** - Need to add types for new IPC channels in the appropriate type files
2. **The ref mechanism for skipping redundant saves** - Not mentioned in plan steps
3. **Consider: What if Settings dialog is open when broadcast arrives?** - The dialog has its own `themeMode` prop. If App.tsx state updates, the dialog will re-render with new prop. Should work fine.

## Risk Assessment

| Risk                                        | Likelihood | Impact | Mitigation                   |
| ------------------------------------------- | ---------- | ------ | ---------------------------- |
| Rapid toggles cause out-of-order broadcasts | Low        | Low    | Accept - last broadcast wins |
| Window created between save and broadcast   | Low        | None   | DB updated before broadcast  |
| Redundant DB saves                          | Certain    | Low    | Use ref to skip              |

## Debug Tools

None needed beyond console.log and Chrome DevTools. The feature is straightforward.

## Updated Plan Recommendation

Merge Steps 3+5 and Steps 4+6 into cohesive units. Add the ref mechanism to Step 5.

---

## Questions for User

None - the critique identifies improvements but no blocking questions. Ready to proceed with implementation using the improved ordering.
