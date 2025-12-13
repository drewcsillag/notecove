# Questions for Tables in Notes Feature

Based on my analysis of the NoteCove codebase, I need clarification on the following items before creating an implementation plan.

## Overview

NoteCove uses TipTap 2.26.4 (built on ProseMirror) with Yjs for collaborative editing. Tables would be implemented as block nodes similar to how images are implemented. TipTap has official table extensions (`@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`) that we could use as a foundation.

---

## 1. Implementation Approach

**Option A: Use Official TipTap Table Extensions**

- Pros: Well-tested, maintained by TipTap team, handles edge cases, supports cell selection, merging, etc.
- Cons: Less control, may include features we don't want, adds ~4 dependencies

**Option B: Build Custom Table Extension**

- Pros: Full control, minimal footprint, can build exactly what we need
- Cons: More work, need to handle all edge cases (cell navigation, selection, merging)

**Option C: Hybrid - Use Official Extensions + Customizations**

- Pros: Get working foundation quickly, customize where needed
- Cons: Need to understand TipTap table internals to customize

**Question:** Which approach do you prefer?

My recommendation: Option C. The TipTap table extensions are battle-tested and handle complex edge cases (keyboard navigation, cell selection, column resizing). We can layer our own styling and toolbar UI on top.

## C

## 2. Table Features - Core

Which core features should tables have?

**Structure:**

- [x ] Fixed columns (user sets column count at creation)
- [x ] Dynamic columns (add/remove columns after creation)
- [x ] Header row (first row styled differently)
- [x ] Header column (first column styled differently)

**Navigation:**

- [ x] Tab to move between cells
- [ x] Shift+Tab to move backwards
- [ x] Arrow keys to navigate
- [ x] Enter to create new row (when in last cell)

**Question:** Which features are must-haves for initial release?
all of the above

---

## 3. Table Features - Advanced

Which advanced features (if any) should be included?

- [ ] **Cell merging** (merge cells horizontally/vertically)
- [x ] **Column resizing** (drag column borders)
- [ ] **Row reordering** (drag to reorder rows)
- [ ] **Column reordering** (drag to reorder columns)
- [ ] **Sort by column** (click header to sort)
- [ ] **Cell background colors**
- [x ] **Cell text alignment** (left/center/right per cell)
- [x ] **Column-level text alignment** (apply to all cells in column)

**Question:** Should any of these be in v1, or are they all "later"?
see checked items above

---

## 4. Table Insertion Methods

How should users create tables?

- [x ] **Toolbar button** - Opens dialog to select rows × columns
- [x ] **Markdown syntax** - e.g., `| col1 | col2 |` auto-converts
- [ ] **Slash command** - `/table` or `/table 3x3`
- [ ] **Keyboard shortcut** - e.g., Cmd+Shift+T (not currently used)

**Question:** Which insertion methods should be supported?
toolbar and markdown syntax

---

## 5. Table Size Constraints

Should there be limits on table dimensions?

**Questions:**

- Maximum columns? (e.g., 20?)
- Maximum rows? (e.g., 1000?)
- Minimum size? (1 row × 1 col seems pointless, 2×2 minimum?)
- Default size for new tables? (e.g., 3 columns × 3 rows?)

## The examples seem like reasonable constraints

## 6. Cell Content

What content should be allowed inside table cells?

