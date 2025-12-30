/**
 * Polling Group
 *
 * Tier 2 of the two-tier sync polling system. Provides persistent, rate-limited
 * polling for notes that didn't sync via the fast path, plus other sources like
 * open notes, recently edited notes, and periodic full repolls.
 *
 * Key features:
 * - Priority-based polling (open notes first, then FIFO)
 * - Rate limiting with hit acceleration (faster when finding data)
 * - Different exit criteria based on why the note was added
 * - Multi-window support for tracking open notes
 */

/**
 * Reason why a note was added to the polling group
 */
export type PollingGroupReason =
  | 'fast-path-handoff' // Fast path timed out, handed off for persistent polling
  | 'open-note' // Note is currently open in editor
  | 'notes-list' // Note is visible in a notes list
  | 'recent-edit' // Note was recently edited
  | 'full-repoll'; // Added during periodic full repoll

/**
 * Priority level for polling
 */
export type PollingPriority = 'high' | 'normal';

/**
 * Entry in the polling group
 */
export interface PollingGroupEntry {
  noteId: string;
  sdId: string;
  /** Expected sequences per source instance (for fast-path-handoff) */
  expectedSequences: Map<string, number>;
  /** Sequences that have been caught up */
  caughtUpSequences?: Set<string>;
  addedAt: number;
  lastPolledAt: number;
  reason: PollingGroupReason;
  priority: PollingPriority;
  /** Whether this entry has been polled at least once (for full-repoll exit) */
  hasBeenPolled: boolean;
}

/**
 * Serializable entry for IPC transport (Maps/Sets converted to plain objects/arrays)
 */
export interface PollingGroupEntrySerialized {
  noteId: string;
  sdId: string;
  /** Expected sequences as object {instanceId: sequence} */
  expectedSequences: Record<string, number>;
  /** Instance IDs that have caught up */
  caughtUpSequences: string[];
  addedAt: number;
  lastPolledAt: number;
  reason: PollingGroupReason;
  priority: PollingPriority;
  hasBeenPolled: boolean;
}

/**
 * Settings for the polling group
 */
export interface PollingGroupSettings {
  /** Base polling rate for misses (default 120/min) */
  pollRatePerMinute: number;
  /** Multiplier for hits - lower = faster (default 0.25, so hits are 4x faster) */
  hitRateMultiplier: number;
  /** Maximum polls per second even with many hits (default 10) */
  maxBurstPerSecond: number;
  /** Reserve capacity for normal priority (default 0.2 = 20%) */
  normalPriorityReserve: number;
  /** Time window for recent edits in ms (default 5 min) */
  recentEditWindowMs: number;
  /** Interval for full repoll in ms (default 30 min, 0 = disabled) */
  fullRepollIntervalMs: number;
  /** Max delay for fast path before handoff in ms (default 60s) */
  fastPathMaxDelayMs: number;
}

/**
 * Default settings values
 */
export const DEFAULT_POLLING_GROUP_SETTINGS: PollingGroupSettings = {
  pollRatePerMinute: 120,
  hitRateMultiplier: 0.25,
  maxBurstPerSecond: 10,
  normalPriorityReserve: 0.2,
  recentEditWindowMs: 5 * 60 * 1000, // 5 minutes
  fullRepollIntervalMs: 30 * 60 * 1000, // 30 minutes
  fastPathMaxDelayMs: 60 * 1000, // 60 seconds
};

/**
 * Per-SD settings overrides (all fields optional)
 */
export type PollingGroupSettingsOverride = Partial<PollingGroupSettings>;

/**
 * Settings stored in app state (uses minutes/seconds instead of ms for readability)
 */
export interface PollingGroupStoredSettings {
  pollRatePerMinute?: number;
  hitRateMultiplier?: number;
  maxBurstPerSecond?: number;
  normalPriorityReserve?: number;
  recentEditWindowMinutes?: number;
  fullRepollIntervalMinutes?: number;
  fastPathMaxDelaySeconds?: number;
}

/**
 * Convert stored settings (minutes/seconds) to runtime settings (milliseconds)
 */
