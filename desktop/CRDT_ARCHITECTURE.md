# CRDT Architecture Analysis & Plan

## Current Architecture (Partially Implemented)

### How Notes Work Today

#### 1. **Note Creation Flow**
```
User clicks "New Note"
  ↓
renderer.js:createNewNote()
  ↓
noteManager.createNote({ folderId })
  ↓
Creates note object: { id, title: '', content: '', ... }
  ↓
Adds to noteManager.notes Map
  ↓
Calls noteManager.saveNote(note)
  ↓
syncManager.saveNoteWithCRDT(note)
  ↓
crdtManager.initializeNote(noteId, note)
  ↓
Creates Y.Doc with metadata ONLY (title, created, modified, tags, folder)
  ↓
Generates CRDT update
  ↓
updateStore.addUpdate(noteId, update)
  ↓
Update written to file: test1.000001-000002.yjson
```

**✅ Result**: Metadata is saved to CRDT files
**❌ Problem**: Content is NOT in CRDT at all

#### 2. **Editor Loading Flow**
```
User clicks a note in the list
  ↓
renderer.js:selectNote(noteId)
  ↓
Gets note from noteManager.getNote(noteId)
  ↓
Note object has: { id, title, content: '<html>...', ... }
  ↓
editor.setContent(note.content, noteId)
  ↓
TipTap displays the HTML
```

**❌ Problem**: Editor is NOT connected to Y.Doc
- Content comes from note.content string
- No Collaboration extension
- Edits are NOT synced to CRDT

#### 3. **Editor Update Flow**
```
User types in editor
  ↓
TipTap fires 'update' event
  ↓
editor.js:handleUpdate()
  ↓
Debounced (300ms)
  ↓
renderer.js:handleEditorUpdate()
  ↓
Gets HTML: editor.getContent()
  ↓
Extracts title from first line
  ↓
Extracts tags from #hashtags
  ↓
noteManager.updateNote(id, { title, content, tags })
  ↓
Updates note object in Map
  ↓
syncManager.saveNoteWithCRDT(note)
  ↓
crdtManager.updateMetadata(noteId, { title, tags, folder })
  ↓
Updates metadata in Y.Doc (auto-sets modified time)
  ↓
Generates CRDT update
  ↓
Update written to file
```

**✅ Result**: Title and tags are saved to CRDT
**❌ Problem**: Content HTML string is saved to note.content but NOT to Y.Doc

#### 4. **App Restart Flow**
```
App starts
  ↓
syncManager.loadAllNotes()
  ↓
For each note directory:
  ↓
  syncManager.loadNote(noteId)
    ↓
    updateStore.readAllUpdates(noteId)
    ↓
    Gets all .yjson files
    ↓
    For each update:
      crdtManager.applyUpdate(noteId, update, 'load')
    ↓
    crdtManager.getNoteFromDoc(noteId)
      ↓
      Reads metadata from Y.Map('metadata')
      ↓
      Tries to read content from Y.XmlFragment('default')
      ↓
      Fragment is EMPTY (no content was ever saved there)
      ↓
      Returns: { title: "...", content: '<p></p>', ... }
```

**✅ Result**: Title, tags, dates load correctly
**❌ Problem**: Content is empty because it was never saved to Y.XmlFragment

---

## Why Content Doesn't Persist

The issue is architectural:

1. **Metadata** is explicitly saved to `Y.Map('metadata')` ✅
2. **Content** should be in `Y.XmlFragment('default')` but it's not ❌

The content flow is completely separate from CRDT:
- Saved as HTML string to `note.content`
- Loaded from `note.content` string
- Never touches Y.XmlFragment

---

## What's Missing: TipTap Collaboration Extension

TipTap has a `Collaboration` extension that:
- Binds the editor to a Y.Doc
- Automatically syncs editor content to Y.XmlFragment
- Handles all ProseMirror ↔ Yjs conversion
- Enables real-time collaboration

**We're not using it at all.**

---

## Required Integration

### Option A: Use Collaboration Extension (Recommended)

**Pros:**
- Proper CRDT integration
- Automatic content sync
- Battle-tested (used by many apps)
- Enables future real-time collaboration
- No manual ProseMirror conversion needed

**Cons:**
- Requires refactoring editor initialization
- Changes data flow (editor becomes source of truth)
- Need to handle initial content loading differently

**Changes needed:**

1. **Install dependencies** (already installed):
   - `@tiptap/extension-collaboration` ✅
   - `y-prosemirror` ✅

2. **Modify editor.js**:
   - Import Collaboration extension
   - Accept Y.Doc in constructor
   - Add Collaboration to extensions array
   - Remove setContent()/getContent() for CRDT-backed notes
   - Keep setContent()/getContent() for non-Electron mode

3. **Modify renderer.js**:
   - Get Y.Doc from syncManager when loading a note
   - Pass Y.Doc to editor instead of HTML string
   - Remove content from updateNote() calls (editor is source of truth)
   - Handle editor re-initialization when switching notes

