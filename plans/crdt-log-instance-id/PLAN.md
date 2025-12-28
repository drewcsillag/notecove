# Compact UUID Migration Plan

**Overall Progress:** `87%` (Phases 1-7 complete)

## Summary

Migrate all UUIDs from 36-character format (`8f5c0e1a-4b2e-4d7f-8c3b-9a1d2e3f4a5b`) to 22-character base64url format (`j1wOGksuTX-MOzqR0uPzSg`). Codebase-wide change affecting storage, database, IPC, and UI.

## Design Decisions

| Decision             | Choice                               | Rationale                     |
| -------------------- | ------------------------------------ | ----------------------------- |
| Encoding             | Base64url without padding (22 chars) | Compact, URL/filesystem-safe  |
| Database storage     | Compact format everywhere            | Cleaner long-term             |
| UI display           | Compact only                         | Simpler, consistent           |
| New ID generation    | `crypto.randomUUID()` → encode       | Well-tested UUID generation   |
| Old files on disk    | Leave as-is                          | No risky renames              |
| Old IDs in code      | Read both formats                    | Backward compatibility        |
| Profile/Instance IDs | Convert immediately in DB            | Consistent logging from start |
| Inter-note links     | Support both `[[old]]` and `[[new]]` | Document compatibility        |
| Implementation       | Phased                               | Lower risk per phase          |

## Migration Strategy

| Item                 | Read Old | Write New | Migrate Existing           |
| -------------------- | -------- | --------- | -------------------------- |
| Profile ID           | ✓        | ✓         | ✗ (used as directory name) |
| Instance ID          | ✓        | ✓         | ✓ (DB only)                |
| Note IDs             | ✓        | ✓         | ✗                          |
| Folder IDs           | ✓        | ✓         | ✗                          |
| CRDT log files       | ✓        | ✓         | ✗ (old files remain)       |
| Activity log files   | ✓        | ✓         | ✗ (old files remain)       |
| Note folders on disk | ✓        | ✓         | ✗                          |
| Vector clocks        | ✓        | ✓         | ✗ (old keys remain)        |
| Inter-note links     | ✓        | ✓         | ✗                          |

**Note on Profile IDs:** Existing profile IDs are NOT migrated because they're used as
filesystem directory names (`profiles/{profileId}/`). Renaming directories is risky and
could break on different platforms. New profiles get compact IDs; existing profiles keep
their original format. This is safe because profile IDs are internal (never shown to users).

---

## Tasks

### Phase 1: Core Utilities + Quick Win ✅

- [x] ✅ **1.1: Create UUID encoding utilities**
  - [x] ✅ Create `packages/shared/src/utils/uuid-encoding.ts`
  - [x] ✅ `uuidToCompact(uuid: string): string` - 36-char → 22-char
  - [x] ✅ `compactToUuid(compact: string): string` - 22-char → 36-char
  - [x] ✅ `isCompactUuid(str: string): boolean` - detect format
  - [x] ✅ `isFullUuid(str: string): boolean` - detect format
  - [x] ✅ `normalizeUuid(str: string): string` - accepts either, returns compact
  - [x] ✅ `generateCompactId(): string` - generate new compact UUID
  - [x] ✅ Write comprehensive tests for round-trip, edge cases
  - [x] ✅ Export from `packages/shared/src/index.ts`

- [x] ✅ **1.2: Update About Window (quick win)**
  - [x] ✅ Add `instanceId` to `app:getInfo` IPC response
  - [x] ✅ Update `AppInfo` interface in renderer
  - [x] ✅ Display profile ID (compact) and instance ID (compact)
  - [x] ✅ Write test for About window

**✓ Checkpoint: Encoding works, About shows IDs** ✅ DONE

### Phase 2: Profile and Instance ID Migration ✅

- [x] ✅ **2.1: Migrate Instance ID in index.ts**
  - [x] ✅ On startup, read existing instance ID from DB
  - [x] ✅ If old format (36-char), convert to compact and save back
  - [x] ✅ New instances generate compact IDs via `generateCompactId()`
  - [x] ✅ Log migration: `[InstanceId] Migrated to compact: {old} → {new}`

- [x] ✅ **2.2: Migrate Profile IDs**
  - [x] ✅ Update `ProfileStorage` to use compact IDs
  - [x] ✅ Migrate existing profiles in `profiles.json` on load
  - [x] ✅ New profiles generate compact IDs
  - [x] ✅ Update profile lock file naming if needed

- [x] ✅ **2.3: Update Profile Presence**
  - [x] ✅ Update `ProfilePresenceManager` for compact IDs
  - [x] ✅ Update `ProfilePresenceReader` to handle both formats
  - [x] ✅ Update `profile_presence_cache` table handling

- [x] ✅ **2.4: Wire profileId through index.ts**
  - [x] ✅ Pass compact `profileId` to `AppendLogManager`
  - [x] ✅ Pass compact `profileId` to `ProfilePresenceManager`
  - [x] ✅ Update `SDWatcherManager` setup

**✓ Checkpoint: App starts with compact profile/instance IDs** ✅ DONE

### Phase 3: CRDT Log System ✅

