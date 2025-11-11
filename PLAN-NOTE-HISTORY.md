# Note History Feature - Implementation Plan

## Overview

Enable users to view and restore any previous version of a note from the complete CRDT history (updates, packs, snapshots).

## Design Decisions

### Activity Sessions (Coarse-grained Navigation)
- **Hybrid approach**: New session after 5min idle OR every 100+ edits
- Groups fine-grained CRDT updates into user-meaningful chunks
- Example: "Today 2:30-2:45 PM (47 changes)"

### Scrubbing Within Sessions (Fine-grained Navigation)
- **Keyframe sampling**: Pre-generate previews at evenly-spaced points
- Default: Sample every 10th update within a session
- Provides smooth scrubbing without reconstructing every single update

### Caching Strategy
- **In-memory only** for MVP (with abstraction for future disk caching)
- Cache interface: `HistoryCache` with `.get(noteId, pointInTime)` and `.set(...)`
- Easy to swap implementation later (disk, IndexedDB, etc.)

### User Snapshots
- **Named snapshots**: User can create bookmarks like "Before major rewrite"
- **Auto-sessions**: Automatic detection continues as baseline
- Named snapshots show prominently at top of timeline
- Stored as metadata alongside CRDT data

## Phase 1: Core Infrastructure

### 1.1 Backend - History Timeline Builder

**New file**: `packages/shared/src/history/timeline-builder.ts`

```typescript
interface HistoryUpdate {
  instanceId: string;
  timestamp: number;
  sequence: number;
  data: Uint8Array;
}

interface ActivitySession {
  id: string; // UUID for this session
  startTime: number;
  endTime: number;
  updateCount: number;
  updates: HistoryUpdate[];
  // For display
  firstPreview?: string; // First 100 chars of doc at session start
  lastPreview?: string;  // First 100 chars of doc at session end
}

interface UserSnapshot {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  totalChanges: number; // Vector clock state
  vectorClock: VectorClock;
}

class TimelineBuilder {
  // Analyze note history and build timeline
  async buildTimeline(
    sdId: string,
    noteId: string,
    updateManager: UpdateManager
  ): Promise<{
    sessions: ActivitySession[];
    userSnapshots: UserSnapshot[];
  }>;

  // Session detection logic
  private groupIntoSessions(
    updates: HistoryUpdate[]
  ): ActivitySession[];
}
```

**Logic**:
1. Read all updates from packs and individual update files
2. Sort by timestamp
3. Group into sessions:
   - New session if gap > 5 minutes
   - OR if current session > 100 updates
4. Generate preview text for first/last state of each session

### 1.2 Backend - State Reconstructor

**New file**: `packages/shared/src/history/state-reconstructor.ts`

```typescript
interface ReconstructionPoint {
  timestamp: number;
  updateIndex: number; // Which update in the timeline
  vectorClock: VectorClock;
}

class StateReconstructor {
  // Reconstruct document at specific point in time
  async reconstructAt(
    sdId: string,
    noteId: string,
    point: ReconstructionPoint,
    updateManager: UpdateManager
  ): Promise<Y.Doc>;

  // Generate keyframe samples for a session
  async generateKeyframes(
    sdId: string,
    noteId: string,
    session: ActivitySession,
    sampleCount: number = 10
  ): Promise<Array<{ updateIndex: number; doc: Y.Doc; text: string }>>;

  // Find best snapshot before target time
  private async findBestSnapshot(
    sdId: string,
    noteId: string,
    targetTime: number
  ): Promise<{ snapshot: SnapshotData | null; updates: HistoryUpdate[] }>;
}
```

**Logic**:
1. Find best snapshot before target time
2. Load snapshot state into new Y.Doc
3. Apply updates chronologically until target reached
4. Return reconstructed document

### 1.3 Backend - User Snapshot Manager

**New file**: `packages/shared/src/history/snapshot-manager.ts`

Storage location: `<storage-dir>/notes/<note-id>/meta/user-snapshots.json`

