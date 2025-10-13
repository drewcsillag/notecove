# Implementation Plan: UI Enhancements

This document outlines the implementation plan for the remaining UI enhancement features.

## Overview

**Status**: 2/7 features completed
- ✅ Documentation build instructions
- ✅ Tag recognition fix (whitespace requirement)
- ⏳ Last opened note restoration
- ⏳ Folder collapse/expand
- ⏳ Note counts for folders
- ⏳ Three-state tag filtering
- ⏳ Three-column resizable layout

---

## Feature 1: Last Opened Note Restoration

### Goal
Restore the last viewed note when the app starts up.

### Implementation Details

**State Storage**:
- Store in `localStorage` (works for both web and Electron modes)
- Key: `notecove-last-opened-note`
- Value: `{ noteId: string, timestamp: number }`

**Changes Required**:

1. **Save last opened note** (`src/renderer.js`):
   ```javascript
   // In selectNote() method, after successfully selecting a note:
   localStorage.setItem('notecove-last-opened-note', JSON.stringify({
     noteId: this.currentNote.id,
     timestamp: Date.now()
   }));
   ```

2. **Restore on startup** (`src/renderer.js` in `initializeApp()`):
   ```javascript
   // After: this.renderFolderTree(); this.renderTagsList();

   // Restore last opened note
   this.restoreLastOpenedNote();
   ```

3. **Add restoration method**:
   ```javascript
   restoreLastOpenedNote() {
     try {
       const stored = localStorage.getItem('notecove-last-opened-note');
       if (!stored) return;

       const { noteId } = JSON.parse(stored);
       const note = this.noteManager.getNote(noteId);

       if (note && !note.deleted) {
         this.selectNote(noteId);
       } else {
         // Note was deleted, find most recent note
         const recentNote = this.noteManager.getMostRecentNote();
         if (recentNote) {
           this.selectNote(recentNote.id);
         }
       }
     } catch (error) {
       console.error('Failed to restore last opened note:', error);
     }
   }
   ```

4. **Add helper to NoteManager** (`src/lib/note-manager.js`):
   ```javascript
   getMostRecentNote() {
     const notes = Array.from(this.notes.values())
       .filter(note => !note.deleted)
       .sort((a, b) => new Date(b.modified) - new Date(a.modified));
     return notes[0] || null;
   }
   ```

**Testing**:
- Create note, switch to it, reload → should restore that note
- Delete the last note, reload → should open most recent note
- No notes exist, reload → should show welcome screen

---

## Feature 2: Folder Collapse/Expand with State Persistence

### Goal
Allow folders with children to be collapsed/expanded, with state persisting across sessions.

### Implementation Details

**State Storage**:
- Store in `localStorage`/Electron settings (same as folders)
- Key: `notecove-folder-state`
- Value: `{ folderId: boolean }` (true = expanded, false = collapsed)

**UI Changes**:
- Add collapse/expand arrow icon (▶/▼) before folder icon
- Clicking folder name toggles collapse state
- Hide/show child folders based on state

**Changes Required**:

1. **Add state to FolderManager** (`src/lib/folder-manager.js`):
   ```javascript
   constructor() {
     // ... existing code ...
     this.folderState = new Map(); // folderId -> isExpanded (boolean)
     this.loadFolderState();
   }

   loadFolderState() {
     try {
       const stored = localStorage.getItem('notecove-folder-state');
       if (stored) {
         const state = JSON.parse(stored);
         Object.entries(state).forEach(([id, expanded]) => {
           this.folderState.set(id, expanded);
         });
       }
     } catch (error) {
       console.error('Failed to load folder state:', error);
     }
   }

   saveFolderState() {
     const state = {};
     this.folderState.forEach((expanded, id) => {
       state[id] = expanded;
     });
     localStorage.setItem('notecove-folder-state', JSON.stringify(state));
   }

   toggleFolderExpanded(folderId) {
     const currentState = this.folderState.get(folderId) ?? true; // default expanded
     this.folderState.set(folderId, !currentState);
     this.saveFolderState();
     this.notify('folder-state-changed', { folderId, expanded: !currentState });
   }

   isFolderExpanded(folderId) {
     return this.folderState.get(folderId) ?? true; // default expanded
   }
   ```

