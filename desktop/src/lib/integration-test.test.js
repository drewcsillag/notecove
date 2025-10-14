import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NoteManager } from './note-manager.js';
import { SyncManager } from './sync-manager.js';
import { NoteCoveEditor } from './editor.js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JSDOM } from 'jsdom';

/**
 * FULL INTEGRATION TEST
 * Tests the COMPLETE app flow exactly as it happens in the real app:
 * 1. Create NoteManager
 * 2. Create SyncManager
 * 3. Link them (triggering loadAllNotes)
 * 4. Create a note
 * 5. Open it in editor (bind to Y.Doc)
 * 6. Type content
 * 7. Destroy everything (simulating app close)
 * 8. Recreate NoteManager + SyncManager (simulating app restart)
 * 9. Load notes (should find the note)
 * 10. Open in editor and verify content appears
 */
describe('Full App Integration Test', () => {
  let testDir;
  let dom;
  let document;
  let editorElement;

  beforeEach(() => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `notecove-integration-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Setup JSDOM for editor
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.Node = dom.window.Node;

    // Mock Electron API
    global.window.electronAPI = {
      isElectron: true,
      fileSystem: {
        exists: (filePath) => {
          return Promise.resolve(fs.existsSync(filePath));
        },
        readDir: (dirPath) => {
          try {
            const files = fs.readdirSync(dirPath);
            return Promise.resolve({ success: true, files });
          } catch (error) {
            return Promise.resolve({ success: false, error: error.message });
          }
        },
        readFile: (filePath) => {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            return Promise.resolve({ success: true, content });
          } catch (error) {
            return Promise.resolve({ success: false, error: error.message });
          }
        },
        writeFile: (filePath, content) => {
          try {
            const dir = path.dirname(filePath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, content, 'utf8');
            return Promise.resolve({ success: true });
          } catch (error) {
            return Promise.resolve({ success: false, error: error.message });
          }
        },
        mkdir: (dirPath) => {
          try {
            fs.mkdirSync(dirPath, { recursive: true });
            return Promise.resolve({ success: true });
          } catch (error) {
            return Promise.resolve({ success: false, error: error.message });
          }
        }
      }
    };

    editorElement = document.getElementById('editor');
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Clean up globals
    delete global.window;
    delete global.document;
    delete global.Node;
  });

  it('should persist note content through full app lifecycle (create → edit → restart → load)', async () => {
    const instanceId = 'test-instance';

    // ============================================================
    // PHASE 1: First App Session - Create and Edit Note
    // ============================================================
    console.log('\n=== PHASE 1: First App Session ===');

    // Step 1: Initialize NoteManager (as renderer.js does)
    const noteManager1 = new NoteManager();
    console.log('Created NoteManager');

    // Step 2: Initialize SyncManager and link to NoteManager
    const syncManager1 = new SyncManager(noteManager1, testDir, instanceId);
    await noteManager1.setSyncManager(syncManager1);
    console.log('Linked SyncManager to NoteManager');

    // At this point, noteManager should have loaded notes from CRDT
    // Since testDir is empty, it should have created sample notes
    console.log('NoteManager has', noteManager1.notes.size, 'notes');

    // Step 3: Create a new note (as user would do)
    const newNote = noteManager1.createNote({ folderId: 'all-notes' });
    console.log('Created note:', newNote.id);
    expect(newNote).toBeDefined();
    expect(newNote.id).toBeDefined();

    // Step 4: Get the Y.Doc for this note (as renderer.js does in renderCurrentNote)
    const yDoc1 = syncManager1.getDoc(newNote.id);
    expect(yDoc1).toBeDefined();
    console.log('Got Y.Doc for note');

    // Step 5: Create editor bound to Y.Doc (as renderer.js does)
    const editor1 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({
          document: yDoc1,
          field: 'default'
        })
      ],
      content: ''
    });
    console.log('Created editor bound to Y.Doc');

    // Step 6: User types content
    const testContent = '<h1>My Test Note</h1><p>This is content that should persist.</p><p>Even after restart!</p>';
    editor1.commands.setContent(testContent);
    await new Promise(resolve => setTimeout(resolve, 10));
    console.log('Set content in editor');

    // Verify it's in the Y.Doc
    const fragment1 = yDoc1.getXmlFragment('default');
    expect(fragment1.length).toBeGreaterThan(0);
    console.log('Y.Doc fragment has', fragment1.length, 'elements');

    // Step 6b: Extract title and update metadata (as renderer.js handleEditorUpdate does)
    const text = editor1.getText();
    const firstLine = text.split('\n')[0].trim();
    const title = firstLine || 'Untitled';
    console.log('Extracted title:', title);

    // Update the note metadata (this triggers CRDT metadata update)
    noteManager1.updateNote(newNote.id, { title, tags: [] });
    console.log('Updated note metadata');

    // Step 7: Flush updates to disk
    await syncManager1.updateStore.flush(newNote.id);
    console.log('Flushed updates to disk');

    // Check what files were created
    const noteDir = path.join(testDir, newNote.id);
    const updatesDir = path.join(noteDir, 'updates');
    const updateFiles = fs.readdirSync(updatesDir);
    console.log('Update files created:', updateFiles);
    expect(updateFiles.length).toBeGreaterThan(0);

    // Step 8: Clean up (simulating app close)
    editor1.destroy();
    await syncManager1.destroy();
    console.log('Destroyed editor and sync manager');

    // ============================================================
    // PHASE 2: App Restart - Load and Verify
    // ============================================================
    console.log('\n=== PHASE 2: App Restart ===');

    // Step 1: Create new NoteManager (fresh start)
    const noteManager2 = new NoteManager();
    console.log('Created new NoteManager');

    // Step 2: Create new SyncManager and link
    const syncManager2 = new SyncManager(noteManager2, testDir, instanceId);
    await noteManager2.setSyncManager(syncManager2);
    console.log('Linked new SyncManager');

    // Step 3: Check if our note was loaded
    const loadedNotes = Array.from(noteManager2.notes.values());
    console.log('Loaded', loadedNotes.length, 'notes');
    loadedNotes.forEach(n => {
      console.log('  -', n.id, n.title, `(${n.content.substring(0, 50)}...)`);
    });

    const ourNote = noteManager2.getNote(newNote.id);
    expect(ourNote).toBeDefined();
    expect(ourNote.title).toBe('My Test Note'); // Title extracted from first line
    console.log('Found our note:', ourNote.id);

    // Step 4: Get Y.Doc for the loaded note
    const yDoc2 = syncManager2.getDoc(newNote.id);
    expect(yDoc2).toBeDefined();
    const fragment2 = yDoc2.getXmlFragment('default');
    console.log('Y.Doc fragment has', fragment2.length, 'elements');
    expect(fragment2.length).toBeGreaterThan(0);

    // Step 5: Create editor bound to loaded Y.Doc
    const editor2 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({
          document: yDoc2,
          field: 'default'
        })
      ],
      content: ''
    });
    console.log('Created new editor bound to loaded Y.Doc');

    // Wait for editor to sync with Y.Doc
    await new Promise(resolve => setTimeout(resolve, 10));

    // Step 6: VERIFY content appears in editor
    const loadedContent = editor2.getHTML();
    console.log('Loaded content:', loadedContent);

    expect(loadedContent).toContain('My Test Note');
    expect(loadedContent).toContain('This is content that should persist');
    expect(loadedContent).toContain('Even after restart');

    // Clean up
    editor2.destroy();
    await syncManager2.destroy();

    console.log('\n=== TEST PASSED ===');
  });

  it('should handle isElectron flag correctly in full flow', async () => {
    const instanceId = 'test-instance';

    // Create NoteManager - it should detect Electron mode
    const noteManager = new NoteManager();
    expect(noteManager.isElectron).toBe(true);

    // Create SyncManager
    const syncManager = new SyncManager(noteManager, testDir, instanceId);
    expect(syncManager.isElectron).toBe(true);

    // Link them
    await noteManager.setSyncManager(syncManager);

    // Create a note
    const note = noteManager.createNote({ folderId: 'all-notes' });

    // Get Y.Doc
    const yDoc = syncManager.getDoc(note.id);
    expect(yDoc).toBeDefined();

    // Clean up
    await syncManager.destroy();
  });

  it('should properly extract preview from Y.Doc content', async () => {
    const instanceId = 'test-instance';

    // First session: create and edit
    const noteManager1 = new NoteManager();
    const syncManager1 = new SyncManager(noteManager1, testDir, instanceId);
    await noteManager1.setSyncManager(syncManager1);

    const note = noteManager1.createNote({ folderId: 'all-notes' });
    const yDoc1 = syncManager1.getDoc(note.id);

    const editor1 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({ document: yDoc1, field: 'default' })
      ]
    });

    editor1.commands.setContent('<p>This is my note content for preview testing</p>');
    await new Promise(resolve => setTimeout(resolve, 10));
    await syncManager1.updateStore.flush(note.id);

    editor1.destroy();
    await syncManager1.destroy();

    // Second session: load and check
    const noteManager2 = new NoteManager();
    const syncManager2 = new SyncManager(noteManager2, testDir, instanceId);
    await noteManager2.setSyncManager(syncManager2);

    const loadedNote = noteManager2.getNote(note.id);
    console.log('Loaded note content field:', loadedNote.content);

    // The note.content field should either have actual content or the placeholder
    // It should NOT be empty string
    expect(loadedNote.content).toBeDefined();
    expect(loadedNote.content.length).toBeGreaterThan(0);

    await syncManager2.destroy();
  });
});
