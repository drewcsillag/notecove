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
 * Test to reproduce the exact bug sequence described by the user:
 * 1. Start app → Sample notes show in list with snippets but empty bodies
 * 2. Create new note → Existing note titles change to "Untitled"
 * 3. Set title and body, quit, restart → New note has title and body
 * 4. Quit and restart again → Note loses title, gets duplicated
 */
describe('Bug Reproduction Test', () => {
  let testDir;
  let dom;
  let document;
  let editorElement;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `bug-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.Node = dom.window.Node;

    global.window.electronAPI = {
      isElectron: true,
      fileSystem: {
        exists: (filePath) => Promise.resolve(fs.existsSync(filePath)),
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
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete global.window;
    delete global.document;
    delete global.Node;
  });

  it('should reproduce: sample notes show snippets but empty bodies', async () => {
    // === APP START #1 ===
    console.log('\n=== APP START #1: Fresh start ===');

    const noteManager1 = new NoteManager();
    const syncManager1 = new SyncManager(noteManager1, testDir, 'test1');
    await noteManager1.setSyncManager(syncManager1);

    const notes = noteManager1.getAllNotes();
    console.log('Loaded notes:', notes.length);

    // Sample notes should be in memory
    expect(notes.length).toBe(2); // Welcome + Getting Started

    const welcomeNote = notes.find(n => n.title === 'Welcome to NoteCove');
    const guideNote = notes.find(n => n.title === 'Getting Started Guide');

    expect(welcomeNote).toBeDefined();
    expect(guideNote).toBeDefined();

    // They have HTML content in memory
    expect(welcomeNote.content).toContain('Welcome to NoteCove');
    expect(guideNote.content).toContain('Quick Start');

    console.log('Sample notes have content in memory:', welcomeNote.content.length, 'chars');

    // But if we open one in the editor...
    const yDoc1 = syncManager1.getDoc(welcomeNote.id);
    const editor1 = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Collaboration.configure({ document: yDoc1, field: 'default' })
      ]
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    // The editor should be EMPTY because Y.XmlFragment is empty
    const editorContent = editor1.getHTML();
    console.log('Editor content for Welcome note:', editorContent);
    expect(editorContent).toBe('<p></p>'); // Empty!

    editor1.destroy();
    await syncManager1.destroy();

    console.log('✓ Confirmed: Sample notes have content in memory but empty Y.Doc');
  });

  it('should reproduce: creating note affects existing notes', async () => {
    // === APP START #1 ===
    console.log('\n=== APP START #1 ===');

    const noteManager1 = new NoteManager();
    const syncManager1 = new SyncManager(noteManager1, testDir, 'test1');
    await noteManager1.setSyncManager(syncManager1);

    const initialNotes = noteManager1.getAllNotes();
    const welcomeNote = initialNotes.find(n => n.title === 'Welcome to NoteCove');
    const guideNote = initialNotes.find(n => n.title === 'Getting Started Guide');

    console.log('Initial notes:');
    console.log('  - Welcome:', welcomeNote.title);
    console.log('  - Guide:', guideNote.title);

    // Create a new note
    console.log('\nCreating new note...');
    const newNote = noteManager1.createNote({ folderId: 'all-notes' });
    console.log('Created note:', newNote.id);

    // Check if existing notes still have their titles
    const welcomeAfter = noteManager1.getNote(welcomeNote.id);
    const guideAfter = noteManager1.getNote(guideNote.id);

    console.log('After creating new note:');
    console.log('  - Welcome:', welcomeAfter.title);
    console.log('  - Guide:', guideAfter.title);

    // User reported: "Getting Started note's title went to Untitled"
    // Let's check if this happens
    expect(welcomeAfter.title).toBe('Welcome to NoteCove');
    expect(guideAfter.title).toBe('Getting Started Guide');

    await syncManager1.destroy();
  });

  it('should reproduce: note duplication on multiple restarts', async () => {
    let userNoteId;

    // === APP START #1: Create and edit note ===
    console.log('\n=== APP START #1: Create and edit note ===');
    {
      const noteManager = new NoteManager();
      const syncManager = new SyncManager(noteManager, testDir, 'test1');
      await noteManager.setSyncManager(syncManager);

      const newNote = noteManager.createNote({ folderId: 'all-notes' });
      userNoteId = newNote.id;

      // Bind to editor and type content
      const yDoc = syncManager.getDoc(newNote.id);
      const editor = new Editor({
        element: editorElement,
        extensions: [StarterKit, Collaboration.configure({ document: yDoc, field: 'default' })]
      });

      editor.commands.setContent('<h1>My Note Title</h1><p>This is the body content.</p>');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Extract title and update metadata
      const text = editor.getText();
      const title = text.split('\n')[0].trim();
      noteManager.updateNote(newNote.id, { title, tags: [] });

      await syncManager.updateStore.flush(newNote.id);

      editor.destroy();
      await syncManager.destroy();
      console.log('Saved note with title:', title);
    }

    // === APP RESTART #1: Load note ===
    console.log('\n=== APP RESTART #1: Load note ===');
    {
      const noteManager = new NoteManager();
      const syncManager = new SyncManager(noteManager, testDir, 'test1');
      await noteManager.setSyncManager(syncManager);

      const loadedNotes = noteManager.getAllNotes();
      console.log('Loaded', loadedNotes.length, 'notes');
      loadedNotes.forEach(n => console.log('  -', n.id.substring(0, 8), n.title));

      const ourNote = noteManager.getNote(userNoteId);
      expect(ourNote).toBeDefined();
      expect(ourNote.title).toBe('My Note Title');
      console.log('✓ Note loaded correctly with title');

      await syncManager.destroy();
    }

    // === APP RESTART #2: Check for issues ===
    console.log('\n=== APP RESTART #2: Check for duplication ===');
    {
      const noteManager = new NoteManager();
      const syncManager = new SyncManager(noteManager, testDir, 'test1');
      await noteManager.setSyncManager(syncManager);

      const loadedNotes = noteManager.getAllNotes();
      console.log('Loaded', loadedNotes.length, 'notes');
      loadedNotes.forEach(n => console.log('  -', n.id.substring(0, 8), n.title));

      // Check if note is duplicated
      const notesWithSameId = loadedNotes.filter(n => n.id === userNoteId);
      console.log('Notes with our ID:', notesWithSameId.length);
      expect(notesWithSameId.length).toBe(1); // Should NOT be duplicated

      const ourNote = noteManager.getNote(userNoteId);
      expect(ourNote).toBeDefined();
      console.log('Note title:', ourNote.title);
      expect(ourNote.title).toBe('My Note Title'); // Should still have title

      await syncManager.destroy();
    }

    // === APP RESTART #3: Check again ===
    console.log('\n=== APP RESTART #3: Final check ===');
    {
      const noteManager = new NoteManager();
      const syncManager = new SyncManager(noteManager, testDir, 'test1');
      await noteManager.setSyncManager(syncManager);

      const loadedNotes = noteManager.getAllNotes();
      console.log('Loaded', loadedNotes.length, 'notes');
      loadedNotes.forEach(n => console.log('  -', n.id.substring(0, 8), n.title));

      const notesWithSameId = loadedNotes.filter(n => n.id === userNoteId);
      console.log('Notes with our ID:', notesWithSameId.length);
      expect(notesWithSameId.length).toBe(1); // Should NOT be duplicated

      await syncManager.destroy();
    }
  });

  it('should check for overlapping sequence numbers in update files', async () => {
    const noteManager = new NoteManager();
    const syncManager = new SyncManager(noteManager, testDir, 'test1');
    await noteManager.setSyncManager(syncManager);

    const note = noteManager.createNote({ folderId: 'all-notes' });
    const yDoc = syncManager.getDoc(note.id);

    const editor = new Editor({
      element: editorElement,
      extensions: [StarterKit, Collaboration.configure({ document: yDoc, field: 'default' })]
    });

    // Make several edits
    for (let i = 0; i < 5; i++) {
      editor.commands.setContent(`<p>Edit ${i}</p>`);
      await new Promise(resolve => setTimeout(resolve, 10));
      const text = editor.getText();
      const title = text.split('\n')[0].trim();
      noteManager.updateNote(note.id, { title, tags: [] });
      await syncManager.updateStore.flush(note.id);
    }

    editor.destroy();
    await syncManager.destroy();

    // Check update files
    const updatesDir = path.join(testDir, note.id, 'updates');
    const files = fs.readdirSync(updatesDir);
    console.log('Update files:', files);

    // Parse sequence ranges
    const sequences = files.map(f => {
      const match = f.match(/test1\.(\d+)-(\d+)\.yjson/);
      if (match) {
        return { start: parseInt(match[1]), end: parseInt(match[2]), file: f };
      }
      return null;
    }).filter(s => s !== null);

    console.log('Sequences:', sequences);

    // Check for overlaps
    for (let i = 0; i < sequences.length; i++) {
      for (let j = i + 1; j < sequences.length; j++) {
        const a = sequences[i];
        const b = sequences[j];

        const overlap = (a.start <= b.end && a.end >= b.start);
        if (overlap) {
          console.error('OVERLAP DETECTED:');
          console.error('  ', a.file, 'covers', a.start, '-', a.end);
          console.error('  ', b.file, 'covers', b.start, '-', b.end);
          expect(overlap).toBe(false); // Fail if overlap found
        }
      }
    }

    console.log('✓ No overlapping sequences found');
  });
});
