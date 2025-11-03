## Phase 4: Advanced Features (Post-MVP)

### 4.1 Tags System 🟡

**Status:** Partially Complete (Paused - bugs to fix)

**Detailed TODO:** See [TODO-TAGS.md](./TODO-TAGS.md) for implementation details, code examples, and resume checklist.

**Tasks:**

- [x] ✅ Implement tag parsing from note content
  - `#tagname` syntax
  - Case-insensitive (normalized to lowercase)
  - No spaces
  - Theme-dependent color (blue accent)
  - Max length: 50 characters
  - Pattern: Must start with letter, followed by letters/numbers/underscores
- [x] ✅ Implement tag index updates
  - Real-time as notes are edited (via IPC handlers)
  - External file sync (via ActivitySync from Dropbox/iCloud)
  - Update SQLite tags table
  - N+1 query problem fixed (batch processing)
- [ ] 🟥 Implement tag autocomplete in editor
  - Show existing tags as user types `#`
  - Insert selected tag
  - **TODO-TAGS.md has detailed implementation notes**
- [ ] 🟥 Implement tag panel component (does not currently exist)
  - Display all tags with counts
  - Clickable to filter notes
  - Full tri-state filtering
  - Tag count badges

**Acceptance Criteria:**

- ✅ Tags are recognized in notes (parsing & rendering)
- ✅ Tags are indexed in database (real-time + external sync)
- ✅ Tag styling persists across app restarts
- ✅ Multiple tags per note work correctly
- ❌ Autocomplete works (show existing tags when typing `#`)
- ❌ Tag filtering works correctly (requires tag panel implementation)

---

### 4.1bis CRDT Snapshot and Packing System 🟥

**Status:** To Do (Performance Optimization)

**Detailed Architecture:** See [docs/architecture/crdt-snapshot-packing.md](./docs/architecture/crdt-snapshot-packing.md)

**Problem:**
- Brief documents reach thousands of CRDT update files
- Cold load takes 3-5 seconds (thousands of file reads + Y.applyUpdate() calls)
- Cloud sync struggles with thousands of tiny files
- Disk space grows unbounded

**Solution:**
Hybrid three-tier system:
1. **Snapshots:** Full document state + vector clock (every ~1000 updates)
2. **Packs:** Batches of 50-100 updates per instance
3. **Recent:** Last 50 unpacked updates for fast sync

**Implementation Phases:**

#### Phase 1: Snapshots (Foundational) 🟥

**Tasks:**
- [ ] 🟥 Design snapshot format
  - Filename: `snapshot_<total-changes>_<instance-id>.yjson`
  - Contents: document state + vector clock (maxSequences)
  - Selection algorithm: Pick highest total-changes
- [ ] 🟥 Implement snapshot creation
  - Trigger: On document close if ≥100 updates since last snapshot
  - Build vector clock from all update files
  - Serialize full document state via Y.encodeStateAsUpdate()
  - Write to `notes/<note-id>/snapshots/` directory
- [ ] 🟥 Implement snapshot loading
  - Scan snapshots/, select newest by total-changes
  - Apply snapshot.documentState to Y.Doc
  - Use snapshot.maxSequences to filter update files
  - Apply only updates with seq > maxSequences[instance-id]
- [ ] 🟥 Add sequence numbers to update filenames
  - New format: `<instance-id>_<timestamp>-<seq>.yjson`
  - Maintain per-instance, per-document sequence counter
  - Parse from existing filenames on startup (self-healing)
- [ ] 🟥 Update file format parsers
  - Handle both old (timestamp-random) and new (timestamp-seq) formats
  - Update `parseUpdateFilename()` in update-format.ts
  - Update `generateUpdateFilename()` to include sequence
- [ ] 🟥 Add error handling
  - Corrupted snapshot: Try next-newest, fallback to updates
  - Missing updates: Handle sequence gaps gracefully
  - Filesystem errors: Retry with exponential backoff
