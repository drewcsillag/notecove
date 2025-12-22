# Questions: Backspace Before Inter-Note Link

## Understanding the Problem (CORRECTED)

**Current Behavior:**
When cursor is at `foo[[uuid]]|bar` and backspace is pressed:

- The `o` is deleted (character BEFORE the link)
- Cursor moves to `fo|[[uuid]]bar`

This is unintuitive - the link is being "skipped over" and content before it is deleted.

**Desired Behavior:**
When cursor is immediately after a link and backspace is pressed, the user wants to interact with the link itself, not skip over it. Two options proposed:

1. **Delete the link** - remove the entire `[[uuid]]`
2. **Reopen autocomplete** - allow editing which note the link points to

---

## Questions

### 1. Which behavior do you prefer?

**Option A: Delete the entire link**

- `foo[[uuid]]|bar` + backspace → `foo|bar`
- Simple, predictable, matches how other atomic elements work
- If you want to change the link, you'd delete it and type `[[` again

**Option B: Reopen autocomplete for editing**

- `foo[[uuid]]|bar` + backspace → `foo[[|bar` with autocomplete open
- More sophisticated - lets you change the link target without deleting
- The previous note would be pre-selected or shown as the query
- Pressing backspace again would delete the `[[` and cancel

**Option C: Two-stage approach**

- First backspace: select/highlight the link
- Second backspace: delete it
- Similar to how some editors handle images/embeds

C

### 2. Should this apply only to cursor immediately after `]]`?

Or also when cursor is positioned inside the hidden `[[uuid]]` text (which can happen due to arrow key navigation)?

Cursor cannot be positioned inside the link

### 3. Delete key behavior?

Should Delete key (forward delete) have analogous behavior when cursor is immediately before `[[`?

yes

### 4. Edge case: consecutive links

`foo[[link1]][[link2]]|bar` + backspace:

- Should this delete/edit `[[link2]]` only? (I assume yes)

YES

---

## My Recommendation

**Option A (delete the link)** is simplest and most predictable. It matches user mental model - backspace deletes what's immediately before the cursor. To edit a link, you delete it and create a new one.

Option B is more powerful but adds complexity. It could be a nice follow-up feature.

What's your preference?
