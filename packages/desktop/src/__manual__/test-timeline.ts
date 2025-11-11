/**
 * Manual test script for note history timeline building
 *
 * Run with: NODE_ENV=test tsx src/__manual__/test-timeline.ts <note-path>
 *
 * Example: NODE_ENV=test tsx src/__manual__/test-timeline.ts "/Users/drew/My Drive/test sharing to work account/notes/abc123..."
 *
 * This script:
 * 1. Loads a real note from disk
 * 2. Builds timeline showing all editing sessions
 * 3. Displays statistics about the note's history
 */

import { dirname, basename } from 'path';
import { NodeFileSystemAdapter } from '../main/storage/node-fs-adapter';
import { UpdateManager } from '@notecove/shared/storage/update-manager';
import { TimelineBuilder } from '@notecove/shared/history';
import { compress, decompress } from '../main/utils/compression';

async function main() {
  console.log('=== Note History Timeline Test ===\n');

  // Get note path from command line
  const notePath = process.argv[2];

  if (!notePath) {
    console.error('Usage: tsx src/__manual__/test-timeline.ts <note-path>');
    console.error('Example: tsx src/__manual__/test-timeline.ts "/Users/drew/My Drive/.../notes/abc123..."');
    process.exit(1);
  }

  // Extract note ID from path
  const noteId = basename(notePath);
  const notesDir = dirname(notePath);
  const sdPath = dirname(notesDir);

  console.log(`Note path: ${notePath}`);
  console.log(`Note ID: ${noteId}`);
  console.log(`SD path: ${sdPath}\n`);

  // Initialize UpdateManager with compression support
  const fs = new NodeFileSystemAdapter();
  const instanceId = 'manual-test-instance';
  const updateManager = new UpdateManager(fs, instanceId, compress, decompress);
  updateManager.registerSD('test-sd', sdPath);

  // Initialize TimelineBuilder
  const timelineBuilder = new TimelineBuilder(updateManager);

  // Get history statistics
  console.log('Analyzing note history...');
  const stats = await timelineBuilder.getHistoryStats('test-sd', noteId);

  console.log('\n📊 History Statistics:');
  console.log(`  Total updates: ${stats.totalUpdates}`);
  console.log(`  Total sessions: ${stats.totalSessions}`);
  console.log(`  First edit: ${stats.firstEdit ? new Date(stats.firstEdit).toLocaleString() : 'N/A'}`);
  console.log(`  Last edit: ${stats.lastEdit ? new Date(stats.lastEdit).toLocaleString() : 'N/A'}`);
  console.log(`  Devices/instances: ${stats.instanceCount}`);
  stats.instances.forEach((id, idx) => {
    console.log(`    ${idx + 1}. ${id.substring(0, 20)}...`);
  });

  // Build full timeline
  console.log('\n🕐 Building timeline...');
  const timeline = await timelineBuilder.buildTimeline('test-sd', noteId);

  console.log(`\n📅 Timeline (${timeline.length} sessions):\n`);

  timeline.forEach((session, idx) => {
    const startTime = new Date(session.startTime).toLocaleString();
    const endTime = new Date(session.endTime).toLocaleString();
    const duration = ((session.endTime - session.startTime) / 1000 / 60).toFixed(1);

    console.log(`Session ${idx + 1}:`);
    console.log(`  ID: ${session.id}`);
    console.log(`  Time: ${startTime} → ${endTime}`);
    console.log(`  Duration: ${duration} minutes`);
    console.log(`  Updates: ${session.updateCount}`);
    console.log(`  Devices: ${session.instanceIds.map(id => id.substring(0, 20) + '...').join(', ')}`);

    // Show sample of updates in this session
    if (session.updates.length > 0) {
      const firstUpdate = session.updates[0];
      const lastUpdate = session.updates[session.updates.length - 1];
      console.log(`  First update: seq ${firstUpdate.sequence} from ${firstUpdate.instanceId.substring(0, 20)}...`);
      console.log(`  Last update: seq ${lastUpdate.sequence} from ${lastUpdate.instanceId.substring(0, 20)}...`);
    }
    console.log('');
  });

  console.log('✅ Timeline test complete!\n');
  console.log('Next steps:');
  console.log('  - Test state reconstruction with test-reconstruction.ts');
  console.log('  - Add IPC handlers to expose this to the renderer');
  console.log('  - Build UI to display this timeline\n');
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
