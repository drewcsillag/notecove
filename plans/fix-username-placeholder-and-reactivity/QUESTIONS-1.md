# Questions - Fix Username Placeholder and Reactivity

## Summary of Current Behavior

After analyzing the codebase, here's what I found:

### Issue 1: Misleading Default Values in Settings UI

**Current Behavior:**

- `UserSettings.tsx` lines 27-28 show:
  ```typescript
  const defaultUsername = savedUsername ?? 'User';
  const defaultHandle = savedHandle ?? 'user';
  ```
- When `savedUsername` or `savedHandle` is `null` (never set), the UI displays "User" and "@user" as actual values
- These look like real values, not placeholder/suggestion text
- When the user creates a comment, `handleGetCurrentProfile()` returns empty strings (`''`) for unset values (lines 291-292 in misc-handlers.ts)
- This disconnect causes comments to appear as "Anonymous" despite the UI showing "User"/"@user"

**Proposed Fix:**

- Convert the TextFields to use `placeholder` prop instead of pre-populating the `value`
- Use empty string as the initial state, with placeholder text like "Your name" and "yourhandle"
- This makes it clear these are suggestions, not actual values

### Issue 2: Settings Changes Not Reactive

**Current Behavior:**

- When user saves settings in `UserSettings.tsx`, it calls `window.electronAPI.appState.set()`
- The main process handler `handleSetAppState` (sync-handlers.ts line 54-64):
  1. Saves to database via `database.setState(key, value)`
  2. Calls `onUserSettingsChanged(key, value)` which writes profile presence files
- However, the renderer components that fetched the user profile on mount (`TipTapEditor.tsx`, `CommentPanel.tsx`, `ReactionPicker.tsx`, `ReactionDisplay.tsx`) don't get notified
- They only fetch profile once in a `useEffect(() => { ... }, [])` with empty deps

**Root Cause:**
The user profile is fetched once at component mount. When settings change, there's no broadcast/event to trigger a re-fetch.

### Issue 3: Profile Files Update

**Current Behavior:**

- When settings change, `onUserSettingsChanged` is called, which calls `profilePresenceManager.writePresenceToAllSDs()`
- This DOES update the profile files immediately (no restart needed)
- The profile presence files at `{SD}/profiles/{profileId}.json` are updated

**Conclusion:**
Profile files ARE updated without restart. The problem is only in-memory state in the renderer process.

---

## Questions

### Q1: Placeholder vs Default Value

For the Settings UI fix, I plan to:

- Remove the default values ("User"/"user")
- Use empty strings as initial state
- Add `placeholder` props to the TextFields: "Your name" and "yourhandle"

**Question:** Is this the desired UX? Or would you prefer:

- (a) Placeholder text that disappears when focused (standard HTML placeholder) ✓ My recommendation
- (b) A different visual treatment (e.g., gray italicized text that clears on focus)
- (c) Keep showing defaults but add a "(not set)" indicator somehow

a

### Q2: Reactivity Scope

When the user saves settings, which of these should update immediately without restart?

- (a) **Just new comments created after save** - Comments already created keep their original author info, new comments use new settings
- (b) **All components showing current user info** - TipTapEditor, CommentPanel, ReactionPicker, ReactionDisplay all re-fetch
- (c) **Something else?**

My recommendation: **(b)** - All components that display or use the current user's info should react to changes. This is what users expect.

b

### Q3: Implementation Approach for Reactivity

There are a few ways to implement reactivity:

- (a) **IPC event broadcast** - Main process broadcasts `user:profileChanged` event when settings change, renderer components listen
- (b) **React context** - Create a `UserProfileContext` that wraps the app, fetches profile, and provides it to children. Update context when settings saved.
- (c) **Custom hook with polling** - Not recommended, wasteful
- (d) **Re-render after save dialog** - Settings dialog could trigger some global state update

My recommendation: **(a)** - IPC event broadcast is consistent with how other settings changes are handled (like `theme:changed`). It's simple and works across windows.

a

### Q4: Existing Comment Author Info

When a user changes their username/handle, should existing comments they authored be updated to show the new name?

- (a) **No** - Comments preserve the name at time of creation (historical accuracy)
- (b) **Yes** - Update author display in comments to match current profile info

My recommendation: **(a)** - Keep historical accuracy. This is how most systems work (Git commits preserve author at commit time, etc.)

a

### Q5: Validation

Should we add validation for the username/handle fields?

- (a) **No validation** - Accept any input (current behavior)
- (b) **Handle validation** - Ensure handle has no spaces, special characters (alphanumeric + underscore only)
- (c) **Both fields validated** - Reasonable length limits, no weird characters

My recommendation: **(b)** - At minimum, handles should be validated since they're used for @mentions. Something like `/^[a-zA-Z0-9_]+$/` and max length of ~20 characters.

## b

## Clarifications Needed

1. Are there any other places where the username/handle appear that I should check for reactivity?

Oh, if you at mention someone in a doc, it brings up a badge for it. Don't know if these should react. Thinking no.

2. Is there a specific design system or UI pattern you prefer for placeholder text in MUI TextFields?

Nope
