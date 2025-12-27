/**
 * UUID Encoding Utilities
 *
 * Converts between standard UUID format (36 chars with dashes)
 * and compact base64url format (22 chars, no padding).
 *
 * The compact format is:
 * - 39% shorter (36 → 22 characters)
 * - URL-safe (uses only a-zA-Z0-9, hyphen, underscore)
 * - Filesystem-safe (no special characters)
 *
 * Algorithm:
 * - UUID is 128 bits (16 bytes)
 * - Base64 encodes 6 bits per character
 * - 128 / 6 = 21.33, rounded up to 22 characters
 * - Uses base64url alphabet (- and _ instead of + and /)
 * - No padding characters (=)
 */

// Base64url alphabet
const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Reverse lookup for decoding
const BASE64URL_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE64URL_CHARS.length; i++) {
  BASE64URL_LOOKUP[BASE64URL_CHARS.charAt(i)] = i;
}

// UUID format regex (with dashes)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Compact format regex (22 base64url characters)
const COMPACT_REGEX = /^[A-Za-z0-9_-]{22}$/;

/**
 * Convert a standard UUID to compact base64url format.
 *
 * @param uuid - Standard UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * @returns Compact ID (e.g., "VQ6EAOKbQdSnFkRmVUQAAA")
 * @throws Error if input is not a valid UUID
 */
export function uuidToCompact(uuid: string): string {
  if (!UUID_REGEX.test(uuid)) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }

  // Remove dashes and convert to lowercase
  const hex = uuid.replace(/-/g, '').toLowerCase();

  // Convert hex to bytes
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  // Encode bytes to base64url
  return bytesToBase64url(bytes);
}

/**
 * Convert a compact base64url ID back to standard UUID format.
 *
 * @param compact - Compact ID (e.g., "VQ6EAOKbQdSnFkRmVUQAAA")
 * @returns Standard UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * @throws Error if input is not a valid compact ID
 */
export function compactToUuid(compact: string): string {
  if (!COMPACT_REGEX.test(compact)) {
    throw new Error(`Invalid compact UUID format: ${compact}`);
  }

  // Decode base64url to bytes
  const bytes = base64urlToBytes(compact);

  // Convert bytes to hex
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }

  // Insert dashes at positions 8, 12, 16, 20
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Check if a string is a valid compact UUID (22-char base64url).
 */
export function isCompactUuid(str: string): boolean {
  return COMPACT_REGEX.test(str);
}

/**
 * Check if a string is a valid full UUID (36-char with dashes).
 */
export function isFullUuid(str: string): boolean {
  return UUID_REGEX.test(str);
}

/**
 * Normalize a UUID to compact format.
 * Accepts either full UUID or compact format, returns compact.
 *
 * @param str - Either full UUID or compact ID
 * @returns Compact ID
 * @throws Error if input is neither format
 */
export function normalizeUuid(str: string): string {
  if (isCompactUuid(str)) {
    return str;
  }
  if (isFullUuid(str)) {
    return uuidToCompact(str);
  }
  throw new Error(`Invalid UUID format (neither full nor compact): ${str}`);
}

/**
 * Generate a new compact UUID.
 * Uses crypto.randomUUID() internally for proper v4 UUID generation.
 *
 * @returns New compact ID (22 characters)
 */
export function generateCompactId(): string {
  const uuid = crypto.randomUUID();
  return uuidToCompact(uuid);
}

/**
 * Convert 16 bytes to 22-character base64url string.
 */
function bytesToBase64url(bytes: Uint8Array): string {
  // 128 bits = 22 base64 characters (with 4 bits of padding)
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 6) {
      bits -= 6;
      result += BASE64URL_CHARS[(value >> bits) & 0x3f];
    }
  }

  // Handle remaining bits (should be 4 bits left = 128 % 6 = 2, but 128/6 = 21.33)
  // Actually: 16 bytes = 128 bits, 128 / 6 = 21 remainder 2
  // So we have 2 bits left, which we pad to 6 bits
  if (bits > 0) {
    result += BASE64URL_CHARS[(value << (6 - bits)) & 0x3f];
  }

  return result;
}

/**
 * Convert 22-character base64url string to 16 bytes.
 */
function base64urlToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(16);
  let bits = 0;
  let value = 0;
  let byteIndex = 0;

  for (const char of str) {
    const charValue = BASE64URL_LOOKUP[char];
    if (charValue === undefined) {
      throw new Error(`Invalid base64url character: ${char}`);
    }

    value = (value << 6) | charValue;
    bits += 6;

    while (bits >= 8 && byteIndex < 16) {
      bits -= 8;
      bytes[byteIndex++] = (value >> bits) & 0xff;
    }
  }

  return bytes;
}
