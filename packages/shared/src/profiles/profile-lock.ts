/**
 * Profile Lock
 *
 * Implements single-instance enforcement per profile.
 * Creates a lock file in the profile data directory that contains
 * the PID and timestamp of the process holding the lock.
 *
 * Features:
 * - Stale lock detection: If the PID in the lock file is no longer running,
 *   the lock is considered stale and can be acquired.
 * - Same-PID handling: If this process already holds the lock, acquisition succeeds.
 */

import type { FileSystemAdapter } from '../storage/types';

const LOCK_FILENAME = 'profile.lock';

export interface LockInfo {
  pid: number;
  timestamp: number;
}

export class ProfileLock {
  private currentLockPath: string | null = null;

  constructor(private readonly fs: FileSystemAdapter) {}

  /**
   * Attempt to acquire the lock for a profile.
   * @param profileDataDir The profile's data directory
   * @returns true if lock acquired, false if already locked by another process
   */
  async acquire(profileDataDir: string): Promise<boolean> {
    const lockPath = this.fs.joinPath(profileDataDir, LOCK_FILENAME);

    // Check if lock file exists
    const exists = await this.fs.exists(lockPath);
    if (exists) {
      const info = await this.readLockFile(lockPath);
      if (info) {
        // If same PID, we already hold the lock
        if (info.pid === process.pid) {
          this.currentLockPath = lockPath;
          return true;
        }

        // Check if the process is still running
        if (this.isProcessRunning(info.pid)) {
          // Lock is held by another live process
          return false;
        }

        // Process is dead - stale lock, delete it
        try {
          await this.fs.deleteFile(lockPath);
        } catch {
          // Ignore delete errors
        }
      }
    }

    // Write new lock file
    const lockData: LockInfo = {
      pid: process.pid,
      timestamp: Date.now(),
    };

    await this.fs.writeFile(lockPath, new TextEncoder().encode(JSON.stringify(lockData)));
    this.currentLockPath = lockPath;
    return true;
  }

  /**
   * Release the lock.
   * Safe to call even if lock was never acquired.
   */
  async release(): Promise<void> {
    if (!this.currentLockPath) {
      return;
    }

    try {
      await this.fs.deleteFile(this.currentLockPath);
    } catch {
      // Ignore errors (file might not exist)
    }

    this.currentLockPath = null;
  }

  /**
   * Check if a profile is currently locked.
   * Returns true if locked by a live process, false otherwise.
   */
  async isLocked(profileDataDir: string): Promise<boolean> {
    const lockPath = this.fs.joinPath(profileDataDir, LOCK_FILENAME);

    const exists = await this.fs.exists(lockPath);
    if (!exists) {
      return false;
    }

    const info = await this.readLockFile(lockPath);
    if (!info) {
      return false;
    }

    // Check if the process is still running
    return this.isProcessRunning(info.pid);
  }

  /**
   * Get information about the current lock holder.
   * @returns Lock info or null if not locked
   */
  async getLockInfo(profileDataDir: string): Promise<LockInfo | null> {
    const lockPath = this.fs.joinPath(profileDataDir, LOCK_FILENAME);

    const exists = await this.fs.exists(lockPath);
    if (!exists) {
      return null;
    }

    return this.readLockFile(lockPath);
  }

  /**
   * Read and parse the lock file
   */
  private async readLockFile(lockPath: string): Promise<LockInfo | null> {
    try {
      const data = await this.fs.readFile(lockPath);
      const content = new TextDecoder().decode(data);
      return JSON.parse(content) as LockInfo;
    } catch {
      return null;
    }
  }

  /**
   * Check if a process is still running.
   * Uses process.kill(pid, 0) which checks if the process exists without killing it.
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Signal 0 checks if process exists without sending a signal
      process.kill(pid, 0);
      return true;
    } catch {
      // Process doesn't exist or we don't have permission
      return false;
    }
  }
}
