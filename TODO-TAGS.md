# TODO: Tags System Completion

**Status:** Paused - Bugs discovered that need fixing first
**Last Updated:** 2025-11-03
**Phase:** 4.1 (Tags System)

## Overview

The tags system is partially complete. Tag parsing, rendering, and database indexing are fully working for both real-time edits (via IPC) and external file sync (via ActivitySync from Dropbox/iCloud). What remains:

1. **Tag Autocomplete in Editor** - Show existing tags as user types `#`
2. **Tag Panel Component** - UI panel to display all tags with counts and filtering

## Completed Work

### ✅ Tag Parsing & Rendering

- **File:** `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Hashtag.ts`
- Pattern: `#[a-zA-Z][a-zA-Z0-9_]*` (must start with letter)
- Max length: 50 characters
- Case-insensitive (normalized to lowercase)
- Theme-dependent blue accent color
- Renders as clickable inline nodes in TipTap editor

### ✅ Tag Database Schema

- **File:** `packages/shared/src/database/schema.ts`
- **Tables:**
  - `tags` table: `id, name (unique)`
  - `note_tags` junction table: `note_id, tag_id` (composite primary key)
- **Database Methods** in `packages/desktop/src/main/database/database.ts`:
  - `getAllTags()`: Get all tags with note counts
  - `getTagsForNote(noteId)`: Get tags for specific note
  - `getTagByName(name)`: Find tag by name
  - `createTag(name)`: Create new tag
  - `addTagToNote(noteId, tagId)`: Associate tag with note
  - `removeTagFromNote(noteId, tagId)`: Remove association
  - `searchNotesByTag(tagName)`: Find notes containing tag

### ✅ Tag Extraction Utility

- **File:** `packages/shared/src/utils/tag-extractor.ts`
- `extractTags(text: string): string[]` - Parses hashtags from text
- Returns deduplicated, lowercase, truncated tags
- Handles edge cases (null, undefined, non-string input)
- **Tests:** `packages/shared/src/utils/__tests__/tag-extractor.test.ts` (15 test cases, all passing)

### ✅ Real-Time Tag Indexing (IPC Handler)

- **File:** `packages/desktop/src/main/ipc/handlers.ts`
- **Method:** `handleApplyUpdate()` (line ~565-635)
- When notes are edited in the UI:
  1. Extracts text content from Y.js CRDT document
  2. Parses tags using `extractTags()`
  3. Compares with existing tags in database
  4. Adds new tags, removes old tags
  5. Broadcasts updates to all windows
- **N+1 Query Fix:** Batch processing with `Promise.all()`

### ✅ External Sync Tag Indexing

- **File:** `packages/desktop/src/main/index.ts`
- **Function:** `reindexTagsForNotes()` (lines 44-136)
- When external changes come from Dropbox/iCloud:
  1. Activity watcher callback (line 527) triggers reindexing
  2. Initial sync on startup (line 559) triggers reindexing
  3. Same extraction and comparison logic as IPC handler
- **Integration Points:**
  - Activity watcher: `setupSDWatchers()` at line 510-548
  - Initial sync: Lines 552-578
- **Type Safety:** Passed as parameter `db: Database` to avoid null issues

### ✅ E2E Tests

