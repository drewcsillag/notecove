# Questions for Text Marks on Chips

## Current Architecture Summary

I've analyzed the codebase and found:

1. **Date Chips** (`DateChip.ts`): Use ProseMirror **decorations** - they don't modify the document structure. The text remains as plain `YYYY-MM-DD` in the document, and decorations add CSS styling via `Decoration.inline()`.

2. **People Chips** (`MentionNode.ts`): Use TipTap **atomic nodes** with `atom: true`. These are indivisible units - you can't place a cursor inside them.

3. **Text marks** (bold, italic, underline, strike): Applied to text ranges. They work on text nodes, not on atomic nodes.

## Key Technical Finding

These two chip types have fundamentally different architectures:

### Date Chips (Decoration-based)

- **Good news**: The underlying text already supports marks! If you type `**2025-01-15**` in markdown, the date text would have bold marks applied, and the decoration would render on top.
- **Current behavior**: Marks ARE preserved in the document - they just don't visually affect the chip styling because the `.date-chip` CSS class overrides everything.
- **Fix needed**: Update CSS to inherit/show marks (bold, italic, etc.) on `.date-chip` elements.

### Mention Chips (Atomic nodes)

- **Challenge**: Atomic nodes in ProseMirror can't have marks applied directly - they're treated as single units.
- **Options**:
  1. Make `MentionNode` support marks by setting `marks: '_'` in the node spec (allows all marks)
  2. Store mark state in node attributes (e.g., `isBold`, `isItalic`)
  3. Change from atomic node to inline content with special handling

---

## Questions

### Q1: Visual Behavior

When a date or mention chip has formatting applied, how should it look?

**Option A**: The chip styling takes precedence, but text formatting shows through

- Example: A bold date chip would have slightly bolder text inside the chip background

**Option B**: Formatting overrides chip styling

- Example: A bold+italic date just looks like bold italic text (loses chip appearance)

**Option C**: Chip styling adapts based on formatting

- Example: Bold chips get a slightly darker background or border to indicate they're formatted

A

### Q2: Scope - Which Marks?

Which text marks should apply to chips?

- [x] Bold
- [x] Italic
- [ ] Underline
- [ ] Strikethrough
- [ ] Code (inline monospace)
- [ ] Other?

Underline and strikethrough

### Q3: Scope - Which Chips?

Which chip types should support marks?

- [ ] Date chips (`YYYY-MM-DD` patterns)
- [ ] Mention chips (`@user` references)
- [ ] Both

both

### Q4: Selection Behavior for Mentions

Currently, mention chips are atomic - clicking them selects the entire chip. If we allow marks:

**Option A**: Keep atomic behavior - you'd need to select the mention and surrounding text, then apply bold
**Option B**: Allow cursor inside the mention text (changes the editing experience significantly)

A

### Q5: Markdown Roundtrip

When exporting/copying as markdown, should we preserve marks on chips?

- Example: A bold mention would become `**@username**` in markdown
- Or should marks be stripped when exporting?

## I think marks can be stripped on export

Please answer these questions so I can proceed with planning.
