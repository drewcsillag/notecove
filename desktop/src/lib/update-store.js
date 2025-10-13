/**
 * Update Store - Manages packed CRDT update files
 * Each instance writes its own update files and reads others'
 * No write conflicts - completely robust multi-instance sync
 *
 * Updates are batched into files based on configurable flush strategy
 */

export class UpdateStore {
  constructor(fileStorage, instanceId, options = {}) {
    this.fileStorage = fileStorage;
    this.instanceId = instanceId;
    this.isElectron = fileStorage.isElectron;

    // Track what we've seen: { instance-A: 5, instance-B: 3 }
    this.seen = new Map();

    // Our current write counter
    this.writeCounter = 0;

    // Buffer for pending updates
    this.pendingUpdates = [];
    this.pendingStartSeq = null;

    // Flush strategy (easy to swap out)
    this.flushStrategy = options.flushStrategy || new IdleFlushStrategy({
      idleMs: options.idleMs || 3000,  // 3 seconds of inactivity
      maxUpdates: options.maxUpdates || 100,  // Safety: flush after 100 updates
      maxBytes: options.maxBytes || 1024 * 1024  // Safety: flush after 1MB
    });

    this.flushTimer = null;
  }

  /**
   * Initialize the update store for a note
   * Loads our meta file and sets up tracking
   * @param {string} noteId - Note ID
   */
  async initialize(noteId) {
    if (!this.isElectron) return;

    try {
      const metaPath = this.getMetaPath(noteId);
      const result = await window.electronAPI.fileSystem.readFile(metaPath);

      if (result.success) {
        const meta = JSON.parse(result.content);
        this.writeCounter = meta.lastWrite || 0;
        this.seen = new Map(Object.entries(meta.seen || {}));
        console.log(`UpdateStore initialized for ${noteId}:`, {
          instanceId: this.instanceId,
          writeCounter: this.writeCounter,
          seen: Object.fromEntries(this.seen)
        });
      } else {
        // First time - initialize empty
        this.writeCounter = 0;
        this.seen = new Map();
        console.log(`UpdateStore: New note ${noteId}, starting fresh`);
      }
    } catch (error) {
      console.error('Error initializing UpdateStore:', error);
      this.writeCounter = 0;
      this.seen = new Map();
    }
  }

  /**
   * Add a CRDT update to the buffer
   * Will be flushed according to flush strategy
   * @param {string} noteId - Note ID
   * @param {Uint8Array} update - CRDT update data
   */
  async addUpdate(noteId, update) {
    if (!this.isElectron) return;

    // Track the sequence number for this update
    if (this.pendingStartSeq === null) {
      this.pendingStartSeq = this.writeCounter + 1;
    }

    this.pendingUpdates.push(update);

    // Check if we should flush based on strategy
    const shouldFlush = this.flushStrategy.shouldFlush({
      updateCount: this.pendingUpdates.length,
      totalBytes: this.getTotalBytes(),
      firstUpdateTime: this.flushStrategy.firstUpdateTime
    });

    if (shouldFlush) {
      await this.flush(noteId);
    } else {
      // Reset idle timer
      this.resetFlushTimer(noteId);
    }
  }

