#!/usr/bin/env node
/**
 * Set a Storage Directory (SD) as active in the NoteCove database
 * Usage: ./tools/sd-activate.js <sd-id>
 * Example: ./tools/sd-activate.js "work-sd-001"
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: ./tools/sd-activate.js <sd-id>');
  console.error('\nTo see available SDs, run: ./tools/sd-list.js');
  process.exit(1);
}

const sdId = args[0];

// Determine database path
const dbPath =
  process.env.NC_DB_PATH ||
  path.join(
    os.homedir(),
    process.platform === 'darwin'
      ? 'Library/Application Support/Electron/notecove.db'
      : process.platform === 'win32'
        ? 'AppData/Roaming/Electron/notecove.db'
        : '.config/Electron/notecove.db'
  );

console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);

  // Check if SD exists
  const sd = db.prepare('SELECT * FROM storage_dirs WHERE id = ?').get(sdId);
  if (!sd) {
    console.error(`\nError: Storage Directory with ID "${sdId}" not found.`);
    console.error('\nAvailable SDs:');
    const allSds = db.prepare('SELECT id, name FROM storage_dirs').all();
    for (const s of allSds) {
      console.error(`  - ${s.id} (${s.name})`);
    }
    db.close();
    process.exit(1);
  }

  // Deactivate all SDs
  db.prepare('UPDATE storage_dirs SET is_active = 0').run();

  // Activate the specified SD
  db.prepare('UPDATE storage_dirs SET is_active = 1 WHERE id = ?').run(sdId);

  console.log('\n✓ Storage Directory activated successfully!');
  console.log('─'.repeat(80));
  console.log(`ID:   ${sd.id}`);
  console.log(`Name: ${sd.name}`);
  console.log(`Path: ${sd.path}`);
  console.log('─'.repeat(80));
  console.log('\nRestart the app for changes to take effect.');

  db.close();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
