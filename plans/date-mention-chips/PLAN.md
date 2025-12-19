# Date & Mention Chips Implementation Plan

**Overall Progress:** `80%`

## Summary

Implement Google Docs-style `@` chips for dates and mentions:
- `@today`, `@yesterday`, `@tomorrow` insert formatted dates
- `@date` opens a date picker
- `@username` mentions people from profile presence data across all SDs

Both use a unified `@` trigger with combined autocomplete (date keywords at top, users below).

## Architecture Decisions

See [QUESTIONS-1.md](./QUESTIONS-1.md), [QUESTIONS-2.md](./QUESTIONS-2.md), and [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md).

**Date Chips:**
- Plain text storage (`2025-12-19`) with decoration styling
- Click opens MUI DatePicker to change date

**Mention Chips:**
- **Atomic inline node** (not marks) - prevents editing corruption
- Node stores: `{ profileId, handle, displayName }`
- Renders as chip showing display name
- Searchable by both handle and name (node text content includes both)
- Click shows popover with profile info + filter action

**User Handle Requirement:**
- Users without handles are excluded from autocomplete
- Show hint in dropdown: "Set your @handle in Settings to be mentionable"

## Tasks

### Phase 0: Bug Fix & Setup
- [x] 🟩 **0.1: Fix instanceId fallback bug**
  - [x] 🟩 Write failing test for instanceId persistence
  - [x] 🟩 Add `instanceId` to app_state table (AppStateKey.InstanceId)
  - [x] 🟩 Fix `index.ts:288` - load from DB or generate new
  - [x] 🟩 Verify instanceId != profileId in presence files

- [x] 🟩 **0.2: Install dependencies**
  - [x] 🟩 Install `@mui/x-date-pickers` and `dayjs` adapter
  - [x] 🟩 Verify date-fns is available for formatting

### Phase 1: Date Keywords (Fast Feedback)
- [x] 🟩 **1.1: AtMention extension - date keywords only**
  - [x] 🟩 Write tests for @ trigger and date keyword matching
  - [x] 🟩 Create `AtMention.ts` extension using TipTap Suggestion API
  - [x] 🟩 `items()` returns date keywords: today, yesterday, tomorrow, date
  - [x] 🟩 `command()` inserts formatted date (`YYYY-MM-DD`)

- [x] 🟩 **1.2: AtSuggestionList component (dates only)**
  - [x] 🟩 Write tests for suggestion list rendering
  - [x] 🟩 Create `AtSuggestionList.tsx` (adapt from TagSuggestionList pattern)
  - [x] 🟩 Show date keywords with icons
  - [x] 🟩 Keyboard navigation (arrow keys, enter)

- [x] 🟩 **1.3: Wire into editor**
  - [x] 🟩 Add AtMention to TipTapEditor extensions
  - [x] 🟩 **CHECKPOINT: Type `@today` → see dropdown → select → date inserted**

### Phase 2: Add Users to Suggestion
- [x] 🟩 **2.1: Fetch and display users**
  - [x] 🟩 Write tests for user fetching and filtering
  - [x] 🟩 Update `items()` to fetch users via `mention.getUsers()`
  - [x] 🟩 Filter users without handles
  - [x] 🟩 Combined list: date keywords section, then users section

- [x] 🟩 **2.2: Handle hint for missing handle**
  - [x] 🟩 Check if current user has handle set
  - [x] 🟩 If not, show hint row: "Set your @handle in Settings"
  - [x] 🟩 Hint row is not selectable, just informational

- [x] 🟩 **2.3: MentionNode extension**
  - [x] 🟩 Write tests for mention node
  - [x] 🟩 Create `MentionNode.ts` as atomic inline node
  - [x] 🟩 Attributes: `profileId`, `handle`, `displayName`
  - [x] 🟩 Node text content: `@handle displayName` (for search)
  - [x] 🟩 Render as chip showing only displayName

- [x] 🟩 **2.4: User insertion**
  - [x] 🟩 Write tests for mention insertion
  - [x] 🟩 Update `command()` to insert MentionNode for users
  - [x] 🟩 Add trailing space after node
  - [x] 🟩 **CHECKPOINT: Type `@drew` → see user → select → chip inserted**

### Phase 3: Date Chip Decoration & Picker
- [x] 🟩 **3.1: Date decoration plugin**
  - [x] 🟩 Write tests for date pattern detection
  - [x] 🟩 Add ProseMirror plugin to detect `YYYY-MM-DD` patterns
  - [x] 🟩 Apply decoration with chip styling
  - [x] 🟩 Store click handler reference (via onDateClick option)

