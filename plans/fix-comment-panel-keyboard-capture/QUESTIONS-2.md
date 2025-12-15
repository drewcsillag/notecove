# Questions Round 2: Focus-Based Approach UX

## Context from Q1

You chose **Option 3: Focus-based approach** - only capture keys when the comment panel itself has focus.

## Q4: UX Flow Clarification

With a focus-based approach, the keyboard shortcuts (j/k/e/r/arrows) will **only work when focus is inside the comment panel**. This has a UX implication:

**Current flow:**

1. User clicks on highlighted comment text in editor
2. Comment panel opens, thread is selected
3. User presses `j` to navigate → **works** (global handler)

**With focus-based approach:**

1. User clicks on highlighted comment text in editor
2. Comment panel opens, thread is selected
3. Focus is still in the editor (where they clicked)
4. User presses `j` to navigate → **doesn't work** (focus not in panel)
5. User must click inside the panel first, THEN j/k works

**Options:**

- **A) Require explicit click** - User must click inside panel to use keyboard nav (more predictable)
- **B) Auto-focus panel when opened** - When comment panel expands, programmatically focus it (more convenient but could be jarring)
- **C) Hybrid: visible + not-in-editor** - Capture keys when panel is visible AND focus is NOT inside `.ProseMirror` (keeps vim-style nav working when panel is visible, but doesn't capture keys while typing in editor)

**Option C** would mean:

- Panel visible + focus in editor = keys NOT captured (so typing works)
- Panel visible + focus anywhere else (including unfocused window) = keys captured (vim nav works)
- Panel hidden = keys NOT captured

Which behavior do you prefer?

Better yet, just kill keyboard nav of comments altogether. It's not great for a11y, but I can come back to it later when I have a better idea of what that should look like.
