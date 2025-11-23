#!/usr/bin/env npx ts-node
/**
 * dump-activity - Debug tool to inspect activity log files
 *
 * Usage: npx ts-node tools/dump-activity.ts [--json] <activity-dir-or-file>
 *
 * Options:
 *   --json  Output in machine-readable JSON format
 *
 * Outputs:
 * - Entry count per instance
 * - Last 20 entries per file
 * - Summary statistics
 */

import * as fs from 'fs';
import * as path from 'path';

interface ActivityEntry {
  noteId: string;
  instanceId: string;
  sequenceNumber: number;
  raw: string;
}

interface ActivityLogDump {
  instanceId: string;
  file: string;
  entryCount: number;
  entries: ActivityEntry[];
}

interface ActivityDumpResult {
  path: string;
  isDirectory: boolean;
  logs: ActivityLogDump[];
  summary: {
    totalFiles: number;
    totalEntries: number;
    instanceIds: string[];
  };
}

function parseActivityEntry(line: string): ActivityEntry | null {
  // Format: noteId|instanceId_sequenceNumber
  const parts = line.split('|');
  if (parts.length !== 2) return null;

  const noteId = parts[0];
  const refParts = parts[1].split('_');
  if (refParts.length < 2) return null;

  // Instance ID might have underscores, sequence is always last
  const sequenceNumber = parseInt(refParts[refParts.length - 1], 10);
  const instanceId = refParts.slice(0, -1).join('_');

  if (isNaN(sequenceNumber)) return null;

  return {
    noteId,
    instanceId,
    sequenceNumber,
    raw: line,
  };
}

function parseActivityFile(filePath: string, maxEntries = 20): ActivityLogDump {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.length > 0);

  const entries: ActivityEntry[] = [];
  for (const line of lines) {
    const entry = parseActivityEntry(line);
    if (entry) {
      entries.push(entry);
    }
  }

  // Get instance ID from filename (e.g., "instance-123.log" -> "instance-123")
  const basename = path.basename(filePath);
  const instanceId = basename.endsWith('.log') ? basename.slice(0, -4) : basename;

  // Return last N entries
  const lastEntries = entries.slice(-maxEntries);

  return {
    instanceId,
    file: basename,
    entryCount: entries.length,
    entries: lastEntries,
  };
}

function parseActivityPath(inputPath: string): ActivityDumpResult {
  const absolutePath = path.resolve(inputPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Path not found: ${absolutePath}`);
  }

  const stat = fs.statSync(absolutePath);
  const isDirectory = stat.isDirectory();

  const logs: ActivityLogDump[] = [];

  if (isDirectory) {
    // Read all .log files in directory
    const files = fs.readdirSync(absolutePath);
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(absolutePath, file);
        logs.push(parseActivityFile(filePath));
      }
    }
  } else {
    // Single file
    logs.push(parseActivityFile(absolutePath));
  }

  const instanceIds = logs.map((l) => l.instanceId);
  const totalEntries = logs.reduce((sum, l) => sum + l.entryCount, 0);

  return {
    path: absolutePath,
    isDirectory,
    logs,
    summary: {
      totalFiles: logs.length,
      totalEntries,
      instanceIds,
    },
  };
}

function dumpActivity(inputPath: string, jsonOutput: boolean): void {
  try {
    const result = parseActivityPath(inputPath);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Human-readable output
    console.log(`\n=== Activity Log Dump: ${path.basename(result.path)} ===`);
    console.log(`Path: ${result.path}`);
    console.log(`Type: ${result.isDirectory ? 'Directory' : 'File'}\n`);

    if (result.logs.length === 0) {
      console.log('No activity log files found.\n');
      return;
    }

    for (const log of result.logs) {
      console.log(`--- ${log.file} (${log.instanceId}) ---`);
      console.log(`Total entries: ${log.entryCount}`);

      if (log.entries.length === 0) {
        console.log('  (empty)\n');
        continue;
      }

      console.log(`Showing last ${log.entries.length} entries:\n`);

      for (const entry of log.entries) {
        console.log(`  [${entry.sequenceNumber}] ${entry.noteId}`);
      }
      console.log('');
    }

    console.log('--- Summary ---');
    console.log(`Total files: ${result.summary.totalFiles}`);
    console.log(`Total entries: ${result.summary.totalEntries}`);
    console.log(`Instances: ${result.summary.instanceIds.join(', ')}`);
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
  console.log('Usage: npx ts-node tools/dump-activity.ts [--json] <activity-dir-or-file>');
  console.log('\nDumps the contents of activity log files in human-readable format.');
  console.log('\nOptions:');
  console.log('  --json  Output in machine-readable JSON format');
  console.log('\nExamples:');
  console.log('  npx ts-node tools/dump-activity.ts /path/to/sd/activity');
  console.log('  npx ts-node tools/dump-activity.ts /path/to/sd/activity/instance-1.log');
  process.exit(0);
}

dumpActivity(fileArgs[0], jsonFlag);
