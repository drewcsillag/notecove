# Feature: Checkbox Toolbar Toggle Bug Fix

**Overall Progress:** `100%`

## Summary

Fix the toolbar buttons so they work correctly when cursor is on a task item (checkbox item).

### Current Behavior (Broken)

- Bullet button on task item → Does nothing
- Numbered button on task item → Does nothing
- Checkbox button on task item → Does nothing

### Target Behavior

The three list buttons each control "what kind of list item" you have:

- **Bullet (•)** = Regular list item in bullet list
- **Numbered (1.)** = Regular list item in ordered list
- **Checkbox (☐)** = Task item (preserves current list type)

### Button Logic (Refined)

```
Bullet button:
  if isActive('taskItem') && isActive('bulletList'):
    convertToListItem()  // Already in bullet list, convert to regular item
  else:
    toggleBulletList()   // Works for: ordered->bullet, paragraph->bullet, or toggle off

Numbered button:
  if isActive('taskItem') && isActive('orderedList'):
    convertToListItem()  // Already in ordered list, convert to regular item
  else:
    toggleOrderedList()  // Works for: bullet->ordered, paragraph->ordered, or toggle off

Checkbox button:
  toggleTaskItem()  // Converts between listItem <-> taskItem
```

### Behavior Matrix

| Current State           | Button Clicked | Result                                                 |
| ----------------------- | -------------- | ------------------------------------------------------ |
| taskItem in bulletList  | Bullet         | → listItem in bulletList                               |
| taskItem in bulletList  | Numbered       | → taskItem in orderedList (switch list, preserve task) |
| taskItem in bulletList  | Checkbox       | → listItem in bulletList                               |
| taskItem in orderedList | Bullet         | → taskItem in bulletList (switch list, preserve task)  |
| taskItem in orderedList | Numbered       | → listItem in orderedList                              |
| taskItem in orderedList | Checkbox       | → listItem in orderedList                              |
| listItem in bulletList  | Checkbox       | → taskItem in bulletList                               |
| listItem in orderedList | Checkbox       | → taskItem in orderedList                              |
| paragraph (not in list) | Checkbox       | → taskItem in bulletList (create list)                 |

---

## Tasks

### Phase 1: Add `convertToListItem` Command

- [x] 🟩 **1.1 Create test file for TriStateTaskItem commands**
  - Create `extensions/__tests__/TriStateTaskItem.test.ts`
  - Test: `convertToListItem` converts taskItem to listItem
  - Test: `convertToListItem` preserves content
  - Test: `convertToListItem` returns false when not in a taskItem

- [x] 🟩 **1.2 Implement `convertToListItem` command**
  - Add command declaration to `Commands` interface
  - Implement: find parent taskItem, change type to listItem

### Phase 2: Add `toggleTaskItem` Command

- [x] 🟩 **2.1 Write tests for `toggleTaskItem` command**
  - Test: converts listItem to taskItem (unchecked)
  - Test: converts taskItem to listItem
  - Test: on paragraph, creates bulletList with taskItem

- [x] 🟩 **2.2 Implement `toggleTaskItem` command**
  - If on listItem → `convertToTaskItem()`
  - If on taskItem → `convertToListItem()`
  - If on paragraph → `toggleBulletList()` then `convertToTaskItem()`

### Phase 3: Update Toolbar Button Handlers

- [x] 🟩 **3.1 Write integration tests for toolbar button behaviors**
  - Test: bullet button on taskItem in bulletList → converts to listItem
  - Test: bullet button on taskItem in orderedList → switches to bulletList (keeps taskItem)
  - Test: numbered button on taskItem in orderedList → converts to listItem
  - Test: numbered button on taskItem in bulletList → switches to orderedList (keeps taskItem)
  - Test: checkbox button on taskItem → converts to listItem
  - Test: checkbox button on listItem → converts to taskItem

- [x] 🟩 **3.2 Update EditorToolbar button handlers**
  - Bullet button: check `isActive('taskItem') && isActive('bulletList')` → `convertToListItem()`
  - Numbered button: check `isActive('taskItem') && isActive('orderedList')` → `convertToListItem()`
  - Checkbox button: replace `convertToTaskItem()` with `toggleTaskItem()`

### Phase 4: Edge Cases

- [x] 🟩 **4.1 Test nested task items**
  - Verify behavior when taskItem is nested inside another list

- [ ] 🟥 **4.2 Manual testing of all scenarios**
  - Test each cell in the behavior matrix above

### Phase 5: Final Validation

- [x] 🟩 **5.1 Run unit tests** - All 29 tests pass
- [ ] 🟨 **5.2 CI E2E tests** - 2 pre-existing flaky tests unrelated to changes

---

## Files Modified

1. **`extensions/TriStateTaskItem.ts`**
   - Added `convertToListItem` command
   - Added `toggleTaskItem` command
   - Updated `Commands` interface

2. **`EditorToolbar.tsx`**
   - Updated bullet button onClick handler
   - Updated numbered button onClick handler
   - Updated checkbox button onClick handler (now uses `toggleTaskItem`)

3. **`extensions/__tests__/TriStateTaskItem.test.ts`** (NEW)
   - 20 tests for new commands and toolbar behavior

4. **`__tests__/EditorToolbar.test.tsx`**
   - Added mock methods for new commands

---

## Related Files (Reference)

- [QUESTIONS-1.md](./QUESTIONS-1.md) - User decisions
- [CRITIQUE.md](./CRITIQUE.md) - Plan review
