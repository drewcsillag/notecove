# Compact UUID Migration Plan

**Overall Progress:** `0%`

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

| Item                 | Read Old | Write New | Migrate Existing     |
| -------------------- | -------- | --------- | -------------------- |
| Profile ID           | ✓        | ✓         | ✓ (DB only)          |
| Instance ID          | ✓        | ✓         | ✓ (DB only)          |
| Note IDs             | ✓        | ✓         | ✗                    |
| Folder IDs           | ✓        | ✓         | ✗                    |
| CRDT log files       | ✓        | ✓         | ✗ (old files remain) |
| Activity log files   | ✓        | ✓         | ✗ (old files remain) |
| Note folders on disk | ✓        | ✓         | ✗                    |
| Vector clocks        | ✓        | ✓         | ✗ (old keys remain)  |
| Inter-note links     | ✓        | ✓         | ✗                    |

---

## Tasks

### Phase 1: Core Utilities + Quick Win

- [ ] 🟥 **1.1: Create UUID encoding utilities**
  - [ ] 🟥 Create `packages/shared/src/utils/uuid-encoding.ts`
  - [ ] 🟥 `uuidToCompact(uuid: string): string` - 36-char → 22-char
  - [ ] 🟥 `compactToUuid(compact: string): string` - 22-char → 36-char
  - [ ] 🟥 `isCompactUuid(str: string): boolean` - detect format
  - [ ] 🟥 `isFullUuid(str: string): boolean` - detect format
  - [ ] 🟥 `normalizeUuid(str: string): string` - accepts either, returns compact
  - [ ] 🟥 `generateCompactId(): string` - generate new compact UUID
  - [ ] 🟥 Write comprehensive tests for round-trip, edge cases
  - [ ] 🟥 Export from `packages/shared/src/index.ts`

- [ ] 🟥 **1.2: Update About Window (quick win)**
  - [ ] 🟥 Add `instanceId` to `app:getInfo` IPC response
  - [ ] 🟥 Update `AppInfo` interface in renderer
  - [ ] 🟥 Display profile ID (compact) and instance ID (compact)
  - [ ] 🟥 Write test for About window

**✓ Checkpoint: Encoding works, About shows IDs**

### Phase 2: Profile and Instance ID Migration

- [ ] 🟥 **2.1: Migrate Instance ID in index.ts**
  - [ ] 🟥 On startup, read existing instance ID from DB
  - [ ] 🟥 If old format (36-char), convert to compact and save back
  - [ ] 🟥 New instances generate compact IDs via `generateCompactId()`
  - [ ] 🟥 Log migration: `[InstanceId] Migrated to compact: {old} → {new}`

- [ ] 🟥 **2.2: Migrate Profile IDs**
  - [ ] 🟥 Update `ProfileStorage` to use compact IDs
  - [ ] 🟥 Migrate existing profiles in `profiles.json` on load
  - [ ] 🟥 New profiles generate compact IDs
  - [ ] 🟥 Update profile lock file naming if needed

- [ ] 🟥 **2.3: Update Profile Presence**
  - [ ] 🟥 Update `ProfilePresenceManager` for compact IDs
  - [ ] 🟥 Update `ProfilePresenceReader` to handle both formats
  - [ ] 🟥 Update `profile_presence_cache` table handling

- [ ] 🟥 **2.4: Wire profileId through index.ts**
  - [ ] 🟥 Pass compact `profileId` to `AppendLogManager`
  - [ ] 🟥 Pass compact `profileId` to `ProfilePresenceManager`
  - [ ] 🟥 Update `SDWatcherManager` setup

**✓ Checkpoint: App starts with compact profile/instance IDs**

### Phase 3: CRDT Log System

- [ ] 🟥 **3.1: Update LogWriter**
  - [ ] 🟥 Write failing tests first
  - [ ] 🟥 Accept `profileId` and `instanceId` (both compact)
  - [ ] 🟥 New filename: `{profileId}_{instanceId}_{timestamp}.crdtlog`
  - [ ] 🟥 Add `findLatestFile()` - find existing file to append to
  - [ ] 🟥 Add `validateFileIntegrity()`:
    - Check for termination sentinel (clean shutdown)
    - If no sentinel, scan for last valid record (mid-append crash)
    - Return append offset or -1 if corrupt
  - [ ] 🟥 Modify `initialize()` to try appending to existing file first

- [ ] 🟥 **3.2: Update LogReader**
  - [ ] 🟥 Write failing tests for both formats
  - [ ] 🟥 Parse old `{instanceId}_{ts}.crdtlog` format
  - [ ] 🟥 Parse new `{profileId}_{instanceId}_{ts}.crdtlog` format
  - [ ] 🟥 Update `LogFileInfo` to include `profileId` (nullable for old files)

