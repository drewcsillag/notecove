# Questions for Move List Items Feature

## 1. Keyboard Shortcut Choice

You mentioned `Shift-Ctrl-Up` and `Shift-Ctrl-Down`. In TipTap/ProseMirror, the convention is:

- `Mod` = Cmd (macOS) or Ctrl (Windows/Linux) - platform agnostic
- `Shift` = Shift key
- `Alt` = Option/Alt key

**Recommended shortcut:** `Alt-Up` and `Alt-Down` because:

- This is the standard convention in VS Code, Sublime Text, and many other editors for line/item movement
- `Ctrl-Shift` often conflicts with text selection operations
- Simpler two-key combo vs three-key combo

**Your preference?**

- (A) `Alt-Up` / `Alt-Down` (standard editor convention)
- (B) `Mod-Shift-Up` / `Mod-Shift-Down` (Ctrl/Cmd + Shift + Arrow)
- (C) Other - please specify

A

## 2. Scope of Movement

You mentioned "list items (and ideally lines or paragraphs)". To clarify:

**What should move when cursor is:**
| Context | What moves? |
|---------|-------------|
| Inside a bullet list item | The entire list item |
| Inside a task item | The entire task item |
| Inside a regular paragraph (not in list) | The paragraph? |
| In a blockquote | The blockquote? Or just internal content? |
| In a table | The row? Or nothing (don't support)? |
| In a heading | The heading? |

**My proposed behavior:**

- List items (bullet, ordered, task): Move the entire item with its content
- Regular paragraphs not in list: Move the paragraph block
- Headings: Move the heading block
- Blockquotes: Move the entire blockquote
- Tables: Don't support (complex structure)
- Code blocks: Move the entire code block

**Does this match your expectation?**

yes

## 3. Nested List Handling

When moving a list item that has nested sub-items:

- (A) Move the item AND all its children together
- (B) Only move the item, leave children behind (they'd merge with previous sibling)

**My recommendation:** (A) - Move the item with all children as a unit

A

## 4. Movement Boundaries

When an item is at the top or bottom of its container:

- If at top of list and press move-up: Do nothing? Or move out of the list?
- If at bottom of list and press move-down: Do nothing? Or move out of the list?

**My recommendation:** Do nothing at boundaries - stay within the parent container. Moving out of lists is a different operation (outdent).

go with recommendation

## 5. Text Selection Preservation

When moving a block:

- (A) Keep the cursor at the same relative position within the text
- (B) Just ensure the cursor is somewhere in the moved block

**My recommendation:** (A) - Preserve the cursor's relative position

A
