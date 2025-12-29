/**
 * Global Setup for E2E Tests
 *
 * Runs once before all tests to prepare the test environment.
 * This helps prevent the macOS "unexpectedly quit" dialog by
 * clearing the saved application state and disabling window restoration.
 */

import { rmSync, existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { execSync } from 'child_process';

/**
 * Clear macOS Saved Application State for Electron
 *
 * On macOS, when an app crashes, the system saves the window state
 * and tries to restore it on next launch. This can cause dialogs like
 * "The last time you opened Electron, it unexpectedly quit while reopening windows."
 *
 * We clear this state before running tests to prevent these dialogs.
 */
function clearMacOSSavedState(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const savedStateDir = join(homedir(), 'Library', 'Saved Application State');
  const electronPatterns = [/electron/i, /notecove/i];

  // Clear Saved Application State directories
  if (existsSync(savedStateDir)) {
    try {
      const entries = readdirSync(savedStateDir);
      for (const entry of entries) {
        const isElectronRelated = electronPatterns.some((pattern) => pattern.test(entry));
        if (isElectronRelated && entry.endsWith('.savedState')) {
          const fullPath = join(savedStateDir, entry);
          try {
            rmSync(fullPath, { recursive: true, force: true });
            console.log(`[Global Setup] Cleared saved application state: ${fullPath}`);
          } catch (err) {
            console.warn(`[Global Setup] Failed to clear saved state: ${fullPath}`, err);
          }
        }
      }
    } catch (err) {
      console.warn('[Global Setup] Failed to read saved state directory:', err);
    }
  }

  // Also clear crash reporter data that might trigger the dialog
  const crashDirs = [
    join(homedir(), 'Library', 'Application Support', 'CrashReporter'),
    join(homedir(), 'Library', 'Logs', 'DiagnosticReports'),
  ];

  for (const crashDir of crashDirs) {
    if (existsSync(crashDir)) {
      try {
        const entries = readdirSync(crashDir);
        for (const entry of entries) {
          if (electronPatterns.some((pattern) => pattern.test(entry))) {
            const fullPath = join(crashDir, entry);
            try {
              rmSync(fullPath, { recursive: true, force: true });
              console.log(`[Global Setup] Cleared crash data: ${fullPath}`);
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Kill any stale Electron processes that might cause issues.
 */
function killStaleElectronProcesses(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  try {
    // Kill any Electron processes (but not this Node process)
    execSync('pkill -9 -f "Electron" 2>/dev/null || true', { stdio: 'ignore' });
    console.log('[Global Setup] Killed stale Electron processes');
  } catch {
    // Ignore errors
  }

  // Give processes time to fully terminate
  execSync('sleep 1', { stdio: 'ignore' });
}

/**
 * Disable macOS window restoration for Electron apps during tests.
 * This sets NSQuitAlwaysKeepsWindows to false for Electron, which
 * prevents the "unexpectedly quit" dialog.
 */
function disableWindowRestoration(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  // Bundle identifiers that Electron might use - be comprehensive
  const bundleIds = [
    'Electron',
    'com.github.Electron',
    'com.electron.notecove',
    'com.electron.electron', // Another common one
    'org.electron.electron',
  ];

  for (const bundleId of bundleIds) {
    try {
      // Set NSQuitAlwaysKeepsWindows to false (don't save windows on quit)
      execSync(`defaults write "${bundleId}" NSQuitAlwaysKeepsWindows -bool false 2>/dev/null`, {
        stdio: 'pipe',
      });
      console.log(`[Global Setup] Disabled window restoration for ${bundleId}`);
    } catch {
      // Ignore errors - the domain might not exist yet
    }
  }

  // Also try to find what bundle IDs actually exist for Electron
  try {
    const result = execSync('defaults domains 2>/dev/null | tr "," "\\n" | grep -i electron', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    if (result.trim()) {
      console.log('[Global Setup] Found Electron-related domains:', result.trim());
      // Disable window restoration for any found domains
      for (const domain of result.trim().split('\n')) {
        const trimmedDomain = domain.trim();
        if (trimmedDomain) {
          try {
            execSync(
              `defaults write "${trimmedDomain}" NSQuitAlwaysKeepsWindows -bool false 2>/dev/null`,
              { stdio: 'ignore' }
            );
          } catch {
            // Ignore
          }
        }
      }
    }
  } catch {
    // Ignore - grep might not find anything
  }
}

/**
 * Global setup function called by Playwright before all tests
 */
export default async function globalSetup(): Promise<void> {
  console.log('[Global Setup] Preparing test environment...');

  // Kill any stale Electron processes first
  killStaleElectronProcesses();

  // Disable window restoration to prevent "unexpectedly quit" dialogs
  disableWindowRestoration();

  // Clear macOS saved application state to prevent crash dialogs
  clearMacOSSavedState();

  // List what saved state directories exist for debugging
  if (process.platform === 'darwin') {
    const savedStateDir = join(homedir(), 'Library', 'Saved Application State');
    if (existsSync(savedStateDir)) {
      try {
        const entries = readdirSync(savedStateDir);
        const electronDirs = entries.filter(
          (e) => /electron/i.test(e) && e.endsWith('.savedState')
        );
        if (electronDirs.length > 0) {
          console.log('[Global Setup] Remaining Electron saved state dirs:', electronDirs);
        }
      } catch {
        // Ignore
      }
    }
  }

  console.log('[Global Setup] Done');
}