```typescript
class UserSnapshotManager {
  // Create named snapshot at current state
  async createSnapshot(
    sdId: string,
    noteId: string,
    name: string,
    description?: string
  ): Promise<UserSnapshot>;

  // List all user snapshots for a note
  async listSnapshots(sdId: string, noteId: string): Promise<UserSnapshot[]>;

  // Delete user snapshot
  async deleteSnapshot(sdId: string, noteId: string, snapshotId: string): Promise<void>;

  // Get document state at snapshot
  async reconstructSnapshot(
    sdId: string,
    noteId: string,
    snapshot: UserSnapshot
  ): Promise<Y.Doc>;
}
```

### 1.4 Backend - History Cache (Abstraction)

**New file**: `packages/shared/src/history/history-cache.ts`

```typescript
interface CacheKey {
  noteId: string;
  timestamp: number;
  updateIndex: number;
}

interface HistoryCache {
  get(key: CacheKey): Y.Doc | null;
  set(key: CacheKey, doc: Y.Doc): void;
  clear(noteId: string): void;
  clearAll(): void;
}

// Phase 1 implementation: in-memory
class InMemoryHistoryCache implements HistoryCache {
  private cache: Map<string, Y.Doc> = new Map();
  private maxSize: number = 50; // Keep last 50 reconstructed states

  // LRU eviction logic...
}
```

### 1.5 Main Process - IPC Handlers

**Update file**: `packages/desktop/src/main/ipc/handlers.ts`

Add new handlers:

```typescript
// Get timeline for a note
ipcMain.handle('note:getTimeline', async (event, noteId: string) => {
  const timeline = await timelineBuilder.buildTimeline(sdId, noteId, updateManager);
  return timeline;
});

// Reconstruct document at specific point
ipcMain.handle('note:reconstructAt', async (event, noteId: string, point: ReconstructionPoint) => {
  const doc = await stateReconstructor.reconstructAt(sdId, noteId, point, updateManager);
  return Y.encodeStateAsUpdate(doc);
});

// Generate keyframes for session scrubbing
ipcMain.handle('note:getSessionKeyframes', async (event, noteId: string, sessionId: string) => {
  const session = await findSession(noteId, sessionId);
  const keyframes = await stateReconstructor.generateKeyframes(sdId, noteId, session);
  return keyframes;
});

// User snapshot management
ipcMain.handle('note:createSnapshot', async (event, noteId: string, name: string, description?: string) => {
  return await snapshotManager.createSnapshot(sdId, noteId, name, description);
});

ipcMain.handle('note:listSnapshots', async (event, noteId: string) => {
  return await snapshotManager.listSnapshots(sdId, noteId);
});

ipcMain.handle('note:deleteSnapshot', async (event, noteId: string, snapshotId: string) => {
  return await snapshotManager.deleteSnapshot(sdId, noteId, snapshotId);
});

// Restore from history (create new note OR replace current)
ipcMain.handle('note:restoreFromHistory', async (
  event,
  noteId: string,
  point: ReconstructionPoint,
  mode: 'replace' | 'new'
) => {
  const doc = await stateReconstructor.reconstructAt(sdId, noteId, point, updateManager);

  if (mode === 'new') {
    // Create new note with this content
    const newNoteId = await createNote(doc);
    return { mode: 'new', noteId: newNoteId };
  } else {
    // Replace current note (but save current as auto-snapshot first)
    await replaceNoteContent(noteId, doc);
    return { mode: 'replace', noteId };
  }
});
```

## Phase 2: Frontend UI

### 2.1 History Panel Component

**New file**: `packages/desktop/src/renderer/src/components/HistoryPanel/HistoryPanel.tsx`

```typescript
interface HistoryPanelProps {
  noteId: string;
  onClose: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ noteId, onClose }) => {
  const [timeline, setTimeline] = useState<{ sessions: ActivitySession[], userSnapshots: UserSnapshot[] } | null>(null);
  const [selectedSession, setSelectedSession] = useState<ActivitySession | null>(null);

  // Load timeline on mount
  useEffect(() => {
    window.electronAPI.note.getTimeline(noteId).then(setTimeline);
  }, [noteId]);

  if (selectedSession) {
    return <SessionDetailView session={selectedSession} noteId={noteId} onBack={() => setSelectedSession(null)} />;
  }

  return (
    <Box>
      <Typography variant="h6">Note History</Typography>

      {/* User Snapshots Section */}
      <Box>
        <Typography variant="subtitle1">Named Snapshots</Typography>
        {timeline?.userSnapshots.map(snapshot => (
          <SnapshotCard key={snapshot.id} snapshot={snapshot} noteId={noteId} />
        ))}
        <Button onClick={() => createSnapshot()}>+ Create Snapshot</Button>
      </Box>

      {/* Auto-detected Sessions */}
      <Box>
        <Typography variant="subtitle1">Activity History</Typography>
        {timeline?.sessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            onClick={() => setSelectedSession(session)}
          />
        ))}
      </Box>
    </Box>
  );
};
```

