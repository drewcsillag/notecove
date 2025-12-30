# Plan Critique - Datepicker Keyboard Navigation

## Issues Found

### 1. Step 2 Assumption is Wrong ❌

**Problem:** The plan assumes `DateCalendar` has an `autoFocus` prop. After checking MUI X types, **DateCalendar does NOT have autoFocus**.

Only `YearCalendar` has autoFocus. The `DateCalendar` component doesn't expose this.

**Fix:** We need to manually focus the selected day button using a ref and `useEffect`:

```tsx
useEffect(() => {
  if (open) {
    // Find and focus the selected day button after mount
    const selectedDay = document.querySelector('.MuiPickersDay-root.Mui-selected');
    (selectedDay as HTMLElement)?.focus();
  }
}, [open]);
```

This changes Step 2's implementation approach.

### 2. Ordering Concern ⚠️

**Problem:** Writing tests first (Step 1) before validating that MUI's keyboard navigation even works with manual focus is risky. The tests assume arrow key behavior that depends on MUI internals.

**Recommendation:**

- First, do a quick spike to verify manual focus enables arrow key navigation
- Then write tests with confidence

**However:** TDD is required by project rules, so we'll write the tests first but be prepared to adjust them.

### 3. Missing: Event Propagation Handling ⚠️

**Problem:** When adding custom keyboard handlers (T, M, Enter/Space), we need to be careful about:

- `event.stopPropagation()` - prevent event bubbling
- `event.preventDefault()` - prevent default browser behavior
- Ensuring we don't interfere with MUI's internal arrow key handling

**Fix:** Add explicit note in Step 3/4 about event handling.

### 4. Missing: Focus Scope for T/M Keys ⚠️

**Problem:** Should T/M work when focus is on the Cancel/Select buttons? Or only when on the calendar?

**Recommendation:** T/M should work anywhere in the dialog for convenience - it's a date picker dialog, so quick date selection makes sense from any focus position.

**Fix:** Attach keyboard handler to the dialog container, not the calendar specifically.

### 5. Testing Challenge: MUI DateCalendar ⚠️

**Problem:** Testing MUI's internal DateCalendar behavior (arrow key navigation) may be difficult because:

- MUI components are complex and may not behave the same in jsdom
- Arrow key tests might need to mock MUI behavior

**Recommendation:**

- Test our custom handlers (T, M, Enter, Escape) thoroughly
- For arrow key navigation, test that focus is set correctly and trust MUI for the rest
- Add manual testing step to verify actual behavior

### 6. Feedback Loop ✓

**Good:** After Step 2 (manual focus), we can interactively test if arrow keys work before proceeding.

### 7. Debug Tools ✓

**Adequate:** Console logs already exist in TipTapEditor for date picker events. Browser DevTools are sufficient for debugging focus issues.

## Revised Plan Approach

1. **Step 1 (Tests):** Write tests, but acknowledge:
   - Arrow key tests may need to trust MUI behavior
   - Focus verification tests are the priority

2. **Step 2 (Focus):** Use `useEffect` + DOM query instead of `autoFocus` prop

3. **Steps 3-4 (Keyboard handlers):** Attach to dialog container with proper event propagation handling

## Questions for User

None - the critique identifies issues but the fixes are clear. Proceeding with adjusted implementation.