- [x] ✅ **3.1: Update LogWriter**
  - [x] ✅ Write failing tests first
  - [x] ✅ Accept `profileId` and `instanceId` (both compact)
  - [x] ✅ New filename: `{profileId}_{instanceId}_{timestamp}.crdtlog`
  - [x] ✅ Add `findLatestFile()` - find existing file to append to
  - [x] ✅ Add `validateFileIntegrity()`:
    - Check for termination sentinel (clean shutdown)
    - If no sentinel, scan for last valid record (mid-append crash)
    - Return append offset or -1 if corrupt
  - [x] ✅ Modify `initialize()` to try appending to existing file first

- [x] ✅ **3.2: Update LogReader**
  - [x] ✅ Write failing tests for both formats
  - [x] ✅ Parse old `{instanceId}_{ts}.crdtlog` format
  - [x] ✅ Parse new `{profileId}_{instanceId}_{ts}.crdtlog` format
  - [x] ✅ Update `LogFileInfo` to include `profileId` (nullable for old files)

- [x] ✅ **3.3: Update NoteStorageManager**
  - [x] ✅ Accept `profileId` in constructor
  - [x] ✅ Pass `profileId` and `instanceId` to LogWriter
  - [x] ✅ Key vector clocks by profile ID (compact)
  - [x] ✅ Support reading old instance-keyed vector clock entries

- [x] ✅ **3.4: Update FolderStorageManager**
  - [x] ✅ Same changes as NoteStorageManager

- [x] ✅ **3.5: Update AppendLogManager**
  - [x] ✅ Accept `profileId` and `instanceId` in constructor
  - [x] ✅ Pass through to NoteStorageManager/FolderStorageManager
  - [x] ✅ Add `getProfileId()` method

**✓ Checkpoint: CRDT logs use new format, old logs still readable** ✅ DONE

### Phase 4: Activity and Deletion Loggers ✅

- [x] ✅ **4.1: Update ActivityLogger**
  - [x] ✅ Write failing tests
  - [x] ✅ Accept `profileId` and `instanceId` in `setInstanceId()` → rename to `setIds()`
  - [x] ✅ New filename: `{profileId}_{instanceId}.log`
  - [x] ✅ New line format: `noteId|profileId_seq` (compact profile ID)

- [x] ✅ **4.2: Update DeletionLogger**
  - [x] ✅ Same changes as ActivityLogger

- [x] ✅ **4.3: Update ActivitySync**
  - [x] ✅ Parse both old `noteId|instanceId_seq` and new line formats
  - [x] ✅ Handle mixed old/new activity log files
  - [x] ✅ Added `parseActivityFilename()` for dual-format filename parsing
  - [x] ✅ Added `setProfileId()` to identify own log files

- [x] ✅ **4.4: Update DeletionSync** (was LogSync)
  - [x] ✅ Filter by profile ID (compact)
  - [x] ✅ Handle old instance-keyed files
  - [x] ✅ Added `parseDeletionFilename()` for dual-format filename parsing
  - [x] ✅ Added `setProfileId()` to identify own log files

- [x] ✅ **4.5: Update SDWatcherManager** (added)
  - [x] ✅ Accept `profileId` parameter in `setupSDWatchers()`
  - [x] ✅ Pass profileId to ActivityLogger.setIds() and DeletionLogger.setIds()
  - [x] ✅ Pass profileId to ActivitySync.setProfileId() and DeletionSync.setProfileId()

**✓ Checkpoint: Activity/deletion logs use new format** ✅ DONE

### Phase 5: New Entity ID Generation ✅

- [x] ✅ **5.1: Update Note Creation**
  - [x] ✅ `note-handlers.ts` - use `generateCompactId()`
  - [x] ✅ `note-edit-handlers.ts` - use `generateCompactId()`
  - [x] ✅ `import-service.ts` - N/A (no UUID generation found)
  - [x] ✅ `web-server/manager.ts` - use `generateCompactId()`

- [x] ✅ **5.2: Update Folder Creation**
  - [x] ✅ `folder-handlers.ts` - use `generateCompactId()`
  - [x] ✅ `import-service.ts` - N/A (no UUID generation found)

- [x] ✅ **5.3: Update Other ID Generation**
  - [x] ✅ Tag IDs (`tag-repository.ts`) - N/A (no UUID generation found)
  - [x] ✅ Comment IDs (`comments/types.ts` - `generateCommentId()`)
  - [x] ✅ Image IDs (image handlers) - N/A (no UUID generation found)
  - [x] ✅ Window IDs (`window-state-manager.ts`) - N/A (no UUID generation found)
  - [x] ✅ Move operation IDs (`note-move-manager.ts`) - N/A (no UUID generation found)
  - [x] ✅ Backup IDs (`backup-manager.ts`) - uses `generateCompactId()` for SD UUIDs
  - [x] ✅ SD UUIDs (`sd-uuid.ts`) - use `generateCompactId()`, updated validation to accept both formats
  - [x] ✅ Checkbox IDs - N/A (not generated in code)

- [x] ✅ **5.4: Test Environment Updates** (added)
  - [x] ✅ Added `crypto.randomUUID` polyfill to `jest.setup.js`
  - [x] ✅ Updated test assertions from specific UUIDs to regex patterns

