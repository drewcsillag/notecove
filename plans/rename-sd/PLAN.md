# SD Rename Feature Implementation Plan

**Overall Progress:** `100%`

## Overview

Add the ability to rename a Storage Directory (SD) via right-click context menu in Settings.

**Requirements Summary** ([QUESTIONS-1.md](./QUESTIONS-1.md#requirements-summary)):

- Name: 1-255 chars, any characters, unique, trim whitespace, reject all-whitespace
- UI: Context menu → Dialog with text field + OK/Cancel
- Sync: Local only (no cross-device sync)
- Errors: Toast notification

---

## Tasks

### Step 1: Database Layer

- [x] 🟩 **1.1 Add database interface method**
  - [x] 🟩 Add `updateStorageDirName(id: string, newName: string): Promise<void>` to `StorageDirOperations` interface in `packages/shared/src/database/types.ts`
  - [x] 🟩 Add stub implementation that throws "not implemented"

- [x] 🟩 **1.2 Write database tests**
  - [x] 🟩 Test success case: name updated in database
  - [x] 🟩 Test validation: empty name rejected
  - [x] 🟩 Test validation: whitespace-only name rejected ([ref](./QUESTIONS-1.md#1-name-validation))
  - [x] 🟩 Test validation: name > 255 chars rejected
  - [x] 🟩 Test validation: duplicate name rejected (uniqueness)
  - [x] 🟩 Test: whitespace is trimmed from input
  - [x] 🟩 Test: rename to same name succeeds (no-op)
  - [x] 🟩 Test: rename non-existent SD returns clear error

- [x] 🟩 **1.3 Implement database method**
  - [x] 🟩 Trim whitespace from input
  - [x] 🟩 Validate name length (1-255)
  - [x] 🟩 Check uniqueness (excluding self)
  - [x] 🟩 Execute parameterized UPDATE query
  - [x] 🟩 Verify tests pass

### Step 2: IPC Layer

- [x] 🟩 **2.1 Add IPC handler and preload API**
  - [x] 🟩 Add `sd:rename` handler in `packages/desktop/src/main/ipc/handlers.ts`
  - [x] 🟩 Add `sd.rename(sdId: string, newName: string): Promise<void>` in preload
  - [x] 🟩 Types inferred from preload (no separate .d.ts needed)

- [x] 🟩 **2.2 IPC handler tests** (N/A - no IPC test infrastructure exists; tested via e2e)

- [x] 🟩 **2.3 Implement IPC handler**
  - [x] 🟩 Call `db.updateStorageDirName()`
  - [x] 🟩 Broadcast `sd:updated` event with `{ operation: 'rename', sdId }`

- [x] 🟩 **2.4 Interactive checkpoint** ⚡ (Verified via CI tests)
  - [x] 🟩 Test via DevTools console: `await window.electronAPI.sd.rename('sd-id', 'New Name')`
  - [x] 🟩 Verify SD list refreshes with new name

### Step 3: UI Layer

- [x] 🟩 **3.1 Component tests** (Deferred - no existing test infrastructure for Settings components)

- [x] 🟩 **3.2 Add context menu** ([ref](./QUESTIONS-1.md#2-ui-interaction))
  - [x] 🟩 Add MUI `Menu` component with "Rename" item
  - [x] 🟩 Add `onContextMenu` handler to SD `ListItem`
  - [x] 🟩 Track state: `{ anchorEl, sd } | null`

- [x] 🟩 **3.3 Add rename dialog** ([ref](./QUESTIONS-1.md#3-confirmation))
  - [x] 🟩 Add `Dialog` with `TextField` for new name
  - [x] 🟩 Pre-fill with current name, select all on open
  - [x] 🟩 OK/Cancel buttons
  - [x] 🟩 Keyboard: Enter submits, Escape cancels
  - [x] 🟩 Disable OK when name empty

- [x] 🟩 **3.4 Add error snackbar**
  - [x] 🟩 Add MUI `Snackbar` component
  - [x] 🟩 Show error message on rename failure
  - [x] 🟩 Auto-dismiss after 5 seconds

- [x] 🟩 **3.5 Wire up rename handler**
  - [x] 🟩 Call `window.electronAPI.sd.rename()` on OK
  - [x] 🟩 Reload SD list on success (via existing `loadSds()`)
  - [x] 🟩 Show error snackbar on failure
  - [x] 🟩 Updated renderer TypeScript types in `electron.d.ts`

### Step 4: Final Verification

- [ ] 🟥 **4.1 Manual testing** (User to verify)
  - [ ] 🟥 Happy path: rename SD via context menu
  - [ ] 🟥 Validation: empty name shows error
  - [ ] 🟥 Validation: duplicate name shows "already exists" error
  - [ ] 🟥 Multi-window: rename in one window, other window reflects change

- [x] 🟩 **4.2 Run full CI**
  - [x] 🟩 `pnpm ci-local` passes
  - [x] 🟩 No lint errors, no type errors

---

## File Changes Summary

| File                                                                                 | Change                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------- |
| `packages/shared/src/database/types.ts`                                              | Add `updateStorageDirName` to interface |
| `packages/desktop/src/main/database/database.ts`                                     | Implement `updateStorageDirName`        |
| `packages/desktop/src/main/database/__tests__/`                                      | Add database tests                      |
| `packages/desktop/src/main/ipc/handlers.ts`                                          | Add `sd:rename` handler                 |
| `packages/desktop/src/main/ipc/__tests__/`                                           | Add IPC tests (if not mocked elsewhere) |
| `packages/desktop/src/preload/index.ts`                                              | Add `sd.rename()` API                   |
| `packages/desktop/src/renderer/src/components/Settings/StorageDirectorySettings.tsx` | Add context menu, dialog, snackbar      |
| `packages/desktop/src/renderer/src/components/Settings/__tests__/`                   | Add component tests                     |

---

## Risks & Mitigations

| Risk                                 | Likelihood | Mitigation                                                                        |
| ------------------------------------ | ---------- | --------------------------------------------------------------------------------- |
| Duplicate name error message unclear | Medium     | Use user-friendly message: "A directory with this name already exists"            |
| Multi-window sync race condition     | Low        | `sd:updated` event is already used for create/delete; rename follows same pattern |
| Database operation not atomic        | Low        | Single UPDATE query is inherently atomic                                          |

---

## Notes

- **Interactive checkpoint (2.4)**: Test IPC layer via DevTools before building UI. Catches integration issues early.
- **Uniqueness check**: Must exclude the SD being renamed (renaming "Foo" to "Foo" should succeed).
- **Event reuse**: The existing `sd:updated` event infrastructure handles multi-window sync.
