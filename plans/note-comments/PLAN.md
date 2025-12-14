# Note Comments Feature - Implementation Plan

**Overall Progress:** `75%`

## Summary

Implement Google Docs-style commenting on text selections in notes. Users can select text, add comments, reply in threads, resolve discussions, react with emojis, and @-mention other users.

## Key Decisions (from Q&A)

| Decision          | Choice                                            |
| ----------------- | ------------------------------------------------- |
| Data Storage      | CRDT (Y.Map in note doc) with lazy initialization |
| Range Anchoring   | Yjs RelativePosition                              |
| Reply Threading   | Single-level (flat)                               |
| Character Limits  | Soft limit 10k chars, warn at 5k                  |
| Undo/Redo         | Separate from editor (not integrated)             |
| Copy/Paste        | Comments don't copy with text                     |
| Virtualization    | At 20+ threads, collapse replies at 3+            |
| Storage Inspector | Yes, add comments to debug view                   |

## Restructured Plan (Minimal Vertical Slice)

The plan is restructured to deliver a testable end-to-end flow as early as possible.

---

## Phase 1: Minimal End-to-End (Threads Only) ✅

**Goal:** Get basic commenting working end-to-end: select text → add comment → see highlight → view in panel.

See: [PLAN-phase1-minimal.md](./PLAN-phase1-minimal.md)

- [x] 🟢 **1.1 Define minimal types (CommentThread only)**
- [x] 🟢 **1.2 Extend NoteDoc with comments Y.Map**
- [x] 🟢 **1.3 Add comment_threads SQLite table**
- [x] 🟢 **1.4 Implement thread CRUD in database**
- [x] 🟢 **1.5 Add IPC handlers (create/read/delete thread)**
- [x] 🟢 **1.6 Expose in preload bridge**
- [x] 🟢 **1.7 Create CommentMarker TipTap extension**
- [x] 🟢 **1.8 Create minimal CommentPanel**
- [x] 🟢 **1.9 Integrate with EditorPanel**
- [x] 🟢 **1.10 Write tests (unit + integration)**

**🎯 Checkpoint:** Full flow testable - select text, add comment, see highlight, view in panel ✅

---

## Phase 2: Replies ✅

**Goal:** Add threaded replies to comments.

See: [PLAN-phase2-replies.md](./PLAN-phase2-replies.md)

- [x] 🟢 **2.1 Add CommentReply type**
- [x] 🟢 **2.2 Extend NoteDoc for replies**
- [x] 🟢 **2.3 Add comment_replies SQLite table**
- [x] 🟢 **2.4 Add reply IPC handlers**
- [x] 🟢 **2.5 Create CommentReply UI component**
- [x] 🟢 **2.6 Add reply input to threads**
- [x] 🟢 **2.7 Write tests**

---

## Phase 3: Resolution & Edit/Delete ✅

**Goal:** Allow resolving threads and editing/deleting own comments.

See: [PLAN-phase3-resolution.md](./PLAN-phase3-resolution.md)

- [x] 🟢 **3.1 Add resolved fields to CommentThread**
- [x] 🟢 **3.2 Implement resolve/reopen IPC**
- [x] 🟢 **3.3 Add "Show resolved" toggle to panel**
- [x] 🟢 **3.4 Implement edit mode for comments**
- [x] 🟢 **3.5 Implement delete with confirmation**
- [x] 🟢 **3.6 Add ownership validation**
- [x] 🟢 **3.7 Write tests**

---

## Phase 4: Emoji Reactions ✅

**Goal:** Allow emoji reactions on comments and replies.

See: [PLAN-phase4-reactions.md](./PLAN-phase4-reactions.md)

- [x] 🟢 **4.1 Add CommentReaction type**
- [x] 🟢 **4.2 Extend NoteDoc for reactions**
- [x] 🟢 **4.3 Add comment_reactions SQLite table**
- [x] 🟢 **4.4 Add reaction IPC handlers**
- [x] 🟢 **4.5 Create ReactionPicker component**
- [x] 🟢 **4.6 Create ReactionDisplay component**
- [x] 🟢 **4.7 Write tests**

