# Syntax Highlighting for Code Blocks

**Overall Progress:** `100%` (Phases 1-6 complete, docs deferred)

## Summary

Add syntax highlighting for triple-quoted code blocks (` ``` `) in notes with:

- One Dark/One Light theme (Atom-style)
- Common language subset (~15 languages)
- Language selector dropdown + markdown syntax support
- Toolbar button for code block creation
- Optional line numbers (toggleable)
- Copy button on hover

## Decisions (from QUESTIONS-1.md)

| Question               | Answer                               |
| ---------------------- | ------------------------------------ |
| Language specification | C: Both markdown syntax AND dropdown |
| Theme                  | B: One Dark/One Light (Atom-style)   |
| Languages              | A: Common subset (~15)               |
| Creation UX            | C: Both markdown AND toolbar button  |
| Line numbers           | C: Optional toggle                   |
| Copy button            | A: Yes, on hover                     |

## Decisions (from QUESTIONS-PLAN-1.md)

| Question              | Answer                                     |
| --------------------- | ------------------------------------------ |
| Language aliases      | A: Rely on lowlight's built-in aliases     |
| No language specified | B: Auto-detect language                    |
| Keyboard shortcut     | A: Cmd+Shift+C (Ctrl+Shift+C on Win/Linux) |
| Markdown import test  | A: Add explicit test                       |

## Plan Critique Notes

See [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) for full critique.

**Key findings incorporated:**

- Phase 1 ordering: Add basic styles before integration for visual feedback
- Added auto-detection for blocks without language specified
- Added keyboard shortcut (Cmd+Shift+C) to Phase 3
- Expanded import testing in Phase 6
- Risk: NodeView may affect Yjs collaboration - test early in Phase 2

## Architecture

### Dependencies to Add

- `@tiptap/extension-code-block-lowlight` - TipTap's syntax highlighting extension
- `lowlight` - Syntax highlighting engine (highlight.js compatible)
- Language grammars from highlight.js (selective imports)

### Component Structure

```
src/renderer/src/components/EditorPanel/
├── extensions/
│   └── CodeBlockLowlight.ts    # Custom extension wrapping @tiptap/extension-code-block-lowlight
├── CodeBlockComponent.tsx       # React component for code block UI (dropdown, copy, line numbers)
├── codeBlockTheme.ts           # One Dark/One Light CSS-in-JS styles
└── TipTapEditor.tsx            # Update to use new extension
```

---

## Phase 1: Core Syntax Highlighting

**Goal:** Get basic syntax highlighting working with markdown syntax (` ```javascript `)

### Tasks

- [x] 🟩 **1.1 Install dependencies**
  - [x] 🟩 Add `@tiptap/extension-code-block-lowlight` to package.json
  - [x] 🟩 Add `lowlight` to package.json
  - [x] 🟩 Run pnpm install

- [x] 🟩 **1.2 Create CodeBlockLowlight extension**
  - [x] 🟩 Write test for extension configuration
  - [x] 🟩 Create `extensions/CodeBlockLowlight.ts`
  - [x] 🟩 Configure lowlight with common language subset
  - [x] 🟩 Enable auto-detection for blocks without language specified
  - [x] 🟩 Verify test passes

- [x] 🟩 **1.3 Integrate into TipTapEditor**
  - [x] 🟩 Write test for code block rendering with highlighting
  - [x] 🟩 Replace StarterKit's codeBlock with CodeBlockLowlight
  - [x] 🟩 Disable codeBlock in StarterKit.configure()
  - [x] 🟩 Verify test passes

- [x] 🟩 **1.4 Add One Dark/One Light theme styles**
  - [x] 🟩 Create `codeBlockTheme.ts` with CSS-in-JS styles
  - [x] 🟩 Add highlight.js token class styles (`.hljs-keyword`, `.hljs-string`, etc.)
  - [x] 🟩 Support both light and dark mode via theme.palette.mode
  - [x] 🟩 Integrate styles into TipTapEditor's `sx` prop

---

## Phase 2: Language Selector Dropdown

**Goal:** Add UI for selecting/changing code block language

### Tasks

- [x] 🟩 **2.1 Create CodeBlockComponent**
  - [x] 🟩 Write test for language dropdown rendering
  - [x] 🟩 Create `CodeBlockComponent.tsx` as NodeViewWrapper
  - [x] 🟩 Add language dropdown in top-right corner
  - [x] 🟩 Populate dropdown with supported languages
  - [x] 🟩 Verify test passes

- [x] 🟩 **2.2 Wire dropdown to node attrs**
  - [x] 🟩 Write test for language change updating highlighting
  - [x] 🟩 Implement onChange handler to update node's language attr
  - [x] 🟩 Verify highlighting updates when language changes
  - [x] 🟩 Verify test passes

- [x] 🟩 **2.3 Configure extension to use React component**
  - [x] 🟩 Use `addNodeView()` to render CodeBlockComponent
  - [x] 🟩 Ensure content editable area still works

---

## Phase 3: Toolbar Button

**Goal:** Add code block button to editor toolbar

### Tasks

- [x] 🟩 **3.1 Add toolbar button**
  - [x] 🟩 Write unit test for toolbar code block button (E2E tests in Phase 6)
  - [x] 🟩 Add DataObject icon button to EditorToolbar
  - [x] 🟩 Implement click handler to insert code block
  - [x] 🟩 Verify test passes

- [x] 🟩 **3.2 Button state management**
  - [x] 🟩 Highlight button when cursor is in code block
  - [x] 🟩 Toggle behavior: click in code block converts back to paragraph

