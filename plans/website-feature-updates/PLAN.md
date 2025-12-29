# Website Feature Updates - Implementation Plan

**Overall Progress:** `100%`

## Summary

Update the NoteCove website documentation to:

1. Add missing implemented features (Images, Tables, Comments, Export, Dark Mode)
2. Move Tags and Inter-note Links from "coming soon" to implemented
3. Update installation docs with `pnpm --filter @notecove/desktop rebuild:electron`
4. Rename "Guide" to "Getting Started" in top nav
5. Verify iOS is marked as "coming soon" (already done)

## Answered Questions

See [QUESTIONS-1.md](./QUESTIONS-1.md) for clarifications:

- **Backlinks:** NOT implemented (skip)
- **Note History:** Half-baked (skip)
- **Tags:** Fully implemented
- **Inter-note links:** Fully implemented
- **rebuild command:** `pnpm --filter @notecove/desktop rebuild:electron` before `pnpm dev`

## Plan Critique

See [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) for review notes.

**Key improvements made:**

- Reordered to create files before adding sidebar links (prevents broken links)
- Grouped related changes for incremental verification
- Added dev server step for live preview during implementation

---

## Tasks

### Phase 1: Quick Wins (Immediately Testable)

- [x] 🟩 **Step 1: Rename "Guide" to "Getting Started" in top nav**
  - File: `website/.vitepress/config.ts`
  - Change nav item text from "Guide" to "Getting Started"

- [x] 🟩 **Step 2: Update installation.md**
  - File: `website/guide/installation.md`
  - Add `pnpm --filter @notecove/desktop rebuild:electron` step
  - Place after `pnpm install` and before `pnpm dev`
  - Add brief explanation (rebuilds native Electron modules)

### Phase 2: Create New Feature Page First

- [x] 🟩 **Step 3: Create collaboration.md**
  - New file: `website/features/collaboration.md`
  - Include proper VitePress frontmatter (title, description)
  - Document threaded comments feature
  - Cover: creating threads, replying, reactions, mentions

- [x] 🟩 **Step 4: Add collaboration.md to sidebar**
  - File: `website/.vitepress/config.ts`
  - Add "Comments & Collaboration" to features sidebar

### Phase 3: Features Overview Page

- [x] 🟩 **Step 5: Update Rich Text Editing section**
  - File: `website/features/index.md`
  - Remove "(coming soon)" from image support
  - Add mention of tables in the description

- [x] 🟩 **Step 6: Add Images feature section**
  - File: `website/features/index.md`
  - Add new section: drag/drop, paste, thumbnails, lightbox, text wrapping

- [x] 🟩 **Step 7: Add Tables feature section**
  - File: `website/features/index.md`
  - Add new section: headers, keyboard navigation, column resizing, cell alignment

- [x] 🟩 **Step 8: Add Comments feature section**
  - File: `website/features/index.md`
  - Add new section: Google Docs-style, text selections, reactions, replies
  - Link to /features/collaboration

- [x] 🟩 **Step 9: Update Smart Organization section**
  - File: `website/features/index.md`
  - Move Tags from "coming soon" to implemented
  - Move Inter-note links from "coming soon" to implemented

- [x] 🟩 **Step 10: Add Dark Mode to Advanced Features**
  - File: `website/features/index.md`
  - Brief mention of dark mode with toggle across windows

- [x] 🟩 **Step 11: Update Coming Soon section**
  - File: `website/features/index.md`
  - Remove Tags (now implemented)
  - Remove Export (now implemented)
  - Keep: Templates, Mobile Apps (Android)

- [x] 🟩 **Step 12: Update Feature Comparison table**
  - File: `website/features/index.md`
  - Add rows: Tables, Comments, Image Support

### Phase 4: Individual Feature Pages

- [x] 🟩 **Step 13: Update rich-text-editing.md**
  - Add comprehensive Images section
  - Add comprehensive Tables section

- [x] 🟩 **Step 14: Update import-export.md**
  - Document Export feature as implemented
  - Cover: Markdown export, folder structure, image handling

- [x] 🟩 **Step 15: Update folders-organization.md**
  - Add Tags documentation
  - Add Inter-note links documentation
  - Updated Pinned Notes section (was implemented)

### Phase 5: Verification

- [x] 🟩 **Step 16: Verify iOS "coming soon" status**
  - Quick check that iOS is marked as coming soon throughout
  - Already complete - no changes needed

- [x] 🟩 **Step 17: Build and verify website**
  - Run `pnpm --filter @notecove/website build`
  - Build successful with no errors
  - No broken links detected

---

## Files Modified

| File                                       | Changes                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `website/.vitepress/config.ts`             | Renamed nav "Guide" → "Getting Started", added collaboration.md to sidebar                           |
| `website/guide/installation.md`            | Added rebuild:electron step (step 3)                                                                 |
| `website/features/index.md`                | Added Images, Tables, Comments, Dark Mode sections; updated Tags, Inter-note links, comparison table |
| `website/features/rich-text-editing.md`    | Added Images and Tables sections, removed "(coming soon)"                                            |
| `website/features/import-export.md`        | Added Export documentation                                                                           |
| `website/features/folders-organization.md` | Updated Tags, Inter-note links, Pinned Notes documentation                                           |

