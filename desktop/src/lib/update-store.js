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

    // Per-note tracking: Map<noteId, { seen, writeCounter, pendingUpdates, pendingStartSeq }>
    this.noteState = new Map();

    // DEPRECATED - keeping for backwards compatibility but not using
    this.seen = new Map();
    this.writeCounter = 0;
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
   * Get or create state for a note
   * @param {string} noteId - Note ID
   * @returns {object} Note state
   */
  getNoteState(noteId) {
    if (!this.noteState.has(noteId)) {
      this.noteState.set(noteId, {
        seen: new Map(),
        writeCounter: 0,
        pendingUpdates: [],
        pendingStartSeq: null
      });
    }
    return this.noteState.get(noteId);
  }

  /**
   * Initialize the update store for a note
   * Loads our meta file and sets up tracking
   * @param {string} noteId - Note ID
   */
  async initialize(noteId) {
    if (!this.isElectron) return;

    const state = this.getNoteState(noteId);

    try {
      const metaPath = this.getMetaPath(noteId);
      const result = await window.electronAPI.fileSystem.readFile(metaPath);

      if (result.success) {
        const meta = JSON.parse(result.content);
        state.writeCounter = meta.lastWrite || 0;
        state.seen = new Map(Object.entries(meta.seen || {}));
        console.log(`UpdateStore initialized for ${noteId}:`, {
          instanceId: this.instanceId,
          writeCounter: state.writeCounter,
          seen: Object.fromEntries(state.seen)
        });
      } else {
        // First time - initialize empty
        state.writeCounter = 0;
        state.seen = new Map();
        console.log(`UpdateStore: New note ${noteId}, starting fresh`);
      }
    } catch (error) {
      console.error('Error initializing UpdateStore:', error);
      state.writeCounter = 0;
      state.seen = new Map();
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

    const state = this.getNoteState(noteId);

    // Track the sequence number for this update
    if (state.pendingStartSeq === null) {
      state.pendingStartSeq = state.writeCounter + 1;
    }

    state.pendingUpdates.push(update);

    // Check if we should flush based on strategy
    const shouldFlush = this.flushStrategy.shouldFlush({
      updateCount: state.pendingUpdates.length,
      totalBytes: this.getTotalBytes(noteId),
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
   * @param {string} noteId - Note ID
   * @returns {number} Total bytes
   */
  getTotalBytes(noteId) {
    const state = this.getNoteState(noteId);
    return state.pendingUpdates.reduce((sum, update) => sum + update.length, 0);
  }

  /**
   * Flush pending updates to a packed file
   * @param {string} noteId - Note ID
   * @returns {boolean} Success
   */
  async flush(noteId) {
    const state = this.getNoteState(noteId);

    console.log(`[UpdateStore] flush() called for ${noteId}, buffer has ${state.pendingUpdates.length} updates`);

    if (!this.isElectron) {
      console.log('[UpdateStore] Not in Electron mode, skipping flush');
      return false;
    }

    if (state.pendingUpdates.length === 0) {
      console.log('[UpdateStore] No pending updates to flush');
      return false;
    }

    try {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }

      const startSeq = state.pendingStartSeq;
      const endSeq = startSeq + state.pendingUpdates.length - 1;

      console.log(`[UpdateStore] Flushing ${state.pendingUpdates.length} updates (seq ${startSeq}-${endSeq})`);

      // Update our write counter
      state.writeCounter = endSeq;

      // Create packed file
      const packedFile = {
        instance: this.instanceId,
        sequence: [startSeq, endSeq],  // Range [start, end] inclusive
        timestamp: new Date().toISOString(),
        updates: state.pendingUpdates.map(u => this.encodeUpdate(u))
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
      state.seen.set(this.instanceId, state.writeCounter);

      // Write our meta file
      await this.writeMeta(noteId);

      console.log(`UpdateStore: Flushed ${state.pendingUpdates.length} updates as ${this.instanceId}.${startSeq}-${endSeq} for note ${noteId}`);

      // Clear buffer
      state.pendingUpdates = [];
      state.pendingStartSeq = null;
      this.flushStrategy.reset();

      return true;
    } catch (error) {
      console.error('Error flushing updates:', error);
      return false;
    }
  }

  /**
   * Read ALL updates from all instances (ignoring seen state)
   * Used when loading a note from scratch
   * @param {string} noteId - Note ID
   * @returns {Array} Array of {instanceId, sequence, update} objects
   */
  async readAllUpdates(noteId) {
    if (!this.isElectron) return [];

    try {
      const updatesDir = this.getUpdatesDir(noteId);

      // List all update files
      const listResult = await window.electronAPI.fileSystem.readDir(updatesDir);
      if (!listResult.success) {
        // Directory doesn't exist yet
        return [];
      }

      const allUpdates = [];

      for (const filename of listResult.files) {
        if (!filename.endsWith('.yjson')) continue;

        // Parse filename: instance-A.000001-000050.yjson or instance-A.000001.yjson
        const match = filename.match(/^(.+)\.(\d+)(?:-(\d+))?\.yjson$/);
        if (!match) continue;

        const [, instanceId] = match;

        // Read the packed file
        const updatePath = `${updatesDir}/${filename}`;
        const readResult = await window.electronAPI.fileSystem.readFile(updatePath);
        if (!readResult.success) {
          console.error('Failed to read packed update file:', updatePath);
          continue;
        }

        const packedFile = JSON.parse(readResult.content);
        const [fileStartSeq] = packedFile.sequence;

        // Read ALL updates from this file
        for (let i = 0; i < packedFile.updates.length; i++) {
          const seq = fileStartSeq + i;
          const update = this.decodeUpdate(packedFile.updates[i]);
          allUpdates.push({ instanceId, sequence: seq, update });
        }
      }

      // Sort by sequence to apply in order
      allUpdates.sort((a, b) => a.sequence - b.sequence);

      console.log(`UpdateStore: Read ${allUpdates.length} total updates for note ${noteId}`);
      return allUpdates;
    } catch (error) {
      console.error('Error reading all updates:', error);
      return [];
    }
  }

  /**
   * Read all updates we haven't seen yet from all instances
   * Used for incremental sync
   * @param {string} noteId - Note ID
   * @returns {Array} Array of {instanceId, sequence, update} objects
   */
  async readNewUpdates(noteId) {
    if (!this.isElectron) return [];

    const state = this.getNoteState(noteId);

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
        const lastSeen = state.seen.get(instanceId) || 0;
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
          state.seen.set(instanceId, Math.max(lastSeen, seq));
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

    const state = this.getNoteState(noteId);

    try {
      const metaPath = this.getMetaPath(noteId);

      const meta = {
        instanceId: this.instanceId,
        lastWrite: state.writeCounter,
        seen: Object.fromEntries(state.seen),
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
    const state = this.getNoteState(noteId);

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (state.pendingUpdates.length > 0) {
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