export function storedToRuntimeSettings(
  stored: PollingGroupStoredSettings
): Partial<PollingGroupSettings> {
  const result: Partial<PollingGroupSettings> = {};

  if (stored.pollRatePerMinute !== undefined) {
    result.pollRatePerMinute = stored.pollRatePerMinute;
  }
  if (stored.hitRateMultiplier !== undefined) {
    result.hitRateMultiplier = stored.hitRateMultiplier;
  }
  if (stored.maxBurstPerSecond !== undefined) {
    result.maxBurstPerSecond = stored.maxBurstPerSecond;
  }
  if (stored.normalPriorityReserve !== undefined) {
    result.normalPriorityReserve = stored.normalPriorityReserve;
  }
  if (stored.recentEditWindowMinutes !== undefined) {
    result.recentEditWindowMs = stored.recentEditWindowMinutes * 60 * 1000;
  }
  if (stored.fullRepollIntervalMinutes !== undefined) {
    result.fullRepollIntervalMs = stored.fullRepollIntervalMinutes * 60 * 1000;
  }
  if (stored.fastPathMaxDelaySeconds !== undefined) {
    result.fastPathMaxDelayMs = stored.fastPathMaxDelaySeconds * 1000;
  }

  return result;
}

/**
 * Merge settings with defaults, applying overrides
 */
export function mergePollingSettings(
  base: Partial<PollingGroupSettings>,
  override?: Partial<PollingGroupSettings>
): PollingGroupSettings {
  return {
    ...DEFAULT_POLLING_GROUP_SETTINGS,
    ...base,
    ...override,
  };
}

/**
 * Input for adding an entry (subset of full entry)
 */
export interface PollingGroupAddInput {
  noteId: string;
  sdId: string;
  expectedSequences: Map<string, number>;
  reason: PollingGroupReason;
}

/**
 * Status returned by getStatus() - uses serializable entries for IPC transport
 */
export interface PollingGroupStatus {
  totalEntries: number;
  highPriorityCount: number;
  normalPriorityCount: number;
  entries: PollingGroupEntrySerialized[];
  currentRatePerMinute: number;
  recentHits: number;
  recentMisses: number;
  /** Time until next full repoll in ms, or null if disabled */
  nextFullRepollIn: number | null;
}

/**
 * Generate a unique key for a note/SD combination
 */
function entryKey(noteId: string, sdId: string): string {
  return `${sdId}:${noteId}`;
}

/**
 * Determine priority based on reason
 */
function priorityForReason(reason: PollingGroupReason): PollingPriority {
  switch (reason) {
    case 'open-note':
    case 'notes-list':
    case 'recent-edit':
      return 'high';
    case 'fast-path-handoff':
    case 'full-repoll':
      return 'normal';
  }
}

/**
 * Polling Group - manages Tier 2 persistent polling
 */
export class PollingGroup {
  private entries = new Map<string, PollingGroupEntry>();
  private settings: PollingGroupSettings;

  // Track open notes per SD (union of all windows)
  private openNotes = new Map<string, Set<string>>(); // sdId -> Set<noteId>
  private notesInLists = new Map<string, Set<string>>(); // sdId -> Set<noteId>

  // Track open notes per window for multi-window support
  private openNotesPerWindow = new Map<string, Map<string, Set<string>>>(); // windowId -> (sdId -> Set<noteId>)
  private notesInListsPerWindow = new Map<string, Map<string, Set<string>>>(); // windowId -> (sdId -> Set<noteId>)

  // Rate limiting state
  private recentPolls: { timestamp: number; wasHit: boolean }[] = [];
  private readonly RATE_WINDOW_MS = 60000; // 1 minute window for rate calculation

  // FIFO queue for ordering within priority levels
  private highPriorityQueue: string[] = []; // entry keys
  private normalPriorityQueue: string[] = []; // entry keys

  constructor(settings: PollingGroupSettings) {
    this.settings = settings;
  }

  /**
   * Update settings (e.g., when user changes preferences)
   */
  updateSettings(settings: Partial<PollingGroupSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): Readonly<PollingGroupSettings> {
    return this.settings;
  }

