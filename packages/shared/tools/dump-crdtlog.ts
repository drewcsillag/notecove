#!/usr/bin/env npx ts-node
/**
 * dump-crdtlog - Debug tool to inspect .crdtlog files
 *
 * Usage: npx ts-node tools/dump-crdtlog.ts [--json] <file.crdtlog>
 *
 * Options:
 *   --json  Output in machine-readable JSON format
 *
 * Outputs:
 * - File header (magic, version)
 * - Each record (timestamp, sequence, data size, data hex preview)
 * - Summary statistics
 */

import * as fs from 'fs';
import * as path from 'path';
import { readLogHeader, readLogRecord, LOG_HEADER_SIZE } from '../src/storage/binary-format';

interface LogDumpResult {
  file: string;
  fileSize: number;
  header: {
    valid: boolean;
    version: number;
    error?: string;
  };
  records: Array<{
    index: number;
    offset: number;
    timestamp: number;
    timestampIso: string;
    sequence: number;
    dataSize: number;
    dataHex: string;
  }>;
  terminated: boolean;
  summary: {
    recordCount: number;
    totalDataSize: number;
    firstTimestamp: number | null;
    lastTimestamp: number | null;
    durationMs: number | null;
    remainingBytes: number;
  };
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString();
}

function formatHex(data: Uint8Array, maxBytes = 32): string {
  const bytes = Array.from(data.slice(0, maxBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  return data.length > maxBytes ? `${bytes}...` : bytes;
}

function parseLogFile(filePath: string): LogDumpResult {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const buffer = new Uint8Array(fs.readFileSync(absolutePath));
  const header = readLogHeader(buffer);

  const result: LogDumpResult = {
    file: path.basename(absolutePath),
    fileSize: buffer.length,
    header: {
      valid: header.valid,
      version: header.version,
      error: header.error,
    },
    records: [],
    terminated: false,
    summary: {
      recordCount: 0,
      totalDataSize: 0,
      firstTimestamp: null,
      lastTimestamp: null,
      durationMs: null,
      remainingBytes: 0,
    },
  };

  if (!header.valid) {
    return result;
  }

  let offset = LOG_HEADER_SIZE;

  while (offset < buffer.length) {
    try {
      const record = readLogRecord(buffer, offset);

      if (record.terminated) {
        result.terminated = true;
        offset += record.bytesRead;
        break;
      }

      result.records.push({
        index: result.records.length + 1,
        offset,
        timestamp: record.timestamp,
        timestampIso: formatTimestamp(record.timestamp),
        sequence: record.sequence,
        dataSize: record.data.length,
        dataHex: formatHex(record.data),
      });

      result.summary.totalDataSize += record.data.length;
      if (result.summary.firstTimestamp === null) {
        result.summary.firstTimestamp = record.timestamp;
      }
      result.summary.lastTimestamp = record.timestamp;

      offset += record.bytesRead;
    } catch {
      break;
    }
  }

  result.summary.recordCount = result.records.length;
  result.summary.remainingBytes = buffer.length - offset;

  if (result.summary.firstTimestamp !== null && result.summary.lastTimestamp !== null) {
    result.summary.durationMs = result.summary.lastTimestamp - result.summary.firstTimestamp;
  }

  return result;
}

function dumpLogFile(filePath: string, jsonOutput: boolean): void {
  try {
    const result = parseLogFile(filePath);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Human-readable output
    console.log(`\n=== CRDT Log Dump: ${result.file} ===`);
    console.log(`File size: ${result.fileSize} bytes\n`);

    console.log('--- Header ---');
    if (!result.header.valid) {
      console.error(`Invalid header: ${result.header.error}`);
      process.exit(1);
    }
    console.log(`Magic: NCLG (valid)`);
    console.log(`Version: ${result.header.version}`);
    console.log('');

    console.log('--- Records ---');
    for (const record of result.records) {
      console.log(`[${record.index}] Record at offset ${record.offset}:`);
      console.log(`  Timestamp: ${record.timestampIso} (${record.timestamp})`);
      console.log(`  Sequence:  ${record.sequence}`);
      console.log(`  Data size: ${record.dataSize} bytes`);
      console.log(`  Data hex:  ${record.dataHex}`);
      console.log('');
    }

    if (result.terminated) {
      console.log(`[${result.summary.recordCount}] TERMINATION SENTINEL\n`);
    }

    console.log('--- Summary ---');
    console.log(`Total records: ${result.summary.recordCount}`);
    console.log(`Total data size: ${result.summary.totalDataSize} bytes`);
    if (result.summary.firstTimestamp !== null && result.summary.lastTimestamp !== null) {
      console.log(
        `Time range: ${formatTimestamp(result.summary.firstTimestamp)} to ${formatTimestamp(result.summary.lastTimestamp)}`
      );
      console.log(`Duration: ${((result.summary.durationMs ?? 0) / 1000).toFixed(2)}s`);
    }
    console.log(`Remaining bytes: ${result.summary.remainingBytes}`);
    if (result.summary.remainingBytes > 0) {
      console.log(`  (Warning: ${result.summary.remainingBytes} bytes after last record)`);
    }
  } catch (err) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json');
const fileArgs = args.filter((arg) => arg !== '--json');

if (fileArgs.length === 0) {
  console.log('Usage: npx ts-node tools/dump-crdtlog.ts [--json] <file.crdtlog>');
  console.log('\nDumps the contents of a .crdtlog file in human-readable format.');
  console.log('\nOptions:');
  console.log('  --json  Output in machine-readable JSON format');
  process.exit(0);
}

dumpLogFile(fileArgs[0], jsonFlag);
