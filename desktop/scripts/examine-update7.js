#!/usr/bin/env node

/**
 * Examine update #7 specifically to understand why it deletes the title
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
  const noteId = '200f15c9-eadd-49c8-b492-ca17a16cabb7';
  const notesPath = '/Users/drew/Documents/NoteCove';
  const updatesPath = path.join(notesPath, noteId, 'updates');

  // Read all update files
  const files = fs.readdirSync(updatesPath)
    .filter(f => f.endsWith('.yjson'))
    .sort();

  console.log(`Found ${files.length} update files\n`);

  // Parse and collect all updates
  const allUpdates = [];

  for (const file of files) {
    const filePath = path.join(updatesPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const packedFile = JSON.parse(content);

    const [startSeq, endSeq] = packedFile.sequence;

    // Decode each update in the file
    packedFile.updates.forEach((base64Update, idx) => {
      const seq = startSeq + idx;
      const update = decodeUpdate(base64Update);

      allUpdates.push({
        file,
        instanceId: packedFile.instance,
        sequence: seq,
        update,
        base64: base64Update
      });
    });
  }

  console.log(`Total updates: ${allUpdates.length}\n`);

  // Now apply updates 1-6 and examine the state
  console.log('=== Applying updates 1-6 ===\n');
  const doc = new Y.Doc();

  for (let i = 0; i < 6; i++) {
    const updateInfo = allUpdates[i];
    console.log(`Applying update ${i + 1} (seq ${updateInfo.sequence})`);
    Y.applyUpdate(doc, updateInfo.update, 'load');

    const yMetadata = doc.getMap('metadata');
    const keys = Array.from(yMetadata.keys());
    const title = yMetadata.get('title');
    const yContent = doc.getXmlFragment('default');

    console.log(`  Metadata keys: [${keys.join(', ')}]`);
    console.log(`  Title: "${title}"`);
    console.log(`  Content length: ${yContent.length}`);
    console.log('');
  }

  console.log('=== STATE BEFORE UPDATE 7 ===');
  const yMetadata = doc.getMap('metadata');
  const keys = Array.from(yMetadata.keys());
  keys.forEach(key => {
    const value = yMetadata.get(key);
    console.log(`  ${key}: ${JSON.stringify(value)}`);
  });
  console.log('');

  // Now examine update 7
  console.log('=== UPDATE 7 DETAILS ===');
  const update7 = allUpdates[6];
  console.log(`Sequence: ${update7.sequence}`);
  console.log(`Instance: ${update7.instanceId}`);
  console.log(`Size: ${update7.update.length} bytes`);
  console.log(`Base64: ${update7.base64}`);
  console.log(`Hex: ${Array.from(update7.update).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  console.log('');

  // Apply update 7 to a COPY of the doc to see what happens
  const docCopy1 = new Y.Doc();
  Y.applyUpdate(docCopy1, Y.encodeStateAsUpdate(doc)); // Copy state

  console.log('=== Applying update 7 to doc with correct state ===');
  Y.applyUpdate(docCopy1, update7.update, 'metadata');

  const yMetadataCopy1 = docCopy1.getMap('metadata');
  const keysCopy1 = Array.from(yMetadataCopy1.keys());
  console.log(`Metadata keys after: [${keysCopy1.join(', ')}]`);
  keysCopy1.forEach(key => {
    const value = yMetadataCopy1.get(key);
    console.log(`  ${key}: ${JSON.stringify(value)}`);
  });
  console.log('');

  // Also try applying it to a fresh doc
  console.log('=== Applying update 7 to FRESH doc (should not work correctly) ===');
  const docFresh = new Y.Doc();
  Y.applyUpdate(docFresh, update7.update, 'metadata');

  const yMetadataFresh = docFresh.getMap('metadata');
  const keysFresh = Array.from(yMetadataFresh.keys());
  console.log(`Metadata keys: [${keysFresh.join(', ')}]`);
  keysFresh.forEach(key => {
    const value = yMetadataFresh.get(key);
    console.log(`  ${key}: ${JSON.stringify(value)}`);
  });
  console.log('');

  // Try decoding update 7 as a full state
  console.log('=== Attempting to decode update 7 structure ===');
  try {
    // Create doc and apply just update 7
    const doc7 = new Y.Doc();
    Y.applyUpdate(doc7, update7.update);

    // See what's in it
    const meta7 = doc7.getMap('metadata');
    const content7 = doc7.getXmlFragment('default');
    console.log(`Metadata from update 7 alone: ${meta7.size} keys`);
    console.log(`Content from update 7 alone: ${content7.length} items`);

    // Check if it contains the new title
    const title7 = meta7.get('title');
    console.log(`Title in update 7: "${title7}"`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main().catch(console.error);
