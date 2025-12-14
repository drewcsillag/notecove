# Phase 7: Polish & Edge Cases

**Progress:** `50%`

## Goal

Handle edge cases, improve UX, add debug tooling, and finalize the feature.

---

## 7.1 Handle Orphaned Comments

**Status:** 🟢 Complete

When anchored text is deleted, the comment becomes orphaned.

**Implementation:**
- Added `isOrphaned` property to ThreadWithDetails interface
- Added `isValidAnchor()` helper to detect invalid anchor positions
- Orphaned threads show warning Alert: "The text this comment was attached to has been deleted."
- Original text quote styled with error background, border, and line-through

**Files Modified:**
- `packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx`

---

## 7.2 Handle Overlapping Ranges

**Status:** 🟥 To Do (Deferred)

When multiple comments cover the same text:

**Planned Visual treatment:**
- Darker highlight for overlapped regions
- Add `comment-overlap` class when position has multiple comments

**Planned Click handling:**
- If click hits multiple comments, show selection popover

This feature is deferred as it requires more complex implementation in the TipTap extension.

---

## 7.3 Add Keyboard Navigation in Panel

**Status:** 🟢 Complete

| Key    | Action                           |
| ------ | -------------------------------- |
| ↑/↓    | Navigate between threads         |
| j/k    | Navigate between threads (vim)   |
| R      | Open reply input                 |
| E      | Edit (if owner)                  |
| Escape | Close panel / blur input         |

**Files Modified:**
- `packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx`

---

## 7.4 Add to Storage Inspector

**Status:** 🟢 Complete

Updated YjsUpdatePreview to show comment-related operations:

**Features:**
- Added CommentIcon import
- Added `isCommentRelated()` helper to detect comment operations
- Added `describeCommentOperation()` for human-readable descriptions
- Header shows chip with comment operation count
- Comment-related structs highlighted with warning color and border
- Shows specific operation types: "New comment thread", "Reply added", "Reaction added", etc.

**Files Modified:**
- `packages/desktop/src/renderer/src/components/StorageInspector/YjsUpdatePreview.tsx`

---

## 7.5 Performance Testing (100+ Comments)

**Status:** 🟥 To Do

**Test scenarios:**

1. **Load time:** Open note with 100 comments
   - Target: <500ms to display
   - Measure: Time from note load to panel rendered

2. **Scroll performance:** Scroll through 100 comments in panel
   - Target: 60fps
   - Implement virtualization if needed (react-window)

3. **Editor performance:** Type in note with 100 comment highlights
   - Target: No noticeable lag
   - Measure: Input latency

4. **Memory usage:** Monitor memory with 100 comments
   - No memory leaks on note switch

---

## 7.6 Final E2E Test Suite

**Status:** 🟥 To Do

**File:** `packages/desktop/e2e/comments-full.spec.ts`

Comprehensive scenarios to be implemented.

---

## Definition of Done (Phase 7)

- [x] Orphaned comments handled gracefully
- [ ] Overlapping comments show selection UI (deferred)
- [x] Keyboard navigation works
- [x] Storage Inspector shows comments
- [ ] Performance acceptable with 100+ comments
- [ ] Virtualization implemented if needed
- [ ] Final E2E suite passing

---

## Definition of Done (Overall Feature)

- [x] All 7 phases complete (core functionality)
- [x] All unit tests passing
- [x] All integration tests passing
- [ ] All E2E tests passing
- [ ] CI passes (`pnpm ci-local`)
- [ ] Manual QA complete
- [ ] Code review complete