4. **Modify note-manager.js**:
   - Remove `content` field from note objects (it's in Y.Doc)
   - Keep `content` getter that reads from CRDT or returns placeholder

5. **Modify sync-manager.js**:
   - Ensure Y.Doc is created and loaded before editor connects

### Option B: Manual Y.XmlFragment Conversion

**Pros:**
- Keeps current editor flow
- Minimal editor changes

**Cons:**
- Fragile: manual ProseMirror JSON ↔ Y.XmlFragment conversion
- Duplicate effort (re-implementing what Collaboration does)
- Harder to maintain
- No real-time collaboration support

**Not recommended.**

---

## Implementation Plan (Option A)

### Phase 1: Basic Collaboration Integration

**Goal**: Get content persisting through CRDT

#### Step 1.1: Modify editor.js
```javascript
import Collaboration from '@tiptap/extension-collaboration';

constructor(element, options = {}) {
  // ...
  this.yDoc = options.yDoc || null; // Accept Y.Doc
  this.initializeEditor();
}

initializeEditor() {
  const extensions = [
    StarterKit,
    // ... other extensions
  ];

  // Add Collaboration if we have a Y.Doc
  if (this.yDoc) {
    extensions.push(
      Collaboration.configure({
        document: this.yDoc,
        field: 'default' // Use 'default' fragment name
      })
    );
  }

  this.editor = new Editor({
    element: this.element,
    extensions,
    // ...
  });
}
```

#### Step 1.2: Modify renderer.js
```javascript
selectNote(noteId) {
  const note = this.noteManager.getNote(noteId);

  // In Electron mode, get Y.Doc from syncManager
  if (this.isElectron && this.syncManager) {
    const yDoc = this.syncManager.getDoc(noteId);

    // Need to recreate editor with new Y.Doc
    // (or implement editor.setDocument() method)
    this.editor.destroy();
    this.editor = new NoteCoveEditor(editorElement, {
      yDoc: yDoc,
      onUpdate: () => this.handleEditorUpdate()
    });
  } else {
    // Web mode: use HTML content
    this.editor.setContent(note.content || '');
  }
}
```

#### Step 1.3: Handle Editor Updates
```javascript
handleEditorUpdate() {
  if (this.isElectron && this.syncManager) {
    // Content is auto-saved by Collaboration extension to Y.Doc
    // Y.Doc changes trigger CRDT updates automatically
    // We only need to extract title and tags

    const text = this.editor.getText();
    const firstLine = text.split('\n')[0].trim();
    const title = firstLine || 'Untitled';
    const tags = this.extractTags(text);

    // Only update metadata (not content)
    this.noteManager.updateNote(this.currentNote.id, { title, tags });
  } else {
    // Web mode: save content as HTML string
    const content = this.editor.getContent();
    // ... existing logic
  }
}
```

### Phase 2: Testing

1. **Unit test**: Content persistence through save/load cycle
2. **E2E test**: Create note → add content → restart → verify content
3. **Manual test**: Multi-instance sync

### Phase 3: Optimization

1. **Editor reuse**: Don't destroy/recreate editor on every note switch
2. **Loading states**: Show spinner while CRDT loads
3. **Conflict resolution**: Handle concurrent edits (automatic with CRDTs)

---

## Migration Strategy

### For Existing Notes (if any)

Notes created before Collaboration integration have `content` as HTML string but empty Y.XmlFragment.

**Migration options**:

1. **Lazy migration**: When a note is opened, if Y.XmlFragment is empty but note.content exists, populate the fragment
2. **Batch migration**: Script to convert all notes at once
3. **Keep both**: Support both old (HTML) and new (CRDT) notes

**Recommended**: Lazy migration in `renderer.js:selectNote()`:

```javascript
selectNote(noteId) {
  const note = this.noteManager.getNote(noteId);
  const yDoc = this.syncManager.getDoc(noteId);
  const fragment = yDoc.getXmlFragment('default');

  // Migration: if fragment is empty but note has content, migrate it
  if (fragment.length === 0 && note.content) {
    this.editor.setContent(note.content); // Populates fragment via Collaboration
    // Save the update
    await this.syncManager.saveNoteWithCRDT(note);
  }
}
```

---

## Testing Requirements

### Unit Tests

1. **CRDT Manager**:
   - ✅ Metadata persists
   - ❌ **TODO**: Content persists through Y.XmlFragment

2. **Sync Manager**:
   - ✅ Metadata loads correctly
   - ❌ **TODO**: Content loads correctly
   - ❌ **TODO**: Multi-instance sync works

3. **Editor Integration**:
   - ❌ **TODO**: Collaboration extension binds to Y.Doc
   - ❌ **TODO**: Editor changes trigger CRDT updates
   - ❌ **TODO**: CRDT updates appear in editor

### E2E Tests (Playwright)

1. **Basic persistence**:
   - Create note with title and content
   - Restart app
   - Verify title and content visible

2. **Multi-instance sync**:
   - Start instance 1, create note with content
   - Start instance 2, verify note appears with content
   - Edit in instance 2
   - Verify changes appear in instance 1

---

## Key Files to Modify

1. `/Users/drew/devel/nc/desktop/src/lib/editor.js` (200 lines)
   - Add Collaboration extension
   - Handle Y.Doc binding
   - Support both CRDT and HTML modes

2. `/Users/drew/devel/nc/desktop/src/renderer.js` (1100 lines)
   - Pass Y.Doc to editor
   - Handle editor re-initialization
   - Remove content from updateNote()

3. `/Users/drew/devel/nc/desktop/src/lib/note-manager.js` (500 lines)
   - Consider removing `content` field
   - Or make it a computed property from Y.Doc

4. **New**: `/Users/drew/devel/nc/desktop/src/lib/crdt-editor-integration.test.js`
   - Test content persistence
   - Test Collaboration extension

---

## Estimated Complexity

- **Phase 1**: 4-6 hours (integration)
- **Phase 2**: 2-3 hours (testing)
- **Phase 3**: 2-3 hours (optimization)
- **Total**: ~10 hours

**Complexity factors**:
- Editor lifecycle management (destroy/recreate)
- Handling both Electron (CRDT) and Web (HTML) modes
- Migration of existing notes
- Testing multi-instance scenarios

---

## Next Steps

1. **Review this plan** - make sure we agree on the approach
2. **Decide**: Full implementation now vs. incremental?
3. **Start with**: Editor Collaboration integration (Phase 1.1)
4. **Test**: Unit test for content persistence
5. **Iterate**: Fix issues, add E2E tests