  /**
   * Add a note to the polling group
   */
  add(input: PollingGroupAddInput): void {
    const key = entryKey(input.noteId, input.sdId);
    const existing = this.entries.get(key);

    if (existing) {
      // Merge expected sequences (keep highest)
      for (const [instanceId, seq] of input.expectedSequences) {
        const existingSeq = existing.expectedSequences.get(instanceId) ?? 0;
        if (seq > existingSeq) {
          existing.expectedSequences.set(instanceId, seq);
        }
      }
      // Update reason if new reason has higher priority
      if (priorityForReason(input.reason) === 'high' && existing.priority === 'normal') {
        existing.reason = input.reason;
        existing.priority = 'high';
        // Move to high priority queue
        this.normalPriorityQueue = this.normalPriorityQueue.filter((k) => k !== key);
        if (!this.highPriorityQueue.includes(key)) {
          this.highPriorityQueue.push(key);
        }
      }
      return;
    }

    const now = Date.now();
    const priority = this.calculatePriority(input.noteId, input.sdId, input.reason);

    const entry: PollingGroupEntry = {
      noteId: input.noteId,
      sdId: input.sdId,
      expectedSequences: new Map(input.expectedSequences),
      caughtUpSequences: new Set(),
      addedAt: now,
      lastPolledAt: 0,
      reason: input.reason,
      priority,
      hasBeenPolled: false,
    };

    this.entries.set(key, entry);

    // Add to appropriate queue
    if (priority === 'high') {
      this.highPriorityQueue.push(key);
    } else {
      this.normalPriorityQueue.push(key);
    }
  }

  /**
   * Remove a note from the polling group
   */
  remove(noteId: string, sdId: string): void {
    const key = entryKey(noteId, sdId);
    this.entries.delete(key);
    this.highPriorityQueue = this.highPriorityQueue.filter((k) => k !== key);
    this.normalPriorityQueue = this.normalPriorityQueue.filter((k) => k !== key);
  }

  /**
   * Get an entry by noteId and sdId
   */
  getEntry(noteId: string, sdId: string): PollingGroupEntry | undefined {
    return this.entries.get(entryKey(noteId, sdId));
  }

  /**
   * Calculate priority based on reason and current state
   */
  private calculatePriority(
    noteId: string,
    sdId: string,
    reason: PollingGroupReason
  ): PollingPriority {
    // Check if note is open or in lists
    if (this.openNotes.get(sdId)?.has(noteId)) {
      return 'high';
    }
    if (this.notesInLists.get(sdId)?.has(noteId)) {
      return 'high';
    }
    return priorityForReason(reason);
  }

  /**
   * Get the next batch of notes to poll, respecting rate limits and priorities
   */
  getNextBatch(maxCount: number): PollingGroupEntry[] {
    // Calculate available capacity based on rate limit and recent activity
    const availableCapacity = this.calculateAvailableCapacity();
    const batchSize = Math.min(maxCount, availableCapacity);

    if (batchSize <= 0) {
      return [];
    }

    const result: PollingGroupEntry[] = [];

    // Calculate how many of each priority we have
    const highAvailable = this.highPriorityQueue.length;
    const normalAvailable = this.normalPriorityQueue.length;

    // Reserve capacity for normal priority, but only if there are normal items
    // and only take reserve from what's available
    let highCapacity: number;

    if (normalAvailable === 0) {
      // No normal priority items - all capacity goes to high
      highCapacity = batchSize;
    } else if (highAvailable === 0) {
      // No high priority items - all capacity goes to normal
      highCapacity = 0;
    } else {
      // Both available - use reserve calculation
      // High priority gets first pick, then reserve kicks in
      // Reserve only applies when high priority could use more than (1-reserve) of capacity
      const reserveRatio = this.settings.normalPriorityReserve;
      const maxHighCapacity = Math.ceil(batchSize * (1 - reserveRatio));

      if (highAvailable >= maxHighCapacity) {
        // High priority can fill its allocation - apply reserve
        highCapacity = maxHighCapacity;
      } else {
        // High priority can't fill its allocation - give it all it needs
        highCapacity = Math.min(highAvailable, batchSize);
      }
    }

    // First, fill high priority slots
    let highCount = 0;
    const highToRemove: number[] = [];
    for (let i = 0; i < this.highPriorityQueue.length && highCount < highCapacity; i++) {
      const key = this.highPriorityQueue[i];
      const entry = key ? this.entries.get(key) : undefined;
      if (entry) {
        result.push(entry);
        highCount++;
        highToRemove.push(i);
      }
    }

    // Move polled entries to end of queue (FIFO)
    for (let i = highToRemove.length - 1; i >= 0; i--) {
      const idx = highToRemove[i];
      if (idx !== undefined) {
        const [removed] = this.highPriorityQueue.splice(idx, 1);
        if (removed) {
          this.highPriorityQueue.push(removed);
        }
      }
    }

    // Then fill normal priority slots (use remaining capacity + reserve)
    const normalCapacity = batchSize - result.length;
    let normalCount = 0;
    const normalToRemove: number[] = [];
    for (let i = 0; i < this.normalPriorityQueue.length && normalCount < normalCapacity; i++) {
      const key = this.normalPriorityQueue[i];
      const entry = key ? this.entries.get(key) : undefined;
      if (entry) {
        result.push(entry);
        normalCount++;
        normalToRemove.push(i);
      }
    }

    // Move polled entries to end of queue (FIFO)
    for (let i = normalToRemove.length - 1; i >= 0; i--) {
      const idx = normalToRemove[i];
      if (idx !== undefined) {
        const [removed] = this.normalPriorityQueue.splice(idx, 1);
        if (removed) {
          this.normalPriorityQueue.push(removed);
        }
      }
    }

    return result;
  }

