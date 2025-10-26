/**
 * Node.js File Watcher
 *
 * Watches a directory for changes and triggers callbacks
 */

import { watch, type FSWatcher } from 'fs';
import { basename } from 'path';
import type { FileWatcher, FileWatchEvent, FileWatchEventType } from '@notecove/shared';

export class NodeFileWatcher implements FileWatcher {
  private watcher: FSWatcher | null = null;
  private watchPath: string | null = null;

  async watch(path: string, callback: (event: FileWatchEvent) => void): Promise<void> {
    // Clean up existing watcher if any
    if (this.watcher) {
      await this.unwatch();
    }

    this.watchPath = path;

    // Watch for file changes
    this.watcher = watch(
      path,
      { recursive: false },
      (eventType: string, filename: string | null) => {
        if (!filename) return;

        // Map Node.js event types to our FileWatchEventType
        let type: FileWatchEventType;
        if (eventType === 'rename') {
          // In Node.js, 'rename' can mean added or deleted
          // We'll treat it as 'changed' for simplicity
          type = 'changed' as FileWatchEventType;
        } else {
          // 'change' event
          type = 'changed' as FileWatchEventType;
        }

        const event: FileWatchEvent = {
          type,
          path,
          filename,
        };

        callback(event);
      }
    );

    this.watcher.on('error', (error) => {
      console.error('[FileWatcher] Error watching directory:', error);
    });
  }

  async unwatch(): Promise<void> {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.watchPath = null;
  }
}
