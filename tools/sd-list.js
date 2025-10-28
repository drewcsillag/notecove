#!/usr/bin/env node
/**
 * List all Storage Directories (SDs) in the NoteCove database
 * Usage: ./tools/sd-list.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

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
  const db = new Database(dbPath, { readonly: true });

  const sds = db.prepare('SELECT * FROM storage_dirs ORDER BY created ASC').all();

  if (sds.length === 0) {
    console.log('\nNo Storage Directories found.');
  } else {
    console.log('\nStorage Directories:');
    console.log('─'.repeat(80));
    for (const sd of sds) {
      const active = sd.is_active === 1 ? ' [ACTIVE]' : '';
      const created = new Date(sd.created).toLocaleString();
      console.log(`ID:      ${sd.id}${active}`);
      console.log(`Name:    ${sd.name}`);
      console.log(`Path:    ${sd.path}`);
      console.log(`Created: ${created}`);
      console.log('─'.repeat(80));
    }
  }

  db.close();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
