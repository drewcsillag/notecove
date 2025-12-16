/**
 * Media Sync Tests
 *
 * Tests for media directory scanning and image registration.
 */

import { scanAndRegisterMedia } from '../media-sync';
import type { Database } from '@notecove/shared';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
}));

import * as fs from 'fs/promises';

// Helper to create stat results
const createDirStat = () => ({ isDirectory: () => true });
const createFileStat = (size: number) => ({ isDirectory: () => false, size });

describe('scanAndRegisterMedia', () => {
  let mockDatabase: {
    imageExists: jest.Mock;
    upsertImage: jest.Mock;
  };

  beforeEach(() => {
    jest.resetAllMocks(); // Use resetAllMocks to also clear implementations
    mockDatabase = {
      imageExists: jest.fn(),
      upsertImage: jest.fn(),
    };
  });

  it('should return 0 for non-existent media directory', async () => {
    (fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(0);
    expect(mockDatabase.upsertImage).not.toHaveBeenCalled();
  });

  it('should return 0 for empty media directory', async () => {
    (fs.stat as jest.Mock).mockResolvedValue(createDirStat());
    (fs.readdir as jest.Mock).mockResolvedValue([]);

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(0);
    expect(mockDatabase.upsertImage).not.toHaveBeenCalled();
  });

  it('should skip non-image files', async () => {
    (fs.stat as jest.Mock).mockResolvedValue(createDirStat());
    (fs.readdir as jest.Mock).mockResolvedValue(['readme.txt', 'data.json', '.DS_Store']);

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(0);
    expect(mockDatabase.upsertImage).not.toHaveBeenCalled();
  });

  it('should skip images already registered in database', async () => {
    const id1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const id2 = 'b2c3d4e5-f678-9012-bcde-f12345678901';
    (fs.stat as jest.Mock).mockResolvedValue(createDirStat());
    (fs.readdir as jest.Mock).mockResolvedValue([`${id1}.png`, `${id2}.jpg`]);
    mockDatabase.imageExists.mockResolvedValue(true); // Already registered

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(0);
    expect(mockDatabase.imageExists).toHaveBeenCalledTimes(2);
    expect(mockDatabase.upsertImage).not.toHaveBeenCalled();
  });

  it('should register unregistered images', async () => {
    const imageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    (fs.stat as jest.Mock)
      .mockResolvedValueOnce(createDirStat()) // First call: directory check
      .mockResolvedValueOnce(createFileStat(1024)); // Second call: file stat
    (fs.readdir as jest.Mock).mockResolvedValue([`${imageId}.png`]);
    mockDatabase.imageExists.mockResolvedValue(false); // Not registered

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(1);
    expect(mockDatabase.upsertImage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: imageId,
        sdId: 'sd-1',
        filename: `${imageId}.png`,
        mimeType: 'image/png',
        size: 1024,
      })
    );
  });

  it('should handle multiple images with mixed registration status', async () => {
    const registeredId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const unregisteredId = 'b2c3d4e5-f678-9012-bcde-f12345678901';

    (fs.stat as jest.Mock)
      .mockResolvedValueOnce(createDirStat()) // First call: directory check
      .mockResolvedValueOnce(createFileStat(2048)) // Second call: file stat for unregistered
      .mockResolvedValueOnce(createFileStat(2048)); // Third call: file stat (unused, registered skipped)
    (fs.readdir as jest.Mock).mockResolvedValue([`${registeredId}.png`, `${unregisteredId}.jpg`]);
    mockDatabase.imageExists
      .mockResolvedValueOnce(true) // First image registered
      .mockResolvedValueOnce(false); // Second image not registered

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(1);
    expect(mockDatabase.upsertImage).toHaveBeenCalledTimes(1);
    expect(mockDatabase.upsertImage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: unregisteredId,
        filename: `${unregisteredId}.jpg`,
        mimeType: 'image/jpeg',
      })
    );
  });

  it('should handle all supported image extensions', async () => {
    const imageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    // Use mockImplementation to control behavior based on call order
    let statCallCount = 0;
    (fs.stat as jest.Mock).mockImplementation(() => {
      statCallCount++;
      if (statCallCount === 1) {
        // First call: directory check
        return Promise.resolve(createDirStat());
      }
      // Subsequent calls: file stats
      return Promise.resolve(createFileStat(512));
    });
    (fs.readdir as jest.Mock).mockResolvedValue([
      `${imageId}.png`,
      `${imageId}.jpg`,
      `${imageId}.jpeg`,
      `${imageId}.gif`,
      `${imageId}.webp`,
      `${imageId}.svg`,
      `${imageId}.heic`,
      `${imageId}.heif`,
    ]);
    mockDatabase.imageExists.mockResolvedValue(false);

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(8);
    expect(mockDatabase.upsertImage).toHaveBeenCalledTimes(8);
  });

  it('should continue on single file stat error', async () => {
    const goodId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const badId = 'b2c3d4e5-f678-9012-bcde-f12345678901';

    // Use mockImplementation to control behavior based on path
    let statCallCount = 0;
    (fs.stat as jest.Mock).mockImplementation(() => {
      statCallCount++;
      if (statCallCount === 1) {
        // First call: directory check
        return Promise.resolve(createDirStat());
      } else if (statCallCount === 2) {
        // Second call: first file (badId) gone
        return Promise.reject(new Error('ENOENT'));
      } else {
        // Third call: second file (goodId) OK
        return Promise.resolve(createFileStat(1024));
      }
    });
    (fs.readdir as jest.Mock).mockResolvedValue([`${badId}.png`, `${goodId}.jpg`]);
    mockDatabase.imageExists.mockResolvedValue(false);

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(1);
    expect(mockDatabase.upsertImage).toHaveBeenCalledTimes(1);
    expect(mockDatabase.upsertImage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: goodId,
      })
    );
  });

  it('should skip files with invalid imageId format', async () => {
    (fs.stat as jest.Mock).mockResolvedValue(createDirStat());
    (fs.readdir as jest.Mock).mockResolvedValue([
      'invalid-id.png', // Not a valid UUID or hex
      '../path-traversal.png', // Security issue
      '.hidden.png', // Hidden file
    ]);

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(0);
    expect(mockDatabase.imageExists).not.toHaveBeenCalled();
    expect(mockDatabase.upsertImage).not.toHaveBeenCalled();
  });

  it('should handle hex format imageIds (32 chars, no dashes)', async () => {
    const hexId = 'a1b2c3d4e5f67890abcdef1234567890'; // 32-char hex
    (fs.stat as jest.Mock)
      .mockResolvedValueOnce(createDirStat()) // First call: directory check
      .mockResolvedValueOnce(createFileStat(4096)); // Second call: file stat
    (fs.readdir as jest.Mock).mockResolvedValue([`${hexId}.png`]);
    mockDatabase.imageExists.mockResolvedValue(false);

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(1);
    expect(mockDatabase.upsertImage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: hexId,
        filename: `${hexId}.png`,
      })
    );
  });

  it('should return 0 if media path is a file instead of directory', async () => {
    // Simulate media path being a file, not a directory
    (fs.stat as jest.Mock).mockResolvedValue({
      isDirectory: () => false,
    });

    const count = await scanAndRegisterMedia(
      'sd-1',
      '/test/sd',
      mockDatabase as unknown as Database
    );

    expect(count).toBe(0);
    expect(mockDatabase.upsertImage).not.toHaveBeenCalled();
  });
});
