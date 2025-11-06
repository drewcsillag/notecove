/**
 * Migration Tool: Add Flag Byte to Existing .yjson Files
 *
 * This tool prepends the 0x01 flag byte to all existing .yjson update files
 * in a Storage Directory (SD). This is required after upgrading to the flag
 * byte protocol which prevents partial file read race conditions.
 *
 * This migration also sets the SD version to 1.
 *
 * Usage:
 *   node migrate-flag-byte.js <sd-path> [--dry-run]
 *
 * Example:
 *   node migrate-flag-byte.js ~/Documents/NoteCove/my-sd --dry-run
 *   node migrate-flag-byte.js ~/Documents/NoteCove/my-sd
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  checkSDVersion,
  createMigrationLock,
  removeMigrationLock,
  writeSDVersion,
} from './sd-version.js';

interface MigrationStats {
  totalFiles: number;
  migratedFiles: number;
  errorFiles: number;
  errors: { file: string; error: string }[];
}

/**
 * Recursively find all .yjson files in a directory
 */
async function findYjsonFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories
          if (!entry.name.startsWith('.')) {
            await scan(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.yjson')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning ${currentPath}:`, error);
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Migrate a single file by prepending 0x01 flag byte
 */
async function migrateFile(filePath: string, dryRun: boolean): Promise<boolean> {
  try {
    // Read existing file
    const existingData = await fs.readFile(filePath);

    if (dryRun) {
      console.log(`  ✅ Would migrate ${path.basename(filePath)} (${existingData.length} bytes)`);
      return true;
    }

    // Prepend 0x01 flag byte
    const migratedData = new Uint8Array(1 + existingData.length);
    migratedData[0] = 0x01; // Ready flag
    migratedData.set(existingData, 1);

    // Write to temp file first
    const tempPath = `${filePath}.migration.tmp`;
    await fs.writeFile(tempPath, migratedData);

    // Atomic rename
    await fs.rename(tempPath, filePath);

    console.log(
      `  ✅ Migrated ${path.basename(filePath)} (${existingData.length} → ${migratedData.length} bytes)`
    );
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to migrate ${path.basename(filePath)}:`, error);
    throw error;
  }
}

/**
 * Migrate all .yjson files in an SD
 */
async function migrateSD(sdPath: string, dryRun: boolean): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalFiles: 0,
    migratedFiles: 0,
    errorFiles: 0,
    errors: [],
  };

  console.log(`\n🔍 Scanning for .yjson files in: ${sdPath}`);
  console.log(dryRun ? '   (DRY RUN - no files will be modified)\n' : '');

  // Find all .yjson files
  const files = await findYjsonFiles(sdPath);
  stats.totalFiles = files.length;

  console.log(`Found ${files.length} .yjson files\n`);

  if (files.length === 0) {
    console.log('No .yjson files found. Nothing to migrate.');
    return stats;
  }

  // Migrate each file
  for (const filePath of files) {
    try {
      await migrateFile(filePath, dryRun);
      stats.migratedFiles++;
    } catch (error) {
      stats.errorFiles++;
      stats.errors.push({
        file: filePath,
        error: (error as Error).message,
      });
    }
  }

  return stats;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Migration Tool: Add Flag Byte to Existing .yjson Files

Usage:
  node migrate-flag-byte.js <sd-path> [--dry-run]

Arguments:
  sd-path     Path to Storage Directory (SD) root
  --dry-run   Preview changes without modifying files

Examples:
  node migrate-flag-byte.js ~/Documents/NoteCove/my-sd --dry-run
  node migrate-flag-byte.js ~/Documents/NoteCove/my-sd

What This Tool Does:
  - Checks SD_VERSION to determine if migration is needed
  - If SD version is 0 (or missing), scans all .yjson files
  - Prepends a 0x01 flag byte to each file
  - Uses atomic rename for safety
  - Writes SD_VERSION file (version 1) on completion

Why This Is Needed:
  After upgrading to the flag byte protocol, all existing .yjson files
  need to be migrated. The flag byte prevents race conditions where
  files are read before they're fully synced across instances.
`);
    process.exit(0);
  }

  const sdPath = args[0];
  const dryRun = args.includes('--dry-run');

  if (!sdPath) {
    console.error('Error: SD path is required');
    process.exit(1);
  }

  // Verify SD path exists
  try {
    const stat = await fs.stat(sdPath);
    if (!stat.isDirectory()) {
      console.error(`Error: ${sdPath} is not a directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: Cannot access ${sdPath}:`, error);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('  FLAG BYTE MIGRATION TOOL');
  console.log('='.repeat(70));

  // Check SD version - if already migrated, exit early
  const versionCheck = await checkSDVersion(sdPath);
  if (versionCheck.compatible) {
    console.log(`\n✅ SD is already at version ${versionCheck.version} - no migration needed`);
    console.log('='.repeat(70) + '\n');
    process.exit(0);
  }

  if (versionCheck.reason === 'too-new') {
    console.error(
      `\n❌ Error: SD version ${versionCheck.sdVersion} is newer than supported version ${versionCheck.appVersion}`
    );
    console.error('   Please upgrade the migration tool');
    console.log('='.repeat(70) + '\n');
    process.exit(1);
  }

  if (versionCheck.reason === 'locked') {
    console.error('\n❌ Error: Migration is already in progress (lock file exists)');
    console.log('='.repeat(70) + '\n');
    process.exit(1);
  }

  // At this point, reason is 'too-old' or version is 0 (legacy SD)
  console.log(`\n📋 SD version: ${versionCheck.sdVersion ?? 0} → 1`);

  // Create migration lock (unless dry run)
  if (!dryRun) {
    console.log('🔒 Creating migration lock...');
    await createMigrationLock(sdPath);
  }

  try {
    const startTime = Date.now();
    const stats = await migrateSD(sdPath, dryRun);
    const duration = Date.now() - startTime;

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('  MIGRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total files found:     ${stats.totalFiles}`);
    console.log(`Files migrated:        ${stats.migratedFiles}`);
    console.log(`Files with errors:     ${stats.errorFiles}`);
    console.log(`Duration:              ${duration}ms`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      for (const { file, error } of stats.errors) {
        console.log(`  ${file}: ${error}`);
      }
    }

    // Write SD version file (unless dry run or errors)
    if (!dryRun && stats.errorFiles === 0) {
      console.log('\n📝 Writing SD version file (version 1)...');
      await writeSDVersion(sdPath, 1);
    }

    if (dryRun) {
      console.log('\n⚠️  DRY RUN COMPLETE - No files were modified');
      console.log('   Run without --dry-run to perform actual migration');
    } else {
      console.log('\n✅ MIGRATION COMPLETE');
      console.log('   SD upgraded to version 1');
    }

    console.log('='.repeat(70) + '\n');

    // Exit with error code if there were errors
    if (stats.errorFiles > 0) {
      process.exit(1);
    }
  } finally {
    // Always remove lock (unless dry run)
    if (!dryRun) {
      await removeMigrationLock(sdPath);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { migrateSD };
export type { MigrationStats };
