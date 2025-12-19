# Tab Key Indent - Questions 2

## Research: What Most Editors Do

Based on research ([LibreOffice discussion](https://ask.libreoffice.org/t/tab-key-no-contextual-behavior/51521), [Notion](https://notionanswers.com/237/insert-a-tab-character-in-notion), [TinyMCE behavior](https://www.flax.co.uk/index.html@p=1003.html)):

**Traditional word processors (Word, Google Docs, LibreOffice):**

- **Tab mid-line**: Insert a tab character
- **Tab at line start**: Increase paragraph indent (or insert tab)

**Web-based editors** typically use one of:

- Actual `\t` character with `white-space: pre` CSS
- Non-breaking spaces (`&nbsp;`)
- `<span style="white-space:pre">\t</span>` wrapper

**My recommendation for "rule of least surprise":**
Insert a **literal tab character** (`\t`). This matches Word/Google Docs behavior and is the most semantically correct. TipTap/ProseMirror will render it correctly in HTML.

## literal tab it is then.

## Clarification on Q2

Your answer was "Ah, no it shouldn't. It should move to the next cell in a table" - but the question was about **non-table** contexts:

| Context             | Current Q2 Answer             | My Understanding                     |
| ------------------- | ----------------------------- | ------------------------------------ |
| Tables              | Keep current: Tab = next cell | Confirmed                            |
| Paragraph text      | Yes - insert tab              | Main use case                        |
| **Heading (h1-h6)** | ?                             | Insert tab?                          |
| **Code block**      | ?                             | Insert tab? (definitely useful here) |
| **Blockquote**      | ?                             | Insert tab?                          |

Should Tab insert a tab character in headings, code blocks, and blockquotes?

## Yes it should

## Clarification on Q4 - List/Task Item Behavior

You clarified: "tab only indents the item if at the beginning of the line following the list item thing. If it's not, then it will insert horizontal space"

So the logic should be:

```
In task item or list item:
  - Cursor at START of text content → Indent the item (existing behavior)
  - Cursor ANYWHERE ELSE in text → Insert tab character (new behavior)
```

Is this correct?
correct

---

## Summary of Understood Requirements

1. **Tab character**: Insert literal `\t` (not spaces)
2. **Shift+Tab**: Remove tab character at cursor if present
3. **Tables**: Keep existing cell navigation
4. **Task/List items at line start**: Keep existing indent behavior
5. **Task/List items elsewhere**: Insert tab character
6. **Other contexts (paragraph, code, etc.)**: Insert tab character

Please confirm or correct!
