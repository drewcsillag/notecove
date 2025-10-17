#!/usr/bin/env node

/**
 * Examine typing updates 2-6 to understand why they're malformed
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
  const noteId = 'e3ea1b56-feea-415e-a5e5-82cbb6eee70c';
  const notesPath = '/Users/drew/Documents/NoteCove';
  const updatesPath = path.join(notesPath, noteId, 'updates');

  // Read the file with updates 2-7
  const filePath = path.join(updatesPath, 'instance-197a431a.000002-000007.yjson');
  const content = fs.readFileSync(filePath, 'utf8');
  const packedFile = JSON.parse(content);

  console.log('=== EXAMINING TYPING UPDATES ===\n');

  // First, get update 1 to establish baseline
  const file1Path = path.join(updatesPath, 'instance-197a431a.000001.yjson');
  const file1Content = fs.readFileSync(file1Path, 'utf8');
  const file1 = JSON.parse(file1Content);

  const doc = new Y.Doc();
  Y.applyUpdate(doc, decodeUpdate(file1.updates[0]));

  console.log('After update 1 (init):');
  const meta1 = doc.getMap('metadata');
  const frag1 = doc.getXmlFragment('default');
  console.log(`  Metadata title: "${meta1.get('title')}"`);
  console.log(`  Fragment length: ${frag1.length}`);
  console.log(`  Fragment toString: "${frag1.toString()}"`);
  console.log('');

  // Now examine each typing update
  packedFile.updates.forEach((base64Update, idx) => {
    const seq = 2 + idx;
    const update = decodeUpdate(base64Update);

    console.log(`Update ${seq}:`);
    console.log(`  Size: ${update.length} bytes`);
    console.log(`  Hex: ${Array.from(update).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

    // Look for ASCII characters in the update
    const asciiChars = [];
    for (let i = 0; i < update.length; i++) {
      if (update[i] >= 32 && update[i] <= 126) {
        asciiChars.push(String.fromCharCode(update[i]));
      }
    }
    if (asciiChars.length > 0) {
      console.log(`  ASCII chars found: "${asciiChars.join('')}"`);
    }

    // Apply to doc
    Y.applyUpdate(doc, update);

    const meta = doc.getMap('metadata');
    const frag = doc.getXmlFragment('default');
    const keys = Array.from(meta.keys());

    console.log(`  After apply:`);
    console.log(`    Metadata keys: ${keys.length} [${keys.join(', ')}]`);
    console.log(`    Title: "${meta.get('title')}"`);
    console.log(`    Fragment length: ${frag.length}`);

    // Try to get actual content
    if (frag.length > 0) {
      try {
        const firstElem = frag.get(0);
        console.log(`    Fragment[0] type: ${firstElem.nodeName}`);
        if (firstElem instanceof Y.XmlText || (firstElem.length !== undefined && firstElem.length > 0)) {
          console.log(`    Fragment[0] content: "${firstElem.toString()}"`);
        }
      } catch (e) {
        console.log(`    Fragment[0] error: ${e.message}`);
      }
    }
    console.log('');
  });
}

main().catch(console.error);
