# Plan Critique

## 1. Ordering Issues

### Problem: Delayed Feedback Loop

The current plan completes the entire markdown parser (Phase 1) before we can test anything. This is risky because we won't know if our approach works until significant investment.

**Recommendation:** Reorder to get early feedback:

1. Build **minimal** parser first (paragraphs, headings, basic text formatting only)
2. Immediately test with welcome note (Phase 2) - this validates the approach
3. Then iteratively add parser features (lists, code blocks, tables, images)
4. Then build import UI (Phase 4) with the proven parser

agree with recommendation

### Problem: Phase 1.1 is too monolithic

"Support all required elements" as a single checkbox is too large. Should be broken into incremental steps.

---

## 2. Missing Items

### 2.1 Title Extraction Clarification

**Q**: When extracting H1 for title, should the H1 be **removed** from the note content, or kept?

- Remove: Title appears in note list, not duplicated in body
- Keep: Title is visible when editing

**Recommendation:** Remove the first H1 from content when used as title (matches common note app behavior).

Keep -- the title in the note list is the first line of the body.

### 2.2 Progress Reporting Details

For large imports, we need:

- Progress dialog showing "Importing note X of Y: [filename]"
- Ability to see what's happening during long operations

agree

### 2.3 Cancel Support

What if user wants to cancel mid-import?

- **Option A:** Don't support cancel - just let it complete
- **Option B:** Support cancel, but already-imported notes remain
- **Option C:** Support cancel with rollback

**Recommendation:** Option B - simpler, and partial imports are still useful.

Agree

### 2.4 Error Recovery

If import fails partway (e.g., disk full, permission error):

- Already-created notes should remain (don't rollback)
- Show error with summary of what was imported vs what failed
- User can retry the failed items

### 2.5 Missing from IPC: Window Targeting

Need explicit handling to ensure import dialog opens in **focused window**.

### 2.6 ProseMirror → Yjs Conversion

The plan doesn't explicitly address how to convert ProseMirror output to Y.XmlFragment. Need to:

- Research existing y-prosemirror utilities
- Or build custom converter

---

## 3. Debug Tools Needed

### 3.1 Parser Test Utility

Create a simple test script that:

- Takes markdown file as input
- Outputs ProseMirror JSON (for inspection)
- Can be run from command line without full app

```bash
pnpm --filter @notecove/shared test:parse path/to/file.md
```

### 3.2 Import Dry Run

Add a "Preview" mode that shows what will be imported without actually doing it.

---

## 4. Dependency Risk: prosemirror-markdown

**Concern:** `prosemirror-markdown` uses a specific ProseMirror schema. Our TipTap extensions (NotecoveImage, TriStateTaskItem, NotecoveTable, etc.) use custom node types that won't match.

**Options:**

1. Use `prosemirror-markdown` with custom schema that matches our TipTap extensions
2. Use `marked` or `remark` to parse markdown to AST, then custom-build ProseMirror nodes
3. Use TipTap's built-in `generateJSON()` with HTML input (parse markdown to HTML first)

**Recommendation:** Option 3 might be simplest:

```
Markdown → marked → HTML → TipTap generateJSON() → ProseMirror JSON → Y.XmlFragment
```

This leverages TipTap's existing HTML parsing which already knows about our custom extensions.

## Option 3 sounds reasonable. If necessary we can back up and try marked or remark. Make sure to make mention of this in the plan in an appropriate place.

## 5. Revised Phase Order

```
Phase 1: Minimal Parser + Welcome Note (Quick Win)
  1.1 Research: Validate markdown → HTML → TipTap approach
  1.2 Implement minimal markdown-to-prosemirror (paragraphs, headings, bold, italic)
  1.3 Implement prosemirror-to-yjs conversion
  1.4 Create welcome.md resource file
  1.5 Update ensureDefaultNote() to use markdown
  1.6 Test: Welcome note renders correctly

Phase 2: Extended Parser
  2.1 Add list support (bullet, ordered, task/checkbox)
  2.2 Add code block support
  2.3 Add table support
  2.4 Add blockquote and horizontal rule support
  2.5 Add image reference extraction

Phase 3: Import Backend
  (as originally planned)

Phase 4: Import Frontend
  (as originally planned)

Phase 5: Testing & Polish
  (as originally planned)
```

---

## 6. Questions for User

**Q16:** When using H1 as title, should the H1 be removed from the note content?

No

**Q17:** For cancel support, is Option B (cancel keeps already-imported notes) acceptable?
yes

**Q18:** Should we add a "Preview" / dry-run mode to the import dialog?
no

---

## 7. Updated Risk Assessment

| Risk                               | Likelihood | Impact | Mitigation                                     |
| ---------------------------------- | ---------- | ------ | ---------------------------------------------- |
| ProseMirror schema mismatch        | High       | High   | Use HTML intermediate (marked → HTML → TipTap) |
| Large imports slow                 | Medium     | Medium | Progress indicator, chunked async processing   |
| Y.XmlFragment conversion issues    | Medium     | High   | Test early with welcome note                   |
| Dialog in wrong window             | Low        | Medium | BrowserWindow.getFocusedWindow()               |
| CRDT sync issues with many updates | Low        | Medium | Batch updates, test with multi-instance        |
