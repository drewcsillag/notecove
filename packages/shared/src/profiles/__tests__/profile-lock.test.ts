/**
 * Profile Lock Tests
 *
 * Tests for single-instance enforcement per profile.
 * The lock prevents multiple app instances from using the same profile.
 */

import { ProfileLock } from '../profile-lock';
import type { FileSystemAdapter } from '../../storage/types';

/**
 * Create a mock filesystem adapter for testing
 */
function createMockFs(files: Map<string, Uint8Array> = new Map()): FileSystemAdapter {
  return {
    exists: jest.fn(async (path: string) => files.has(path)),
    mkdir: jest.fn(async () => {}),
    readFile: jest.fn(async (path: string) => {
      const data = files.get(path);
      if (!data) throw new Error(`ENOENT: ${path}`);
      return data;
    }),
    writeFile: jest.fn(async (path: string, data: Uint8Array) => {
      files.set(path, data);
    }),
    appendFile: jest.fn(async () => {}),
    deleteFile: jest.fn(async (path: string) => {
      files.delete(path);
    }),
    listFiles: jest.fn(async () => []),
    joinPath: jest.fn((...segments: string[]) => segments.join('/')),
    basename: jest.fn((path: string) => path.split('/').pop() || ''),
    stat: jest.fn(async () => ({ size: 0, mtimeMs: 0, ctimeMs: 0 })),
  };
}

describe('ProfileLock', () => {
  const PROFILE_DATA_DIR = '/Users/test/NoteCove/profile-data';
  const LOCK_FILE = `${PROFILE_DATA_DIR}/profile.lock`;

  describe('acquire', () => {
    it('should create lock file on acquire', async () => {
      const mockFs = createMockFs();
      const lock = new ProfileLock(mockFs);

      const acquired = await lock.acquire(PROFILE_DATA_DIR);

      expect(acquired).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      expect(writeCall[0]).toBe(LOCK_FILE);
    });

    it('should write PID and timestamp to lock file', async () => {
      const mockFs = createMockFs();
      const lock = new ProfileLock(mockFs);

      await lock.acquire(PROFILE_DATA_DIR);

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      const content = JSON.parse(new TextDecoder().decode(writeCall[1])) as {
        pid: number;
        timestamp: number;
      };
      expect(content.pid).toBe(process.pid);
      expect(typeof content.timestamp).toBe('number');
      expect(content.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should fail to acquire if lock already held by another process', async () => {
      const files = new Map<string, Uint8Array>();
      // Use the parent process PID (ppid) - this is guaranteed to be a running process
      // that is different from the current process
      const ppid = process.ppid;
      const otherLock = JSON.stringify({ pid: ppid, timestamp: Date.now() });
      files.set(LOCK_FILE, new TextEncoder().encode(otherLock));

      const mockFs = createMockFs(files);
      const lock = new ProfileLock(mockFs);

      const acquired = await lock.acquire(PROFILE_DATA_DIR);

      expect(acquired).toBe(false);
    });

    it('should succeed if lock is stale (dead PID)', async () => {
      const files = new Map<string, Uint8Array>();
      // Use a PID that definitely doesn't exist (very high number)
      const staleLock = JSON.stringify({ pid: 999999999, timestamp: Date.now() - 60000 });
      files.set(LOCK_FILE, new TextEncoder().encode(staleLock));

      const mockFs = createMockFs(files);
      const lock = new ProfileLock(mockFs);

      const acquired = await lock.acquire(PROFILE_DATA_DIR);

      expect(acquired).toBe(true);
      // Should have deleted the stale lock and written a new one
      expect(mockFs.deleteFile).toHaveBeenCalledWith(LOCK_FILE);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should succeed if already holding the lock (same PID)', async () => {
      const files = new Map<string, Uint8Array>();
      // Same PID as current process
      const ownLock = JSON.stringify({ pid: process.pid, timestamp: Date.now() });
      files.set(LOCK_FILE, new TextEncoder().encode(ownLock));

      const mockFs = createMockFs(files);
      const lock = new ProfileLock(mockFs);

      const acquired = await lock.acquire(PROFILE_DATA_DIR);

      expect(acquired).toBe(true);
    });
  });

  describe('release', () => {
    it('should delete lock file on release', async () => {
      const mockFs = createMockFs();
      const lock = new ProfileLock(mockFs);

      await lock.acquire(PROFILE_DATA_DIR);
      await lock.release();

      expect(mockFs.deleteFile).toHaveBeenCalledWith(LOCK_FILE);
    });

    it('should not throw if lock file does not exist', async () => {
      const mockFs = createMockFs();
      // Make deleteFile throw ENOENT
      (mockFs.deleteFile as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
      const lock = new ProfileLock(mockFs);

      // Should not throw
      await expect(lock.release()).resolves.toBeUndefined();
    });
  });

  describe('isLocked', () => {
    it('should return true when lock file exists and PID is alive', async () => {
      const files = new Map<string, Uint8Array>();
      // Use parent process PID - guaranteed to be alive and different from current
      const ppid = process.ppid;
      const lockData = JSON.stringify({ pid: ppid, timestamp: Date.now() });
      files.set(LOCK_FILE, new TextEncoder().encode(lockData));

      const mockFs = createMockFs(files);
      const lock = new ProfileLock(mockFs);

      const locked = await lock.isLocked(PROFILE_DATA_DIR);

      expect(locked).toBe(true);
    });

    it('should return false when lock file does not exist', async () => {
      const mockFs = createMockFs();
      const lock = new ProfileLock(mockFs);

      const locked = await lock.isLocked(PROFILE_DATA_DIR);

      expect(locked).toBe(false);
    });

    it('should return false when lock is stale (dead PID)', async () => {
      const files = new Map<string, Uint8Array>();
      // Use a PID that definitely doesn't exist
      const staleLock = JSON.stringify({ pid: 999999999, timestamp: Date.now() - 60000 });
      files.set(LOCK_FILE, new TextEncoder().encode(staleLock));

      const mockFs = createMockFs(files);
      const lock = new ProfileLock(mockFs);

      const locked = await lock.isLocked(PROFILE_DATA_DIR);

      expect(locked).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock info when lock exists', async () => {
      const files = new Map<string, Uint8Array>();
      const timestamp = Date.now();
      const lockData = JSON.stringify({ pid: 12345, timestamp });
      files.set(LOCK_FILE, new TextEncoder().encode(lockData));

      const mockFs = createMockFs(files);
      const lock = new ProfileLock(mockFs);

      const info = await lock.getLockInfo(PROFILE_DATA_DIR);

      expect(info).toEqual({ pid: 12345, timestamp });
    });

    it('should return null when lock does not exist', async () => {
      const mockFs = createMockFs();
      const lock = new ProfileLock(mockFs);

      const info = await lock.getLockInfo(PROFILE_DATA_DIR);

      expect(info).toBeNull();
    });
  });
});