### 2.2 Session Detail View (Scrubbing)

**New file**: `packages/desktop/src/renderer/src/components/HistoryPanel/SessionDetailView.tsx`

```typescript
interface SessionDetailViewProps {
  session: ActivitySession;
  noteId: string;
  onBack: () => void;
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = ({ session, noteId, onBack }) => {
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(true);

  // Load keyframes on mount
  useEffect(() => {
    window.electronAPI.note.getSessionKeyframes(noteId, session.id).then(setKeyframes);
  }, [noteId, session.id]);

  const handleRestore = async (mode: 'replace' | 'new') => {
    const point = keyframes[selectedKeyframeIndex].reconstructionPoint;
    await window.electronAPI.note.restoreFromHistory(noteId, point, mode);
    onBack();
  };

  return (
    <Box>
      <Typography variant="h6">
        Session: {formatTimeRange(session.startTime, session.endTime)}
      </Typography>

      {/* Scrubbing Slider */}
      <Slider
        min={0}
        max={keyframes.length - 1}
        value={selectedKeyframeIndex}
        onChange={(_, value) => setSelectedKeyframeIndex(value as number)}
        marks={keyframes.map((_, i) => ({ value: i }))}
      />

      {/* Preview Area */}
      <Box display="flex" gap={2}>
        {showDiff && (
          <DiffViewer
            original={getCurrentNoteContent()}
            modified={keyframes[selectedKeyframeIndex]?.text}
          />
        )}
        <PreviewPane content={keyframes[selectedKeyframeIndex]?.text} />
      </Box>

      {/* Actions */}
      <Box>
        <Button onClick={onBack}>Back to Timeline</Button>
        <Button onClick={() => handleRestore('new')}>Create New Note</Button>
        <Button onClick={() => handleRestore('replace')} color="warning">
          Replace Current
        </Button>
      </Box>
    </Box>
  );
};
```

### 2.3 Integration Points

**Add to**:
1. **Context menu** (`NoteContextMenu.tsx`): "View History" menu item
2. **Tools menu** (`MenuBar.tsx`): "Note History" option
3. **Keyboard shortcut**: Cmd+Shift+H to open history for selected note
4. **Note info dialog** (`NoteInfoDialog.tsx`): Add "History" tab

## Phase 3: Testing

### 3.1 Unit Tests

**New file**: `packages/shared/src/history/__tests__/timeline-builder.test.ts`

Test cases:
- Session detection with 5min gaps
- Session detection with 100+ updates
- Handling notes with no history
- Handling notes with single update
- Preview text extraction

**New file**: `packages/shared/src/history/__tests__/state-reconstructor.test.ts`

Test cases:
- Reconstruct from snapshot + updates
- Reconstruct from updates only (no snapshot)
- Keyframe generation
- Edge cases (empty note, single update)

### 3.2 E2E Tests

**New file**: `packages/desktop/e2e/note-history.spec.ts`

Test cases:
- Open history panel via context menu
- View timeline with sessions
- Create named snapshot
- Scrub through session keyframes
- Restore to previous version (new note)
- Restore to previous version (replace current)
- Verify undo creates snapshot before replace

## Phase 4: Performance Optimization (Future)