- [x] **Plain text** (obviously)
- [ x] **Rich text** (bold, italic, code, links)
- [ x] **Hashtags** (#tag support)
- [x ] **Inter-note links** ([[note-id]] support)
- [ ] **Task checkboxes** (tri-state task items)
- [ ] **Images** (inline images in cells)
- [ ] **Lists** (bullet/numbered lists in cells)
- [ ] **Code blocks** (multi-line code in cells)

**Question:** Which cell content types should be supported? My suggestion: Rich text, hashtags, and inter-note links. Others may complicate layout significantly.
checked the ones i wanted above

---

## 7. Table Toolbar/Context Menu

When user is in a table or has a table selected, what UI should appear?

**Options:**

- [ ] **Floating toolbar** near table (like Notion)
- [ ] **Context menu** on right-click
- [x ] **Main toolbar changes** (additional table buttons appear)
- [ ] **Cell hover buttons** (+ buttons at edges to add row/column)

**Actions needed:**

- Add row above/below
- Add column left/right
- Delete row
- Delete column
- Delete entire table
- Toggle header row
- Toggle header column

**Question:** What UI style do you prefer for table manipulation?
main toolbar changes

---

## 8. Styling

How should tables look?

**Border options:**

- [x] Bordered (all cells have visible borders)
- [ ] Borderless (clean look, just content)
- [ ] User can toggle between styles

**Header styling:**

- [ ] Bold text
- [x] Background color (subtle gray)
- [ ] Both

**Hover/Selection:**

- [x] Row highlight on hover
- [x] Cell highlight on selection
- [x] Multi-cell selection visual

**Question:** Preferred table styling? I'd suggest bordered by default with subtle header background.
I like your suggestions

---

## 9. Copy/Paste Behavior

**Pasting tables from other apps (Excel, Google Sheets, web pages):**

- Should pasted HTML tables be converted to NoteCove tables?
  yes
- Should pasted tab-separated text become a table?
  yes

**Copying from NoteCove:**

- Should copying a table produce HTML table markup?
- Should it produce markdown table syntax?
- Both (HTML for rich paste, markdown as fallback)?

**Question:** What copy/paste behavior do you expect?
both

---

## 10. Export Considerations

When exporting notes to Markdown/HTML:

- Tables should export as proper Markdown tables (using `|` syntax)
- Tables should export as proper HTML `<table>` elements

**Question:** Any special export requirements?

## use `|` syntax

## 11. Keyboard Shortcuts for Table Actions

Should there be keyboard shortcuts for common table operations?

| Action           | Possible Shortcut         |
| ---------------- | ------------------------- |
| Add row below    | Cmd+Enter (when in table) |
| Add column right | Cmd+Shift+Enter           |
| Delete row       | Cmd+Backspace             |
| Delete column    | Cmd+Shift+Backspace       |

**Question:** Should table operations have shortcuts? If so, any preferences?

## Those seem reasonable

## 12. Empty Table Behavior

What happens if a table becomes empty (all cells deleted)?

- Delete the table automatically?
- Leave an empty table structure?
- Show a placeholder to recreate?

**Question:** Preferred behavior for empty/near-empty tables?

## Delete the table

## 13. Accessibility

Should tables have accessibility features?

- [ ] Table caption (like `<caption>`)
- [ ] Scope headers (for screen readers)
- [ ] ARIA attributes

**Question:** Is accessibility a priority for v1?
yes

---

## Summary of Decisions

| Question                | Decision                                              |
| ----------------------- | ----------------------------------------------------- |
| Implementation approach | Hybrid (TipTap official + customizations)             |
| Core features           | All: headers, dynamic columns, full keyboard nav      |
| Advanced features       | Column resizing, cell/column alignment                |
| Insertion methods       | Toolbar button, Markdown syntax                       |
| Size constraints        | 2×2 min, 20 cols max, 1000 rows max, 3×3 default      |
| Cell content            | Plain text, rich text, hashtags, inter-note links     |
| UI style                | Main toolbar changes when in table                    |
| Styling                 | Bordered, subtle header bg, row hover, cell selection |
| Copy/paste              | Convert pasted tables, output HTML + Markdown         |
| Export                  | Markdown `\|` syntax                                  |
| Shortcuts               | Cmd+Enter (row), Cmd+Shift+Enter (col), etc.          |
| Empty tables            | Auto-delete                                           |
| Accessibility           | Yes (v1 priority)                                     |

See [PLAN.md](./PLAN.md) for full implementation plan.
