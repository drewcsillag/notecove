/**
 * Compression utilities using zstd
 *
 * Provides compression/decompression for snapshot and pack files.
 * Uses zstd level 3 (default) for optimal balance of speed and compression ratio.
 */

import zstd from '@mongodb-js/zstd';

/**
 * Compression level (1-22, default 3)
 * - Level 1: Fastest, ~55% compression
 * - Level 3: Fast, ~65% compression (RECOMMENDED)
 * - Level 10: Moderate, ~75% compression
 * - Level 19: Slow, ~80% compression
 */
const COMPRESSION_LEVEL = 3;

/**
 * Compress data using zstd
 * @param data - Uncompressed data
 * @returns Compressed data
 */
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const buffer = Buffer.from(data);
  const compressed = await zstd.compress(buffer, COMPRESSION_LEVEL);
  return new Uint8Array(compressed);
}

/**
 * Decompress data using zstd
 * @param data - Compressed data
 * @returns Decompressed data
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const buffer = Buffer.from(data);
  const decompressed = await zstd.decompress(buffer);
  return new Uint8Array(decompressed);
}

/**
 * Try to decompress data, fallback to returning original if it fails
 * Useful for backward compatibility with uncompressed files
 *
 * @param data - Potentially compressed data
 * @returns Decompressed data or original if decompression fails
 */
export async function decompressWithFallback(data: Uint8Array): Promise<Uint8Array> {
  try {
    const buffer = Buffer.from(data);
    const decompressed = await zstd.decompress(buffer);
    return new Uint8Array(decompressed);
  } catch (error) {
    // If decompression fails, assume it's uncompressed data
    console.warn('[Compression] Decompression failed, assuming uncompressed data:', error);
    return data;
  }
}

/**
 * Check if data is zstd-compressed
 * @param data - Data to check
 * @returns True if data appears to be zstd-compressed
 */
export function isCompressed(data: Uint8Array): boolean {
  // zstd magic number: 0x28, 0xB5, 0x2F, 0xFD
  if (data.length < 4) {
    return false;
  }
  return data[0] === 0x28 && data[1] === 0xb5 && data[2] === 0x2f && data[3] === 0xfd;
}
