#!/usr/bin/env node
/**
 * Usage:
 *   node inspect-yjs-update.js path/to/update.bin
 *
 * The file should contain a Yjs update (Uint8Array / binary data).
 * The script will decode and pretty-print it.
 */

import fs from 'fs';
import * as Y from 'yjs';

if (process.argv.length < 3) {
  console.error('Usage: node inspect-yjs-update.js <update-file>');
  process.exit(1);
}

const filename = process.argv[2];

// Read the binary file
const update = fs.readFileSync(filename);

// Make sure it's a Uint8Array (Buffer is compatible but we convert anyway)
const updateArray = new Uint8Array(update);

// Decode and log
try {
  console.log('🧩 Human-readable summary:\n');
  Y.logUpdate(updateArray);

  console.log('\n📦 Structured object:\n');
  const decoded = Y.decodeUpdate(updateArray);
  console.log(JSON.stringify(decoded, null, 2));
} catch (err) {
  console.error('❌ Failed to decode update:', err);
  process.exit(1);
}
