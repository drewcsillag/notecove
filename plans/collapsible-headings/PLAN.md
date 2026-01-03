# Collapsible Headings Implementation Plan

**Overall Progress:** `0%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)
**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md), [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md)

## Summary of Decisions

- **Persistence:** Collapsed state is stored in document (syncs via Yjs)
- **Collaboration:** Collapse state syncs to all collaborators
- **Default:** New headings start expanded
- **Shortcuts:** `Cmd/Ctrl+.` toggle, `Cmd/Ctrl+Shift+.` collapse/expand all
- **Print/Export:** Always show full content (ignore collapse state)
- **Toggle visibility:** Always visible (not hover-only)
- **Copy/paste:** Include hidden content
- **Split heading:** New heading is expanded
- **Architecture:** Full decoration-based approach
- **Docs:** Add to website features

## Architecture

### Two-Part System

1. **CollapsibleHeading extension** - Extends Heading node with:
   - `collapsed: boolean` attribute (default: false)
   - NodeView that renders toggle button (▶/▼)
   - Keyboard shortcuts for toggling
   - Commands: `toggleHeadingCollapse`, `collapseAllHeadings`, `expandAllHeadings`

2. **CollapseDecorations plugin** - ProseMirror plugin that:
   - Scans document for collapsed headings
   - Calculates which node ranges should be hidden
   - Applies widget/node decorations with `display: none`
   - Recalculates on every document change

### Hiding Logic

For a collapsed heading at level N, hide all nodes until:

- End of document, OR
- A heading of level ≤ N (same or higher importance)

Example with h2 collapsed at position 10:

```
pos 10: ## Collapsed Heading  <-- collapsed=true
pos 20: paragraph             <-- HIDE
pos 30: ### Subheading        <-- HIDE (h3 < h2 in importance)
pos 40: paragraph             <-- HIDE
pos 50: ## Next Section       <-- STOP (h2 = h2)
```

## Tasks

### Phase 1: Core Extension

- [ ] 🟥 **Step 1: Create CollapsibleHeading extension (basic)**
  - [ ] 🟥 Write test: heading has `collapsed` attribute, defaults to false
  - [ ] 🟥 Write test: existing headings without attr are treated as expanded
  - [ ] 🟥 Write test: split heading (Enter) creates expanded heading
  - [ ] 🟥 Extend StarterKit Heading with `collapsed` attribute
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **Step 2: Create CollapsibleHeading NodeView**
  - [ ] 🟥 Write test: heading renders with toggle button
  - [ ] 🟥 Write test: clicking toggle updates `collapsed` attribute
  - [ ] 🟥 Write test: toggle shows ▶ when collapsed, ▼ when expanded
  - [ ] 🟥 Implement NodeView with toggle button (always visible)
  - [ ] 🟥 Add toggle click handler that updates node attribute
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **Step 3: Create CollapseDecorations plugin**
  - [ ] 🟥 Write test: collapsed h2 hides content until next h2 or h1
  - [ ] 🟥 Write test: collapsed h1 hides content until next h1
  - [ ] 🟥 Write test: nested headings are hidden correctly
  - [ ] 🟥 Write test: multiple collapsed headings work independently
  - [ ] 🟥 Implement plugin that calculates hidden ranges
  - [ ] 🟥 Apply node decorations with hiding class
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **Step 4: Add keyboard shortcuts**
  - [ ] 🟥 Write test: Mod-. toggles collapse on heading at cursor
  - [ ] 🟥 Write test: Mod-. does nothing when cursor not in heading
  - [ ] 🟥 Write test: Mod-Shift-. collapses all if any expanded
  - [ ] 🟥 Write test: Mod-Shift-. expands all if all collapsed
  - [ ] 🟥 Add `toggleHeadingCollapse` command
  - [ ] 🟥 Add `collapseAllHeadings` / `expandAllHeadings` commands
  - [ ] 🟥 Wire up keyboard shortcuts
  - [ ] 🟥 Update PLAN.md

### Phase 2: Styling & Integration

- [ ] 🟥 **Step 5: Add styles**
  - [ ] 🟥 Add toggle button styles to `tipTapEditorStyles.ts`
  - [ ] 🟥 Add collapsed content hiding styles (`.collapsed-content { display: none }`)
  - [ ] 🟥 Add print media query to show all content
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **Step 6: Integrate into editor**
  - [ ] 🟥 Update `getEditorExtensions.ts` to disable StarterKit heading
  - [ ] 🟥 Add CollapsibleHeading extension
  - [ ] 🟥 Add CollapseDecorations plugin
  - [ ] 🟥 Verify Yjs sync works with `collapsed` attribute
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **Step 7: Verify export behavior**
  - [ ] 🟥 Write test: markdown export includes collapsed content
  - [ ] 🟥 Write test: print preview shows all content
  - [ ] 🟥 Update PLAN.md

### Phase 3: Documentation & Validation

- [ ] 🟥 **Step 8: Update website documentation**
  - [ ] 🟥 Add collapsible headings to `website/features/rich-text-editing.md`
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **Step 9: Final validation**
  - [ ] 🟥 Run full CI suite
  - [ ] 🟥 Manual testing of collapse behavior
  - [ ] 🟥 Update PLAN.md with final status

## File Structure

```
packages/desktop/src/renderer/src/components/EditorPanel/extensions/
├── CollapsibleHeading.ts          # Main extension
├── CollapseDecorations.ts         # Plugin for hiding content
├── __tests__/
│   ├── CollapsibleHeading.test.ts
│   └── CollapseDecorations.test.ts
```

## Deferred Items

None

## Risks & Considerations

1. **Performance**: Decoration recalculation on every edit. Mitigation: Only recalc when heading nodes change.

2. **Selection across hidden content**: What if user selects from before to after a collapsed section? The hidden content should still be selected (copy includes it).

3. **Cursor in hidden content**: If cursor is in content that becomes hidden, need to move it. Mitigation: Auto-expand the heading if cursor would be hidden.