  /**
   * Calculate available polling capacity based on rate limit and recent hits
   */
  private calculateAvailableCapacity(): number {
    // Clean up old polls
    const now = Date.now();
    this.recentPolls = this.recentPolls.filter((p) => now - p.timestamp < this.RATE_WINDOW_MS);

    // Calculate effective rate based on hits
    let effectivePolls = 0;
    for (const poll of this.recentPolls) {
      if (poll.wasHit) {
        effectivePolls += this.settings.hitRateMultiplier;
      } else {
        effectivePolls += 1;
      }
    }

    // Calculate remaining capacity
    const remaining = this.settings.pollRatePerMinute - effectivePolls;

    // Apply burst cap (convert to per-call basis)
    return Math.min(Math.max(0, Math.floor(remaining)), this.settings.maxBurstPerSecond);
  }

  /**
   * Mark a note as polled
   */
  markPolled(noteId: string, sdId: string, wasHit: boolean): void {
    const key = entryKey(noteId, sdId);
    const entry = this.entries.get(key);

    if (entry) {
      entry.lastPolledAt = Date.now();
      entry.hasBeenPolled = true;
    }

    // Track for rate limiting
    this.recentPolls.push({
      timestamp: Date.now(),
      wasHit,
    });
  }

  /**
   * Update the actual sequence we received for an instance.
   * If the actual sequence >= expected, marks the instance as caught up.
   *
   * @param noteId Note ID
   * @param sdId Storage directory ID
   * @param instanceId Source instance ID
   * @param actualSequence The sequence we actually received from CRDT log
   */
  updateSequence(noteId: string, sdId: string, instanceId: string, actualSequence: number): void {
    const entry = this.entries.get(entryKey(noteId, sdId));
    if (entry) {
      const expectedSeq = entry.expectedSequences.get(instanceId);
      if (expectedSeq !== undefined && actualSequence >= expectedSeq) {
        // Mark as caught up
        if (!entry.caughtUpSequences) {
          entry.caughtUpSequences = new Set();
        }
        entry.caughtUpSequences.add(instanceId);
      }
    }
  }

  /**
   * Add or update expected sequence for an instance
   */
  addExpectedSequence(noteId: string, sdId: string, instanceId: string, sequence: number): void {
    const entry = this.entries.get(entryKey(noteId, sdId));
    if (entry) {
      const existing = entry.expectedSequences.get(instanceId) ?? 0;
      if (sequence > existing) {
        entry.expectedSequences.set(instanceId, sequence);
      }
    }
  }