  /**
   * Reset the idle flush timer
   * @param {string} noteId - Note ID
   */
  resetFlushTimer(noteId) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    // Only set timer if strategy has idle timeout
    const idleMs = this.flushStrategy.options?.idleMs;
    if (idleMs) {
      this.flushTimer = setTimeout(() => {
        this.flush(noteId);
      }, idleMs);
    }
  }

  /**
   * Get total bytes of pending updates
   * @returns {number} Total bytes
   */
  getTotalBytes() {
    return this.pendingUpdates.reduce((sum, update) => sum + update.length, 0);
  }

  /**
   * Flush pending updates to a packed file
   * @param {string} noteId - Note ID
   * @returns {boolean} Success
   */
  async flush(noteId) {
    if (!this.isElectron || this.pendingUpdates.length === 0) {
      return false;
    }

    try {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }

      const startSeq = this.pendingStartSeq;
      const endSeq = startSeq + this.pendingUpdates.length - 1;

      // Update our write counter
      this.writeCounter = endSeq;

      // Create packed file
      const packedFile = {
        instance: this.instanceId,
        sequence: [startSeq, endSeq],  // Range [start, end] inclusive
        timestamp: new Date().toISOString(),
        updates: this.pendingUpdates.map(u => this.encodeUpdate(u))
      };

      // Write packed file
      const updatePath = this.getUpdatePath(noteId, this.instanceId, startSeq, endSeq);
      await this.ensureDirectories(noteId);

      const writeResult = await window.electronAPI.fileSystem.writeFile(
        updatePath,
        JSON.stringify(packedFile)
      );

      if (!writeResult.success) {
        console.error('Failed to write packed update file:', writeResult.error);
        return false;
      }

      // Update our seen map
      this.seen.set(this.instanceId, this.writeCounter);

      // Write our meta file
      await this.writeMeta(noteId);

      console.log(`UpdateStore: Flushed ${this.pendingUpdates.length} updates as ${this.instanceId}.${startSeq}-${endSeq} for note ${noteId}`);

      // Clear buffer
      this.pendingUpdates = [];
      this.pendingStartSeq = null;
      this.flushStrategy.reset();

      return true;
    } catch (error) {
      console.error('Error flushing updates:', error);
      return false;
    }
  }

  /**
   * Read all updates we haven't seen yet from all instances
   * @param {string} noteId - Note ID
   * @returns {Array} Array of {instanceId, sequence, update} objects
   */
  async readNewUpdates(noteId) {
    if (!this.isElectron) return [];

    try {
      const updatesDir = this.getUpdatesDir(noteId);

      // List all update files
      const listResult = await window.electronAPI.fileSystem.readDir(updatesDir);
      if (!listResult.success) {
        // Directory doesn't exist yet
        return [];
      }

      const newUpdates = [];

      for (const filename of listResult.files) {
        if (!filename.endsWith('.yjson')) continue;

        // Parse filename: instance-A.000001-000050.yjson or instance-A.000001.yjson
        const match = filename.match(/^(.+)\.(\d+)(?:-(\d+))?\.yjson$/);
        if (!match) continue;

        const [, instanceId, startStr, endStr] = match;
        const startSeq = parseInt(startStr, 10);
        const endSeq = endStr ? parseInt(endStr, 10) : startSeq;

        // Have we seen all updates in this file?
        const lastSeen = this.seen.get(instanceId) || 0;
        if (endSeq <= lastSeen) {
          continue; // Already seen all updates in this file
        }

        // Read the packed file
        const updatePath = `${updatesDir}/${filename}`;
        const readResult = await window.electronAPI.fileSystem.readFile(updatePath);
        if (!readResult.success) {
          console.error('Failed to read packed update file:', updatePath);
          continue;
        }

        const packedFile = JSON.parse(readResult.content);

        // Extract updates we haven't seen
        const [fileStartSeq, fileEndSeq] = packedFile.sequence;

        for (let i = 0; i < packedFile.updates.length; i++) {
          const seq = fileStartSeq + i;

          if (seq <= lastSeen) {
            continue; // Already seen
          }

          const update = this.decodeUpdate(packedFile.updates[i]);
          newUpdates.push({ instanceId, sequence: seq, update });

          // Mark as seen
          this.seen.set(instanceId, Math.max(lastSeen, seq));
        }
      }

      // Sort by sequence to apply in order
      newUpdates.sort((a, b) => a.sequence - b.sequence);

      if (newUpdates.length > 0) {
        console.log(`UpdateStore: Read ${newUpdates.length} new updates for note ${noteId}`);
        // Update our meta file with what we've seen
        await this.writeMeta(noteId);
      }

      return newUpdates;
    } catch (error) {
      console.error('Error reading new updates:', error);
      return [];
    }
  }

  /**
   * Write our meta file tracking what we've seen
   * @param {string} noteId - Note ID
   */
  async writeMeta(noteId) {
    if (!this.isElectron) return;

    try {
      const metaPath = this.getMetaPath(noteId);

      const meta = {
        instanceId: this.instanceId,
        lastWrite: this.writeCounter,
        seen: Object.fromEntries(this.seen),
        lastUpdated: new Date().toISOString()
      };

      await this.ensureDirectories(noteId);

      const result = await window.electronAPI.fileSystem.writeFile(
        metaPath,
        JSON.stringify(meta, null, 2)
      );

      if (!result.success) {
        console.error('Failed to write meta file:', result.error);
      }
    } catch (error) {
      console.error('Error writing meta file:', error);
    }
  }

  /**
   * Ensure directories exist for a note
   * @param {string} noteId - Note ID
   */
  async ensureDirectories(noteId) {
    if (!this.isElectron) return;

    const notesPath = this.fileStorage.notesPath;
    const noteDir = `${notesPath}/${noteId}`;
    const updatesDir = `${noteDir}/updates`;
    const metaDir = `${noteDir}/meta`;

    for (const dir of [noteDir, updatesDir, metaDir]) {
      const exists = await window.electronAPI.fileSystem.exists(dir);
      if (!exists) {
        await window.electronAPI.fileSystem.mkdir(dir);
      }
    }
  }

  /**
   * Get path to our meta file
   * @param {string} noteId - Note ID
   * @returns {string} Path
   */
  getMetaPath(noteId) {
    const notesPath = this.fileStorage.notesPath;
    return `${notesPath}/${noteId}/meta/${this.instanceId}.json`;
  }

  /**
   * Get path to updates directory
   * @param {string} noteId - Note ID
   * @returns {string} Path
   */
  getUpdatesDir(noteId) {
    const notesPath = this.fileStorage.notesPath;
    return `${notesPath}/${noteId}/updates`;
  }

  /**
   * Get path to a packed update file
   * @param {string} noteId - Note ID
   * @param {string} instanceId - Instance ID
   * @param {number} startSeq - Start sequence number
   * @param {number} endSeq - End sequence number (optional, same as start for single update)
   * @returns {string} Path
   */
  getUpdatePath(noteId, instanceId, startSeq, endSeq = null) {
    const updatesDir = this.getUpdatesDir(noteId);
    const paddedStart = startSeq.toString().padStart(6, '0');

    if (endSeq && endSeq !== startSeq) {
      const paddedEnd = endSeq.toString().padStart(6, '0');
      return `${updatesDir}/${instanceId}.${paddedStart}-${paddedEnd}.yjson`;
    } else {
      return `${updatesDir}/${instanceId}.${paddedStart}.yjson`;
    }
  }

  /**
   * Encode update as base64 for storage
   * @param {Uint8Array} update - Update data
   * @returns {string} Base64 string
   */
  encodeUpdate(update) {
    return btoa(String.fromCharCode(...update));
  }

  /**
   * Decode update from base64
   * @param {string} base64 - Base64 string
   * @returns {Uint8Array} Update data
   */
  decodeUpdate(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Get all instance IDs that have written updates for a note
   * @param {string} noteId - Note ID
   * @returns {Array<string>} Instance IDs
   */
  async getInstances(noteId) {
    if (!this.isElectron) return [];

    try {
      const metaDir = `${this.fileStorage.notesPath}/${noteId}/meta`;
      const result = await window.electronAPI.fileSystem.readDir(metaDir);

      if (!result.success) {
        return [];
      }

      return result.files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  /**
   * Cleanup - flush any pending updates
   * @param {string} noteId - Note ID
   */
  async cleanup(noteId) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingUpdates.length > 0) {
      await this.flush(noteId);
    }
  }
}

