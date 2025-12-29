# Fix Username Placeholder and Reactivity

**Overall Progress:** `100%`

## Summary

Fix three related issues with username/handle settings:

1. Settings UI shows fake default values instead of placeholder text
2. Settings changes require app restart to take effect in comments
3. Handle field needs validation

## Decisions (from [QUESTIONS-1.md](./QUESTIONS-1.md))

- **Placeholder UX**: Standard HTML placeholder ("Your name", "yourhandle")
- **Reactivity**: All components using current user profile should update via IPC broadcast
- **Historical comments**: Keep original author info (no updates)
- **@mention badges**: Keep as-is at insertion time (no reactivity)
- **Validation**: Handle only - alphanumeric + underscore, max 20 chars

## Plan Critique Notes

- **Ordering**: Good - phases properly ordered with dependencies flowing forward
- **Test file**: `UserSettings.test.tsx` doesn't exist - needs to be created (not just added to)
- **Pattern to follow**: Use `theme-api.ts` as reference for `onChanged` pattern (`ipcRenderer.on` + unsubscribe)
- **userApi location**: Already exists in `comment-api.ts` at line 424, just needs `onProfileChanged` added

---

## Tasks

### Phase 1: Settings UI Placeholder Fix

- [x] 🟩 **1.1 Create test file for UserSettings**
  - Create new test file
  - Test that empty username/handle shows placeholder text (not "User"/"@user")
  - Test that placeholder disappears when user types
  - Test save functionality
  - Location: `packages/desktop/src/renderer/src/components/Settings/__tests__/UserSettings.test.tsx`

- [x] 🟩 **1.2 Update UserSettings.tsx to use placeholders**
  - Remove default values ("User"/"user") from lines 27-28
  - Use empty string as initial state
  - Add `placeholder` prop to TextFields: "Your name" and "yourhandle"
  - Location: `packages/desktop/src/renderer/src/components/Settings/UserSettings.tsx`

### Phase 2: Handle Validation

- [x] 🟩 **2.1 Add tests for handle validation**
  - Valid: alphanumeric and underscore only
  - Invalid: spaces, special characters, too long (>20)
  - Error message displayed for invalid input
  - Save button disabled when invalid
  - Location: `packages/desktop/src/renderer/src/components/Settings/__tests__/UserSettings.test.tsx`

- [x] 🟩 **2.2 Add handle validation to UserSettings.tsx**
  - Regex: `/^[a-zA-Z0-9_]*$/`
  - Max length: 20 characters
  - Show error state on TextField when invalid
  - Disable Save button when invalid
  - Location: `packages/desktop/src/renderer/src/components/Settings/UserSettings.tsx`

### Phase 3: IPC Broadcast for Profile Changes

- [x] 🟩 **3.1 Add broadcastToAll call in handleSetAppState**
  - After saving username/userHandle, broadcast `user:profileChanged`
  - Include new profile data in broadcast: `{ profileId, username, handle }`
  - Add debug log: `[User Settings] Broadcasting profile change`
  - Location: `packages/desktop/src/main/ipc/handlers/sync-handlers.ts`

- [x] 🟩 **3.2 Write test for profile change broadcast**
  - When username is set, database getState is called to fetch profile
  - When userHandle is set, database getState is called to fetch profile
  - Non-user settings don't trigger the profile fetch
  - Location: `packages/desktop/src/main/ipc/__tests__/handlers/sync-handlers.test.ts`

- [x] 🟩 **3.3 Add onProfileChanged to userApi in preload**
  - Follow pattern from `theme-api.ts` line 20-28
  - `ipcRenderer.on('user:profileChanged', listener)`
  - Return unsubscribe function
  - Location: `packages/desktop/src/preload/api/comment-api.ts`

- [x] 🟩 **3.4 Update electron.d.ts types**
  - Add `onProfileChanged` to user API interface
  - Callback receives `{ profileId: string, username: string, handle: string }`
  - Returns `() => void` (unsubscribe)
  - Location: `packages/desktop/src/renderer/src/types/electron.d.ts`

- [x] 🟩 **3.5 Update browser-stub.ts**
  - Add stub for `user.onProfileChanged` - returns no-op unsubscribe
  - Location: `packages/desktop/src/renderer/src/api/browser-stub.ts`

- [x] 🟩 **3.6 Update web-client.ts**
  - Add placeholder for `user.onProfileChanged` - returns no-op unsubscribe
  - Location: `packages/desktop/src/renderer/src/api/web-client.ts`

### Phase 4: Renderer Components Subscribe to Profile Changes

- [x] 🟩 **4.1 Update TipTapEditor.tsx**
  - Subscribe to `user.onProfileChanged` in the existing useEffect
  - Update userProfile state when event received
  - Clean up subscription on unmount
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`

- [x] 🟩 **4.2 Update CommentPanel.tsx**
  - Subscribe to `user.onProfileChanged` in the existing useEffect
  - Update userProfile state when event received
  - Location: `packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx`

- [x] 🟩 **4.3 Update ReactionPicker.tsx**
  - Subscribe to `user.onProfileChanged` in the existing useEffect
  - Update userProfile state when event received
  - Location: `packages/desktop/src/renderer/src/components/CommentPanel/ReactionPicker.tsx`

- [x] 🟩 **4.4 Update ReactionDisplay.tsx**
  - Subscribe to `user.onProfileChanged` in the existing useEffect
  - Update userProfile state when event received
  - Location: `packages/desktop/src/renderer/src/components/CommentPanel/ReactionDisplay.tsx`

### Phase 5: Integration Testing

- [ ] 🟥 **5.1 Manual testing checklist**
  - [ ] Open Settings > User tab, verify placeholder text shows (not "User"/"@user")
  - [ ] Enter invalid handle (spaces, special chars), verify error and Save disabled
  - [ ] Save valid settings, create new comment, verify it uses new name immediately
  - [ ] Verify existing comments keep old author name
  - [ ] Open second window, change settings in one, verify other window picks up change

---

## Files Modified

| File                    | Changes                                             |
| ----------------------- | --------------------------------------------------- |
| `UserSettings.tsx`      | Placeholder props, validation                       |
| `UserSettings.test.tsx` | **New file** - tests for placeholder and validation |
| `sync-handlers.ts`      | Broadcast `user:profileChanged` on profile change   |
| `sync-handlers.test.ts` | Test for broadcast                                  |
| `comment-api.ts`        | Add `onProfileChanged` to `userApi`                 |
| `electron.d.ts`         | Type for `onProfileChanged`                         |
| `browser-stub.ts`       | Stub for `onProfileChanged`                         |
| `web-client.ts`         | Placeholder for `onProfileChanged`                  |
| `TipTapEditor.tsx`      | Subscribe to profile changes                        |
| `CommentPanel.tsx`      | Subscribe to profile changes                        |
| `ReactionPicker.tsx`    | Subscribe to profile changes                        |
| `ReactionDisplay.tsx`   | Subscribe to profile changes                        |
