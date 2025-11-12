/**
 * Manual test script for note history state reconstruction
 *
 * Run with: NODE_ENV=test tsx src/__manual__/test-reconstruction.ts <note-path> [session-index]
 *
 * Example: NODE_ENV=test tsx src/__manual__/test-reconstruction.ts "/Users/drew/My Drive/.../notes/abc123..." 5
 *
 * This script:
 * 1. Loads a note's timeline
 * 2. Reconstructs document state at start and end of a session
 * 3. Shows text content and changes made during that session
 * 4. Tests keyframe generation for scrubbing UI
 */

import { dirname, basename } from 'path';
import { NodeFileSystemAdapter } from '../main/storage/node-fs-adapter';
import { UpdateManager } from '@notecove/shared/storage/update-manager';
import { TimelineBuilder, StateReconstructor } from '@notecove/shared/history';
import { compress, decompress } from '../main/utils/compression';

async function main() {
  console.log('=== Note History State Reconstruction Test ===\n');

  // Get note path from command line
  const notePath = process.argv[2];
  const sessionIndex = parseInt(process.argv[3] ?? '0', 10);

  if (!notePath) {
    console.error('Usage: tsx src/__manual__/test-reconstruction.ts <note-path> [session-index]');
    console.error(
      'Example: tsx src/__manual__/test-reconstruction.ts "/Users/drew/My Drive/.../notes/abc123..." 5'
    );
    process.exit(1);
  }

  // Extract note ID from path
  const noteId = basename(notePath);
  const notesDir = dirname(notePath);
  const sdPath = dirname(notesDir);

  console.log(`Note path: ${notePath}`);
  console.log(`Note ID: ${noteId}`);
  console.log(`SD path: ${sdPath}`);
  console.log(`Target session: #${sessionIndex + 1}\n`);

  // Initialize UpdateManager with compression support
  const fs = new NodeFileSystemAdapter();
  const instanceId = 'manual-test-instance';
  const updateManager = new UpdateManager(fs, instanceId, compress, decompress);
  updateManager.registerSD('test-sd', sdPath);

  // Initialize TimelineBuilder and StateReconstructor
  const timelineBuilder = new TimelineBuilder(updateManager);
  const stateReconstructor = new StateReconstructor(updateManager);

  // Build timeline
  console.log('Building timeline...');
  const timeline = await timelineBuilder.buildTimeline('test-sd', noteId);
  console.log(`Found ${timeline.length} sessions\n`);

  if (sessionIndex >= timeline.length) {
    console.error(`Error: Session index ${sessionIndex} out of range (0-${timeline.length - 1})`);
    process.exit(1);
  }

  const session = timeline[sessionIndex];
  if (!session) {
    console.error(`Session ${sessionIndex} not found`);
    process.exit(1);
  }
  console.log(`📅 Session #${sessionIndex + 1}:`);
  console.log(`  ID: ${session.id}`);
  console.log(
    `  Time: ${new Date(session.startTime).toLocaleString()} → ${new Date(session.endTime).toLocaleString()}`
  );
  console.log(
    `  Duration: ${((session.endTime - session.startTime) / 1000 / 60).toFixed(1)} minutes`
  );
  console.log(`  Updates: ${session.updateCount}`);
  console.log(
    `  Devices: ${session.instanceIds.map((id) => id.substring(0, 20) + '...').join(', ')}\n`
  );

  // Collect all updates for reconstruction
  console.log('Collecting all updates for reconstruction...');
  const allUpdates = timeline.flatMap((s) => s.updates);
  console.log(`Total updates in timeline: ${allUpdates.length}\n`);

  // Get session preview (first and last state)
  console.log('🔄 Reconstructing session preview...');
  const { firstPreview, lastPreview } = await stateReconstructor.getSessionPreview(
    'test-sd',
    noteId,
    session,
    allUpdates
  );

  console.log('📄 Session start (first 200 chars):');
  console.log(`  "${firstPreview.substring(0, 200)}..."\n`);

  console.log('📄 Session end (first 200 chars):');
  console.log(`  "${lastPreview.substring(0, 200)}..."\n`);

  // Generate keyframes for scrubbing
  console.log('🎞️ Generating keyframes for scrubbing UI...');
  const keyframeCount = Math.min(5, session.updates.length); // Max 5 keyframes for test
  const keyframes = await stateReconstructor.generateKeyframes(
    'test-sd',
    noteId,
    session,
    allUpdates,
    keyframeCount
  );

  console.log(`Generated ${keyframes.length} keyframes:\n`);

  keyframes.forEach((keyframe, idx) => {
    const time = new Date(keyframe.timestamp).toLocaleString();
    const preview = keyframe.text.substring(0, 100);

    console.log(`Keyframe ${idx + 1}:`);
    console.log(`  Update index: ${keyframe.updateIndex}`);
    console.log(`  Time: ${time}`);
    console.log(`  Preview: "${preview}..."`);
    console.log('');
  });

  console.log('✅ State reconstruction test complete!\n');
  console.log('Next steps:');
  console.log('  - Add IPC handlers to expose history API to renderer');
  console.log('  - Build UI components (HistoryPanel, SessionDetailView)');
  console.log('  - Implement scrubbing with keyframe interpolation\n');
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
