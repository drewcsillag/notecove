# Float Todos Feature - Clarifying Questions

## Context

When a todo item is toggled to `checked` or `nope`, it should "float" to the bottom of the list, but remain **ahead of** any other `checked` or `nope` items already there.

---

## Questions

### 1. Scope of "the list"

When you say "the list," do you mean:

- **A)** The immediate parent list only (just the siblings)
- **B)** The entire list including nested sub-lists (flatten and re-sort everything)

**Example for clarity:**

```
- [ ] Task A
  - [ ] Sub-task A1  ← if I check this
  - [ ] Sub-task A2
- [ ] Task B
```

If I check "Sub-task A1", should it:

- (A) Move to the bottom of the sub-list (after A2, but still under Task A)
- (B) Move to the bottom of the entire top-level list (after Task B)

**Your answer:**
A

---

### 2. Mixed List Items

Lists can contain both regular list items (`listItem`) and task items (`taskItem`). What happens when a task is checked in a mixed list?

```
- Regular bullet
- [ ] Task 1  ← if I check this
- Another regular bullet
- [ ] Task 2
```

Should the checked Task 1:

- **A)** Move to the bottom of the entire list (after everything, including regular bullets)
- **B)** Move to the bottom only among task items (after Task 2, but before any trailing regular bullets)
- **C)** Only reorder relative to other task items, ignoring regular bullets entirely

**Your answer:**
A

---

### 3. Ordering of Completed Items

You said checked/nope items should be "ahead of any other done or noped checkboxes." To confirm the intended order:

**Example:**

```
- [ ] Active 1
- [ ] Active 2
- [x] Done 1 (was completed earlier)
- [x] Done 2 (was completed later)
```

If I now check "Active 1", should the order become:

- **A)** Active 2, **Active 1** (newly checked), Done 1, Done 2 — newly completed goes to START of completed group
- **B)** Active 2, Done 1, Done 2, **Active 1** (newly checked) — newly completed goes to END/very bottom

**Your answer:**
A

---

### 4. Unchecking (cycling back to unchecked)

If a completed item is cycled back to `unchecked` (via `nope → unchecked`), should it:

- **A)** Float back to the TOP of the list (among unchecked items)
- **B)** Stay in its current position at the bottom
- **C)** Return to its original position (requires tracking original positions - more complex)

**Your answer:**

## Float above the checked items at the bottom if that makes sense

### 5. Animation/UX Considerations

Should the movement be:

- **A)** Instant (item just moves immediately)
- **B)** Animated (smooth transition so user can track where it went)

**Your answer:**
A

---

### 6. Undo Behavior

When a user undoes a checkbox toggle (Ctrl+Z), should:

- **A)** The item return to its original position AND state (full undo)
- **B)** Just the state be restored (position stays where it floated to)

**Your answer:**
A

---

### 7. Checked vs Nope ordering

Should there be any distinction between `checked` and `nope` items in the ordering?

- **A)** Treat them the same (both are "completed" and intermixed based on when they were completed)
- **B)** Checked items first, then nope items at the very bottom
- **C)** Nope items first, then checked items at the very bottom

**Your answer:**
A

---