2. **Update folder rendering** (`src/renderer.js`):
   ```javascript
   renderFolderItems(folders, level = 0) {
     if (!folders || folders.length === 0) return '';

     return folders.map(folder => {
       const indent = level * 16;
       const icon = folder.icon || '📁';
       const hasChildren = folder.children && folder.children.length > 0;
       const isActive = this.currentFolderId === folder.id;
       const isDraggable = !folder.isSpecial && !folder.isRoot;
       const isExpanded = this.folderManager.isFolderExpanded(folder.id);

       // Collapse arrow (only show if has children)
       const collapseArrow = hasChildren
         ? `<span class="folder-collapse-arrow"
                   onclick="event.stopPropagation(); app.toggleFolderCollapse('${folder.id}')"
                   style="cursor: pointer; margin-right: 4px;">
              ${isExpanded ? '▼' : '▶'}
            </span>`
         : '<span style="display: inline-block; width: 16px;"></span>';

       return `
         <div class="folder-item ${isActive ? 'active' : ''}"
              style="padding-left: ${indent + 8}px"
              data-folder-id="${folder.id}"
              ${isDraggable ? 'draggable="true"' : ''}
              ${isDraggable ? 'ondragstart="app.handleFolderDragStart(event)"' : ''}
              ${isDraggable ? 'ondragend="app.handleFolderDragEnd(event)"' : ''}
              onclick="app.selectFolder('${folder.id}')"
              ondragover="app.handleFolderDragOver(event)"
              ondragleave="app.handleFolderDragLeave(event)"
              ondrop="app.handleFolderDrop(event)">
           ${collapseArrow}
           <span class="folder-icon">${icon}</span>
           <span class="folder-name">${escapeHtml(folder.name)}</span>
         </div>
         ${hasChildren && isExpanded ? this.renderFolderItems(folder.children, level + 1) : ''}
       `;
     }).join('');
   }

   toggleFolderCollapse(folderId) {
     this.folderManager.toggleFolderExpanded(folderId);
     this.renderFolderTree(); // Re-render to show/hide children
   }
   ```

3. **Listen for state changes**:
   ```javascript
   handleFolderEvent(event, data) {
     // ... existing code ...
     if (event === 'folder-state-changed') {
       this.renderFolderTree();
     }
   }
   ```

**CSS Updates** (if needed):
```css
.folder-collapse-arrow {
  display: inline-block;
  width: 16px;
  text-align: center;
  font-size: 10px;
  user-select: none;
}
```

**Testing**:
- Folder with children shows collapse arrow
- Clicking arrow toggles children visibility
- State persists after reload
- Folders without children don't show arrow

---

## Feature 3: Note Counts for Folders

### Goal
Display the number of notes in each folder (right-aligned).

### Implementation Details

**Display Format**: `Folder Name ────── 5`
- Count only direct children (not subfolders)
- Right-aligned with leader dots or spaces
- Show for all folders including "All Notes" and "Recently Deleted"

**Changes Required**:

1. **Update folder rendering** (`src/renderer.js`):
   ```javascript
   renderFolderItems(folders, level = 0) {
     // ... existing code ...

     // Get note count for this folder
     const noteCount = this.folderManager.getNoteCountForFolder(folder.id);

     return `
       <div class="folder-item ${isActive ? 'active' : ''}"
            style="padding-left: ${indent + 8}px; display: flex; justify-content: space-between; align-items: center;"
            ...>
         <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
           ${collapseArrow}
           <span class="folder-icon">${icon}</span>
           <span class="folder-name" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
             ${escapeHtml(folder.name)}
           </span>
         </div>
         <span class="folder-count" style="margin-left: 8px; color: var(--text-secondary); font-size: 12px; flex-shrink: 0;">
           ${noteCount}
         </span>
       </div>
       ${hasChildren && isExpanded ? this.renderFolderItems(folder.children, level + 1) : ''}
     `;
   }
   ```

2. **Add count method to FolderManager** (`src/lib/folder-manager.js`):
   ```javascript
   getNoteCountForFolder(folderId) {
     // Special case for "all-notes"
     if (folderId === 'all-notes') {
       return this.noteManager.notes.size;
     }

     // Special case for "trash"
     if (folderId === 'trash') {
       return Array.from(this.noteManager.notes.values())
         .filter(note => note.deleted).length;
     }

     // Regular folders: count only direct children
     return Array.from(this.noteManager.notes.values())
       .filter(note => !note.deleted && note.folderId === folderId).length;
   }
   ```

**Testing**:
- Create notes in folders → counts update
- Move note to folder → count updates in both folders
- Delete note → trash count increases, source folder decreases
- Restore note → counts update

---

## Feature 4: Three-State Tag Filtering

### Goal
Click a tag 3 times to cycle through: include → exclude → no filter

### Implementation Details

**State Management**:
```javascript
// In renderer.js constructor:
this.tagFilterState = null; // null | { tag: string, mode: 'include' | 'exclude' }
```

