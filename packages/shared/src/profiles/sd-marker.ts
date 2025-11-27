/**
 * SD Marker
 *
 * Handles SD-TYPE marker files that distinguish development vs production
 * storage directories. This is a safety mechanism to prevent dev builds
 * from accidentally corrupting production data and vice versa.
 *
 * The marker file is named "SD-TYPE" and contains either "dev" or "prod".
 */

import type { FileSystemAdapter } from '../storage/types';
import type { SDType } from './types';

/** Filename for the SD type marker */
const SD_TYPE_FILENAME = 'SD-TYPE';

/**
 * SDMarker handles reading and writing SD-TYPE marker files.
 *
 * These marker files indicate whether a storage directory was created
 * by a dev build or a production build.
 */
export class SDMarker {
  constructor(private readonly fs: FileSystemAdapter) {}

  /**
   * Get the path to the marker file for an SD.
   */
  private getMarkerPath(sdPath: string): string {
    return this.fs.joinPath(sdPath, SD_TYPE_FILENAME);
  }

  /**
   * Write an SD-TYPE marker file.
   *
   * @param sdPath - Path to the storage directory
   * @param type - The SD type ('dev' or 'prod')
   */
  async writeSDMarker(sdPath: string, type: SDType): Promise<void> {
    const markerPath = this.getMarkerPath(sdPath);
    const data = new TextEncoder().encode(type);
    await this.fs.writeFile(markerPath, data);
    console.log(`[SDMarker] Wrote marker file: ${markerPath} = ${type}`);
  }

  /**
   * Read the SD-TYPE marker file.
   *
   * @param sdPath - Path to the storage directory
   * @returns The SD type ('dev' or 'prod'), or null if no valid marker exists
   */
  async readSDMarker(sdPath: string): Promise<SDType | null> {
    const markerPath = this.getMarkerPath(sdPath);

    try {
      const exists = await this.fs.exists(markerPath);
      if (!exists) {
        return null;
      }

      const data = await this.fs.readFile(markerPath);
      const content = new TextDecoder().decode(data).trim();

      // Validate the content is a valid SDType
      if (content === 'dev' || content === 'prod') {
        return content;
      }

      console.warn(`[SDMarker] Invalid marker content: "${content}" in ${markerPath}`);
      return null;
    } catch (error) {
      console.warn(`[SDMarker] Failed to read marker file ${markerPath}:`, error);
      return null;
    }
  }

  /**
   * Check if an SD is marked as a dev SD.
   *
   * @param sdPath - Path to the storage directory
   * @returns true if the SD has a 'dev' marker, false otherwise
   */
  async isDevSD(sdPath: string): Promise<boolean> {
    const type = await this.readSDMarker(sdPath);
    return type === 'dev';
  }

  /**
   * Check if an SD is marked as a prod SD.
   *
   * @param sdPath - Path to the storage directory
   * @returns true if the SD has a 'prod' marker, false otherwise
   */
  async isProdSD(sdPath: string): Promise<boolean> {
    const type = await this.readSDMarker(sdPath);
    return type === 'prod';
  }

  /**
   * Ensure an SD has a marker file, writing one if it doesn't exist.
   *
   * This is used to mark existing unmarked SDs when they're first accessed.
   * It will NOT overwrite an existing marker.
   *
   * @param sdPath - Path to the storage directory
   * @param defaultType - The type to write if no marker exists
   */
  async ensureMarker(sdPath: string, defaultType: SDType): Promise<void> {
    const existingType = await this.readSDMarker(sdPath);
    if (existingType === null) {
      console.log(`[SDMarker] No marker found, writing default: ${defaultType}`);
      await this.writeSDMarker(sdPath, defaultType);
    }
  }
}