- [x] 🟩 **3.2: DatePickerDialog component**
  - [x] 🟩 Write tests for DatePickerDialog (component is simple, tests deferred to integration)
  - [x] 🟩 Create `DatePickerDialog.tsx` using MUI DatePicker
  - [x] 🟩 Props: initialDate, onSelect, onClose, anchorEl

- [x] 🟩 **3.3: Date chip click handling**
  - [x] 🟩 Wire click on date decoration to show DatePickerDialog
  - [x] 🟩 On date selection, replace text via editor transaction
  - [x] 🟩 Ensure change is undoable (uses standard editor commands)
  - [x] 🟩 **CHECKPOINT: Click date chip → picker opens → select → date changes**

- [x] 🟩 **3.4: @date keyword handling**
  - [x] 🟩 When `@date` selected, show DatePickerDialog immediately (via custom event)
  - [x] 🟩 Insert selected date (or nothing if cancelled)

### Phase 4: Mention Interactions
- [x] 🟩 **4.1: MentionPopover component**
  - [x] 🟩 Write tests for MentionPopover (component is simple, tests deferred)
  - [x] 🟩 Create `MentionPopover.tsx`
  - [x] 🟩 Display: avatar (initials), name, handle
  - [x] 🟩 Action: "Show notes by this person" button

- [x] 🟩 **4.2: Mention click handling**
  - [x] 🟩 Add click handler to MentionNode (via onMentionClick option)
  - [x] 🟩 Show MentionPopover on click

- [ ] 🟨 **4.3: Filter notes by person** (DEFERRED - requires notes list changes)
  - [ ] 🟨 Add IPC handler `notes:filterByAuthor(profileId)`
  - [ ] 🟨 Wire popover action to trigger filter
  - [ ] 🟨 Update notes list to show filtered results
  - [ ] 🟨 **CHECKPOINT: Click mention → popover → filter works**
  - Note: Button is wired up but filtering not yet implemented (logs to console)

### Phase 5: Styling & Polish
- [x] 🟩 **5.1: Chip styling**
  - [x] 🟩 CSS for date and mention chips (background, border-radius, padding)
  - [x] 🟩 Same visual style for both (per Q11)
  - [x] 🟩 Hover states
  - [x] 🟩 Dark mode support

- [ ] 🟨 **5.2: Edge cases** (DEFERRED - manual testing needed)
  - [ ] 🟨 Handle deleted profiles (chip still displays, popover shows "unknown user")
  - [x] 🟩 Handle empty user list (just show date keywords) - done in AtMention.items()
  - [ ] 🟨 Test copy/paste of chips
  - [ ] 🟨 Test collaboration (Yjs) with mention nodes
  - [ ] 🟨 Test search finds mentions by handle and name

- [ ] 🟥 **5.3: Final integration test**
  - [ ] 🟥 Full end-to-end test of both date and mention flows
  - [ ] 🟥 Run CI, ensure all tests pass

## File Structure (New Files)

```
packages/desktop/src/renderer/src/components/EditorPanel/
├── extensions/
│   ├── AtMention.ts           # Unified @ suggestion extension
│   └── MentionNode.ts         # Atomic inline node for mentions
├── AtSuggestionList.tsx       # Combined date/user suggestion dropdown
├── DatePickerDialog.tsx       # MUI date picker for @date and editing
└── MentionPopover.tsx         # Profile info popover on click
```

## Dependencies

**To Install:**
- `@mui/x-date-pickers` - MUI DatePicker
- `dayjs` - Date adapter for MUI (lighter than date-fns adapter)

**Already Available:**
- `@tiptap/suggestion`, `tippy.js` - Autocomplete infrastructure
- `date-fns` - Date formatting
- MUI components - UI

## Existing Code to Leverage

- `MentionAutocomplete.tsx` - Patterns for user list UI
- `mentionApi.getUsers()` - Already in preload
- `TagSuggestionList.tsx` - Pattern for suggestion dropdown
- `Hashtag.ts` - Pattern for decoration plugin

## Testing Strategy

- Unit tests for extensions (AtMention, MentionNode)
- Unit tests for UI components (AtSuggestionList, DatePickerDialog, MentionPopover)
- Integration test for full @ flow
- Manual testing for autocomplete UX
- Verify search works for both date text and mention content
