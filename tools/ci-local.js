#!/usr/bin/env node

/**
 * Local CI script - runs all checks that would run in CI
 * Run this before merging to main to ensure everything passes
 */

import { execSync } from 'child_process';
import { exit } from 'process';

const checks = [
  { name: 'Format Check', cmd: 'pnpm format:check' },
  { name: 'Lint', cmd: 'pnpm lint' },
  { name: 'Type Check', cmd: 'pnpm typecheck' },
  { name: 'Build', cmd: 'pnpm build' },
  { name: 'Unit Tests', cmd: 'pnpm test' },
  { name: 'Coverage', cmd: 'pnpm test:coverage' },
  { name: 'E2E Tests', cmd: 'pnpm test:e2e' },
];

console.log('🚀 Running local CI checks...\n');

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
