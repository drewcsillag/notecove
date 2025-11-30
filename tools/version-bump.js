#!/usr/bin/env node

/**
 * Version Bump Script
 *
 * Bumps the version in root package.json and syncs to all other files.
 *
 * Usage:
 *   pnpm version:bump patch   # 0.1.0 → 0.1.1
 *   pnpm version:bump minor   # 0.1.0 → 0.2.0
 *   pnpm version:bump major   # 0.1.0 → 1.0.0
 *   pnpm version:bump 1.2.3   # Set specific version
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(readFileSync(join(rootDir, filePath), 'utf-8'));
}

function writeJson(filePath, data) {
  writeFileSync(join(rootDir, filePath), JSON.stringify(data, null, 2) + '\n');
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(current, type) {
  const parsed = parseVersion(current);

  switch (type) {
    case 'major':
      return formatVersion({ major: parsed.major + 1, minor: 0, patch: 0 });
    case 'minor':
      return formatVersion({ major: parsed.major, minor: parsed.minor + 1, patch: 0 });
    case 'patch':
      return formatVersion({ major: parsed.major, minor: parsed.minor, patch: parsed.patch + 1 });
    default:
      // Assume it's a specific version
      parseVersion(type); // Validate format
      return type;
  }
}

function main() {
  const bumpType = process.argv[2];

  if (!bumpType) {
    console.error('Usage: pnpm version:bump <major|minor|patch|x.y.z>');
    console.error('');
    console.error('Examples:');
    console.error('  pnpm version:bump patch   # 0.1.0 → 0.1.1');
    console.error('  pnpm version:bump minor   # 0.1.0 → 0.2.0');
    console.error('  pnpm version:bump major   # 0.1.0 → 1.0.0');
    console.error('  pnpm version:bump 1.2.3   # Set specific version');
    process.exit(1);
  }

  // Read current version
  const rootPkg = readJson('package.json');
  const currentVersion = rootPkg.version;

  // Calculate new version
  let newVersion;
  try {
    newVersion = bumpVersion(currentVersion, bumpType);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  console.log(`📦 Bumping version: ${currentVersion} → ${newVersion}`);

  // Update root package.json
  rootPkg.version = newVersion;
  writeJson('package.json', rootPkg);
  console.log('   ✅ Updated root package.json');

  // Run version sync to update all other files
  console.log('\n🔄 Syncing to all files...');
  try {
    execSync('node tools/version-sync.js', {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch {
    console.error('❌ Version sync failed');
    process.exit(1);
  }

  console.log(`\n✅ Version bumped to ${newVersion}`);
}

main();
