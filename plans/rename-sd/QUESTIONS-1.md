# Questions for SD Rename Feature

## Understanding Confirmed

Based on my codebase exploration, I've confirmed:

- **SD = Storage Directory** - a sync directory containing notes/folders
- Stored in `StorageDirCache` table with `id`, `name`, `path`, `uuid`, `created`, `is_active` fields
- Managed via IPC handlers (`sd:list`, `sd:create`, `sd:setActive`, `sd:getActive`, `sd:delete`)
- UI in `StorageDirectorySettings.tsx` - currently displays name but has no edit capability
- Existing pattern for renaming exists (folder rename) that can be followed

## Questions

### 1. Name Validation

What validation rules should apply to SD names?

- **Maximum length?** (Current folder name limit appears to be 255 chars)
- **Minimum length?** (At least 1 char? Allow empty?)
- **Allowed characters?** (Any restrictions like no `/`, `\`, or special chars?)
- **Uniqueness?** Should SD names be unique across all SDs, or can duplicates exist?
- **Whitespace handling?** Trim leading/trailing whitespace? Allow all-whitespace names?

Minimum length of 1, max of 255. Any characters should be fine. Names should be unique. trim leading/trailing whitespace, but disallow all whitespace names.

### 2. UI Interaction

How should the rename be triggered and edited?

- **Inline editing** - Click on name to edit in place (like folder renaming)?
- **Edit button** - Add an edit/pencil icon that opens a dialog?
- **Context menu** - Right-click menu with "Rename" option?
- **Something else?**

context menu

### 3. Confirmation

Should there be a confirmation before renaming?

- No confirmation (just rename immediately on Enter/blur)?
- Confirmation dialog ("Are you sure you want to rename...")?

no confirmation outside of what I'd guess would be an ok button on a popup

### 4. Sync Considerations

Since SDs can sync across devices (based on UUID):

- Is the SD `name` considered a **local-only setting** (each device can have its own name for the same SD)?
- Or should the name sync across devices that share the same SD UUID?

This affects whether rename is a simple local database update or needs to interact with sync infrastructure.

SD name is local only now. I can't think of a reason to change that

### 5. Active Operations

Should renaming be blocked during active sync operations?

- Allow rename anytime?
- Block if SD is currently syncing?
- Show warning but allow anyway?

Is there a reason to block it? AFAIK, it's just a cosmetic thing, as all _real_ operations use the uuid.

### 6. Error Handling

What should happen if rename fails (e.g., database error)?

- Silently fail?
- Show error toast/notification?
- Show error dialog with retry option?

toast

### 7. Accessibility

Are there any specific accessibility requirements for the rename UI?

- Keyboard shortcuts?
- Screen reader announcements?
- Focus management after rename?

I want normal accessibility, so whatever would be appropriate

## Assumptions (Please Confirm or Correct)

1. Renaming an SD does **not** affect the file system path - only the display name in the UI
2. Renaming does **not** affect any notes, folders, or sync state within the SD
3. The rename should broadcast an `sd:updated` event so all windows stay in sync
4. Following the existing folder rename pattern is appropriate

Correct.

---

## Final Understanding (No Further Questions)

Based on your answers, here is my complete understanding of the feature:

### Requirements Summary

| Aspect             | Requirement                                                 |
| ------------------ | ----------------------------------------------------------- |
| **Name length**    | 1-255 characters                                            |
| **Allowed chars**  | Any                                                         |
| **Uniqueness**     | Must be unique across all SDs                               |
| **Whitespace**     | Trim leading/trailing; reject all-whitespace                |
| **UI trigger**     | Right-click context menu                                    |
| **UI interaction** | Dialog with text field + OK/Cancel buttons                  |
| **Confirmation**   | OK button in dialog (no separate confirmation)              |
| **Sync**           | Local only (no cross-device sync of name)                   |
| **Blocking**       | No blocking during sync operations                          |
| **Error handling** | Toast notification via MUI Snackbar                         |
| **Accessibility**  | Standard MUI accessibility (focus management, keyboard nav) |

### Implementation Scope

1. **Database** (`packages/shared/src/database/types.ts` + `packages/desktop/src/main/database/database.ts`)
   - Add `updateStorageDirName(id: string, newName: string): Promise<void>` method
   - Validate uniqueness, trim whitespace, check length

2. **IPC Handler** (`packages/desktop/src/main/ipc/handlers.ts`)
   - Add `sd:rename` handler that calls database method
   - Broadcast `sd:updated` event with `{operation: 'rename', sdId}`

3. **Preload API** (`packages/desktop/src/preload/index.ts`)
   - Add `sd.rename(sdId: string, newName: string): Promise<void>`

4. **UI** (`packages/desktop/src/renderer/src/components/Settings/StorageDirectorySettings.tsx`)
   - Add context menu to SD list items (MUI `Menu` component)
   - Add rename dialog (MUI `Dialog` with `TextField`)
   - Add error toast (MUI `Snackbar`)
   - Handle Enter key to submit, Escape to cancel

5. **Tests**
   - Database unit tests for `updateStorageDirName`
   - IPC handler tests
   - Component tests for context menu and dialog

### Existing Patterns to Follow

- **Context menu**: `FolderTree.tsx` lines 374-378, 1561-1575
- **Rename dialog**: `FolderTree.tsx` lines 1577-1612
- **Toast**: `StaleSyncToast.tsx` (or simpler MUI `Snackbar`)

---

**I have no further questions.** Ready to create implementation plan when you are.
