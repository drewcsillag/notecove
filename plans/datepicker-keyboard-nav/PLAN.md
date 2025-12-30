# Datepicker Keyboard Navigation - Implementation Plan

**Overall Progress:** `90%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md)

**Plan Critique:** [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md)

## Summary

Add keyboard navigation to the date picker that appears when typing `@date`. The MUI DateCalendar component supports keyboard navigation natively once focused. The main work is:

1. Manually focusing the selected day when the picker opens (MUI doesn't have autoFocus)
2. Adding T/M shortcuts for Today/Tomorrow
3. Making Enter/Space close the picker after selection

## Tasks

- [x] 🟩 **Step 1: Write tests for keyboard navigation**
  - [x] 🟩 Create `DatePickerDialog.test.tsx` with tests for:
    - Dialog opens and renders
    - Focus moves to calendar (selected day) when dialog opens
    - Enter selects current date and closes picker
    - Space selects current date and closes picker
    - T key selects today and closes
    - M key selects tomorrow and closes
    - Escape closes without selecting
    - (Note: Arrow key navigation is MUI internal - verify via manual testing)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 2: Add manual focus to selected day on open**
  - [x] 🟩 Add useEffect to focus selected day button when dialog opens
  - [x] 🟩 Use DOM query: `.MuiPickersDay-root.Mui-selected`
  - [x] 🟩 Run tests - focus test should pass
  - [ ] 🟨 Manual verify: arrow keys now navigate calendar
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 3: Add Enter/Space to select and close**
  - [x] 🟩 Add onKeyDown handler to dialog container
  - [x] 🟩 When Enter/Space pressed, call `onSelect` with selectedDate and close
  - [x] 🟩 Use `event.preventDefault()` to prevent double-handling
  - [x] 🟩 Don't interfere with MUI's internal arrow key handling
  - [x] 🟩 Run tests, verify tests pass
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 4: Add T/M shortcuts for Today/Tomorrow**
  - [x] 🟩 In same onKeyDown handler, handle 't'/'T' and 'm'/'M' keys
  - [x] 🟩 T: Select today's date and close
  - [x] 🟩 M: Select tomorrow's date and close
  - [x] 🟩 Run tests, verify tests pass
  - [x] 🟩 Update PLAN.md

- [ ] 🟨 **Step 5: Manual testing and edge cases**
  - [ ] 🟥 Test opening via `@date` command
  - [ ] 🟥 Test opening via clicking existing date chip
  - [ ] 🟥 Test all keyboard shortcuts:
    - Arrow keys (←→↑↓) navigate days/weeks
    - Page Up/Down navigate months
    - Home/End navigate to first/last of month
    - Enter/Space select and close
    - T for today, M for tomorrow
    - Escape closes
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **Step 6: Run CI and commit**
  - [ ] 🟥 Run ci-local
  - [ ] 🟥 Fix any issues
  - [ ] 🟥 Commit with user approval
  - [ ] 🟥 Update PLAN.md with final status

## Technical Notes

### MUI DateCalendar Native Keyboard Support

The MUI DateCalendar supports (once focused):

- Arrow keys: Navigate days (←→) and weeks (↑↓)
- Page Up/Down: Navigate months
- Shift + Page Up/Down: Navigate years
- Home/End: First/last day of month

**Key insight:** DateCalendar does NOT have autoFocus prop. We must manually focus.

### Custom Keyboard Handlers Needed

1. **Enter/Space**: MUI doesn't auto-close on selection - we intercept and call `onSelect` + `onClose`
2. **T key**: Custom shortcut for "Today"
3. **M key**: Custom shortcut for "Tomorrow"
4. **Escape**: Already handled by Popover's `onClose`, but verify it works

### Focus Strategy

```tsx
useEffect(() => {
  if (open) {
    // Small delay to ensure DOM is ready
    requestAnimationFrame(() => {
      const selectedDay = document.querySelector('.MuiPickersDay-root.Mui-selected') as HTMLElement;
      selectedDay?.focus();
    });
  }
}, [open]);
```

### Keyboard Handler Scope

Attach `onKeyDown` to the Popover's paper slot (dialog container) so T/M work from anywhere in the dialog.

## Deferred Items

None
