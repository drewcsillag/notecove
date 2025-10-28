# Known Issues

## Multi-SD Note Sync (Critical)

**Status:** Identified, Awaiting Architecture Refactor

**Description:**
Notes created in non-default Storage Directories do not sync correctly across instances.

**Root Cause:**
The note storage architecture currently uses a single `UpdateManager` instance configured with a single `SyncDirectoryStructure` pointing to the default SD. When notes are created in other SDs:
1. Updates are written to the default SD's path instead of the correct SD's path
2. Other instances read from the default SD's path and don't find the notes
3. ActivitySync only monitors the default SD's activity log

**Impact:**
- Notes created in secondary SDs don't appear in other instances
- Note titles don't sync for notes in secondary SDs
- Cross-instance collaboration only works for the default SD

**E2E Test Coverage:**
- `e2e/multi-sd-cross-instance.spec.ts` - Tests 1 & 2 (failing as expected)

**Required Fix:**
Major architectural refactor needed:
1. Make `CRDTManager.loadNote()` SD-aware (add sdId parameter)
2. Create `UpdateManager` per SD or make UpdateManager lookup SD paths dynamically
3. Set up file watchers for each SD's notes directory
4. Make `ActivitySync` monitor activity logs in all configured SDs
5. Update all note-related IPC handlers to route to correct SD

**Workaround:**
Currently, only use the default SD for multi-instance collaboration. Additional SDs can be used for organization but won't sync properly across instances.

**Folder Sync:**
✅ Folder creation/modification in secondary SDs DOES sync correctly because:
- `loadFolderTree(sdId)` explicitly passes SD ID
- Each SD maintains its own folder tree CRDT
- File watchers are properly configured for folder updates

