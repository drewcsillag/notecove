# Plan Critique

## Ordering Review

✅ **Feature 1 ordering is correct:**

- Schema key must come first (dependency for persistence)
- Tests before implementation (TDD)
- LeftSidebar changes before App.tsx (App.tsx depends on LeftSidebar props)

✅ **Feature 2 ordering is correct:**

- Tests before implementation (TDD)
- State logic before UI (can test filtering logic independently)
- Polish last

## Feedback Loop

**Recommendation**: Consider implementing Feature 2 (tag search) first since:

- It's entirely contained within TagPanel.tsx
- Can be manually tested immediately after implementation
- No cross-component coordination needed

Feature 1 requires changes to both LeftSidebar and App.tsx before we can test.

**Decision**: Keep current order. Feature 1 is simpler and follows an existing pattern exactly (App.tsx already does this for 3-panel layout). Getting it done first removes context-switching.

## Debug Tools

✅ **Existing tools are sufficient:**

- `console.error` already used for persistence failures
- Browser DevTools can inspect localStorage/state
- No additional debug tooling needed

## Missing Items Check

1. **No existing tests** for LeftSidebar or TagPanel
   - ✅ Plan already includes writing tests (TDD)

2. **Hidden tag panel behavior**
   - When `showTagPanel=false`, LeftSidebar renders without PanelGroup
   - Saved sizes still apply when panel is shown again ✅
   - No issue here

3. **Search box responsiveness**
   - Need to ensure search box doesn't overflow on narrow panels
   - ✅ Added consideration to Step 2.4 (style and polish)

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                           |
| -------------------------------------------------- | ---------- | ------ | ---------------------------------------------------- |
| `onLayout` behaves differently for vertical panels | Low        | Medium | Use same pattern as horizontal panels; test manually |
| Search box too wide for header                     | Medium     | Low    | Use flex-shrink and min-width; test at various sizes |
| Tag filtering causes layout shift                  | Expected   | None   | Normal behavior, not a bug                           |

## Questions from Critique

None. The plan is straightforward and follows existing patterns.

## Final Recommendation

**Plan is approved with one minor adjustment:**

- In Step 2.3, explicitly note that the TextField should use `size="small"` and flexible width to fit in the header

The plan correctly applies TDD, follows existing code patterns, and has reasonable scope.
