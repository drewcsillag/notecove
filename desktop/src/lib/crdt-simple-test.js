/**
 * Simple test to debug CRDT save/load issue
 * Run with: node --loader ./node_modules/vitest/dist/node-loader.mjs src/lib/crdt-simple-test.js
 */
import { CRDTManager } from './crdt-manager.js';
import * as Y from 'yjs';

console.log('=== Test 1: Create a note and check if updates are generated ===');

const crdtManager = new CRDTManager();
const noteId = 'test-note';

// Simulate creating a new note
const note = {
  id: noteId,
  title: 'My Test Title',
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
  tags: ['test'],
  folder: 'all-notes'
};

console.log('1. Initializing note with title:', note.title);
crdtManager.initializeNote(noteId, note);

console.log('2. Getting pending updates...');
const pendingUpdates = crdtManager.getPendingUpdates(noteId);
console.log('   Pending updates count:', pendingUpdates.length);

if (pendingUpdates.length > 0) {
  console.log('   ✅ Updates were generated!');
  console.log('   First update size:', pendingUpdates[0].length, 'bytes');
} else {
  console.log('   ❌ NO updates generated!');
}

console.log('\n3. Reading the note back from CRDT...');
const loadedNote = crdtManager.getNoteFromDoc(noteId);
console.log('   Loaded title:', loadedNote.title);
console.log('   Loaded tags:', loadedNote.tags);
console.log('   Loaded folderId:', loadedNote.folderId);

if (loadedNote.title === note.title) {
  console.log('   ✅ Title matches!');
} else {
  console.log('   ❌ Title mismatch! Expected:', note.title, 'Got:', loadedNote.title);
}

console.log('\n=== Test 2: Apply the update to a new doc ===');

const crdtManager2 = new CRDTManager();
const noteId2 = 'test-note-2';

// Simulate loading from updates
for (const update of pendingUpdates) {
  crdtManager2.applyUpdate(noteId2, new Uint8Array(update), 'load');
}

const loadedNote2 = crdtManager2.getNoteFromDoc(noteId2);
console.log('Loaded from updates - title:', loadedNote2.title);
console.log('Loaded from updates - tags:', loadedNote2.tags);

if (loadedNote2.title === note.title) {
  console.log('✅ Title persisted through update apply!');
} else {
  console.log('❌ Title lost! Expected:', note.title, 'Got:', loadedNote2.title);
}