**Visual Indicators**:
- Normal (include): Blue background
- Exclude: Red text with strikethrough
- No filter: Default style

**Changes Required**:

1. **Update tag click handler** (`src/renderer.js`):
   ```javascript
   // Find existing tag click handler and replace
   onTagClick(tag) {
     // Cycle through states: null -> include -> exclude -> null
     if (!this.tagFilterState || this.tagFilterState.tag !== tag) {
       // First click: include
       this.tagFilterState = { tag, mode: 'include' };
     } else if (this.tagFilterState.mode === 'include') {
       // Second click: exclude
       this.tagFilterState = { tag, mode: 'exclude' };
     } else {
       // Third click: clear filter
       this.tagFilterState = null;
     }

     this.updateUI();
     this.renderTagsList(); // Re-render tags to show visual state
   }
   ```

2. **Update note filtering** (`src/renderer.js` in `renderNotesList()`):
   ```javascript
   // Replace existing tag filter logic:

   // Filter by tag state (include/exclude)
   if (this.tagFilterState) {
     const { tag, mode } = this.tagFilterState;
     if (mode === 'include') {
       filteredNotes = filteredNotes.filter(note =>
         note.tags && note.tags.includes(tag)
       );
     } else if (mode === 'exclude') {
       filteredNotes = filteredNotes.filter(note =>
         !note.tags || !note.tags.includes(tag)
       );
     }
   }
   ```

3. **Update tag rendering** (`src/renderer.js` in `renderTagsList()`):
   ```javascript
   renderTagsList() {
     // ... existing count code ...

     const tagsHTML = sortedTags.map(([tag, count]) => {
       let classList = 'tag-item';
       let style = '';

       if (this.tagFilterState && this.tagFilterState.tag === tag) {
         if (this.tagFilterState.mode === 'include') {
           classList += ' tag-active';
           style = 'background: var(--primary-color); color: white;';
         } else if (this.tagFilterState.mode === 'exclude') {
           classList += ' tag-excluded';
           style = 'color: #ef4444; text-decoration: line-through;';
         }
       }

       return `
         <div class="${classList}"
              style="${style} cursor: pointer; padding: 4px 12px; border-radius: 12px; font-size: 12px;"
              onclick="app.onTagClick('${tag}')">
           #${escapeHtml(tag)} (${count})
         </div>
       `;
     }).join('');

     tagsList.innerHTML = tagsHTML || '<div style="color: var(--text-secondary); font-size: 12px;">No tags</div>';
   }
   ```

**Testing**:
- First click: shows only notes with tag
- Second click: shows only notes WITHOUT tag
- Third click: shows all notes (no filter)
- Visual styling changes appropriately

---

## Feature 5: Three-Column Resizable Layout

### Goal
Restructure UI: Sidebar | Notes List | Editor (resizable panels)

### Implementation Details

**Current Layout**:
```
[Sidebar (folders/tags)] [Editor/Welcome]
```

**New Layout**:
```
[Sidebar 25%] [Notes List 25%] [Editor 50%]
```

**Technology**: Use CSS `resize` property or implement custom drag handles

**Major Changes Required**:

1. **HTML Structure** (`index.html`):
   ```html
   <div class="app-container">
     <!-- Sidebar stays the same -->
     <aside class="sidebar">...</aside>

     <!-- NEW: Notes list panel -->
     <div class="notes-panel" id="notesPanel">
       <div class="notes-header">
         <input type="text" class="search-input" placeholder="Search notes...">
         <span class="notes-count" id="notesCount">0</span>
       </div>
       <div class="notes-list" id="notesList"></div>
     </div>

     <!-- Main area (editor/welcome) -->
     <main class="main-content">
       <!-- Existing welcome and editor states -->
     </main>
   </div>
   ```

2. **CSS Updates** (`index.html` `<style>` section):
   ```css
   .app-container {
     display: flex;
     height: 100vh;
     overflow: hidden;
   }

   .sidebar {
     width: 25%;
     min-width: 200px;
     max-width: 400px;
     resize: horizontal;
     overflow: auto;
     border-right: 1px solid var(--border);
   }

   .notes-panel {
     width: 25%;
     min-width: 200px;
     max-width: 400px;
     resize: horizontal;
     overflow: hidden;
     display: flex;
     flex-direction: column;
     border-right: 1px solid var(--border);
   }

   .notes-panel .notes-header {
     padding: 12px;
     border-bottom: 1px solid var(--border);
     display: flex;
     gap: 8px;
     align-items: center;
   }

   .notes-panel .search-input {
     flex: 1;
   }

   .notes-panel .notes-list {
     flex: 1;
     overflow-y: auto;
   }

   .main-content {
     flex: 1;
     min-width: 300px;
     overflow: hidden;
   }
   ```

