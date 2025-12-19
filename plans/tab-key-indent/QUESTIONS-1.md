# Tab Key Indent - Questions

## Summary of Current State

Currently, the Tab key in the TipTap editor:

1. **Inside tables**: Navigates to next cell (via `Table.ts` extension)
2. **Inside task items**: Indents/nests the task item (via `TriStateTaskItem.ts` with `nested: true`)
3. **Everywhere else**: Browser default behavior (moves focus to next focusable element)

The browser's default Tab behavior is what's causing focus to leave the editor when you press Tab in regular paragraph text.

## Questions

### Q1: What should Tab insert?

When pressing Tab in a paragraph (not in a table or list), what horizontal space should be added?

Options:

- **A) Literal tab character** (`\t`) - traditional tab, actual character inserted
- **B) 2 spaces** - common code convention
- **C) 4 spaces** - common code convention, matches typical tab width
- **D) Other** - please specify

What do most editors do here? I want to follow the rule of least surprise with this.

### Q2: Should Tab work in all text contexts?

Should Tab insert space in these contexts?

| Context                  | Should Tab insert space? |
| ------------------------ | ------------------------ |
| Paragraph (regular text) | Yes (main use case)      |
| Heading (h1-h6)          | ?                        |
| Code block               | ?                        |
| Blockquote               | ?                        |

Ah, no it shouldn't. It should move to the next cell in a table

### Q3: Shift+Tab behavior?

In contexts where Tab inserts space:

- **A) Do nothing** (Shift+Tab doesn't remove space)
- **B) Remove tab/spaces** at cursor position if present
- **C) Other** - please specify

B

### Q4: Table and Task Item behavior unchanged?

I assume we want to keep the current behavior:

- Tab in table = navigate to next cell
- Tab in task item = indent/nest the item

Is that correct, or should Tab also insert spaces in these contexts?

That is correct, though in a task or list item, tab only indents the item if at the beginning of the line following the list item thing (bullet, checkbox, number, whatever). If it's not, then it will insert horizontal space