- Disk caching of reconstructed states
- Incremental keyframe generation (don't regenerate all when scrubbing)
- WebWorker for state reconstruction (don't block UI thread)
- Virtualized timeline list (handle notes with thousands of sessions)

## Implementation Order

1. **Backend infrastructure** (TimelineBuilder, StateReconstructor) - ~2-3 days
2. **IPC handlers and integration** - ~1 day
3. **Basic UI (timeline view only, no scrubbing)** - ~2 days
4. **Session detail view with scrubbing** - ~2 days
5. **User snapshots** - ~1 day
6. **Integration into existing UI** (context menus, shortcuts) - ~1 day
7. **Testing** - ~2 days

**Total estimate**: ~2 weeks for full implementation

## Design Decisions (Updated)

### Open Questions - RESOLVED

1. **Diff visualization**: ✅ Use existing library (react-diff-viewer or similar)
   - No need to invent a diff viewer if one already exists and is well tested

2. **Multi-device attribution**: ✅ Yes, color-coded by instance
   - Show which device/instance made edits using color coding with legend
   - Note: User attribution (named users) is future enhancement, not this plan

3. **Search within history**: ✅ Yes, in history panel
   - Search box at top of history panel for note-specific history search
   - Primary use case: "When did I mention X?" - forensic analysis of changes

4. **Export history**: ✅ Yes, multiple formats
   - Markdown (timeline with diffs/changes)
   - HTML (rich report viewable in browser)
   - JSON (structured data for programmatic analysis)

5. **Timeline display**: ✅ Show temporal ambiguity when present
   - CRDTs don't have conflicts, but concurrent edits from multiple instances
   - If timing is messy/hard to represent linearly, show that ambiguity in UI

## Success Criteria

- [ ] User can view complete history of any note
- [ ] Sessions are automatically detected and grouped sensibly
- [ ] Sessions are color-coded by instance/device with legend
- [ ] User can scrub through sessions and see previews
- [ ] User can search within note history ("when did I mention X")
- [ ] User can restore any version (as new note or replacement)
- [ ] User can create named snapshots for important versions
- [ ] User can export history as Markdown, HTML, or JSON
- [ ] Performance: Timeline loads in <1s, keyframe generation in <2s
- [ ] All features accessible via context menu, keyboard, and menu bar

## Additional Features to Add

### Instance/Device Color Coding

Each instance ID gets assigned a consistent color. Timeline UI shows:
- Session cards with colored left border indicating which instance made changes
- Legend at top showing: "Instance-ABC (this device)" in blue, "Instance-XYZ" in green, etc.
- When multiple instances contributed to a session, show striped/gradient border

**Implementation**: `packages/desktop/src/renderer/src/utils/instance-colors.ts`
- Generate consistent color from instance ID hash
- Material UI color palette for good contrast

### History Search

**UI**: Search box at top of HistoryPanel
**Backend method**: `searchHistory(noteId: string, query: string): SearchResult[]`

```typescript
interface HistorySearchResult {
  timestamp: number;
  sessionId: string;
  updateIndex: number;
  matchContext: string; // Text snippet showing match with highlights
  instanceId: string;
}
```

Search algorithm:
1. Reconstruct document at each session boundary (or keyframe)
2. Search text content for query
3. Return matches with context
4. UI highlights matching sessions in timeline

**Note**: Could be slow for notes with many sessions. Consider:
- Incremental search (abort if too slow)
- Progress indicator
- Option to search only recent history (last 30 days)

### History Export

**UI**: Export button in HistoryPanel with format dropdown

**Backend methods**:
```typescript
exportHistoryAsMarkdown(noteId: string): string
exportHistoryAsHTML(noteId: string): string
exportHistoryAsJSON(noteId: string): object
```

**Markdown format example**:
```markdown
# History of "My Note Title"

## Session 1: Nov 11, 2025 2:30-2:45 PM (47 changes)
Instance: Desktop-ABC

### Changes
- Added section on CRDTs
- Fixed typos in introduction
- ...

## Session 2: Nov 11, 2025 11:20-11:35 AM (23 changes)
Instance: Laptop-XYZ

### Changes
- Updated examples
- ...
```

**HTML format**: Rich HTML with:
- Expandable/collapsible sessions
- Inline diffs with color coding
- Interactive timeline visualization
- Print-friendly CSS

**JSON format**: Complete structured data:
```json
{
  "noteId": "...",
  "noteTitle": "...",
  "exportTimestamp": 1699028345123,
  "sessions": [
    {
      "id": "session-1",
      "startTime": 1699028100000,
      "endTime": 1699028900000,
      "updateCount": 47,
      "instanceId": "instance-abc",
      "updates": [...]
    }
  ],
  "userSnapshots": [...]
}
```