  /**
   * Mark a sequence as caught up (CRDT log has expected sequence)
   */
  markSequenceCaughtUp(noteId: string, sdId: string, instanceId: string): void {
    const entry = this.entries.get(entryKey(noteId, sdId));
    if (entry) {
      if (!entry.caughtUpSequences) {
        entry.caughtUpSequences = new Set();
      }
      entry.caughtUpSequences.add(instanceId);
    }
  }

  /**
   * Check if a note should exit the polling group based on its reason
   */
  checkExitCriteria(noteId: string, sdId: string): boolean {
    const entry = this.entries.get(entryKey(noteId, sdId));
    if (!entry) {
      return true; // Not in group, consider "exited"
    }

    switch (entry.reason) {
      case 'fast-path-handoff': {
        // Exit when all expected sequences are caught up
        if (entry.expectedSequences.size === 0) {
          return true;
        }
        for (const instanceId of entry.expectedSequences.keys()) {
          if (!entry.caughtUpSequences?.has(instanceId)) {
            return false;
          }
        }
        return true;
      }

      case 'full-repoll': {
        // Exit after one poll
        return entry.hasBeenPolled;
      }

      case 'open-note': {
        // Exit when note is no longer open
        return !this.openNotes.get(sdId)?.has(noteId);
      }

      case 'notes-list': {
        // Exit when note is no longer in any list
        return !this.notesInLists.get(sdId)?.has(noteId);
      }

      case 'recent-edit': {
        // Exit when outside the recent edit window
        const elapsed = Date.now() - entry.addedAt;
        return elapsed > this.settings.recentEditWindowMs;
      }
    }
  }

  /**
   * Set open notes for an SD (union of all windows)
   */
  setOpenNotes(sdId: string, noteIds: Set<string>): void {
    this.openNotes.set(sdId, noteIds);
    this.updatePriorities(sdId);
  }

  /**
   * Set notes in lists for an SD (union of all windows)
   */
  setNotesInLists(sdId: string, noteIds: Set<string>): void {
    this.notesInLists.set(sdId, noteIds);
    this.updatePriorities(sdId);
  }

  /**
   * Set open notes for a specific window
   */
  setOpenNotesForWindow(windowId: string, sdId: string, noteIds: Set<string>): void {
    if (!this.openNotesPerWindow.has(windowId)) {
      this.openNotesPerWindow.set(windowId, new Map());
    }
    this.openNotesPerWindow.get(windowId)!.set(sdId, noteIds);
    this.rebuildOpenNotesUnion(sdId);
  }

  /**
   * Set notes in lists for a specific window
   */
  setNotesInListsForWindow(windowId: string, sdId: string, noteIds: Set<string>): void {
    if (!this.notesInListsPerWindow.has(windowId)) {
      this.notesInListsPerWindow.set(windowId, new Map());
    }
    this.notesInListsPerWindow.get(windowId)!.set(sdId, noteIds);
    this.rebuildNotesInListsUnion(sdId);
  }

  /**
   * Remove a window (when it closes)
   */
  removeWindow(windowId: string): void {
    const openNotesForWindow = this.openNotesPerWindow.get(windowId);
    const notesInListsForWindow = this.notesInListsPerWindow.get(windowId);

    // Track affected SDs
    const affectedSdIds = new Set<string>();

    if (openNotesForWindow) {
      for (const sdId of openNotesForWindow.keys()) {
        affectedSdIds.add(sdId);
      }
    }

    if (notesInListsForWindow) {
      for (const sdId of notesInListsForWindow.keys()) {
        affectedSdIds.add(sdId);
      }
    }

    // Remove window
    this.openNotesPerWindow.delete(windowId);
    this.notesInListsPerWindow.delete(windowId);

    // Rebuild unions for affected SDs
    for (const sdId of affectedSdIds) {
      this.rebuildOpenNotesUnion(sdId);
      this.rebuildNotesInListsUnion(sdId);
    }
  }

  /**
   * Rebuild the open notes union for an SD from all windows
   */
  private rebuildOpenNotesUnion(sdId: string): void {
    const union = new Set<string>();

    for (const windowNotes of this.openNotesPerWindow.values()) {
      const notesForSd = windowNotes.get(sdId);
      if (notesForSd) {
        for (const noteId of notesForSd) {
          union.add(noteId);
        }
      }
    }

    this.openNotes.set(sdId, union);
    this.updatePriorities(sdId);
  }

