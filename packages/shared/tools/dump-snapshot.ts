#!/usr/bin/env npx ts-node
/**
 * dump-snapshot - Debug tool to inspect .snapshot files
 *
 * Usage: npx ts-node tools/dump-snapshot.ts [--json] <file.snapshot>
 *
 * Options:
 *   --json  Output in machine-readable JSON format
 *
 * Outputs:
 * - File header (magic, version, status)
 * - Vector clock entries (instance IDs, sequences, offsets, filenames)
 * - Document state size and hex preview
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseSnapshotFile, SNAPSHOT_HEADER_SIZE } from '../src/storage/binary-format';

interface SnapshotDumpResult {
  file: string;
  fileSize: number;
  header: {
    valid: boolean;
    version: number;
    complete: boolean;
  };
  vectorClock: Array<{
    instanceId: string;
    sequence: number;
    offset: number;
    filename: string;
  }>;
  documentState: {
    size: number;
    hex: string;
  };
  summary: {
    headerSize: number;
    vectorClockSize: number;
    documentStateSize: number;
    totalSequence: number;
  };
}

function formatHex(data: Uint8Array, maxBytes = 32): string {
  const bytes = Array.from(data.slice(0, maxBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  return data.length > maxBytes ? `${bytes}...` : bytes;
}

function parseSnapshot(filePath: string): SnapshotDumpResult {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const buffer = new Uint8Array(fs.readFileSync(absolutePath));
  const snapshot = parseSnapshotFile(buffer);

  const headerSize = SNAPSHOT_HEADER_SIZE;
  const vectorClockSize = buffer.length - headerSize - snapshot.documentState.length;
  const totalSequence = snapshot.vectorClock.reduce((sum, entry) => sum + entry.sequence, 0);

  return {
    file: path.basename(absolutePath),
    fileSize: buffer.length,
    header: {
      valid: true,
      version: snapshot.version,
      complete: snapshot.complete,
    },
    vectorClock: snapshot.vectorClock.map((entry) => ({
      instanceId: entry.instanceId,
      sequence: entry.sequence,
      offset: entry.offset,
      filename: entry.filename,
    })),
    documentState: {
      size: snapshot.documentState.length,
      hex: formatHex(snapshot.documentState),
    },
    summary: {
      headerSize,
      vectorClockSize,
      documentStateSize: snapshot.documentState.length,
      totalSequence,
    },
  };
}

function dumpSnapshotFile(filePath: string, jsonOutput: boolean): void {
  try {
    const result = parseSnapshot(filePath);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Human-readable output
    console.log(`\n=== Snapshot Dump: ${result.file} ===`);
    console.log(`File size: ${result.fileSize} bytes\n`);

    console.log('--- Header ---');
    console.log(`Magic: NCSS (valid)`);
    console.log(`Version: ${result.header.version}`);
    console.log(`Status: ${result.header.complete ? 'COMPLETE (0x01)' : 'INCOMPLETE (0x00)'}`);
    if (!result.header.complete) {
      console.log('  ⚠️  Warning: Snapshot is incomplete (interrupted write)');
    }
    console.log('');

    console.log('--- Vector Clock ---');
    console.log(`Entry count: ${result.vectorClock.length}`);
    if (result.vectorClock.length === 0) {
      console.log('  (empty - no sync state recorded)');
    } else {
      for (const entry of result.vectorClock) {
        console.log(`\n  Instance: ${entry.instanceId}`);
        console.log(`    Sequence: ${entry.sequence}`);
        console.log(`    Offset:   ${entry.offset} bytes`);
        console.log(`    File:     ${entry.filename}`);
      }
    }
    console.log('');

    console.log('--- Document State ---');
    console.log(`Size: ${result.documentState.size} bytes`);
    if (result.documentState.size > 0) {
      console.log(`Hex preview: ${result.documentState.hex}`);
    } else {
      console.log('  (empty document)');
    }
    console.log('');

    console.log('--- Summary ---');
    console.log(`Header size: ${result.summary.headerSize} bytes`);
    console.log(`Vector clock size: ${result.summary.vectorClockSize} bytes`);
    console.log(`Document state size: ${result.summary.documentStateSize} bytes`);
    console.log(`Total: ${result.fileSize} bytes`);
    console.log(`Vector clock sum (total sequences): ${result.summary.totalSequence}`);
  } catch (err) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error('Error parsing snapshot:');
      console.error(err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json');
const fileArgs = args.filter((arg) => arg !== '--json');

if (fileArgs.length === 0) {
  console.log('Usage: npx ts-node tools/dump-snapshot.ts [--json] <file.snapshot>');
  console.log('\nDumps the contents of a .snapshot file in human-readable format.');
  console.log('\nOptions:');
  console.log('  --json  Output in machine-readable JSON format');
  process.exit(0);
}

dumpSnapshotFile(fileArgs[0], jsonFlag);
