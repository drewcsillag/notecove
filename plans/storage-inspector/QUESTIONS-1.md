# Storage Inspector - Questions Round 1

## Feature Understanding

Based on my analysis, here's what I understand:

**Storage Directory Contents:**

- `notes/{noteId}/` - Individual notes with:
  - `logs/` - `.crdtlog` files (append-only CRDT updates)
  - `snapshots/` - `.snapshot` files (full document state + vector clock)
  - `packs/` - `.yjson` packed updates (future: compressed)
  - `meta/` - Note metadata
- `folders/` - Folder tree CRDT (logs + snapshots)
- `activity/` - Activity logs for sync tracking
- `profiles/` - Profile presence files (.json)
- `media/` - Images (and future media)
- `SD_ID`, `SD_VERSION` - Identity files

**Binary Formats:**

- `.crdtlog`: 5-byte header (NCLG + version), then varint-length records with timestamp/sequence/yjs-update
- `.snapshot`: 6-byte header (NCSS + version + complete flag), vector clock, document state

---

## Questions

### 1. Window Design

**Q1a:** Should this be a standalone window (like NoteInfoWindow) or a panel within the main app (like SyncStatus)?

yes

**Q1b:** If standalone window, should it be resizable and remember its size/position?
yes

### 2. Hexdump View

**Q2:** The Wireshark-style view you mentioned - do you want:

- (A) **Classic two-column**: `offset: hex | ascii` side by side
- (B) **Three-column**: `offset | hex | decoded structure` where the structure view highlights which bytes correspond to which parsed field
- (C) Something else?

Example of (A):

```
00000000  4E 43 4C 47 01 8F 01 00  |NCLG....|
00000008  00 01 8C 12 34 56 78 01  |....4Vx.|
```

Example of (B):

```
Offset    Hex                      Structure
00000000  4E 43 4C 47              Magic: "NCLG"
00000004  01                       Version: 1
00000005  8F 01                    Length: 143 (varint)
00000007  00 00 01 8C 12 34 56 78  Timestamp: 2024-...
...
```

B

### 3. Navigation/Selection

**Q3a:** When browsing the tree:

- Should selecting a note show its files (logs, snapshots, packs)?
  yes
- Should clicking a file automatically parse and display it?
  yes
- Should there be a way to select multiple files for comparison?
  no

**Q3b:** For CRDT logs with multiple records - should clicking a record in the list highlight its bytes in the hex view?
yes

### 4. XML Serialization

**Q4:** When you say "string serialized form (XML ultimately)", do you mean:

- (A) The TipTap/ProseMirror XML representation of the document content (what the editor uses)
- (B) Some kind of debug XML format showing the Yjs internal structure
- (C) Both?

For (A), Yjs `XmlFragment.toJSON()` can produce something like:

```json
[{ "type": "paragraph", "content": [{ "type": "text", "text": "Hello" }] }]
```

And we could render that as formatted XML:

```xml
<paragraph>
  <text>Hello</text>
</paragraph>
```

C

### 5. Additional Inspectable Items

**Q5:** Beyond what you mentioned, the SD also contains:

- **Activity logs** (.log files) - plain text `noteId|instanceId_seq` entries for sync
- **Profile presence files** (.json) - per-profile sync state
- **Media files** - images stored in `media/`
- **SD_ID file** - UUID identifying the storage directory
- **SD_VERSION file** - Format version (currently "1")

Should these all be inspectable? The activity logs and profile files are human-readable text/JSON, so they'd just need a text viewer.

yes

### 6. Folder Tree CRDT

**Q6:** The folder tree is also a CRDT document stored in `folders/logs/` and `folders/snapshots/`. Should this be inspectable the same way as notes?

yes

### 7. Real-time Updates

**Q7:** Should the inspector auto-refresh when files change (e.g., when editing a note), or should it be a snapshot-in-time with a manual refresh button?

snapshot with manual refresh

### 8. Error States

**Q8:** How should we handle:

- Incomplete/corrupt files (e.g., snapshot with status=0x00)
- Missing magic numbers
- Truncated records

Options:

- (A) Show error and skip
- (B) Show partial parse with error markers
- (C) Allow "raw hex only" view for corrupt files

B

### 9. Keyboard Navigation

**Q9:** Any specific keyboard shortcuts desired? Current tools menu items use things like `Cmd+Shift+I` (Note Info), `Cmd+Alt+H` (History).
No special keyboard shortcut
