/**
 * Storage Directory UUID Management
 * Handles SD_ID file operations and UUID generation with reconciliation
 */

import type { FileSystemAdapter } from './types';
import { generateCompactId, isCompactUuid, isFullUuid } from '../utils/uuid-encoding';

/**
 * SD_ID file format
 * Plain text file containing a single UUID string
 */
export interface SdIdFile {
  uuid: string;
}

/**
 * Result of UUID initialization
 */
export interface SdUuidInitResult {
  uuid: string;
  wasGenerated: boolean; // True if we generated a new UUID
  hadRaceCondition: boolean; // True if we detected a race condition
}

/**
 * SD UUID Manager
 * Manages UUID assignment for Storage Directories
 */
export class SdUuidManager {
  private static readonly SD_ID_FILENAME = 'SD_ID';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 100;

  constructor(private readonly fs: FileSystemAdapter) {}

  /**
   * Get the SD_ID file path for a given SD root directory
   */
  private getSdIdPath(sdPath: string): string {
    return this.fs.joinPath(sdPath, SdUuidManager.SD_ID_FILENAME);
  }

  /**
   * Read UUID from SD_ID file
   * Returns null if file doesn't exist or is invalid
   */
  async readUuid(sdPath: string): Promise<string | null> {
    const sdIdPath = this.getSdIdPath(sdPath);

    try {
      const exists = await this.fs.exists(sdIdPath);
      if (!exists) {
        return null;
      }

      const data = await this.fs.readFile(sdIdPath);
      const content = this.bytesToString(data);
      const uuid = content.trim();

      // Validate UUID format (basic check)
      if (!this.isValidUuid(uuid)) {
        console.warn(`[SdUuidManager] Invalid UUID in SD_ID file at ${sdIdPath}: ${uuid}`);
        return null;
      }

      return uuid;
    } catch (error) {
      console.error(`[SdUuidManager] Failed to read SD_ID file at ${sdIdPath}:`, error);
      return null;
    }
  }

  /**
   * Write UUID to SD_ID file
   */
  async writeUuid(sdPath: string, uuid: string): Promise<void> {
    const sdIdPath = this.getSdIdPath(sdPath);

    try {
      // Validate UUID before writing
      if (!this.isValidUuid(uuid)) {
        throw new Error(`Invalid UUID format: ${uuid}`);
      }

      const data = this.stringToBytes(uuid);
      await this.fs.writeFile(sdIdPath, data);
    } catch (error) {
      console.error(`[SdUuidManager] Failed to write SD_ID file at ${sdIdPath}:`, error);
      throw error;
    }
  }

  /**
   * Initialize UUID for an SD with reconciliation
   * Implements Option C: Auto-generate + read-back reconciliation
   *
   * Process:
   * 1. Check if SD_ID file exists
   * 2. If exists, read and return it
   * 3. If not, generate new UUID, write it, read back
   * 4. If read-back differs (race condition), use the read-back value
   * 5. Retry up to MAX_RETRIES times on failure
   *
   * @param sdPath Path to the SD root directory
   * @returns UUID initialization result
   */
  async initializeUuid(sdPath: string): Promise<SdUuidInitResult> {
    // First, check if UUID already exists
    const existingUuid = await this.readUuid(sdPath);
    if (existingUuid) {
      return {
        uuid: existingUuid,
        wasGenerated: false,
        hadRaceCondition: false,
      };
    }

    // Generate new UUID with retry and reconciliation
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < SdUuidManager.MAX_RETRIES; attempt++) {
      try {
        // Generate new compact UUID
        const generatedUuid = generateCompactId();

        // Write to file
        await this.writeUuid(sdPath, generatedUuid);

        // Read back for reconciliation
        const readBackUuid = await this.readUuid(sdPath);

        if (!readBackUuid) {
          throw new Error('Failed to read back SD_ID file after writing');
        }

        // Check for race condition
        const hadRaceCondition = readBackUuid !== generatedUuid;

        if (hadRaceCondition) {
          console.warn(
            `[SdUuidManager] Race condition detected at ${sdPath}: ` +
              `generated ${generatedUuid} but read back ${readBackUuid}`
          );
        }

        return {
          uuid: readBackUuid, // Use the read-back value (handles race condition)
          wasGenerated: true,
          hadRaceCondition,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(
          `[SdUuidManager] UUID initialization attempt ${attempt + 1}/${SdUuidManager.MAX_RETRIES} failed:`,
          error
        );

        // Wait before retry (except on last attempt)
        if (attempt < SdUuidManager.MAX_RETRIES - 1) {
          await this.delay(SdUuidManager.RETRY_DELAY_MS);
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed to initialize UUID for SD at ${sdPath} after ${SdUuidManager.MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }

  /**
   * Validate UUID format
   * Accepts both full UUID (36-char) and compact (22-char) formats
   */
  private isValidUuid(uuid: string): boolean {
    return isFullUuid(uuid) || isCompactUuid(uuid);
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convert Uint8Array to UTF-8 string
   */
  private bytesToString(bytes: Uint8Array): string {
    return new TextDecoder('utf-8').decode(bytes);
  }

  /**
   * Convert UTF-8 string to Uint8Array
   */
  private stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  /**
   * Ensure SD has a UUID
   * Convenience method that combines read and initialize
   * Returns the UUID (existing or newly generated)
   */
  async ensureUuid(sdPath: string): Promise<string> {
    const result = await this.initializeUuid(sdPath);
    return result.uuid;
  }

  /**
   * Delete SD_ID file
   * Used during SD removal or testing
   */
  async deleteUuid(sdPath: string): Promise<void> {
    const sdIdPath = this.getSdIdPath(sdPath);

    try {
      const exists = await this.fs.exists(sdIdPath);
      if (exists) {
        await this.fs.deleteFile(sdIdPath);
      }
    } catch (error) {
      console.error(`[SdUuidManager] Failed to delete SD_ID file at ${sdIdPath}:`, error);
      throw error;
    }
  }
}