- [ ] 🟥 Write unit tests
  - Snapshot creation and loading
  - Vector clock arithmetic
  - Filename parsing (both formats)
  - Sequence number management
- [ ] 🟥 Write integration tests
  - Cold load with snapshot + updates
  - Multi-instance snapshot selection
  - Corruption recovery
- [ ] 🟥 Performance benchmarks
  - Measure cold load time before/after
  - Verify 80-90% reduction (3-5s → 100-250ms)

**Acceptance Criteria:**
- Cold load time reduced by 80-90%
- All update files after snapshot are applied correctly
- No data loss in any scenario
- Multi-instance safe (deterministic snapshot selection)
- All tests pass

---

#### Phase 2: Packing (File Count Reduction) 🟥

**Tasks:**
- [ ] 🟥 Design pack format
  - Filename: `<instance-id>_pack_<start-seq>-<end-seq>.yjson`
  - Contents: Array of {seq, timestamp, data} entries
  - Pack size: 50-100 updates per pack
- [ ] 🟥 Implement pack creation
  - Background job runs every 5 minutes
  - Group updates by instance-id
  - Verify contiguous sequences (no gaps)
  - Pack updates older than 5 minutes
  - Keep last 50 updates unpacked
- [ ] 🟥 Implement pack loading
  - Scan packs/ directory during cold load
  - Filter by vector clock (skip if fully incorporated)
  - Apply updates in sequence order
- [ ] 🟥 Atomic pack operations
  - Write pack file first
  - Then delete original update files
  - Handle crashes mid-operation (duplicates OK)
- [ ] 🟥 Handle sequence gaps
  - Only pack up to first gap
  - Leave updates after gap unpacked
  - Timeout: After 24h, treat gap as permanent
- [ ] 🟥 Add file locks for concurrency
  - Each instance only packs its own updates (instance-id)
  - No coordination needed between instances
- [ ] 🟥 Write unit tests
  - Pack creation and loading
  - Gap handling
  - Atomic operations
- [ ] 🟥 Write integration tests
  - Background packing job
  - Cold load with packs + updates
  - Concurrent packing (multiple instances)
- [ ] 🟥 Performance benchmarks
  - Measure file count before/after
  - Verify 90-95% reduction (2000 files → 50-100 files)

**Acceptance Criteria:**
- File count reduced by 90-95%
- Cold load still fast (no regression)
- Packs load correctly during cold start
- All tests pass
- Cloud sync faster (fewer files)

---

#### Phase 3: Garbage Collection (Disk Space) 🟥

**Tasks:**
- [ ] 🟥 Implement snapshot GC
  - Keep last 2-3 snapshots by total-changes
  - Delete older snapshots
  - Run every 30 minutes
- [ ] 🟥 Implement pack/update GC
  - Find oldest kept snapshot's maxSequences
  - Delete packs fully incorporated (pack.endSeq ≤ maxSequences[instance])
  - Delete updates fully incorporated (update.seq ≤ maxSequences[instance])
  - Keep minimum 24h history regardless (configurable)
- [ ] 🟥 Add GC configuration
  - Snapshot retention count (default: 2-3)
  - Minimum history duration (default: 24h)
  - GC frequency (default: 30min)
- [ ] 🟥 Add GC metrics/logging
  - Log deleted file counts
  - Log disk space freed
  - Track GC duration
- [ ] 🟥 Write unit tests
  - GC selection logic
  - Retention policy enforcement
- [ ] 🟥 Write integration tests
  - Full GC cycle (snapshots + packs + updates)
  - Verify correct files deleted
  - Verify minimum history preserved
