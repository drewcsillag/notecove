#!/usr/bin/env node
/**
 * Debug script to inspect CRDT log files for a note
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';

// Re-implement the minimal parsing we need
const LOG_MAGIC = 0x4e434c47;
const LOG_HEADER_SIZE = 5;

function decodeVarint(buffer, offset) {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  for (;;) {
    if (offset + bytesRead >= buffer.length) {
      throw new Error('Incomplete varint: buffer ends mid-encoding');
    }

    const byte = buffer[offset + bytesRead];
    bytesRead++;

    value += (byte & 0x7f) * Math.pow(2, shift);
    shift += 7;

    if ((byte & 0x80) === 0) {
      break;
    }

    if (shift > 56) {
      throw new Error('Varint too large for safe JavaScript integer');
    }
  }

  return { value, bytesRead };
}

function decodeTimestamp(buffer, offset) {
  if (buffer.length < offset + 8) {
    throw new Error('Buffer too short to read timestamp');
  }

  const high =
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3];
  const low =
    (buffer[offset + 4] << 24) |
    (buffer[offset + 5] << 16) |
    (buffer[offset + 6] << 8) |
    buffer[offset + 7];

  return (high >>> 0) * 0x100000000 + (low >>> 0);
}

function readLogHeader(buffer) {
  if (buffer.length < LOG_HEADER_SIZE) {
    return {
      valid: false,
      version: 0,
      error: 'Truncated header: expected at least 5 bytes',
    };
  }

  const magic = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
  if (magic !== LOG_MAGIC) {
    return {
      valid: false,
      version: 0,
      error: `Invalid magic number: expected 0x${LOG_MAGIC.toString(16)}, got 0x${magic.toString(16)}`,
    };
  }

  const version = buffer[4];
  if (version !== 1) {
    return {
      valid: false,
      version,
      error: `Unsupported version: expected 1, got ${version}`,
    };
  }

  return { valid: true, version };
}

function readLogRecord(buffer, offset) {
  const lengthResult = decodeVarint(buffer, offset);
  const payloadLength = lengthResult.value;
  let pos = offset + lengthResult.bytesRead;

  if (payloadLength === 0) {
    return {
      timestamp: 0,
      sequence: 0,
      data: new Uint8Array(0),
      bytesRead: lengthResult.bytesRead,
      terminated: true,
    };
  }

  if (buffer.length < pos + payloadLength) {
    throw new Error(
      `Truncated record: expected ${payloadLength} bytes, have ${buffer.length - pos}`
    );
  }

  const timestamp = decodeTimestamp(buffer, pos);
  pos += 8;

  const sequenceResult = decodeVarint(buffer, pos);
  const sequence = sequenceResult.value;
  pos += sequenceResult.bytesRead;

  const dataLength = payloadLength - 8 - sequenceResult.bytesRead;
  const data = buffer.slice(pos, pos + dataLength);

  return {
    timestamp,
    sequence,
    data,
    bytesRead: lengthResult.bytesRead + payloadLength,
    terminated: false,
  };
}

function parseLogFile(buffer) {
  const header = readLogHeader(buffer);
  if (!header.valid) {
    throw new Error(`Invalid log file header: ${header.error}`);
  }

  const records = [];
  let offset = LOG_HEADER_SIZE;
  let terminated = false;

  while (offset < buffer.length) {
    const record = readLogRecord(buffer, offset);

    if (record.terminated) {
      terminated = true;
      break;
    }

    records.push({
      timestamp: record.timestamp,
      sequence: record.sequence,
      data: record.data,
    });

    offset += record.bytesRead;
  }

  return {
    version: header.version,
    records,
    terminated,
  };
}

// Main script
const noteDir = process.argv[2];
if (!noteDir) {
  console.error('Usage: node scripts/inspect-crdt-logs.mjs <note-dir>');
  process.exit(1);
}

const logsDir = path.join(noteDir, 'logs');

// Get all log files
const logFiles = fs.readdirSync(logsDir)
  .filter(f => f.endsWith('.crdtlog'))
  .sort();

console.log(`Found ${logFiles.length} log files:\n`);

// Track all records by instance
const recordsByInstance = new Map();

for (const file of logFiles) {
  const match = file.match(/^(.+)_(\d+)\.crdtlog$/);
  if (!match) continue;

  const instanceId = match[1];
  const fileTimestamp = parseInt(match[2], 10);
  const filePath = path.join(logsDir, file);
  const buffer = fs.readFileSync(filePath);

  console.log(`\n=== ${file} ===`);
  console.log(`  File size: ${buffer.length} bytes`);
  console.log(`  Instance: ${instanceId}`);
  console.log(`  File timestamp: ${new Date(fileTimestamp).toISOString()}`);

  try {
    const parsed = parseLogFile(buffer);
    console.log(`  Records: ${parsed.records.length}`);
    console.log(`  Terminated: ${parsed.terminated}`);

    if (!recordsByInstance.has(instanceId)) {
      recordsByInstance.set(instanceId, []);
    }

    for (const record of parsed.records) {
      recordsByInstance.get(instanceId).push({
        file,
        timestamp: record.timestamp,
        sequence: record.sequence,
        dataSize: record.data.length,
      });

      console.log(`    seq=${record.sequence}, ts=${new Date(record.timestamp).toISOString()}, dataSize=${record.data.length}`);
    }
  } catch (err) {
    console.error(`  ERROR: ${err}`);
  }
}

// Summary by instance
console.log('\n\n=== SUMMARY BY INSTANCE ===');
for (const [instanceId, records] of recordsByInstance) {
  records.sort((a, b) => a.sequence - b.sequence);
  const seqs = records.map(r => r.sequence);
  const minSeq = Math.min(...seqs);
  const maxSeq = Math.max(...seqs);

  // Check for gaps
  const gaps = [];
  for (let i = minSeq; i <= maxSeq; i++) {
    if (!seqs.includes(i)) {
      gaps.push(i);
    }
  }

  console.log(`\nInstance: ${instanceId}`);
  console.log(`  Records: ${records.length}`);
  console.log(`  Sequence range: ${minSeq} - ${maxSeq}`);
  console.log(`  Sequence gaps: ${gaps.length > 0 ? gaps.join(', ') : 'none'}`);
}

// Now reconstruct the document
console.log('\n\n=== RECONSTRUCTING DOCUMENT ===');

const doc = new Y.Doc();

// Collect all records and sort by timestamp
const allRecords = [];

for (const file of logFiles) {
  const match = file.match(/^(.+)_(\d+)\.crdtlog$/);
  if (!match) continue;

  const instanceId = match[1];
  const filePath = path.join(logsDir, file);
  const buffer = fs.readFileSync(filePath);

  try {
    const parsed = parseLogFile(buffer);
    for (const record of parsed.records) {
      allRecords.push({ instanceId, record });
    }
  } catch (err) {
    console.error(`Error parsing ${file}: ${err}`);
  }
}

// Sort by timestamp, then by sequence
allRecords.sort((a, b) => {
  if (a.record.timestamp !== b.record.timestamp) {
    return a.record.timestamp - b.record.timestamp;
  }
  return a.record.sequence - b.record.sequence;
});

console.log(`Total records to apply: ${allRecords.length}`);

for (const { instanceId, record } of allRecords) {
  try {
    Y.applyUpdate(doc, record.data);
  } catch (err) {
    console.error(`Error applying update from ${instanceId} seq=${record.sequence}: ${err}`);
  }
}

// Get the document content - try multiple possible keys
console.log('\n=== DOCUMENT KEYS ===');
const topLevelKeys = doc.share.keys();
console.log('Top-level keys in doc:', [...topLevelKeys]);

// Try 'content' (which is what NoteDoc uses)
const xmlFragment = doc.getXmlFragment('content');
console.log('\n=== DOCUMENT CONTENT (from content XmlFragment) ===');
console.log(JSON.stringify(xmlFragment.toJSON(), null, 2));

// Try to extract text content
function extractText(node, indent = '') {
  let text = '';
  if (typeof node === 'string') {
    return node;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      text += extractText(child, indent);
    }
  } else if (typeof node === 'object' && node !== null) {
    if (node.type === 'text' && node.text) {
      text += node.text;
    }
    if (node.content) {
      text += extractText(node.content, indent);
    }
    if (node.type === 'paragraph' || node.type === 'taskItem' || node.type === 'listItem') {
      text += '\n';
    }
  }
  return text;
}

console.log('\n=== EXTRACTED TEXT ===');
const content = xmlFragment.toJSON();
console.log(extractText(content));
