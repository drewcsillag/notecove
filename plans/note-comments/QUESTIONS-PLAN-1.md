# Plan Review Questions

## 1. Migration Strategy

When we add the `comments` Y.Map to NoteDoc, what happens to existing notes?

**Options:**

- **A) Lazy initialization**: Comments map is created on first access. Existing notes work fine.
- **B) Migration script**: Run migration to add empty comments map to all existing docs.
- **C) Version check**: Check doc version and upgrade on load.

**My recommendation**: Option A (lazy initialization) - simplest, Yjs handles missing maps gracefully.

A sounds good

---

## 2. Backward Compatibility

What happens if an older client (without comment support) syncs a note with comments?

**Concerns:**

- Will the old client crash?
- Will it silently drop/corrupt the comments data?
- Do we need version gating?

**My recommendation**: Yjs should preserve unknown maps during sync. We should test this explicitly. If there's risk, we may need to version the app and warn about mixed versions.

Don't worry about it. There is only one user right now. Me.

---

## 3. Reply Threading Depth

The plan shows single-level replies (flat threads). Is that intentional?

```
Comment
├── Reply 1
├── Reply 2
└── Reply 3
```

vs nested (Reddit-style):

```
Comment
├── Reply 1
│   └── Reply to Reply 1
└── Reply 2
```

**My recommendation**: Single-level is simpler and matches Google Docs. Confirm this is correct.

## Single level

## 4. Character Limits

Should there be limits on:

- Comment content length?
- Reply content length?
- Number of replies per thread?
- Total comments per note?

**My recommendation**: Soft limits with warnings, not hard blocks:

- Comment/reply: 10,000 chars (warn at 5,000)
- No limit on replies per thread
- No limit on comments per note (handle via virtualization)

## your recommendation Sounds good

## 5. Undo/Redo Behavior

How should comment operations interact with TipTap's undo stack?

**Options:**

- **A) Separate**: Comments have their own undo/redo (not integrated with editor)
- **B) Integrated**: Adding a comment is part of editor undo stack
- **C) No undo**: Comment operations are immediate and final

**My recommendation**: Option A - comments are separate from document editing. Deleting a comment has its own "undo" (via confirmation dialog), but doesn't integrate with Cmd+Z.

## A

## 6. Copy/Paste with Comments

What happens when user:

1. Copies text that has comments attached?
2. Pastes that text elsewhere in the same note?
3. Pastes that text in a different note?

**Options:**

- **A) Comments don't copy**: Only text is copied, comments stay anchored
- **B) Comments copy**: New comment threads created at paste location
- **C) Reference copy**: Pasted text links to original comment (complex)

**My recommendation**: Option A - comments don't copy. This matches Google Docs behavior and is simplest.

A

---

## 7. Performance Thresholds

The plan mentions virtualization but doesn't specify when to apply it.

**Question**: At what thresholds should we:

- Virtualize the comment panel list?
- Paginate/lazy-load comments?
- Show a "too many comments" warning?

**My recommendation**:

- Virtualize at 20+ threads (simple to implement with react-window)
- Lazy-load replies (collapsed by default if >3 replies)
- No hard limit, but test with 100+ comments

## Go with your recommendation

## 8. Storage Inspector Integration

Should comments be visible in the Storage Inspector debug tool?

**My recommendation**: Yes - add comments to the NoteDoc breakdown view. Helps debugging.

## Yes!

## 9. Error Handling

What happens if:

- IPC call fails mid-operation?
- CRDT state is corrupted?
- SQLite and CRDT get out of sync?

**My recommendation**:

- IPC failures: Show toast error, allow retry
- CRDT corruption: Log and attempt recovery from SQLite cache
- Sync mismatch: SQLite is always rebuildable from CRDT (CRDT is source of truth)

## Agree

## 10. Minimal Vertical Slice

Should we restructure the plan to deliver a minimal working feature earlier?

**Proposed restructure:**

**Phase 1A**: Minimal data model (threads only, no replies/reactions)
**Phase 2A**: Minimal IPC (create/read/delete thread)
**Phase 3A**: Minimal highlights (basic decoration)
**Phase 4A**: Minimal panel (list threads, add new)
**Checkpoint**: Full flow testable!

**Phase 1B-4B**: Add replies
**Phase 1C-4C**: Add reactions
**Phase 1D-4D**: Add mentions
**Phase 5-9**: Polish as originally planned

**Trade-off**: More integration points, but faster feedback. Thoughts?

yes, restructure
