/**
 * Storage Directory Registry
 *
 * Maintains a mapping of Storage Directory IDs to their filesystem paths.
 * Used by UpdateManager to route note operations to the correct SD.
 */

import type { UUID } from '@notecove/shared';

export class StorageDirectoryRegistry {
  private sdPaths = new Map<UUID, string>();

  /**
   * Register a Storage Directory with its path
   */
  register(sdId: UUID, path: string): void {
    this.sdPaths.set(sdId, path);
  }

  /**
   * Unregister a Storage Directory
   */
  unregister(sdId: UUID): void {
    this.sdPaths.delete(sdId);
  }

  /**
   * Get the path for a Storage Directory
   * @returns The path, or undefined if not registered
   */
  get(sdId: UUID): string | undefined {
    return this.sdPaths.get(sdId);
  }

  /**
   * Check if a Storage Directory is registered
   */
  has(sdId: UUID): boolean {
    return this.sdPaths.has(sdId);
  }

  /**
   * Get all registered Storage Directory IDs
   */
  getAllIds(): UUID[] {
    return Array.from(this.sdPaths.keys());
  }

  /**
   * Get all registered Storage Directories (id → path mapping)
   */
  getAll(): Map<UUID, string> {
    return new Map(this.sdPaths);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.sdPaths.clear();
  }

  /**
   * Get the number of registered Storage Directories
   */
  get size(): number {
    return this.sdPaths.size;
  }
}
