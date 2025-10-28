/**
 * Debug script to decode and display CRDT state
 * Usage: node debug-crdt.js <noteId>
 */

const fs = require('fs');
const path = require('path');
const Y = require('yjs');

const noteId = process.argv[2] || 'default-note';
const storagePath = path.join(
  require('os').homedir(),
  'Library/Application Support/Electron/storage/notes',
  noteId,
  'updates'
);

console.log(`Reading updates for note: ${noteId}`);
console.log(`Storage path: ${storagePath}`);

if (!fs.existsSync(storagePath)) {
  console.log('Storage directory does not exist!');
  process.exit(1);
}

const files = fs.readdirSync(storagePath).filter((f) => f.endsWith('.yjson'));
console.log(`Found ${files.length} update files`);

const yDoc = new Y.Doc();

for (const file of files) {
  const filePath = path.join(storagePath, file);
  const data = fs.readFileSync(filePath);

  // Decode the update (assuming it's stored as is)
  Y.applyUpdate(yDoc, data);
  console.log(`Applied update from: ${file}`);
}

// Extract content
const fragment = yDoc.getXmlFragment('content');
console.log('\n=== Document Content ===');
console.log(fragment.toJSON());