- [ ] 🟥 Long-running test
  - Simulate 7 days of editing
  - Verify disk usage stable (doesn't grow unbounded)

**Acceptance Criteria:**
- Disk usage stable over time
- Old snapshots/packs/updates properly deleted
- Minimum history retained (configurable)
- GC runs reliably in background
- All tests pass

---

#### Phase 4: Optimizations and Monitoring 🟥

**Tasks:**
- [ ] 🟥 Add telemetry
  - Cold load time (P50, P95, P99)
  - File count per note (histogram)
  - Snapshot creation time
  - Pack creation time
  - GC deleted file count
- [ ] 🟥 Add observability
  - Log snapshot creation (totalChanges, size, duration)
  - Log snapshot selection (which snapshot chosen, why)
  - Log pack creation (instance, seq range, file count)
  - Log GC activity (deleted files, space freed)
  - Structured logging (JSON, easily parseable)
- [ ] 🟥 Optimize snapshot triggers
  - Adaptive frequency based on edit rate
  - Snapshot on document close if ≥N updates
  - Background snapshot job for idle documents
- [ ] 🟥 Handle edge cases
  - Corrupted snapshot recovery
  - Filesystem errors (Google Drive sync issues)
  - Sequence gaps (crashes, conflicts)
  - Concurrent operations (multiple instances)
- [ ] 🟥 Add compression (optional)
  - gzip or brotli for snapshots/packs
  - Reduces file size 50-80%
  - Tradeoff: CPU cost vs. I/O savings
- [ ] 🟥 Performance testing
  - Benchmark with 10K, 50K, 100K updates
  - Test with slow filesystem (simulate Google Drive)
  - Test with multiple concurrent instances
- [ ] 🟥 Documentation
  - Update architecture docs
  - Add troubleshooting guide
  - Document configuration options

**Acceptance Criteria:**
- Metrics available for monitoring
- Edge cases handled gracefully
- Performance validated at scale
- Documentation complete

---

**Overall Expected Improvements:**

| Metric | Before | After Phase 1 | After Phase 3 |
|--------|--------|---------------|---------------|
| Cold load time | 3-5 seconds | 100-250ms | 100-200ms |
| File count (brief doc) | 2,000 files | ~100 files | ~65 files |
| Disk usage growth | Unbounded | Unbounded | Bounded (GC) |
| Cloud sync time | Slow (many files) | Improved | Fast (few files) |

**Links:**
- **Architecture:** [docs/architecture/crdt-snapshot-packing.md](./docs/architecture/crdt-snapshot-packing.md)
- **Related:** Phase 2.7 (CRDT sync), Phase 3 (Multi-instance sync)

---

### 4.2 Inter-Note Links 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement inter-note link syntax: `[[title]]`
  - Theme-dependent color (different from tags, complementary to blue)
  - Store as note IDs internally
  - Display as titles (computed on render)
- [ ] 🟥 Implement link autocomplete
  - Trigger on `[[`
  - Show notes matching typed text (substring)
  - Show duplicates with differentiators (SD, folder, date)
  - Insert link as `[[note-id]]` with display title
- [ ] 🟥 Implement link click behavior
  - Single click: navigate to note in editor
  - Double click: open note in new window
- [ ] 🟥 Implement broken link handling
  - If target note deleted: show as invalid (strikethrough, red)
  - Don't remove link (allows restoration)
- [ ] 🟥 Implement link updating
  - When target note title changes, update display automatically
  - Links stored as IDs, so no actual update needed in content

**Acceptance Criteria:**

- Can create inter-note links
- Autocomplete works
- Links navigate correctly
- Broken links show as invalid

---

### 4.3 Advanced Search 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Enhance search with advanced dialog
  - Full text search (already working)
  - Filter by: date range, folder, SD, tags, has-todos, etc.
  - Boolean operators (AND, OR, NOT)
  - Saved searches
- [ ] 🟥 Implement search result highlighting
  - Highlight matching text in note list previews
  - Highlight in editor when opened from search

**Acceptance Criteria:**

- Advanced search dialog works
- Can save searches
- Results are accurate

---

### 4.4 Export as Markdown 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement note export
  - Right-click menu: Export as Markdown
  - File menu: Export
  - Convert TipTap content to markdown
  - Convert `[[note-id]]` links to relative file links
- [ ] 🟥 Implement folder export
  - Right-click menu on folder: Export as Markdown
  - Creates folder structure on disk (using file chooser)
  - One .md file per note
  - Preserve folder hierarchy
  - Handle duplicate titles (suffix with `-1`, `-2`, etc.)
- [ ] 🟥 Implement SD export
  - Settings or File menu: Export SD
  - Same as folder export but for entire SD
- [ ] 🟥 Implement filename mangling
  - Replace invalid filesystem characters with `_`
  - Remove emojis and non-keyboard-typable characters
  - Ensure filenames are valid on all platforms

**Acceptance Criteria:**

- Can export notes, folders, SDs
- Markdown is correct
- Links are converted correctly
- Folder structure preserved

---

### 4.5 Tri-State Checkboxes 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement tri-state checkbox in TipTap
  - Markdown: `- [ ]` (todo), `- [x]` (done), `- [N]` (NOPE)
  - Visual: empty checkbox, checked checkbox, red checkbox with "N"
  - Interaction: click to cycle through states
  - Works in bullet and numbered lists
- [ ] 🟥 Store checkbox state in CRDT
- [ ] 🟥 Index todos in SQLite for querying

**Acceptance Criteria:**

- Checkboxes render correctly
- Can cycle through states
- State syncs across instances

---

### 4.6 Color Highlight & Text Color 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Add TipTap extensions:
  - TextStyle
  - Color (text color)
  - Highlight (background color)
- [ ] 🟥 Add toolbar controls for color selection

**Acceptance Criteria:**

- Can change text color
- Can highlight text
- Colors persist in CRDT

---

### 4.7 Additional TipTap Extensions 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Add TipTap extensions (verify Yjs compatibility):
  - Table
  - Image (with alignment)
  - TaskList (integrate with tri-state checkboxes)
  - Mention (for @username)
  - Copy to clipboard
  - Emoji dropdown
  - Reset formatting
- [ ] 🟥 Add to toolbar

**Acceptance Criteria:**

- All extensions work
- Compatible with Yjs

---

### 4.8 IPC API (Read-Only) 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Design IPC API protocol
  - Commands: query notes, get note content, search, list folders
  - Response format: JSON
- [ ] 🟥 Implement API in main process
  - Accept connections via IPC (Electron's IPC mechanism)
  - Execute queries against SQLite cache + CRDT files
  - Return results
- [ ] 🟥 Implement CLI tool
  - `notecove query <query>` - runs query, outputs results
  - `notecove search <term>` - searches notes
  - Connects to running app via IPC
  - Falls back to error if app not running
- [ ] 🟥 Document API

**Acceptance Criteria:**

- API is accessible via IPC
- CLI tool works
- Can query notes programmatically

---

### 4.9 Due Dates & @mentions for Tasks 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement due date syntax: `@due(2025-12-31)`
  - Parse and extract due dates
  - Store in SQLite
  - Visual indicator in editor
- [ ] 🟥 Implement @mention for task assignment
  - Same as mention handle
  - Links task to user
- [ ] 🟥 Add due date filtering/querying

**Acceptance Criteria:**

- Can add due dates to tasks
- Can assign tasks with @mentions
- Can query tasks by due date

---

### 4.10 Apple Shortcuts Integration 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement Intents framework on iOS
  - Intent: Create Note
  - Intent: Add to Note
  - Intent: Search Notes
  - Intent: Get Note Content
- [ ] 🟥 Implement AppleScript support on macOS
  - Same capabilities as iOS Shortcuts
- [ ] 🟥 Document automation capabilities

**Acceptance Criteria:**

- Shortcuts can create/search notes
- AppleScript works on macOS

---

### 4.11 IPC API (Write Operations) 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Extend IPC API to support writes
  - Commands: create note, update note, delete note, move note
  - Ensure proper CRDT update generation
  - Update SQLite cache
  - Trigger UI updates
- [ ] 🟥 Update CLI tool to support write operations
- [ ] 🟥 Add safety checks (confirmation prompts, dry-run mode)

**Acceptance Criteria:**

- Can create/update/delete notes via API
- Changes appear in UI immediately
- CRDT state remains consistent

---
