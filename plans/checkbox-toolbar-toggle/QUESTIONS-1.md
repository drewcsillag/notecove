# Questions - Checkbox Toolbar Toggle Bug

## Current Behavior

When cursor is on a **task item** (checkbox item):

1. **Bullet button**: Does nothing (TipTap's `toggleBulletList()` doesn't know how to handle `taskItem` nodes)
2. **Numbered button**: Does nothing (same issue with `toggleOrderedList()`)
3. **Checkbox button**: Does nothing (the `convertToTaskItem()` command only converts `listItem` → `taskItem`, not the reverse)

## Proposed Solution

When cursor is on a task item:

- **Checkbox button**: Should convert the task item back to a regular list item (remove the checkbox)
- **Bullet/Numbered buttons**: Two options (see question 1)

---

## Questions

### 1. What should the Bullet List and Numbered List buttons do when on a task item?

**Option A: Convert to regular list item in that list type**

- Bullet button on task item → converts to regular list item (keeps bullet list)
- Numbered button on task item → converts to regular list item AND switches parent to ordered list

**Option B: Just toggle the list off (remove from list entirely)**

- Same as current bullet/numbered behavior for regular list items - toggles the list on/off
- Would remove the item from the list entirely, converting to a paragraph

**Option C: Disable/show different state**

- Disable bullet/numbered buttons when on a task item
- Only allow converting via checkbox button

**My recommendation**: Option A - it's the most intuitive. User clicks bullet to get a bullet, clicks numbered to get a numbered item, clicks checkbox to get a checkbox. Each button controls "what kind of list item is this?".

A

### 2. Should we preserve task item state when converting between list types?

When you have a task item in a bullet list and click "Numbered List", should the item:

- **A**: Stay as a task item but move to an ordered list (preserving checkbox state)
- **B**: Convert to a regular `listItem` in an ordered list (losing checkbox)

**My recommendation**: Option A - preserve the task status. The list type (bullet vs. numbered) is orthogonal to whether something is a task.

A

### 3. Keyboard shortcuts for converting task items?

Currently there are no keyboard shortcuts for the checkbox button. The existing shortcuts are:

- `⌘⇧8` - Toggle Bullet List
- `⌘⇧7` - Toggle Numbered List

Do you want to add a shortcut for toggling task item status? Some options:

- `⌘⇧9` - Toggle task item (convert to/from checkbox)
- `⌘[` or similar

Or is this not needed for now?

Not needed for now
