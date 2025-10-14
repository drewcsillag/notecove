import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CRDTManager } from './crdt-manager.js';
import { UpdateStore } from './update-store.js';
import { SyncManager } from './sync-manager.js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JSDOM } from 'jsdom';

/**
 * Integration test for CRDT content persistence with TipTap Collaboration
 * Tests the full cycle: edit in TipTap -> CRDT updates -> reload -> content appears
 */
describe('CRDT Content Persistence with Collaboration', () => {
  let testDir;
  let mockNoteManager;
  let mockFileSystemAPI;
  let dom;
  let document;

  beforeEach(() => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `notecove-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Setup JSDOM for editor
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.Node = dom.window.Node;

    // Mock NoteManager
    mockNoteManager = {
      notes: new Map(),
      notify: () => {}
    };

    // Mock Electron File System API with real file operations
    mockFileSystemAPI = {
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
    };

    // Setup global mocks
    global.window.electronAPI = {
      isElectron: true,
      fileSystem: mockFileSystemAPI
    };
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should persist content typed in TipTap through save/load cycle', async () => {
    const instanceId = 'test-instance';
    const noteId = 'test-note-123';

    // === WRITE PHASE ===
    console.log('\n=== WRITE PHASE: Creating editor with CRDT ===');

    const syncManager1 = new SyncManager(mockNoteManager, testDir, instanceId);

    // Initialize the note (creates Y.Doc)
    await syncManager1.saveNoteWithCRDT({
      id: noteId,
      title: 'Test Note',
      created: '2025-10-13T20:00:00.000Z',
      modified: '2025-10-13T20:00:00.000Z',
      tags: [],
      folder: 'all-notes',
      deleted: false
    });

    // Get the Y.Doc
    const yDoc1 = syncManager1.getDoc(noteId);
    expect(yDoc1).toBeDefined();

    // Create TipTap editor with Collaboration extension
    const editorElement = document.getElementById('editor');
    const editor1 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({
          document: yDoc1,
          field: 'default'
        })
      ],
      content: '' // Start empty
    });

    // Type some content into the editor
    const testContent = '<h1>Hello World</h1><p>This is a test note with some content.</p>';
    editor1.commands.setContent(testContent);

    // Wait a tick for CRDT to process
    await new Promise(resolve => setTimeout(resolve, 10));

    console.log('Editor content:', editor1.getHTML());
    console.log('Y.Doc fragment length:', yDoc1.getXmlFragment('default').length);

    // Verify content is in the Y.Doc
    const fragment1 = yDoc1.getXmlFragment('default');
    expect(fragment1.length).toBeGreaterThan(0);

    // Get the CRDT updates
    const pendingUpdates = syncManager1.crdtManager.getPendingUpdates(noteId);
    console.log('Pending updates:', pendingUpdates.length);

    // Flush updates to disk
    await syncManager1.updateStore.flush(noteId);

    // Clean up
    editor1.destroy();
    await syncManager1.destroy();

    console.log('=== WRITE PHASE COMPLETE ===\n');

    // === READ PHASE ===
    console.log('=== READ PHASE: Loading content from CRDT ===');

    // Create new SyncManager (simulating app restart)
    const syncManager2 = new SyncManager(mockNoteManager, testDir, instanceId);

    // Load the note
    const loadedNote = await syncManager2.loadNote(noteId);
    console.log('Loaded note:', loadedNote);

    expect(loadedNote).not.toBeNull();
    expect(loadedNote.id).toBe(noteId);
    expect(loadedNote.title).toBe('Test Note');

    // Get the Y.Doc (should have content loaded)
    const yDoc2 = syncManager2.getDoc(noteId);
    const fragment2 = yDoc2.getXmlFragment('default');
    console.log('Loaded Y.Doc fragment length:', fragment2.length);
    expect(fragment2.length).toBeGreaterThan(0);

    // Create a new editor bound to the loaded Y.Doc
    const editor2 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({
          document: yDoc2,
          field: 'default'
        })
      ],
      content: '' // Will be populated from Y.Doc
    });

    // Wait a tick for editor to sync with Y.Doc
    await new Promise(resolve => setTimeout(resolve, 10));

    // Get content from editor
    const loadedContent = editor2.getHTML();
    console.log('Loaded editor content:', loadedContent);

    // Verify content persisted
    expect(loadedContent).toContain('Hello World');
    expect(loadedContent).toContain('This is a test note');

    // Clean up
    editor2.destroy();
    await syncManager2.destroy();

    console.log('=== READ PHASE COMPLETE ===\n');
  });

  it('should handle multiple edits and preserve all changes', async () => {
    const instanceId = 'test-instance';
    const noteId = 'test-note-456';

    // === First Edit ===
    const syncManager1 = new SyncManager(mockNoteManager, testDir, instanceId);
    await syncManager1.saveNoteWithCRDT({
      id: noteId,
      title: 'Version 1',
      created: '2025-10-13T20:00:00.000Z',
      modified: '2025-10-13T20:00:00.000Z',
      tags: [],
      folder: 'all-notes',
      deleted: false
    });

    const yDoc1 = syncManager1.getDoc(noteId);
    const editorElement = document.getElementById('editor');
    const editor1 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({ document: yDoc1, field: 'default' })
      ]
    });

    editor1.commands.setContent('<p>Version 1 content</p>');
    await new Promise(resolve => setTimeout(resolve, 10));
    await syncManager1.updateStore.flush(noteId);

    editor1.destroy();
    await syncManager1.destroy();

    // === Second Edit ===
    const syncManager2 = new SyncManager(mockNoteManager, testDir, instanceId);
    await syncManager2.loadNote(noteId);

    const yDoc2 = syncManager2.getDoc(noteId);
    const editor2 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({ document: yDoc2, field: 'default' })
      ]
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    // Append more content
    editor2.commands.insertContentAt(editor2.state.doc.content.size, '<p>Version 2 additions</p>');
    await new Promise(resolve => setTimeout(resolve, 10));
    await syncManager2.updateStore.flush(noteId);

    editor2.destroy();
    await syncManager2.destroy();

    // === Load and Verify ===
    const syncManager3 = new SyncManager(mockNoteManager, testDir, instanceId);
    await syncManager3.loadNote(noteId);

    const yDoc3 = syncManager3.getDoc(noteId);
    const editor3 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({ document: yDoc3, field: 'default' })
      ]
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const finalContent = editor3.getHTML();
    console.log('Final content after multiple edits:', finalContent);

    // Should have both edits
    expect(finalContent).toContain('Version 1 content');
    expect(finalContent).toContain('Version 2 additions');

    editor3.destroy();
    await syncManager3.destroy();
  });

  it('should handle rich formatting (headings, lists, bold, italic)', async () => {
    const instanceId = 'test-instance';
    const noteId = 'test-note-789';

    const syncManager1 = new SyncManager(mockNoteManager, testDir, instanceId);
    await syncManager1.saveNoteWithCRDT({
      id: noteId,
      title: 'Rich Format Test',
      created: '2025-10-13T20:00:00.000Z',
      modified: '2025-10-13T20:00:00.000Z',
      tags: [],
      folder: 'all-notes',
      deleted: false
    });

    const yDoc1 = syncManager1.getDoc(noteId);
    const editorElement = document.getElementById('editor');
    const editor1 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({ document: yDoc1, field: 'default' })
      ]
    });

    // Add rich content
    const richContent = `
      <h1>Main Heading</h1>
      <p>Some <strong>bold</strong> and <em>italic</em> text.</p>
      <ul>
        <li>List item 1</li>
        <li>List item 2</li>
      </ul>
      <ol>
        <li>Numbered item 1</li>
        <li>Numbered item 2</li>
      </ol>
    `;
    editor1.commands.setContent(richContent);

    await new Promise(resolve => setTimeout(resolve, 10));
    await syncManager1.updateStore.flush(noteId);

    editor1.destroy();
    await syncManager1.destroy();

    // === Load and Verify ===
    const syncManager2 = new SyncManager(mockNoteManager, testDir, instanceId);
    await syncManager2.loadNote(noteId);

    const yDoc2 = syncManager2.getDoc(noteId);
    const editor2 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({ document: yDoc2, field: 'default' })
      ]
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const loadedContent = editor2.getHTML();
    console.log('Loaded rich content:', loadedContent);

    // Verify all formatting preserved
    expect(loadedContent).toContain('<h1>Main Heading</h1>');
    expect(loadedContent).toContain('<strong>bold</strong>');
    expect(loadedContent).toContain('<em>italic</em>');
    expect(loadedContent).toContain('<ul>');
    expect(loadedContent).toContain('<ol>');
    expect(loadedContent).toContain('List item 1');
    expect(loadedContent).toContain('Numbered item 1');

    editor2.destroy();
    await syncManager2.destroy();
  });

  it('should handle empty content correctly', async () => {
    const instanceId = 'test-instance';
    const noteId = 'test-note-empty';

    const syncManager1 = new SyncManager(mockNoteManager, testDir, instanceId);
    await syncManager1.saveNoteWithCRDT({
      id: noteId,
      title: 'Empty Note',
      created: '2025-10-13T20:00:00.000Z',
      modified: '2025-10-13T20:00:00.000Z',
      tags: [],
      folder: 'all-notes',
      deleted: false
    });

    // Don't add any content - leave empty
    await syncManager1.updateStore.flush(noteId);
    await syncManager1.destroy();

    // === Load empty note ===
    const syncManager2 = new SyncManager(mockNoteManager, testDir, instanceId);
    const loadedNote = await syncManager2.loadNote(noteId);

    expect(loadedNote).not.toBeNull();
    expect(loadedNote.title).toBe('Empty Note');

    // Empty Y.XmlFragment should be fine
    const yDoc2 = syncManager2.getDoc(noteId);
    const fragment = yDoc2.getXmlFragment('default');
    expect(fragment.length).toBe(0);

    await syncManager2.destroy();
  });
});
