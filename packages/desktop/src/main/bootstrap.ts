/**
 * Bootstrap Entry Point
 *
 * This file MUST be the entry point for the Electron main process.
 * It fixes a critical issue where macOS Finder launches apps with a
 * non-existent current working directory, causing process.cwd() to throw
 * ENOENT errors when modules like `depd` call it during initialization.
 *
 * CRITICAL: Only use Node.js built-in modules here that don't call process.cwd()
 * during their initialization. os, path, and fs are safe.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// These are safe built-ins that don't call process.cwd() during load
const os = require('os') as typeof import('os');

// Fix the working directory IMMEDIATELY before any other modules load
try {
  process.cwd();
} catch {
  // Current directory doesn't exist (e.g., launched from Finder with deleted cwd)
  // Change to a safe directory - use home directory as it always exists
  const homeDir = os.homedir();

  try {
    process.chdir(homeDir);
    // Use console.error since console.log might not work yet
    console.error(`[Bootstrap] Fixed missing cwd, changed to: ${homeDir}`);
  } catch (chdirError) {
    // If even home directory fails, we can't recover
    console.error('[Bootstrap] FATAL: Cannot set working directory to home:', chdirError);
    process.exit(1);
  }
}

// Now it's safe to load the main module which has many dependencies
// Use dynamic import to ensure this runs AFTER the cwd fix above
async function main(): Promise<void> {
  await import('./index.js');
}

void main();
