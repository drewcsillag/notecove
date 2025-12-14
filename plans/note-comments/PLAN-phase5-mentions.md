# Phase 5: @-Mentions

**Progress:** `100%`

## Goal

Enable @-mentioning users in comments with autocomplete from profile presence files.

---

## 5.1 Create Mention User IPC Handler

**Status:** 🟢 Complete

**Files:**

- `packages/desktop/src/main/ipc/handlers.ts` - Added `MentionUser` interface and `handleGetMentionUsers` handler
- `packages/desktop/src/preload/index.ts` - Added `mention.getUsers` API
- `packages/desktop/src/renderer/src/types/electron.d.ts` - Added type definitions

**Implementation:**

- Added `profileId` parameter to IPCHandlers constructor
- Handler gets current user from database (AppStateKey.Username, AppStateKey.UserHandle)
- Gets other users from profile presence cache for all SDs
- Deduplicates by profileId

---

## 5.2 Build MentionAutocomplete Component

**Status:** 🟢 Complete

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/MentionAutocomplete.tsx`

**Features:**

- Fetches users on mount via `window.electronAPI.mention.getUsers()`
- Filters users by query (handle or name match)
- Keyboard navigation (Arrow keys, Enter/Tab to select, Escape to close)
- Uses capture phase for keydown to prevent textarea from receiving events
- Positioned with MUI Popper component

---

## 5.3 Integrate with CommentInput

**Status:** 🟢 Complete

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx`

**Implementation:**

- Added mention state tracking for both reply and edit inputs
- Added `handleReplyTextChange` and `handleEditTextChange` to detect `@(\w*)$` pattern
- Added `handleReplyMentionSelect` and `handleEditMentionSelect` to insert mentions
- MentionAutocomplete shown when mention state is active
- Cursor positioned after inserted mention

---

## 5.4 Style Mentions in Rendered Comments

**Status:** 🟢 Complete

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/CommentContent.tsx`

**Features:**

- Parses content with `/@\w+/g` regex
- Renders mentions with primary color, background, and rounded corners
- Used for both thread.content and reply.content display

---

## 5.5 Write Tests

**Status:** 🟢 Complete

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/__tests__/CommentContent.test.tsx`

**Tests:**

- Plain text rendering
- Single mention styling
- Multiple mentions
- Mentions with numbers/underscores
- Empty content
- Mention-only content
- Email-like text handling
- Whitespace preservation
- Mentions at start/end/consecutive

---

## Definition of Done

- [x] IPC returns users from profile presence
- [x] Autocomplete shows filtered users
- [x] Keyboard navigation works
- [x] Selecting user inserts @handle
- [x] Mentions styled in rendered comments
- [x] All tests passing