---

## Phase 5: @-Mentions

**Goal:** Enable @-mentioning users with autocomplete.

See: [PLAN-phase5-mentions.md](./PLAN-phase5-mentions.md)

- [ ] 🟥 **5.1 Create mention user IPC handler**
- [ ] 🟥 **5.2 Build MentionAutocomplete component**
- [ ] 🟥 **5.3 Integrate with CommentInput**
- [ ] 🟥 **5.4 Style mentions in rendered comments**
- [ ] 🟥 **5.5 Write tests**

---

## Phase 6: Toolbar & Keyboard Integration (Partial)

**Goal:** Provide multiple entry points for adding comments.

See: [PLAN-phase6-toolbar.md](./PLAN-phase6-toolbar.md)

- [x] 🟢 **6.1 Add toolbar button (selection-dependent)**
- [x] 🟢 **6.2 Add keyboard shortcut (Cmd+Alt+M)** (changed from Cmd+Shift+M)
- [x] 🟢 **6.3 Add context menu item**
- [x] 🟢 **6.4 Add comment count badge**
- [ ] 🟥 **6.5 Write E2E tests**

---

## Phase 7: Polish & Edge Cases

**Goal:** Handle edge cases and finalize the feature.

See: [PLAN-phase7-polish.md](./PLAN-phase7-polish.md)

- [ ] 🟥 **7.1 Handle orphaned comments**
- [ ] 🟥 **7.2 Handle overlapping ranges**
- [x] 🟢 **7.3 Add keyboard navigation in panel**
- [ ] 🟥 **7.4 Add to Storage Inspector**
- [ ] 🟥 **7.5 Performance testing (100+ comments)**
- [ ] 🟥 **7.6 Final E2E test suite**

---

## Testing Strategy

| Layer       | Scope                  | Location                                                     |
| ----------- | ---------------------- | ------------------------------------------------------------ |
| Unit        | CRDT operations, types | `packages/shared/src/__tests__/`                             |
| Unit        | Database CRUD          | `packages/desktop/src/main/database/__tests__/`              |
| Unit        | UI components          | `packages/desktop/src/renderer/src/components/**/__tests__/` |
| Integration | IPC round-trips        | `packages/desktop/src/main/__tests__/`                       |
| E2E         | Full user flows        | `packages/desktop/e2e/`                                      |

---

## Files Overview

### New Files

```
packages/shared/src/
├── comments/
│   ├── types.ts
│   └── __tests__/types.test.ts

packages/desktop/src/
├── main/
│   ├── comments/
│   │   ├── comment-manager.ts
│   │   └── __tests__/comment-manager.test.ts
├── renderer/src/
│   ├── components/
│   │   ├── CommentPanel/
│   │   │   ├── CommentPanel.tsx
│   │   │   ├── CommentThread.tsx
│   │   │   ├── CommentReply.tsx
│   │   │   ├── CommentInput.tsx
│   │   │   ├── CommentContent.tsx
│   │   │   ├── ReactionPicker.tsx
│   │   │   ├── ReactionDisplay.tsx
│   │   │   ├── MentionAutocomplete.tsx
│   │   │   └── index.ts
│   │   └── EditorPanel/extensions/
│   │       └── CommentMarker.ts
│   └── hooks/
│       └── useComments.ts
```

### Modified Files

```
packages/shared/src/
├── database/schema.ts          # Add comment tables
├── crdt/note-doc.ts            # Add comments Y.Map

packages/desktop/src/
├── main/
│   ├── ipc/handlers.ts         # Register comment handlers
│   ├── ipc/types.ts            # Add comment IPC types
│   └── database/database.ts    # Add comment CRUD
├── renderer/src/
│   └── components/EditorPanel/
│       ├── EditorPanel.tsx     # Add CommentPanel
│       └── TipTapEditor.tsx    # Add CommentMarker extension
├── preload/index.ts            # Expose comment APIs
└── renderer/src/types/electron.d.ts
```

---

## Links

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial requirements questions
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up questions
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Plan critique questions
