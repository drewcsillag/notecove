# Questions for Datepicker Keyboard Navigation

## Background

I've analyzed the current implementation:

- `DatePickerDialog.tsx` uses MUI X `DateCalendar` component
- The component is wrapped in a `Popover`
- MUI's DateCalendar natively supports keyboard navigation:
  - Arrow keys: Navigate between days (left/right = prev/next day, up/down = prev/next week)
  - Page Up/Down: Navigate between months
  - Home/End: Go to start/end of month (or year with Shift)
  - Enter/Space: Select the focused date

The issue is that **focus isn't being set** on the calendar when the popover opens, so keyboard events don't reach the calendar.

## Questions

### 1. Expected Keyboard Behavior

Should the following standard calendar keyboard shortcuts work?

| Key                  | Action                                  |
| -------------------- | --------------------------------------- |
| ← →                  | Move to previous/next day               |
| ↑ ↓                  | Move to previous/next week              |
| Page Up/Down         | Move to previous/next month             |
| Shift + Page Up/Down | Move to previous/next year              |
| Home/End             | Move to first/last day of month         |
| Enter/Space          | Select the focused date (closes picker) |
| Escape               | Close picker without selecting          |

**Or** do you want just arrow keys and Enter, with simpler behavior?

I'd like for all of the standard calendar keyboard keys to work

### 2. Quick Select Buttons

Currently there are "Today" and "Tomorrow" buttons at the top. Should there be a keyboard shortcut to activate these? For example:

- `T` for Today
- `M` for Tomorrow (next day)
- Or no shortcuts, rely on Tab to reach them?

T and M would be great!

### 3. Initial Focus

When the picker opens, should focus go to:

- **Option A**: The calendar grid (so arrow keys work immediately)
- **Option B**: The "Today" button (so quick selection is first)

I recommend **Option A** since the feature request is specifically about cursor key navigation.

Option A

### 4. Closing Behavior

When selecting a date with Enter/Space:

- **Option A**: Select AND close the picker (immediate action)
- **Option B**: Select but stay open (user must click "Select" button)

Currently clicking a date in the calendar doesn't close it - you must click "Select". Should keyboard Enter behave differently?

yes, option A

### 5. Website Documentation

This feature enhances an existing feature (date picker) rather than adding a new feature. It likely doesn't need separate documentation on the website - it's a usability/accessibility improvement. Do you agree?

Agree
