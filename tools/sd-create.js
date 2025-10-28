#!/usr/bin/env node
/**
 * Create a new Storage Directory (SD) in the NoteCove database
 * Usage: ./tools/sd-create.js <name> <path>
 * Example: ./tools/sd-create.js "Work" "/Users/drew/Dropbox/NoteCove-Work"
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: ./tools/sd-create.js <name> <path>');
  console.error('Example: ./tools/sd-create.js "Work" "/Users/drew/Dropbox/NoteCove-Work"');
  process.exit(1);
}

const [name, sdPath] = args;

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

  // Check if this is the first SD
  const existing = db.prepare('SELECT COUNT(*) as count FROM storage_dirs').get();
  const isFirst = existing.count === 0;

  // Generate ID
  const id = crypto.randomUUID();

  // Insert SD
  db.prepare(
    `
    INSERT INTO storage_dirs (id, name, path, created, is_active)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(id, name, sdPath, Date.now(), isFirst ? 1 : 0);

  console.log('\n✓ Storage Directory created successfully!');
  console.log('─'.repeat(80));
  console.log(`ID:     ${id}`);
  console.log(`Name:   ${name}`);
  console.log(`Path:   ${sdPath}`);
  console.log(`Active: ${isFirst ? 'Yes (first SD)' : 'No'}`);
  console.log('─'.repeat(80));

  if (!isFirst) {
    console.log('\nTo set this SD as active, run:');
    console.log(`  ./tools/sd-activate.js ${id}`);
  }

  db.close();
} catch (error) {
  console.error('Error:', error.message);
  if (error.message.includes('UNIQUE constraint')) {
    console.error('\nThis name or path already exists. Use different values.');
  }
  process.exit(1);
}
