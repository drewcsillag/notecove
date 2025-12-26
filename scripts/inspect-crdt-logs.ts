#!/usr/bin/env npx ts-node
/**
 * Debug script to inspect CRDT log files for a note
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';
import { parseLogFile } from '../packages/shared/src/storage/binary-format';

const noteDir = process.argv[2];
if (!noteDir) {
  console.error('Usage: npx ts-node scripts/inspect-crdt-logs.ts <note-dir>');
  process.exit(1);
}

const logsDir = path.join(noteDir, 'logs');

// Get all log files
const logFiles = fs
  .readdirSync(logsDir)
  .filter((f) => f.endsWith('.crdtlog'))
  .sort();

console.log(`Found ${logFiles.length} log files:\n`);

// Track all records by instance
interface RecordInfo {
  file: string;
  timestamp: number;
  sequence: number;
  dataSize: number;
}

const recordsByInstance = new Map<string, RecordInfo[]>();

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
      recordsByInstance.get(instanceId)!.push({
        file,
        timestamp: record.timestamp,
        sequence: record.sequence,
        dataSize: record.data.length,
      });

      console.log(
        `    seq=${record.sequence}, ts=${new Date(record.timestamp).toISOString()}, dataSize=${record.data.length}`
      );
    }
  } catch (err) {
    console.error(`  ERROR: ${err}`);
  }
}

// Summary by instance
console.log('\n\n=== SUMMARY BY INSTANCE ===');
for (const [instanceId, records] of recordsByInstance) {
  records.sort((a, b) => a.sequence - b.sequence);
  const seqs = records.map((r) => r.sequence);
  const minSeq = Math.min(...seqs);
  const maxSeq = Math.max(...seqs);

  // Check for gaps
  const gaps: number[] = [];
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
const allRecords: {
  instanceId: string;
  record: { timestamp: number; sequence: number; data: Uint8Array };
}[] = [];

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

// Get the document content
const xmlFragment = doc.get('prosemirror', Y.XmlFragment);
console.log('\n=== DOCUMENT CONTENT (from ProseMirror XML) ===');
console.log(xmlFragment.toJSON());

// Try to extract text content
function extractText(node: any, indent = ''): string {
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
