/**
 * SD Version Management Tests
 */

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  checkSDVersion,
  writeSDVersion,
  createMigrationLock,
  removeMigrationLock,
  isMigrationLocked,
} from '../sd-version';
import { CURRENT_SD_VERSION } from '../types';
import type { FileSystemAdapter } from '../../types';

describe('SD Version Management', () => {
  let mockFs: jest.Mocked<FileSystemAdapter>;
  const sdPath = '/test/sd';
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  beforeEach(() => {
    mockFs = {
      exists: jest.fn(),
      mkdir: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      deleteFile: jest.fn(),
      listFiles: jest.fn(),
      joinPath: jest.fn((base, file) => `${base}/${file}`),
      basename: jest.fn((path) => path.split('/').pop() || ''),
      stat: jest.fn(),
    };
  });

  describe('checkSDVersion', () => {
    it('should return compatible when SD version matches current version', async () => {
      mockFs.exists.mockResolvedValue(false); // No lock file
      mockFs.readFile.mockResolvedValue(textEncoder.encode('1\n'));

      const result = await checkSDVersion(sdPath, mockFs);

      expect(result).toEqual({
        compatible: true,
        version: 1,
      });
      expect(mockFs.exists).toHaveBeenCalledWith(`${sdPath}/.migration-lock`);
      expect(mockFs.readFile).toHaveBeenCalledWith(`${sdPath}/SD_VERSION`);
    });

    it('should return locked when migration lock file exists', async () => {
      mockFs.exists.mockResolvedValue(true); // Lock file exists

      const result = await checkSDVersion(sdPath, mockFs);

      expect(result).toEqual({
        compatible: false,
        reason: 'locked',
        appVersion: CURRENT_SD_VERSION,
      });
      expect(mockFs.exists).toHaveBeenCalledWith(`${sdPath}/.migration-lock`);
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should return too-new when SD version is higher than current', async () => {
      mockFs.exists.mockResolvedValue(false);
      mockFs.readFile.mockResolvedValue(textEncoder.encode('999\n'));

      const result = await checkSDVersion(sdPath, mockFs);

      expect(result).toEqual({
        compatible: false,
        reason: 'too-new',
        sdVersion: 999,
        appVersion: CURRENT_SD_VERSION,
      });
    });

    it('should return too-old when SD version is lower than current', async () => {
      mockFs.exists.mockResolvedValue(false);
      mockFs.readFile.mockResolvedValue(textEncoder.encode('0\n'));

      const result = await checkSDVersion(sdPath, mockFs);

      expect(result).toEqual({
        compatible: false,
        reason: 'too-old',
        sdVersion: 0,
        appVersion: CURRENT_SD_VERSION,
      });
    });

    it('should treat missing SD_VERSION file as version 0', async () => {
      mockFs.exists.mockResolvedValue(false);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await checkSDVersion(sdPath, mockFs);

      expect(result).toEqual({
        compatible: false,
        reason: 'too-old',
        sdVersion: 0,
        appVersion: CURRENT_SD_VERSION,
      });
    });

    it('should treat invalid version number as version 0', async () => {
      mockFs.exists.mockResolvedValue(false);
      mockFs.readFile.mockResolvedValue(textEncoder.encode('invalid\n'));

      const result = await checkSDVersion(sdPath, mockFs);

      expect(result).toEqual({
        compatible: false,
        reason: 'too-old',
        sdVersion: 0,
        appVersion: CURRENT_SD_VERSION,
      });
    });

    it('should treat negative version number as version 0', async () => {
      mockFs.exists.mockResolvedValue(false);
      mockFs.readFile.mockResolvedValue(textEncoder.encode('-5\n'));

      const result = await checkSDVersion(sdPath, mockFs);

      expect(result).toEqual({
        compatible: false,
        reason: 'too-old',
        sdVersion: 0,
        appVersion: CURRENT_SD_VERSION,
      });
    });

    it('should handle version number without newline', async () => {
      mockFs.exists.mockResolvedValue(false);
      mockFs.readFile.mockResolvedValue(textEncoder.encode('1'));

      const result = await checkSDVersion(sdPath, mockFs);

      expect(result).toEqual({
        compatible: true,
        version: 1,
      });
    });
  });

  describe('writeSDVersion', () => {
    it('should write version number with newline', async () => {
      await writeSDVersion(sdPath, 1, mockFs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        `${sdPath}/SD_VERSION`,
        textEncoder.encode('1\n')
      );
    });

    it('should write higher version numbers correctly', async () => {
      await writeSDVersion(sdPath, 42, mockFs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        `${sdPath}/SD_VERSION`,
        textEncoder.encode('42\n')
      );
    });
  });

  describe('createMigrationLock', () => {
    it('should create lock file with timestamp', async () => {
      const beforeTime = Date.now();
      await createMigrationLock(sdPath, mockFs);
      const afterTime = Date.now();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        `${sdPath}/.migration-lock`,
        expect.any(Uint8Array)
      );

      // Verify the content structure
      const writtenData = (mockFs.writeFile as jest.Mock).mock.calls[0][1] as Uint8Array;
      const content = textDecoder.decode(writtenData);
      const lockData = JSON.parse(content);

      expect(lockData).toHaveProperty('timestamp');
      const lockTime = new Date(lockData.timestamp).getTime();
      expect(lockTime).toBeGreaterThanOrEqual(beforeTime);
      expect(lockTime).toBeLessThanOrEqual(afterTime);
    });

    it('should create valid JSON in lock file', async () => {
      await createMigrationLock(sdPath, mockFs);

      const writtenData = (mockFs.writeFile as jest.Mock).mock.calls[0][1] as Uint8Array;
      const content = textDecoder.decode(writtenData);

      // Should not throw
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  describe('removeMigrationLock', () => {
    it('should remove lock file', async () => {
      await removeMigrationLock(sdPath, mockFs);

      expect(mockFs.deleteFile).toHaveBeenCalledWith(`${sdPath}/.migration-lock`);
    });

    it('should ignore errors when removing lock file', async () => {
      mockFs.deleteFile.mockRejectedValue(new Error('File not found'));

      // Should not throw
      await expect(removeMigrationLock(sdPath, mockFs)).resolves.not.toThrow();
    });
  });

  describe('isMigrationLocked', () => {
    it('should return true when lock file exists', async () => {
      mockFs.exists.mockResolvedValue(true);

      const result = await isMigrationLocked(sdPath, mockFs);

      expect(result).toBe(true);
      expect(mockFs.exists).toHaveBeenCalledWith(`${sdPath}/.migration-lock`);
    });

    it('should return false when lock file does not exist', async () => {
      mockFs.exists.mockResolvedValue(false);

      const result = await isMigrationLocked(sdPath, mockFs);

      expect(result).toBe(false);
      expect(mockFs.exists).toHaveBeenCalledWith(`${sdPath}/.migration-lock`);
    });
  });

  describe('Integration scenarios', () => {
    it('should support complete migration workflow', async () => {
      // 1. Check version - should be version 0 (missing file)
      mockFs.exists.mockResolvedValue(false);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      let result = await checkSDVersion(sdPath, mockFs);
      expect(result).toEqual({
        compatible: false,
        reason: 'too-old',
        sdVersion: 0,
        appVersion: CURRENT_SD_VERSION,
      });

      // 2. Create migration lock
      await createMigrationLock(sdPath, mockFs);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        `${sdPath}/.migration-lock`,
        expect.any(Uint8Array)
      );

      // 3. Check if locked
      mockFs.exists.mockResolvedValue(true);
      const isLocked = await isMigrationLocked(sdPath, mockFs);
      expect(isLocked).toBe(true);

      // 4. Write new version
      await writeSDVersion(sdPath, 1, mockFs);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        `${sdPath}/SD_VERSION`,
        textEncoder.encode('1\n')
      );

      // 5. Remove lock
      await removeMigrationLock(sdPath, mockFs);
      expect(mockFs.deleteFile).toHaveBeenCalledWith(`${sdPath}/.migration-lock`);

      // 6. Check version again - should be compatible now
      mockFs.exists.mockResolvedValue(false);
      mockFs.readFile.mockResolvedValue(textEncoder.encode('1\n'));

      result = await checkSDVersion(sdPath, mockFs);
      expect(result).toEqual({
        compatible: true,
        version: 1,
      });
    });

    it('should detect concurrent migration attempts', async () => {
      // First instance creates lock
      await createMigrationLock(sdPath, mockFs);

      // Second instance tries to check version
      mockFs.exists.mockResolvedValue(true); // Lock exists

      const result = await checkSDVersion(sdPath, mockFs);
      expect(result).toEqual({
        compatible: false,
        reason: 'locked',
        appVersion: CURRENT_SD_VERSION,
      });
    });
  });
});
