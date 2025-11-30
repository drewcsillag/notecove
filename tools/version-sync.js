#!/usr/bin/env node

/**
 * Version Sync Script
 *
 * Synchronizes version from root package.json to all other package.json files
 * and updates hardcoded version references in test files.
 *
 * Usage:
 *   pnpm version:sync           # Sync versions from root
 *   pnpm version:sync --check   # Check if versions are in sync (exits 1 if not)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const checkOnly = process.argv.includes('--check');

// Files containing package.json that should be synced
const packageJsonPaths = [
  'packages/desktop/package.json',
  'packages/shared/package.json',
  'website/package.json',
  'tools/package.json',
];

// Files with hardcoded version strings that need updating
// Format: { path, patterns: [{ search: RegExp, replace: (version) => string }] }
const hardcodedVersionFiles = [
  {
    path: 'packages/desktop/src/main/telemetry/__tests__/config.test.ts',
    patterns: [
      {
        search: /getVersion: jest\.fn\(\(\) => '[^']+'\)/g,
        replace: (v) => `getVersion: jest.fn(() => '${v}')`,
      },
    ],
  },
  {
    path: 'packages/desktop/src/main/telemetry/__tests__/logger.test.ts',
    patterns: [
      {
        search: /app_version: '[^']+'/g,
        replace: (v) => `app_version: '${v}'`,
      },
      {
        search: /app_version="[^"]+"/g,
        replace: (v) => `app_version="${v}"`,
      },
    ],
  },
  {
    path: 'packages/desktop/src/main/telemetry/logger.example.ts',
    patterns: [
      {
        search: /app_version: '[^']+'/g,
        replace: (v) => `app_version: '${v}'`,
      },
    ],
  },
];

function readJson(filePath) {
  const fullPath = join(rootDir, filePath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

function writeJson(filePath, data) {
  const fullPath = join(rootDir, filePath);
  writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n');
}

function readFile(filePath) {
  const fullPath = join(rootDir, filePath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return readFileSync(fullPath, 'utf-8');
}

function writeFile(filePath, content) {
  const fullPath = join(rootDir, filePath);
  writeFileSync(fullPath, content);
}

function main() {
  // Read root version
  const rootPkg = readJson('package.json');
  if (!rootPkg) {
    console.error('❌ Could not read root package.json');
    process.exit(1);
  }

  const version = rootPkg.version;
  console.log(`📦 Root version: ${version}`);

  let allInSync = true;
  const updates = [];

  // Check/update package.json files
  console.log('\n📋 Checking package.json files...');
  for (const pkgPath of packageJsonPaths) {
    const pkg = readJson(pkgPath);
    if (!pkg) {
      console.log(`   ⚠️  ${pkgPath} not found, skipping`);
      continue;
    }

    if (pkg.version === version) {
      console.log(`   ✅ ${pkgPath} (${pkg.version})`);
    } else {
      console.log(`   ❌ ${pkgPath} (${pkg.version} → ${version})`);
      allInSync = false;
      if (!checkOnly) {
        pkg.version = version;
        writeJson(pkgPath, pkg);
        updates.push(pkgPath);
      }
    }
  }

  // Check/update hardcoded version files
  console.log('\n📋 Checking hardcoded version references...');
  for (const fileConfig of hardcodedVersionFiles) {
    const content = readFile(fileConfig.path);
    if (!content) {
      console.log(`   ⚠️  ${fileConfig.path} not found, skipping`);
      continue;
    }

    let newContent = content;
    let hasChanges = false;

    for (const pattern of fileConfig.patterns) {
      const replacement = pattern.replace(version);
      const matches = content.match(pattern.search);
      if (matches) {
        // Check if any match doesn't equal the expected replacement
        const needsUpdate = matches.some((m) => m !== replacement);
        if (needsUpdate) {
          hasChanges = true;
          newContent = newContent.replace(pattern.search, replacement);
        }
      }
    }

    if (!hasChanges) {
      console.log(`   ✅ ${fileConfig.path}`);
    } else {
      console.log(`   ❌ ${fileConfig.path} (needs update)`);
      allInSync = false;
      if (!checkOnly) {
        writeFile(fileConfig.path, newContent);
        updates.push(fileConfig.path);
      }
    }
  }

  // Summary
  console.log('');
  if (allInSync) {
    console.log('✅ All versions are in sync!');
    process.exit(0);
  } else if (checkOnly) {
    console.log('❌ Versions are out of sync. Run `pnpm version:sync` to fix.');
    process.exit(1);
  } else {
    console.log(`✅ Updated ${updates.length} file(s):`);
    for (const file of updates) {
      console.log(`   - ${file}`);
    }
    process.exit(0);
  }
}

main();
