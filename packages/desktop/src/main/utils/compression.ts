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
 *
 * Handles the status/version byte prefix used in pack and snapshot files:
 * - Byte 0: 0x00 (being written) or 0x01 (complete)
 * - Bytes 1+: zstd compressed data OR plain uncompressed data
 *
 * @param data - Compressed data (with optional status byte prefix)
 * @returns Decompressed data
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  // Check if first byte is a status byte (0x00 or 0x01)
  let dataToDecompress = data;

  if (data.length > 0 && (data[0] === 0x00 || data[0] === 0x01)) {
    // Check if byte 1 starts with zstd magic number (need at least 5 bytes total)
    if (
      data.length >= 5 &&
      data[1] === 0x28 &&
      data[2] === 0xb5 &&
      data[3] === 0x2f &&
      data[4] === 0xfd
    ) {
      // Compressed: strip status byte before decompressing
      dataToDecompress = data.slice(1);
    } else {
      // Uncompressed with status byte: just strip the status byte and return
      return data.slice(1);
    }
  }

  try {
    const buffer = Buffer.from(dataToDecompress);
    const decompressed = await zstd.decompress(buffer);
    return new Uint8Array(decompressed);
  } catch (error) {
    // Log detailed error information
    console.error('[Compression] Decompression failed:', error);
    console.error('[Compression] Data length:', data.length);
    console.error(
      '[Compression] First 20 bytes:',
      Array.from(data.slice(0, 20))
        .map((b) => '0x' + b.toString(16).padStart(2, '0'))
        .join(' ')
    );
    throw error;
  }
}

/**
 * Try to decompress data, fallback to returning original if it fails
 * Useful for backward compatibility with uncompressed files
 *
 * Handles the status/version byte prefix used in pack and snapshot files.
 *
 * @param data - Potentially compressed data (with optional status byte prefix)
 * @returns Decompressed data or original if decompression fails
 */
export async function decompressWithFallback(data: Uint8Array): Promise<Uint8Array> {
  try {
    // Check if first byte is a status byte (0x00 or 0x01)
    let dataToDecompress = data;

    if (data.length > 0 && (data[0] === 0x00 || data[0] === 0x01)) {
      // Check if byte 1 starts with zstd magic number (need at least 5 bytes total)
      if (
        data.length >= 5 &&
        data[1] === 0x28 &&
        data[2] === 0xb5 &&
        data[3] === 0x2f &&
        data[4] === 0xfd
      ) {
        // Compressed: strip status byte before decompressing
        dataToDecompress = data.slice(1);
      } else {
        // Uncompressed with status byte: just strip the status byte and return
        return data.slice(1);
      }
    }

    const buffer = Buffer.from(dataToDecompress);
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