**✓ Checkpoint: New notes/folders get compact IDs** ✅ DONE

### Phase 6: Inter-Note Links ✅

- [x] ✅ **6.1: Update Link Extractor**
  - [x] ✅ Tests exist for both formats (20 tests passing)
  - [x] ✅ Updated regex in `link-extractor.ts` to match both formats
  - [x] ✅ Return IDs in original format (full UUIDs lowercased for consistency, compact preserved as-is)

- [x] ✅ **6.2: Update Link Creation**
  - [x] ✅ New links use compact format (from notes created with `generateCompactId()`)
  - [x] ✅ Updated TipTap InterNoteLink extension with case-sensitive ID handling
  - [x] ✅ Link insertion unchanged (uses note's stored ID format)

**✓ Checkpoint: Links work with both old and new IDs** ✅ DONE

### Phase 7: IPC and Database Queries ✅

**Simplified**: IDs are opaque strings. No normalization needed - handlers pass through whatever format is stored.

- [x] ✅ **7.1: IPC Handlers** - No changes needed
  - [x] ✅ Handlers already treat IDs as opaque strings
  - [x] ✅ New entities get compact IDs (from Phase 5)
  - [x] ✅ Old entities keep their original IDs

- [x] ✅ **7.2: Database Query Compatibility** - Already works
  - [x] ✅ Lookup uses exact string matching
  - [x] ✅ Old notes found by old ID, new notes by compact ID

**✓ Checkpoint: IPC works with both formats** ✅ DONE

### Phase 8: Testing

- [ ] 🟥 **8.1: Unit Tests**
  - [ ] 🟥 UUID encoding round-trip
  - [ ] 🟥 Format detection (`isCompactUuid`, `isFullUuid`)
  - [ ] 🟥 Mixed format handling

- [ ] 🟥 **8.2: Integration Tests**
  - [ ] 🟥 Old storage directory with new code
  - [ ] 🟥 Mixed old/new CRDT logs in same note
  - [ ] 🟥 Inter-note links both formats
  - [ ] 🟥 Profile/instance migration

- [ ] 🟥 **8.3: E2E Tests**
  - [ ] 🟥 Update any hardcoded UUIDs in test fixtures
  - [ ] 🟥 Test About window shows compact IDs
  - [ ] 🟥 Test creating new note gets compact ID

---

## Files to Modify

### New Files

- `packages/shared/src/utils/uuid-encoding.ts`
- `packages/shared/src/utils/__tests__/uuid-encoding.test.ts`

### Core Storage (packages/shared/src/storage/)

- `log-writer.ts` - filename format, append behavior
- `log-reader.ts` - parse both formats
- `activity-logger.ts` - filename and line format
- `deletion-logger.ts` - filename and line format
- `log-sync.ts` - filter by profile ID
- `note-storage-manager.ts` - vector clock keys, profile ID
- `folder-storage-manager.ts` - vector clock keys, profile ID
- `append-log-manager.ts` - accept profile ID
- `sd-uuid.ts` - generate compact IDs

### IPC Handlers (packages/desktop/src/main/ipc/handlers/)

- `note-handlers.ts` - compact IDs, normalize input
- `note-edit-handlers.ts` - compact IDs
- `folder-handlers.ts` - compact IDs
- `image-handlers.ts` - compact IDs

### Main Process (packages/desktop/src/main/)

- `index.ts` - profile/instance ID migration, wiring
- `app-ipc-setup.ts` - return instance ID
- `window-state-manager.ts` - compact window IDs
- `note-move-manager.ts` - compact move IDs
- `backup-manager.ts` - compact backup IDs
- `import/import-service.ts` - compact IDs
- `web-server/manager.ts` - compact IDs

### Profiles

- `profile-storage.ts` or `app-profile.ts` - compact profile IDs
- `profile-presence-manager.ts` - compact IDs

### Other

- `packages/shared/src/utils/link-extractor.ts` - dual regex
- `packages/shared/src/comments/types.ts` - compact comment IDs
- `packages/desktop/src/main/database/tag-repository.ts` - compact tag IDs
- `packages/desktop/src/renderer/src/components/AboutWindow/AboutWindow.tsx`

---

## Risk Assessment

| Risk                   | Mitigation                                     |
| ---------------------- | ---------------------------------------------- |
| Old files not readable | Dual-format parsing in all readers             |
| DB migration fails     | Transaction-based migration, rollback on error |
| Inter-note links break | Regex matches both formats                     |
| Vector clock confusion | Support both old and new keys                  |
| Mid-append crash       | Scan for last valid record if no sentinel      |
| Test failures          | Update test fixtures progressively             |
| Performance impact     | Encoding/decoding is cheap (~microseconds)     |

---

## Related Files

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial clarifications
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Profile ID implications
- [QUESTIONS-3.md](./QUESTIONS-3.md) - Encoding choice
- [QUESTIONS-4.md](./QUESTIONS-4.md) - Scope expansion
- [QUESTIONS-5.md](./QUESTIONS-5.md) - Migration clarifications
