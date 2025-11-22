#!/usr/bin/env node

/**
 * Local CI script - runs all checks that would run in CI
 * Run this before merging to main to ensure everything passes
 *
 * Usage:
 *   pnpm ci-local        # Full CI with coverage (for pre-commit)
 *   pnpm ci-local --fast # Skip coverage (for rapid iteration)
 */

import { execSync } from 'child_process';
import { exit } from 'process';

const fastMode = process.argv.includes('--fast');

const checks = [
  {
    name: 'Cleanup',
    cmd: 'find . -name "*.log" -type f -delete && rm -rf packages/*/coverage packages/*/.nyc_output',
  },
  { name: 'Format Check', cmd: 'pnpm format:check' },
  { name: 'Lint', cmd: 'pnpm lint' },
  { name: 'Type Check', cmd: 'pnpm typecheck' },
  { name: 'Build', cmd: 'pnpm build' },
  {
    name: 'Rebuild for Node.js',
    cmd: 'cd packages/desktop && pnpm rebuild better-sqlite3',
  },
  { name: 'Unit Tests', cmd: 'pnpm test' },
  ...(fastMode ? [] : [{ name: 'Coverage', cmd: 'pnpm test:coverage' }]),
  {
    name: 'Rebuild for Electron',
    cmd: 'cd packages/desktop && npx @electron/rebuild -f -w better-sqlite3',
  },
  { name: 'E2E Tests', cmd: 'pnpm test:e2e' },
];

console.log(
  fastMode
    ? '⚡ Running local CI checks (FAST MODE - skipping coverage)...\n'
    : '🚀 Running local CI checks (FULL MODE - with coverage)...\n'
);

let failed = false;

for (const check of checks) {
  console.log(`\n📋 ${check.name}...`);
  console.log(`   $ ${check.cmd}\n`);

  try {
    execSync(check.cmd, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${check.name} passed\n`);
  } catch (error) {
    console.error(`❌ ${check.name} failed\n`);
    failed = true;
    break; // Stop on first failure
  }
}

if (failed) {
  console.error('\n❌ Local CI failed. Please fix the errors before committing.\n');
  exit(1);
} else {
  console.log('\n✅ All local CI checks passed! Safe to merge to main.\n');
  exit(0);
}