- [ ] 🟥 **3.3: Update NoteStorageManager**
  - [ ] 🟥 Accept `profileId` in constructor
  - [ ] 🟥 Pass `profileId` and `instanceId` to LogWriter
  - [ ] 🟥 Key vector clocks by profile ID (compact)
  - [ ] 🟥 Support reading old instance-keyed vector clock entries

- [ ] 🟥 **3.4: Update FolderStorageManager**
  - [ ] 🟥 Same changes as NoteStorageManager

- [ ] 🟥 **3.5: Update AppendLogManager**
  - [ ] 🟥 Accept `profileId` and `instanceId` in constructor
  - [ ] 🟥 Pass through to NoteStorageManager/FolderStorageManager
  - [ ] 🟥 Add `getProfileId()` method

**✓ Checkpoint: CRDT logs use new format, old logs still readable**

### Phase 4: Activity and Deletion Loggers

- [ ] 🟥 **4.1: Update ActivityLogger**
  - [ ] 🟥 Write failing tests
  - [ ] 🟥 Accept `profileId` and `instanceId` in `setInstanceId()` → rename to `setIds()`
  - [ ] 🟥 New filename: `{profileId}_{instanceId}.log`
  - [ ] 🟥 New line format: `noteId|profileId_seq` (compact profile ID)

- [ ] 🟥 **4.2: Update DeletionLogger**
  - [ ] 🟥 Same changes as ActivityLogger

- [ ] 🟥 **4.3: Update ActivitySync**
  - [ ] 🟥 Parse both old `noteId|instanceId_seq` and new line formats
  - [ ] 🟥 Handle mixed old/new activity log files

- [ ] 🟥 **4.4: Update LogSync**
  - [ ] 🟥 Filter by profile ID (compact)
  - [ ] 🟥 Handle old instance-keyed files

**✓ Checkpoint: Activity/deletion logs use new format**

### Phase 5: New Entity ID Generation

- [ ] 🟥 **5.1: Update Note Creation**
  - [ ] 🟥 `note-handlers.ts` - use `generateCompactId()`
  - [ ] 🟥 `note-edit-handlers.ts` - use `generateCompactId()`
  - [ ] 🟥 `import-service.ts` - use `generateCompactId()` for notes
  - [ ] 🟥 `web-server/manager.ts` - use `generateCompactId()`

- [ ] 🟥 **5.2: Update Folder Creation**
  - [ ] 🟥 `folder-handlers.ts` - use `generateCompactId()`
  - [ ] 🟥 `import-service.ts` - use `generateCompactId()` for folders

- [ ] 🟥 **5.3: Update Other ID Generation**
  - [ ] 🟥 Tag IDs (`tag-repository.ts`)
  - [ ] 🟥 Comment IDs (`comments/types.ts` - `generateCommentId()`)
  - [ ] 🟥 Image IDs (image handlers)
  - [ ] 🟥 Window IDs (`window-state-manager.ts`)
  - [ ] 🟥 Move operation IDs (`note-move-manager.ts`)
  - [ ] 🟥 Backup IDs (`backup-manager.ts`)
  - [ ] 🟥 SD UUIDs (`sd-uuid.ts`)
  - [ ] 🟥 Checkbox IDs (if generated in code)

**✓ Checkpoint: New notes/folders get compact IDs**

### Phase 6: Inter-Note Links

- [ ] 🟥 **6.1: Update Link Extractor**
  - [ ] 🟥 Write failing tests for both formats
  - [ ] 🟥 Update regex in `link-extractor.ts` to match:
    - Old: `[[8f5c0e1a-4b2e-4d7f-8c3b-9a1d2e3f4a5b]]`
    - New: `[[j1wOGksuTX-MOzqR0uPzSg]]`
  - [ ] 🟥 Return normalized (compact) IDs from extractor

- [ ] 🟥 **6.2: Update Link Creation**
  - [ ] 🟥 New links use compact format in `[[...]]`
  - [ ] 🟥 Update TipTap link extension if needed
  - [ ] 🟥 Update link insertion UI

**✓ Checkpoint: Links work with both old and new IDs**

### Phase 7: IPC and Database Queries

- [ ] 🟥 **7.1: Update IPC Handlers**
  - [ ] 🟥 Normalize incoming IDs with `normalizeUuid()`
  - [ ] 🟥 Return compact format in responses
  - [ ] 🟥 Key handlers: note:load, note:delete, folder:get, etc.

- [ ] 🟥 **7.2: Database Query Compatibility**
  - [ ] 🟥 Notes: old IDs stay as-is in DB, lookup by exact match
  - [ ] 🟥 Verify: linking to old note by old ID still works
  - [ ] 🟥 Verify: linking to old note by compact ID fails gracefully (note not found)

**✓ Checkpoint: IPC accepts both formats**

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