  /**
   * Rebuild the notes-in-lists union for an SD from all windows
   */
  private rebuildNotesInListsUnion(sdId: string): void {
    const union = new Set<string>();

    for (const windowNotes of this.notesInListsPerWindow.values()) {
      const notesForSd = windowNotes.get(sdId);
      if (notesForSd) {
        for (const noteId of notesForSd) {
          union.add(noteId);
        }
      }
    }

    this.notesInLists.set(sdId, union);
    this.updatePriorities(sdId);
  }

  /**
   * Update priorities for entries in an SD based on open notes / notes-in-lists
   */
  private updatePriorities(sdId: string): void {
    const openNotesForSd = this.openNotes.get(sdId) ?? new Set();
    const notesInListsForSd = this.notesInLists.get(sdId) ?? new Set();

    for (const [key, entry] of this.entries) {
      if (entry.sdId !== sdId) continue;

      const shouldBeHigh = openNotesForSd.has(entry.noteId) || notesInListsForSd.has(entry.noteId);

      if (shouldBeHigh && entry.priority === 'normal') {
        // Upgrade to high priority
        entry.priority = 'high';
        this.normalPriorityQueue = this.normalPriorityQueue.filter((k) => k !== key);
        if (!this.highPriorityQueue.includes(key)) {
          this.highPriorityQueue.push(key);
        }
      } else if (!shouldBeHigh && entry.priority === 'high') {
        // Downgrade to normal priority (unless reason dictates high)
        const reasonPriority = priorityForReason(entry.reason);
        if (reasonPriority === 'normal') {
          entry.priority = 'normal';
          this.highPriorityQueue = this.highPriorityQueue.filter((k) => k !== key);
          if (!this.normalPriorityQueue.includes(key)) {
            this.normalPriorityQueue.push(key);
          }
        }
      }
    }
  }

  /**
   * Get status for UI display (with serializable entries for IPC transport)
   */
  getStatus(nextFullRepollIn: number | null = null): PollingGroupStatus {
    const entries = Array.from(this.entries.values());
    const highPriorityCount = entries.filter((e) => e.priority === 'high').length;
    const normalPriorityCount = entries.filter((e) => e.priority === 'normal').length;

    // Calculate current effective rate
    const now = Date.now();
    const recentPollsInWindow = this.recentPolls.filter(
      (p) => now - p.timestamp < this.RATE_WINDOW_MS
    );
    const recentHits = recentPollsInWindow.filter((p) => p.wasHit).length;
    const recentMisses = recentPollsInWindow.filter((p) => !p.wasHit).length;

    // Calculate effective rate (accounting for hit multiplier)
    let effectivePolls = 0;
    for (const poll of recentPollsInWindow) {
      effectivePolls += poll.wasHit ? this.settings.hitRateMultiplier : 1;
    }

    // Convert entries to serializable form
    const serializedEntries: PollingGroupEntrySerialized[] = entries.map((entry) => ({
      noteId: entry.noteId,
      sdId: entry.sdId,
      expectedSequences: Object.fromEntries(entry.expectedSequences),
      caughtUpSequences: entry.caughtUpSequences ? Array.from(entry.caughtUpSequences) : [],
      addedAt: entry.addedAt,
      lastPolledAt: entry.lastPolledAt,
      reason: entry.reason,
      priority: entry.priority,
      hasBeenPolled: entry.hasBeenPolled,
    }));

    return {
      totalEntries: entries.length,
      highPriorityCount,
      normalPriorityCount,
      entries: serializedEntries,
      currentRatePerMinute: effectivePolls,
      recentHits,
      recentMisses,
      nextFullRepollIn,
    };
  }

  /**
   * Clear all entries (for testing or reset)
   */
  clear(): void {
    this.entries.clear();
    this.highPriorityQueue = [];
    this.normalPriorityQueue = [];
    this.recentPolls = [];
    this.openNotes.clear();
    this.notesInLists.clear();
    this.openNotesPerWindow.clear();
    this.notesInListsPerWindow.clear();
  }
}
