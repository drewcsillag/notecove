#!/usr/bin/env node

/**
 * Decode Y.js update files to human-readable format
 * Usage: node scripts/decode-updates.js <note-id>
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

function analyzeUpdate(updateData, index, total) {
  // Create a fresh Y.Doc to apply this single update to
  const doc = new Y.Doc();

  // Apply the update
  Y.applyUpdate(doc, updateData);

  // Extract metadata
  const yMetadata = doc.getMap('metadata');
  const metadata = {};
  yMetadata.forEach((value, key) => {
    metadata[key] = value;
  });

  // Extract content
  const yContent = doc.getXmlFragment('default');
  const contentLength = yContent.length;

  return {
    index: index + 1,
    total,
    updateSize: updateData.length,
    metadata,
    metadataKeys: Array.from(yMetadata.keys()),
    contentLength
  };
}

function analyzeUpdatesIncremental(updates) {
  console.log('\n=== INCREMENTAL ANALYSIS (applying updates one by one) ===\n');

  const doc = new Y.Doc();

  updates.forEach((updateInfo, i) => {
    Y.applyUpdate(doc, updateInfo.update, 'load');

    const yMetadata = doc.getMap('metadata');
    const keys = Array.from(yMetadata.keys());
    const metadata = {};
    keys.forEach(key => {
      metadata[key] = yMetadata.get(key);
    });

    const yContent = doc.getXmlFragment('default');

    console.log(`After update ${i + 1} (type: ${updateInfo.type || 'unknown'}, seq ${updateInfo.sequence}, instance ${updateInfo.instanceId}):`);
    console.log(`  Metadata keys (${keys.length}): [${keys.join(', ')}]`);
    if (keys.length > 0) {
      console.log(`  Metadata values:`, JSON.stringify(metadata, null, 2).split('\n').map(line => `    ${line}`).join('\n').trim());
    }
    console.log(`  Content length: ${yContent.length}`);
    console.log('');
  });
}

async function main() {
  const noteId = process.argv[2];
  if (!noteId) {
    console.error('Usage: node scripts/decode-updates.js <note-id>');
    process.exit(1);
  }

  const notesPath = '/Users/drew/Documents/NoteCove';
  const notePath = path.join(notesPath, noteId);
  const updatesPath = path.join(notePath, 'updates');

  if (!fs.existsSync(updatesPath)) {
    console.error(`Updates directory not found: ${updatesPath}`);
    process.exit(1);
  }

  // Read all update files
  const files = fs.readdirSync(updatesPath)
    .filter(f => f.endsWith('.yjson'))
    .sort();

  console.log(`Found ${files.length} update files for note ${noteId}\n`);

  // Parse and collect all updates
  const allUpdates = [];

  for (const file of files) {
    const filePath = path.join(updatesPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const packedFile = JSON.parse(content);

    const [startSeq, endSeq] = packedFile.sequence;
    const instanceId = packedFile.instance;

    console.log(`File: ${file}`);
    console.log(`  Instance: ${instanceId}`);
    console.log(`  Sequence: ${startSeq}-${endSeq}`);
    console.log(`  Timestamp: ${packedFile.timestamp}`);
    console.log(`  Updates: ${packedFile.updates.length}`);

    // Decode each update in the file
    packedFile.updates.forEach((updateEntry, idx) => {
      const seq = startSeq + idx;

      // Handle both old format (string) and new format (object with type)
      let base64Update, type;
      if (typeof updateEntry === 'string') {
        // Old format: just the base64 string
        base64Update = updateEntry;
        type = 'content'; // Default type for backward compat
      } else {
        // New format: object with data and type
        base64Update = updateEntry.data;
        type = updateEntry.type;
      }

      const update = decodeUpdate(base64Update);

      allUpdates.push({
        file,
        instanceId,
        sequence: seq,
        update,
        type,
        base64: base64Update
      });

      // Analyze this individual update
      const analysis = analyzeUpdate(update, allUpdates.length - 1, packedFile.updates.length);
      console.log(`  \nUpdate ${idx + 1} (seq ${seq}, type: ${type}, ${update.length} bytes):`);
      console.log(`    Metadata keys: [${analysis.metadataKeys.join(', ')}]`);
      if (analysis.metadataKeys.length > 0) {
        console.log(`    Metadata:`, JSON.stringify(analysis.metadata, null, 2).split('\n').map(line => `      ${line}`).join('\n').trim());
      }
      console.log(`    Content length: ${analysis.contentLength}`);
    });

    console.log('');
  }

  // Now do incremental analysis
  analyzeUpdatesIncremental(allUpdates);

  console.log('\n=== SUMMARY ===');
  console.log(`Total updates: ${allUpdates.length}`);
  console.log(`Instances: ${Array.from(new Set(allUpdates.map(u => u.instanceId))).join(', ')}`);
}

main().catch(console.error);
