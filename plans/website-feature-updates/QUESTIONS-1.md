# Questions - Website Feature Updates

## Task Summary

1. Update features list based on plans directory and source code
2. Update Getting Started docs (add `pnpm rebuild:electron` step)
3. Mark iOS app as "coming soon" (already done in most places, need to verify)
4. Rename "Guide" to "Getting Started" in top nav

---

## Questions

### 1. Features List Scope

I found **many** implemented features in the plans and source code that aren't documented on the website. Here's a summary of what's missing:

**Currently documented:**

- Offline-First Sync ✅
- CRDT Synchronization ✅
- Rich Text Editing ✅ (but says "Image support coming soon" - images ARE implemented!)
- Link Unfurling ✅
- Folders ✅
- Full-Text Search ✅
- Multi-Window Support ✅
- Activity Logging ✅
- Import Markdown ✅

**Missing from features page (but implemented):**

- **Images** - Full image support: drag/drop, paste, thumbnails, lightbox, export, text wrapping (10-phase feature, 100% complete)
- **Tables** - Full table support with headers, keyboard navigation, column resizing, cell alignment (8-phase feature, 100% complete)
- **Comments** - Google Docs-style threaded comments on text selections with reactions
- **Note History** - Timeline view of edits, session-based history, state reconstruction
- **Export** - Markdown export with folder structure (listed as "coming soon" but actually implemented)
- **Dark Mode** - Full dark mode with toggle across all windows
- **Backlinks** - See which notes link to the current note
- **Pin Notes** - Pin/unpin notes for favorites
- **Code Blocks with Syntax Highlighting** - Already documented but undersold
- **Keyboard Shortcuts** - Extensive shortcuts (there's a guide page)

**Question:** Should I add ALL of these to the features page, or just the major ones? I'd suggest adding:

- Images (major feature)
- Tables (major feature)
- Comments (major feature)
- Note History (major feature)
- Export (move from "coming soon" to implemented)
- Dark Mode (quick mention)
- Backlinks (in the "Smart Organization" section)

Backlinks are actually not implemented. Note History should be left off - it's half maked right now.

### 2. Feature Page Structure

Currently there are individual feature pages for:

- `/features/offline-sync.md`
- `/features/rich-text-editing.md`
- `/features/link-unfurling.md`
- `/features/search.md`
- `/features/folders-organization.md`
- `/features/import-export.md`

**Question:** Should I create new individual feature pages for the major new features (Images, Tables, Comments, History)? Or just mention them in the overview and existing pages?

My suggestion:

- Add Images to rich-text-editing.md (it's an editor feature)
- Add Tables to rich-text-editing.md (it's an editor feature)
- Create a new `/features/collaboration.md` page for Comments (it's substantial enough)
- Create a new `/features/history.md` page for Note History
- Update `/features/import-export.md` to document Export as implemented

Sounds good

### 3. Tags Status

The features page says Tags are "coming soon", but I see:

- Tag extraction from content is implemented
- Tag autocomplete in editor is implemented
- Tag filtering (include/exclude modes) is implemented
- Tag panel exists in the UI

**Question:** Are tags fully implemented and should be moved from "coming soon" to "implemented"?

They are fully implemented

### 4. Inter-note Links Status

The features page says Inter-note links are "coming soon", but I see:

- Backlink detection and display
- Link search autocomplete
- Link reference resolution
- Wiki-style link support in TipTap

**Question:** Are inter-note links fully implemented and should be moved from "coming soon"?

They are fully implemented

### 5. Installation - pnpm rebuild:electron

You mentioned adding `pnpm rebuild:electron` to the installation docs.

**Question:** Should this be:

- `pnpm rebuild:electron` in the root directory?
- `pnpm --filter @notecove/desktop rebuild:electron`?
- Some other command?

And where exactly in the installation flow should it go? After `pnpm install`?

`pnpm --filter @notecove/desktop rebuild:electron`
Just before where it starts notecove with some variant of `pnpm dev`

### 6. iOS "Coming Soon" Verification

I checked and iOS is already marked as "coming soon" in:

- Features index (line 68)
- Installation page (lines 60-62, 72-74)
- Getting Started page (line 28)
- Offline Sync page (line 90)
- Architecture overview

**Question:** Is there any place I should update that isn't already marked as "coming soon"? Or is this already complete?

That should be complete, this was a double check

### 7. Feature Comparison Table

The comparison table at the bottom of features/index.md might need updates. Currently it compares:

- Offline-First
- CRDT Sync
- Cross-Platform
- No Cloud Servers
- Rich Text
- Link Unfurling
- Open Source
- File-Based Sync

**Question:** Should I add rows for:

- Tables
- Comments
- Image Support
- Note History

## yes except for note history for reasons mentioned above

## Clarification Needed Before Proceeding

The most important questions are:

1. Which features should I add to the features list? (Question 1)
2. Should I create new feature pages or just update existing ones? (Question 2)
3. What's the exact `pnpm rebuild:electron` command? (Question 5)
