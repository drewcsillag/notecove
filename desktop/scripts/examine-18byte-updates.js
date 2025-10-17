#!/usr/bin/env node

/**
 * Examine the mysterious 18-byte updates (3-7)
 */

const fs = require('fs');
const path = require('path');
const Y = require('yjs');

function decodeUpdate(base64) {
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function main() {
  const noteId = 'e7b2a137-8664-4b7b-8b7c-aeedb187b2bf';
  const notesPath = '/Users/drew/Documents/NoteCove';
  const updatesPath = path.join(notesPath, noteId, 'updates');

  // Read the packed file with updates 3-8
  const filePath = path.join(updatesPath, 'instance-0cdc8e5f.000003-000008.yjson');
  const content = fs.readFileSync(filePath, 'utf8');
  const packedFile = JSON.parse(content);

  console.log('Updates 3-8 from packed file:\n');

  packedFile.updates.forEach((base64Update, idx) => {
    const seq = 3 + idx;
    const update = decodeUpdate(base64Update);

    console.log(`Update ${seq}:`);
    console.log(`  Size: ${update.length} bytes`);
    console.log(`  Base64: ${base64Update}`);
    console.log(`  Hex: ${Array.from(update).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

    // Try to understand what this update does
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);

    const yMetadata = doc.getMap('metadata');
    const yContent = doc.getXmlFragment('default');

    console.log(`  Applied to fresh doc: ${yMetadata.size} metadata keys, ${yContent.length} content items`);
    console.log('');
  });

  // Now apply them incrementally to see the effect
  console.log('=== INCREMENTAL APPLICATION ===\n');

  // First create the initial state (updates 1-2)
  const file1Path = path.join(updatesPath, 'instance-0cdc8e5f.000001-000002.yjson');
  const file1Content = fs.readFileSync(file1Path, 'utf8');
  const file1 = JSON.parse(file1Content);

  const doc = new Y.Doc();

  // Apply update 1 (initialization)
  Y.applyUpdate(doc, decodeUpdate(file1.updates[0]));
  console.log('After update 1 (init):');
  const meta1 = doc.getMap('metadata');
  console.log(`  Metadata: ${meta1.size} keys, title="${meta1.get('title')}"`);
  console.log(`  Content: ${doc.getXmlFragment('default').length} items`);
  console.log('');

  // Apply update 2 (content)
  Y.applyUpdate(doc, decodeUpdate(file1.updates[1]));
  console.log('After update 2 (content):');
  const meta2 = doc.getMap('metadata');
  console.log(`  Metadata: ${meta2.size} keys, title="${meta2.get('title')}"`);
  console.log(`  Content: ${doc.getXmlFragment('default').length} items`);
  console.log('');

  // Now apply updates 3-8 one by one
  packedFile.updates.forEach((base64Update, idx) => {
    const seq = 3 + idx;
    const update = decodeUpdate(base64Update);

    Y.applyUpdate(doc, update);

    const yMetadata = doc.getMap('metadata');
    const yContent = doc.getXmlFragment('default');
    const keys = Array.from(yMetadata.keys());

    console.log(`After update ${seq}:`);
    console.log(`  Metadata: ${keys.length} keys [${keys.join(', ')}]`);
    console.log(`  Title: "${yMetadata.get('title')}"`);
    console.log(`  Content: ${yContent.length} items`);
    console.log('');
  });
}

main().catch(console.error);