- **File:** `packages/desktop/e2e/tags.spec.ts`
- 8 test cases covering:
  - Tag rendering with styling
  - Multiple tags per note
  - Tags with numbers and underscores
  - Tags at different positions
  - Edge cases (# without alphanumeric chars)
  - Tag styling persistence across restarts
  - **Database indexing integration** (tests that tags are actually stored in SQLite)
  - Tag updates when note is edited
  - Tag removal when deleted from note
- All tests passing (141 total E2E tests)

## Remaining Work

### 1. Tag Autocomplete in Editor 🟥

**Goal:** When user types `#` in the editor, show a dropdown of existing tags that match what they're typing. User can arrow-key navigate and press Enter to insert.

#### Implementation Approach

**Technology:**

- TipTap has a suggestion API designed for this: https://tiptap.dev/docs/editor/api/utilities/suggestion
- We'll use `@tiptap/suggestion` utility
- Need to create a suggestion plugin for the Hashtag extension

**Data Flow:**

1. User types `#` → Trigger suggestion
2. Query database for existing tags (via IPC call)
3. Filter tags based on typed text (client-side)
4. Render dropdown menu (React component)
5. User selects tag → Insert into editor as Hashtag node

**Files to Modify:**

1. **`packages/desktop/src/renderer/src/components/EditorPanel/extensions/Hashtag.ts`**
   - Add `addProseMirrorPlugins()` method
   - Configure `Suggestion` plugin
   - Define trigger character: `#`
   - Define `items` function to query tags
   - Define `render` function to show dropdown

2. **`packages/desktop/src/renderer/src/components/EditorPanel/TagSuggestion.tsx`** (NEW FILE)
   - React component for rendering suggestion dropdown
   - Props: `items`, `command`, `selectedIndex`
   - Keyboard navigation (up/down arrows, Enter to select)
   - Visual styling consistent with app theme

3. **Add IPC method to get all tags**
   - Already exists: `database.getAllTags()` returns `Array<{ id: string, name: string, count: number }>`
   - May need to add IPC handler in `handlers.ts` if not already exposed

**Example Code Structure:**

```typescript
// In Hashtag.ts
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import TagSuggestionList from './TagSuggestionList';

export const Hashtag = Node.create({
  // ... existing config ...

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '#',
        items: async ({ query }) => {
          // Query all tags via IPC
          const allTags = await window.api.getAllTags();
          // Filter by query
          return allTags
            .filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10); // Limit to 10 suggestions
        },
        render: () => {
          let component: ReactRenderer;
          return {
            onStart: (props) => {
              component = new ReactRenderer(TagSuggestionList, {
                props,
                editor: props.editor,
              });
            },
            onUpdate: (props) => {
              component.updateProps(props);
            },
            onKeyDown: (props) => {
              return component.ref?.onKeyDown(props);
            },
            onExit: () => {
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});
```

**Testing:**

- Add E2E test: Type `#`, verify dropdown appears with existing tags
- Test filtering: Type `#wo`, verify only "work" tag appears (if it exists)
- Test selection: Arrow down, press Enter, verify tag is inserted
- Test cancellation: Press Escape, verify dropdown closes

**Potential Issues:**

- IPC call is async - may cause lag if database is slow
  - **Mitigation:** Cache tags in renderer, refresh periodically
- Dropdown positioning (avoid clipping at screen edges)
  - **Solution:** Use Popper.js or similar positioning library
- Conflict with existing `#` behavior
  - **Test:** Ensure typing `#` in middle of word doesn't trigger

### 2. Tag Panel Component 🟥

**Goal:** Add a collapsible panel (similar to folder panel) that displays all tags with note counts. Clicking a tag filters the notes list.

#### Implementation Approach

**UI Design:**

- Position: Could be in left sidebar below folders, or in right sidebar
- Each tag shows: `#tagname (count)`
- Clicking tag: Filters notes list to show only notes with that tag
- **Tri-state filtering:**
  - No tags selected: Show all notes
  - One tag selected: Show notes with that tag
  - Multiple tags selected: Show notes with ANY of those tags (OR logic)
    - Could add toggle for AND logic later

**Data Flow:**

1. On mount: Fetch all tags with counts via IPC
2. Store in React state
3. Real-time updates: Listen for `tag:updated` IPC events
4. When tag clicked: Update filter state, trigger notes list refresh

**Files to Create:**

1. **`packages/desktop/src/renderer/src/components/TagPanel/TagPanel.tsx`** (NEW FILE)
   - Main component
   - Fetches tags on mount: `window.api.getAllTags()`
   - Renders list of tags with counts
   - Click handler: Updates selected tags
   - Emits filter event to parent (App.tsx)

2. **`packages/desktop/src/renderer/src/components/TagPanel/TagItem.tsx`** (NEW FILE)
   - Single tag item component
   - Props: `tag: { id, name, count }`, `selected: boolean`, `onClick: () => void`
   - Renders: `#tagname (count)` with visual indicator if selected

**Files to Modify:**

1. **`packages/desktop/src/renderer/src/App.tsx`**
   - Add state for selected tags: `selectedTags: string[]`
   - Pass to NotesListPanel as filter
   - Render TagPanel component

2. **`packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx`**
   - Accept `selectedTags` prop
   - Modify note fetching logic to filter by tags
   - Use existing `database.searchNotesByTag()` method
   - Handle multiple tags (loop + dedupe)

3. **`packages/desktop/src/main/ipc/handlers.ts`**
   - Add IPC handler for `getAllTags` (if not exists)
   - Add `tag:updated` broadcast event (may already exist from real-time indexing)

**Testing:**

- E2E test: Click tag, verify notes list filters correctly
- Test multiple tag selection
- Test tag count updates when note is edited
- Test tag removal when all notes with tag are deleted

**UI/UX Considerations:**

- Clear filter button (X icon) when tags are selected
- Tag count badge styling (consistent with folder count badges)
- Collapsible panel (expand/collapse icon)
- Scrollable list if many tags
- Empty state: "No tags yet. Add tags to your notes by typing #tagname"

## Dependencies

**NPM Packages:**

- `@tiptap/suggestion` - Already installed (part of TipTap ecosystem)
- No new dependencies required

## Known Issues / Bugs to Fix

**User mentioned bugs discovered** - These need to be addressed before continuing with tag autocomplete/panel:

- _[Details to be provided by user]_

## Testing Strategy

1. **Unit Tests:**
   - Tag extraction utility: ✅ Already complete (15 tests)
   - Need tests for autocomplete suggestion filtering logic

2. **E2E Tests:**
   - Tag rendering/styling: ✅ Already complete (6 tests)
   - Tag database indexing: ✅ Already complete (2 tests)
   - **TODO:** Tag autocomplete (type `#`, select tag)
   - **TODO:** Tag panel filtering (click tag, verify notes filter)

3. **Manual Testing:**
   - Test with large number of tags (100+)
   - Test with special characters in tag names
   - Test with multiple instances (sync via Dropbox)

## Performance Considerations

- Tag list caching in renderer (avoid IPC call on every keystroke)
- Debounce tag query when typing (300ms delay)
- Limit autocomplete suggestions to 10-20 items
- Virtual scrolling for tag panel if > 100 tags

## References

- TipTap Suggestion Docs: https://tiptap.dev/docs/editor/api/utilities/suggestion
- TipTap Mention Extension (similar to what we need): https://tiptap.dev/docs/editor/extensions/nodes/mention
- MUI Autocomplete (for dropdown styling inspiration): https://mui.com/material-ui/react-autocomplete/

## Resume Work Checklist

When resuming:

1. [ ] Fix bugs user mentioned (details TBD)
2. [ ] Verify all existing E2E tests still pass
3. [ ] Start with tag autocomplete (easier than panel)
4. [ ] Create `TagSuggestionList.tsx` component
5. [ ] Add `@tiptap/suggestion` plugin to Hashtag extension
6. [ ] Add E2E test for autocomplete
7. [ ] Run CI to ensure no regressions
8. [ ] Then move to tag panel implementation
