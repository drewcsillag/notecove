#!/usr/bin/env node

/**
 * Database Doctor - Diagnose and repair database issues
 *
 * This tool checks for common database problems like orphaned notes/folders
 * and optionally fixes them.
 *
 * Usage:
 *   node tools/db-doctor.js <path-to-notecove.db>        # Check only
 *   node tools/db-doctor.js <path-to-notecove.db> --fix  # Check and fix
 *
 * Examples:
 *   node tools/db-doctor.js ~/Library/Application\ Support/@notecove/desktop/notecove.db
 *   node tools/db-doctor.js /tmp/nc-instance-X/notecove.db --fix
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { exit } from 'process';

const dbPath = process.argv[2];
const fix = process.argv.includes('--fix');

if (!dbPath) {
  console.error('Usage: node tools/db-doctor.js <path-to-notecove.db> [--fix]');
  exit(1);
}

if (!existsSync(dbPath)) {
  console.error(`Error: Database not found at ${dbPath}`);
  exit(1);
}

function sqliteQuery(query) {
  try {
    const result = execSync(`sqlite3 -json "${dbPath}" "${query}"`, { encoding: 'utf-8' });
    return result.trim() ? JSON.parse(result) : [];
  } catch (error) {
    console.error('Query error:', error.message);
    return [];
  }
}

function sqliteExec(command) {
  try {
    execSync(`sqlite3 "${dbPath}" "${command}"`, { encoding: 'utf-8' });
    return true;
  } catch (error) {
    console.error('Exec error:', error.message);
    return false;
  }
}

console.log('🔍 Database Doctor\n');
console.log(`Database: ${dbPath}`);
console.log(`Mode: ${fix ? 'CHECK AND FIX' : 'CHECK ONLY'}\n`);

let hasIssues = false;

// Check for orphaned notes
console.log('📝 Checking for orphaned notes...');
const orphanedNotes = sqliteQuery(`
  SELECT n.id, n.title, n.sd_id, n.created
  FROM notes n
  LEFT JOIN storage_dirs sd ON n.sd_id = sd.id
  WHERE sd.id IS NULL
`);

if (orphanedNotes.length > 0) {
  hasIssues = true;
  console.log(`❌ Found ${orphanedNotes.length} orphaned note(s):`);
  orphanedNotes.forEach((note) => {
    console.log(
      `   - ${note.id} "${note.title}" (sd_id: ${note.sd_id}, created: ${new Date(note.created).toISOString()})`
    );
  });

  if (fix) {
    sqliteExec('DELETE FROM notes WHERE sd_id NOT IN (SELECT id FROM storage_dirs)');
    console.log(`✅ Deleted orphaned note(s)\n`);
  } else {
    console.log('   Run with --fix to remove these orphaned notes\n');
  }
} else {
  console.log('✅ No orphaned notes found\n');
}

// Check for orphaned folders
console.log('📁 Checking for orphaned folders...');
const orphanedFolders = sqliteQuery(`
  SELECT f.id, f.name, f.sd_id
  FROM folders f
  LEFT JOIN storage_dirs sd ON f.sd_id = sd.id
  WHERE sd.id IS NULL
`);

if (orphanedFolders.length > 0) {
  hasIssues = true;
  console.log(`❌ Found ${orphanedFolders.length} orphaned folder(s):`);
  orphanedFolders.forEach((folder) => {
    console.log(`   - ${folder.id} "${folder.name}" (sd_id: ${folder.sd_id})`);
  });

  if (fix) {
    sqliteExec('DELETE FROM folders WHERE sd_id NOT IN (SELECT id FROM storage_dirs)');
    console.log(`✅ Deleted orphaned folder(s)\n`);
  } else {
    console.log('   Run with --fix to remove these orphaned folders\n');
  }
} else {
  console.log('✅ No orphaned folders found\n');
}

// Check for orphaned tag associations
console.log('🏷️  Checking for orphaned tag associations...');
const orphanedNoteTags = sqliteQuery(`
  SELECT nt.note_id, nt.tag_id
  FROM note_tags nt
  LEFT JOIN notes n ON nt.note_id = n.id
  WHERE n.id IS NULL
`);

if (orphanedNoteTags.length > 0) {
  hasIssues = true;
  console.log(`❌ Found ${orphanedNoteTags.length} orphaned tag association(s)`);

  if (fix) {
    sqliteExec('DELETE FROM note_tags WHERE note_id NOT IN (SELECT id FROM notes)');
    console.log(`✅ Deleted orphaned tag association(s)\n`);
  } else {
    console.log('   Run with --fix to remove these orphaned associations\n');
  }
} else {
  console.log('✅ No orphaned tag associations found\n');
}

// Check for unused tags (tags with no note associations)
console.log('🔖 Checking for unused tags...');
const unusedTags = sqliteQuery(`
  SELECT t.id, t.name
  FROM tags t
  LEFT JOIN note_tags nt ON t.id = nt.tag_id
  WHERE nt.tag_id IS NULL
`);

if (unusedTags.length > 0) {
  hasIssues = true;
  console.log(`❌ Found ${unusedTags.length} unused tag(s):`);
  unusedTags.forEach((tag) => {
    console.log(`   - ${tag.id} "${tag.name}"`);
  });

  if (fix) {
    sqliteExec('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)');
    console.log(`✅ Deleted unused tag(s)\n`);
  } else {
    console.log('   Run with --fix to remove these unused tags\n');
  }
} else {
  console.log('✅ No unused tags found\n');
}

// Show summary
console.log('='.repeat(60));
if (hasIssues) {
  if (fix) {
    console.log('✅ Database repaired successfully');
  } else {
    console.log('⚠️  Issues found. Run with --fix to repair.');
  }
} else {
  console.log('✅ Database is healthy - no issues found');
}

exit(hasIssues && !fix ? 1 : 0);