## Files Created

| File                                | Purpose                               |
| ----------------------------------- | ------------------------------------- |
| `website/features/collaboration.md` | Comments & Collaboration feature page |

### Phase 6: Accuracy Audit (Added after user feedback)

See [QUESTIONS-2.md](./QUESTIONS-2.md) for the full audit.

- [x] 🟩 **Step 18: Fix landing page Coming Soon section**
  - File: `website/index.md`
  - Removed outdated items (sync improvements, note list panel, tags/links)
  - Now only shows: iOS app implementation
  - Updated "What's Working" section with more features

- [x] 🟩 **Step 19: Fix keyboard-shortcuts.md**
  - Fixed New Window: `Cmd+Shift+N` → `Cmd+Shift+W`
  - Fixed New Folder: `Cmd+Shift+F` → `Cmd+Shift+N`
  - Removed non-existent shortcuts (toggle sidebar, focus sidebar, focus editor, next/prev note)
  - Added missing shortcuts: Dark mode, panel toggles
  - Reorganized sections

- [x] 🟩 **Step 20: Fix basic-usage.md**
  - Fixed New Window shortcut
  - Fixed sync setup menu path: "File → Preferences → Sync" → "Settings → Storage Directories"
  - Removed "(Coming soon)" from Global Search

- [x] 🟩 **Step 21: Fix sync-configuration.md**
  - Fixed all menu paths from "File → Preferences → Sync" to "Settings → Storage Directories"
  - Removed "Help → View Activity Log" reference (doesn't exist)
  - Replaced "Reset Sync State" with "Reload Note From CRDT Logs" (actual menu item)

- [x] 🟩 **Step 22: Rebuild and verify**
  - Website builds successfully with no errors

---

## Files Modified (Final)

| File                                       | Changes                                        |
| ------------------------------------------ | ---------------------------------------------- |
| `website/.vitepress/config.ts`             | Renamed nav, added collaboration.md to sidebar |
| `website/index.md`                         | Fixed Coming Soon, updated What's Working      |
| `website/guide/installation.md`            | Added rebuild:electron step                    |
| `website/guide/basic-usage.md`             | Fixed shortcuts and menu paths                 |
| `website/guide/keyboard-shortcuts.md`      | Major overhaul - fixed all shortcuts           |
| `website/guide/sync-configuration.md`      | Fixed all menu paths and non-existent features |
| `website/features/index.md`                | Added new features, updated comparison table   |
| `website/features/rich-text-editing.md`    | Added Images and Tables sections               |
| `website/features/import-export.md`        | Added Export documentation                     |
| `website/features/folders-organization.md` | Updated Tags, Inter-note links, Pinned Notes   |

## Files Created

| File                                | Purpose                               |
| ----------------------------------- | ------------------------------------- |
| `website/features/collaboration.md` | Comments & Collaboration feature page |

### Phase 7: Additional Accuracy Fixes (Added after user feedback round 3)

- [x] 🟩 **Step 23: Add inter-note links to basic-usage.md**
  - Added full Inter-note Links section with `[[` syntax documentation

- [x] 🟩 **Step 24: Fix search hotkeys in basic-usage.md**
  - Swapped Global Search and Find in Note shortcuts (were reversed)
  - Global Search: `Cmd+F` / `Ctrl+F`
  - Find in Note: `Cmd+Shift+F` / `Ctrl+Shift+F`

- [x] 🟩 **Step 25: Rewrite features/search.md**
  - Fixed search hotkeys (were reversed)
  - Removed regex, whole word, date search features (don't exist)
  - Updated tag filtering to use Tag Panel with AND/AND NOT logic
  - Removed Index Management, Saved Searches, Search Shortcuts, Search Performance sections

- [x] 🟩 **Step 26: Fix folders-organization.md**
  - Fixed New Folder shortcut: `Cmd+Shift+F` → `Cmd+Shift+N`
  - Removed Sorting Notes section (not implemented)
  - Removed Smart Tags section (not a thing)
  - Removed Graph View coming soon (not planned)
  - Removed Workspaces section (not planned)
  - Removed Archiving section (not planned)
  - Simplified Search & Filtering section

- [x] 🟩 **Step 27: Fix keyboard-shortcuts.md search section**
  - Swapped Global search and Find in note shortcuts (were reversed)

- [x] 🟩 **Step 28: Rebuild and verify**
  - Website builds successfully with no errors

---

## Implementation Notes

- All changes completed successfully
- Website builds with no errors
- iOS documentation confirmed as "coming soon" throughout
- Backlinks kept as "coming soon" (not implemented per user clarification)
- Note History skipped (half-baked per user clarification)
- Keyboard shortcuts verified against menu.ts source code
- Menu paths verified against actual Settings dialog tabs
- Search hotkeys corrected: Global = Cmd+F, Find in Note = Cmd+Shift+F