3. **JavaScript Updates**:
   - Move search input from main to notes panel
   - Update `renderNotesList()` to render in new location
   - Notes count already exists, just needs styling

4. **Custom Resize Handles** (optional, for better UX):
   ```html
   <div class="resize-handle" data-target="sidebar"></div>
   <div class="resize-handle" data-target="notesPanel"></div>
   ```

   ```javascript
   // Add drag logic for resize handles
   setupResizeHandles() {
     document.querySelectorAll('.resize-handle').forEach(handle => {
       handle.addEventListener('mousedown', (e) => {
         const target = handle.dataset.target;
         const panel = document.getElementById(target);
         const startX = e.pageX;
         const startWidth = panel.offsetWidth;

         const doDrag = (e) => {
           const newWidth = startWidth + (e.pageX - startX);
           panel.style.width = `${newWidth}px`;
         };

         const stopDrag = () => {
           document.removeEventListener('mousemove', doDrag);
           document.removeEventListener('mouseup', stopDrag);
           // Save widths to localStorage
           this.savePanelWidths();
         };

         document.addEventListener('mousemove', doDrag);
         document.addEventListener('mouseup', stopDrag);
       });
     });
   }
   ```

**Testing**:
- Three columns visible
- Each panel resizable
- Widths persist after reload
- Min/max widths enforced
- Works on small screens

---

## Testing Plan

### Unit Tests (Vitest)

**File**: `tests/unit/renderer.test.js` (new tests)

```javascript
describe('Last Opened Note', () => {
  it('should restore last opened note on startup', () => {
    // Test implementation
  });

  it('should fall back to most recent note if last note deleted', () => {
    // Test implementation
  });
});

describe('Folder State', () => {
  it('should persist folder collapse state', () => {
    // Test implementation
  });

  it('should default folders to expanded', () => {
    // Test implementation
  });
});

describe('Tag Filtering', () => {
  it('should cycle through include/exclude/none on clicks', () => {
    // Test implementation
  });

  it('should filter notes correctly in exclude mode', () => {
    // Test implementation
  });
});
```

### E2E Tests (Playwright)

**File**: `tests/e2e/ui-enhancements.spec.js` (new file)

```javascript
test.describe('UI Enhancements', () => {
  test('should restore last opened note', async ({ page }) => {
    // Create notes, select one, reload, verify it's selected
  });

  test('should collapse and expand folders', async ({ page }) => {
    // Create folder hierarchy, collapse/expand, verify state
  });

  test('should show note counts on folders', async ({ page }) => {
    // Create notes, verify counts, move notes, verify updates
  });

  test('should cycle tag filter states', async ({ page }) => {
    // Create tagged notes, click tag 3 times, verify filtering
  });

  test('should display three-column layout', async ({ page }) => {
    // Verify sidebar, notes list, and editor are all visible
  });

  test('should resize panels', async ({ page }) => {
    // Drag resize handles, verify widths change
  });
});
```

---

## Implementation Order

Recommended order (easiest to hardest):

1. **Note counts for folders** (30 min)
   - Minimal changes, no state
   - Good visual improvement

2. **Last opened note** (30 min)
   - Simple localStorage, clear benefit
   - Low risk

3. **Folder collapse/expand** (1-2 hours)
   - Moderate complexity
   - State management required

4. **Three-state tag filtering** (1 hour)
   - Moderate complexity
   - State logic is straightforward

5. **Three-column layout** (2-3 hours)
   - Most complex
   - Requires HTML/CSS restructuring
   - Risk of breaking existing layout
   - Should be done last with thorough testing

---

## Risk Assessment

**Low Risk**:
- Note counts (purely additive)
- Last opened note (isolated feature)

**Medium Risk**:
- Folder collapse (new state, but isolated)
- Tag filtering (changes filtering logic)

**High Risk**:
- Three-column layout (major structural changes, could break existing features)

---

## Rollback Plan

Each feature should be implemented in a separate commit for easy rollback:
1. `feat: add note counts to folders`
2. `feat: restore last opened note on startup`
3. `feat: implement folder collapse/expand`
4. `feat: add three-state tag filtering`
5. `feat: restructure to three-column layout`

If any feature causes issues, revert that specific commit.

---

## Next Steps

1. Review this plan
2. Approve/modify approach
3. Implement features in recommended order
4. Test each feature before moving to next
5. Commit after each feature
6. Final integration test

---

**Estimated Total Time**: 5-7 hours
**Recommended Session**: Break into 2-3 focused sessions
