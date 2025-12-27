# Questions - Part 5: Migration Clarification

## Complete UUID Usage Summary

Based on the codebase search, here's the full list:

| Category               | Items                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| **Note IDs**           | notes table, note_links, note_tags, checkboxes, comment_threads, images, note_moves, note_sync_state |
| **Folder IDs**         | folders table, notes.folder_id, note_moves.target_folder_id                                          |
| **Profile IDs**        | profile_presence_cache, profiles.json config                                                         |
| **Instance IDs**       | app_state table, activity_log_state, vector clocks, CRDT log filenames, activity log filenames       |
| **Storage Dir IDs**    | storage_dirs table, SD_ID files, note_moves                                                          |
| **Tag IDs**            | tags table, note_tags                                                                                |
| **Comment IDs**        | comment_threads, comment_replies, comment_reactions                                                  |
| **Image IDs**          | images table, filenames                                                                              |
| **Window IDs**         | window_state table                                                                                   |
| **Backup IDs**         | backup metadata                                                                                      |
| **Move Operation IDs** | note_moves table                                                                                     |
| **User IDs**           | users table (for @-mentions)                                                                         |
| **Checkbox IDs**       | checkboxes table                                                                                     |

**Also found:**

- UUID regex in `link-extractor.ts` for `[[uuid]]` inter-note links
- Vector clock keys use instance ID

---

## Q21: Migration Strategy Clarification

You said: "Tolerate old, but only create using new. But profile and instance ids should change immediately."

**My interpretation:**

1. **Profile ID and Instance ID**: Convert existing IDs in the database to compact format on startup (one-time migration)

2. **Everything else** (note IDs, folder IDs, etc.):
   - Keep reading old 36-char format from files/DB
   - Only generate NEW items with compact 22-char format
   - Don't rename existing note folders on disk
   - Don't update existing DB records

**Is this correct?**

**Follow-up**: For profile/instance ID migration, what happens to:

- Existing CRDT log files named `{oldInstanceId}_{timestamp}.crdtlog`?
- Existing activity log files named `{oldInstanceId}.log`?
- Vector clock entries keyed by old instance ID?

Should we:

- **A**: Rename old files to use new compact ID
- **B**: Leave old files, start writing new files with compact ID (files accumulate)
- **C**: Something else?

## B

## Q22: UI Display Clarification

Earlier (Q2) you said you wanted **both** compact and full UUID in the About window.
Now (Q16) you chose Option A: **compact only** everywhere.

Which is it for the About window specifically?

- **A**: Compact only (consistent with Q16)
- **B**: Both formats (as originally discussed)

A

---

## Q23: Inter-Note Link Format

The `[[uuid]]` pattern in documents currently expects 36-char UUIDs:

```typescript
/\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/gi;
```

Should we:

- **A**: Support both formats in the regex (old and new links work)
- **B**: Migrate existing links in documents to compact format
- **C**: Keep old format for links only (special case)

My recommendation: **A** - support both formats, new links use compact.

## A

## Q24: Note Folder Paths on Disk

Currently: `/notes/550e8400-e29b-41d4-a716-446655440000/`
New notes: `/notes/VQ6EAOLxRLSnFkRmVUQAAA/`

For existing notes, should we:

- **A**: Leave old folder names (mixed formats on disk)
- **B**: Rename folders on first access
- **C**: Rename all folders during migration

My recommendation: **A** - leave old names, tolerate both.

A
