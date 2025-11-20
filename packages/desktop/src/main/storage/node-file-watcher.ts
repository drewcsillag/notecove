/**
 * Node.js File Watcher using Chokidar
 *
 * Watches a directory for changes and triggers callbacks.
 * Uses chokidar for reliable cross-platform file watching.
 */

import chokidar, { type FSWatcher } from 'chokidar';
import type { FileWatcher, FileWatchEvent, FileWatchEventType } from '@notecove/shared';

export class NodeFileWatcher implements FileWatcher {
  private watcher: FSWatcher | null = null;

  async watch(path: string, callback: (event: FileWatchEvent) => void): Promise<void> {
    // Clean up existing watcher if any
    if (this.watcher) {
      await this.unwatch();
    }

    // Watch for file changes using chokidar
    this.watcher = chokidar.watch(path, {
      persistent: true,
      ignoreInitial: true, // Don't trigger events for existing files
      // Note: awaitWriteFinish removed - was causing detection issues
      // Files are written atomically, so we don't need to wait
    });

    // Listen for all file events
    this.watcher
      .on('add', (filepath) => {
        // Extract just the filename from the full path
        const pathModule = require('path');
        const filename = pathModule.basename(filepath);
        console.log(`[FileWatcher] File added: ${filename} in ${path}`);
        callback({
          type: 'changed' as FileWatchEventType,
          path,
          filename,
        });
      })
      .on('change', (filepath) => {
        const pathModule = require('path');
        const filename = pathModule.basename(filepath);
        console.log(`[FileWatcher] File changed: ${filename} in ${path}`);
        callback({
          type: 'changed' as FileWatchEventType,
          path,
          filename,
        });
      })
      .on('unlink', (filepath) => {
        const pathModule = require('path');
        const filename = pathModule.basename(filepath);
        console.log(`[FileWatcher] File removed: ${filename} in ${path}`);
        callback({
          type: 'changed' as FileWatchEventType,
          path,
          filename,
        });
      })
      .on('error', (error) => {
        console.error('[FileWatcher] Error watching directory:', error);
      });

    // Wait for watcher to be ready
    await new Promise<void>((resolve) => {
      this.watcher!.on('ready', () => {
        console.log(`[FileWatcher] Ready to watch: ${path}`);
        resolve();
      });
    });
  }

  async unwatch(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