/**
 * Idle-based flush strategy
 * Flushes after period of inactivity, with safety limits
 */
class IdleFlushStrategy {
  constructor(options = {}) {
    this.options = {
      idleMs: options.idleMs || 3000,
      maxUpdates: options.maxUpdates || 100,
      maxBytes: options.maxBytes || 1024 * 1024
    };
    this.firstUpdateTime = null;
  }

  shouldFlush({ updateCount, totalBytes }) {
    // Track when first update arrived
    if (this.firstUpdateTime === null) {
      this.firstUpdateTime = Date.now();
    }

    // Safety limits - flush if exceeded
    if (updateCount >= this.options.maxUpdates) {
      console.log('UpdateStore: Flushing due to max updates');
      return true;
    }

    if (totalBytes >= this.options.maxBytes) {
      console.log('UpdateStore: Flushing due to max bytes');
      return true;
    }

    // Otherwise wait for idle timer
    return false;
  }

  reset() {
    this.firstUpdateTime = null;
  }
}

/**
 * Immediate flush strategy (for server-based sync)
 * Flushes every update immediately
 */
export class ImmediateFlushStrategy {
  shouldFlush() {
    return true;
  }

  reset() {}
}

/**
 * Count-based flush strategy
 * Flushes after N updates
 */
export class CountFlushStrategy {
  constructor(count = 50) {
    this.maxCount = count;
  }

  shouldFlush({ updateCount }) {
    return updateCount >= this.maxCount;
  }

  reset() {}
}