- [x] 🟩 **3.3 Keyboard shortcut**
  - [x] 🟩 Write test for keyboard shortcut registration
  - [x] 🟩 Add keyboard handler for Mod-Shift-c (Cmd+Shift+C on Mac, Ctrl+Shift+C on Win/Linux)
  - [x] 🟩 Toggle behavior: shortcut in code block converts back to paragraph
  - [x] 🟩 Verify test passes

---

## Phase 4: Copy Button

**Goal:** Add copy-to-clipboard button that appears on hover

### Tasks

- [x] 🟩 **4.1 Add copy button UI**
  - [x] 🟩 Write test for copy button visibility on hover
  - [x] 🟩 Add ContentCopy icon button to CodeBlockComponent
  - [x] 🟩 Show on hover (with language dropdown), hide otherwise
  - [x] 🟩 Verify test passes

- [x] 🟩 **4.2 Implement copy functionality**
  - [x] 🟩 Write test for clipboard content after copy
  - [x] 🟩 Implement click handler using navigator.clipboard.writeText
  - [x] 🟩 Show "Copied!" feedback with Check icon (2 second duration)
  - [x] 🟩 Verify test passes

---

## Phase 5: Line Numbers

**Goal:** Add optional line numbers with toggle

### Tasks

- [x] 🟩 **5.1 Add line number rendering**
  - [x] 🟩 Write test for line number display
  - [x] 🟩 Add line number gutter to CodeBlockComponent
  - [x] 🟩 Style line numbers (muted color, right-aligned)
  - [x] 🟩 Line numbers sync with content lines
  - [x] 🟩 Verify test passes

- [x] 🟩 **5.2 Add toggle control**
  - [x] 🟩 Write test for line number toggle
  - [x] 🟩 Add FormatListNumbered icon toggle button to code block UI
  - [x] 🟩 Store preference in node attrs (showLineNumbers per-block)
  - [x] 🟩 Verify test passes

- [ ] ⬜ **5.3 Global setting (optional - deferred)**
  - [ ] ⬜ Add default line numbers preference to app settings
  - [ ] ⬜ New blocks inherit global default
  - [ ] ⬜ Per-block toggle overrides global

---

## Phase 6: Polish & Testing

**Goal:** Ensure quality and handle edge cases

### Tasks

- [x] 🟩 **6.1 Markdown export/import**
  - [x] 🟩 Verified existing tests for markdown export with language tag
  - [x] 🟩 Verified markdown-export.ts handles language attr correctly
  - [x] 🟩 Verified markdownToProsemirror handles language on import
  - [x] 🟩 Added test verifying showLineNumbers doesn't affect export
  - [x] 🟩 Round-trip preserves language (existing tests confirm)

- [x] 🟩 **6.2 Collaboration/Sync**
  - [x] 🟩 Attributes stored in node.attrs (standard Yjs sync)
  - [x] 🟩 Language and showLineNumbers sync via standard Yjs CRDT

- [x] 🟩 **6.3 Edge cases**
  - [x] 🟩 Test empty code blocks
  - [x] 🟩 Test very long lines
  - [x] 🟩 Test code with special characters (HTML, unicode, tabs)
  - [x] 🟩 Test unknown language tags (graceful fallback)
  - [x] 🟩 Test multiline code

- [ ] ⬜ **6.4 Documentation (deferred)**
  - [ ] ⬜ Update website docs with code block feature
  - [ ] ⬜ Add screenshots

---

## Supported Languages (Phase 1)

```typescript
const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'go',
  'rust',
  'ruby',
  'php',
  'html',
  'css',
  'sql',
  'json',
  'yaml',
  'markdown',
  'bash',
  'shell',
  'xml',
  'diff',
];
```

---

## Theme Colors Reference (One Dark/One Light)

### One Dark (dark mode)

```css
--background: #282c34 --foreground: #abb2bf --comment: #5c6370 --keyword: #c678dd --string: #98c379
  --number: #d19a66 --function: #61afef --variable: #e06c75 --type: #e5c07b --operator: #56b6c2;
```

### One Light (light mode)

```css
--background: #fafafa --foreground: #383a42 --comment: #a0a1a7 --keyword: #a626a4 --string: #50a14f
  --number: #986801 --function: #4078f2 --variable: #e45649 --type: #c18401 --operator: #0184bc;
```

---

## Risk Assessment

| Risk                                              | Mitigation                                                     |
| ------------------------------------------------- | -------------------------------------------------------------- |
| Bundle size increase                              | Selective language imports, tree-shaking                       |
| Performance with large code blocks                | Lazy highlighting, virtualization if needed                    |
| Collaboration conflicts on language attr          | Standard Yjs conflict resolution                               |
| Copy button interfering with selection            | Position outside editable area                                 |
| NodeView breaks Yjs collaboration                 | Test early in Phase 2, use `NodeViewContent` for editable area |
| Language dropdown blocks text selection           | Use `contentEditable={false}` on dropdown container            |
| Styles conflict with existing `pre`/`code` styles | Scope styles to `.code-block-lowlight` class                   |
| Auto-detect guesses wrong language                | Show detected language in dropdown, user can override          |

---

## Files to Modify/Create

### New Files

- `src/renderer/src/components/EditorPanel/extensions/CodeBlockLowlight.ts`
- `src/renderer/src/components/EditorPanel/CodeBlockComponent.tsx`
- `src/renderer/src/components/EditorPanel/codeBlockTheme.ts`
- `src/renderer/src/components/EditorPanel/extensions/__tests__/CodeBlockLowlight.test.ts`

### Modified Files

- `packages/desktop/package.json` (dependencies)
- `src/renderer/src/components/EditorPanel/TipTapEditor.tsx` (extension + styles)
- `src/renderer/src/components/EditorPanel/EditorToolbar.tsx` (code block button)
- `src/renderer/src/utils/markdown-export.ts` (verify language handling)
