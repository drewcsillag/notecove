# iOS JavaScriptCore Bridge Architecture

**Status**: Design Document
**Created**: 2025-11-13
**Phase**: 3.2 - iOS CRDT Implementation

---

## Overview

The iOS app reuses the TypeScript CRDT logic from `packages/shared` via JavaScriptCore, while implementing platform-specific concerns (file I/O, SQLite, file watching) in native Swift. This approach maximizes code sharing while maintaining native performance.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        iOS App (Swift)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐                    ┌──────────────────┐   │
│  │   SwiftUI    │                    │  File I/O Layer  │   │
│  │  (UI Views)  │                    │    (Swift)       │   │
│  └──────┬───────┘                    └────────┬─────────┘   │
│         │                                     │             │
│         │                                     │             │
│  ┌──────▼──────────────────────────────────────▼─────────┐ │
│  │              CRDTBridge (Swift)                       │ │
│  │  - Manages JSContext lifecycle                        │ │
│  │  - Loads bundled JS code                              │ │
│  │  - Marshals data Swift ↔ JS                           │ │
│  │  - Exposes Swift functions to JS                      │ │
│  └───────────────────────┬──────────────────────────────┘ │
│                          │                                  │
│  ┌───────────────────────▼──────────────────────────────┐ │
│  │           JavaScriptCore (JSContext)                  │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │      Bundled packages/shared Code               │ │ │
│  │  │  - CRDT operations (Yjs)                        │ │ │
│  │  │  - Update format parsing                        │ │ │
│  │  │  - Snapshot/Pack logic                          │ │ │
│  │  │  - Title extraction                             │ │ │
│  │  │  - Folder tree operations                       │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│                          │                                  │
│  ┌───────────────────────▼──────────────────────────────┐ │
│  │                GRDB (SQLite)                          │ │
│  │  - Note metadata cache                                │ │
│  │  - FTS5 search index                                  │ │
│  │  - Tag index                                          │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │                                  │
         │                                  │
         ▼                                  ▼
   ┌─────────────┐                  ┌──────────────┐
   │  iCloud     │                  │   File       │
   │  Drive      │                  │   Watcher    │
   └─────────────┘                  └──────────────┘
```

## Component Breakdown

### 1. CRDTBridge (Swift)

**Purpose**: Main coordinator between Swift and JavaScript layers.

**Responsibilities**:

- Initialize and manage JSContext
- Load bundled JavaScript code
- Expose Swift functions to JavaScript (via JSExport protocol)
- Marshal data between Swift and JavaScript types
- Handle errors from JavaScript execution

**Key APIs**:

```swift
class CRDTBridge {
    // Lifecycle
    init() throws
    func loadSharedCode() throws

    // Note operations
    func createNote(noteId: String, folderId: String, sdId: String) throws
    func loadNote(noteId: String, sdPath: String) throws -> NoteDocument
    func applyUpdate(noteId: String, update: Data) throws
    func getDocumentState(noteId: String) throws -> Data

    // Folder tree operations
    func loadFolderTree(sdPath: String) throws -> FolderTree
    func addFolder(sdPath: String, parentId: String?, name: String) throws -> String
    func moveFolder(sdPath: String, folderId: String, newParentId: String?) throws

    // Snapshot/Pack operations
    func createSnapshot(noteId: String, sdPath: String) throws
    func createPack(noteId: String, sdPath: String) throws

    // Title extraction
    func extractTitle(yjsonData: Data) throws -> String
}
```

### 2. File I/O Layer (Swift)

**Purpose**: Handle all file system operations.

**Responsibilities**:

- Read/write .yjson files
- Create/delete directories
- Manage storage directory paths
- Handle iCloud Drive specifics
- Atomic file operations

**Key APIs**:

```swift
class FileIOManager {
    func readFile(at path: String) throws -> Data
    func writeFile(data: Data, to path: String) throws
    func deleteFile(at path: String) throws
    func listFiles(in directory: String, matching pattern: String) throws -> [String]
    func createDirectory(at path: String) throws
    func fileExists(at path: String) -> Bool
}
```

### 3. File Watcher (Swift)

**Purpose**: Detect changes to CRDT files from other instances.

**Responsibilities**:

- Monitor storage directories for changes
- Debounce rapid changes
- Handle iCloud Drive sync delays
- Notify observers of relevant changes

**Implementation**:

- Use `FileManager` notifications
- `NSMetadataQuery` for iCloud Drive monitoring
- Combine publishers for reactive updates

### 4. GRDB SQLite Layer (Swift)

**Purpose**: Local cache and search index.

**Responsibilities**:

- Same schema as desktop (from `packages/shared/src/database/schema.ts`)
- FTS5 full-text search
- Tag indexing
- Note metadata caching

**Integration**:

- Use GRDB Swift library
- Translate TypeScript schema to Swift models
- Expose to SwiftUI views via Combine publishers

### 5. Bundled JavaScript Code

**Purpose**: Run shared CRDT logic in JavaScriptCore.

**Creation Process**:

1. Bundle `packages/shared` with esbuild (or similar)
2. Output single `.js` file
3. Include Yjs and dependencies
4. Add to Xcode project as a resource
5. Load at runtime via `JSContext.evaluateScript()`

**Requirements**:

- No Node.js-specific APIs
- No DOM/browser APIs
- Pure computation only (no I/O)
- All I/O delegated to Swift via callbacks

## Data Marshaling

### Swift → JavaScript

```swift
// Example: Passing update data to JS
let updateData: Data = ... // Binary CRDT update
let base64 = updateData.base64EncodedString()
let result = context.evaluateScript("applyUpdate('\(noteId)', '\(base64)')")
```

### JavaScript → Swift

```swift
// Example: Getting document state from JS
let result = context.evaluateScript("getDocumentState('\(noteId)')")
let base64 = result!.toString()!
let data = Data(base64Encoded: base64)!
```

### Type Mappings

| Swift Type      | JavaScript Type      | Notes                 |
| --------------- | -------------------- | --------------------- |
| `String`        | `string`             | Direct mapping        |
| `Int`, `Double` | `number`             | Direct mapping        |
| `Bool`          | `boolean`            | Direct mapping        |
| `Data` (binary) | `string` (base64)    | Base64 encode/decode  |
| `[String: Any]` | `Object`             | JSON-compatible dict  |
| `[Any]`         | `Array`              | JSON-compatible array |
| `Date`          | `number` (timestamp) | Unix milliseconds     |

## JavaScript Bundle Structure

The bundled JavaScript will expose a global object with all necessary functions:

```javascript
// Global object exposed to Swift
window.NoteCoveBridge = {
    // Note operations
    createNote: (noteId, folderId, sdId) => { ... },
    applyUpdate: (noteId, updateBase64) => { ... },
    getDocumentState: (noteId) => { ... },

    // Folder tree operations
    loadFolderTree: (sdPath) => { ... },
    addFolder: (sdPath, parentId, name) => { ... },

    // Title extraction
    extractTitle: (yjsonBase64) => { ... },

    // Internal state (hidden from Swift)
    _openDocuments: new Map(),
    _folderTrees: new Map()
};
```

## Error Handling

### JavaScript Errors

```swift
// Wrap JS calls in try-catch
guard let result = context.evaluateScript(script),
      !result.isUndefined,
      !result.isNull else {
    if let exception = context.exception {
        throw CRDTBridgeError.javascriptError(exception.toString())
    }
    throw CRDTBridgeError.unexpectedResult
}
```

### Swift Errors Exposed to JavaScript

```swift
// Create error callback in JSContext
context.setObject({ (message: String) in
    print("JS Error: \(message)")
}, forKeyedSubscript: "swiftLog" as NSString)
```

## Concurrency Model

### Swift Side

- All JSContext operations on **main queue** (JSContext is not thread-safe)
- File I/O operations on **background queue**
- Use `async/await` for cleaner code

```swift
actor CRDTBridge {
    private let context: JSContext
    private let fileIO: FileIOManager

    func loadNote(noteId: String, sdPath: String) async throws -> NoteDocument {
        // File I/O on background
        let files = await fileIO.listFiles(in: "\(sdPath)/notes/\(noteId)")

        // JS operations on main actor
        return await MainActor.run {
            // Call JavaScript to load document
            let result = context.evaluateScript("loadNote('\(noteId)', ...)")
            return parseResult(result)
        }
    }
}
```

### JavaScript Side

- Single-threaded (JavaScriptCore limitation)
- All operations synchronous from JS perspective
- Async operations handled in Swift, results passed back to JS

## Memory Management

### JSContext Lifecycle

- Create once at app launch
- Keep alive for app lifetime
- Dispose on app termination

### Document Caching

- Keep frequently accessed documents in JS memory
- Implement LRU eviction for memory pressure
- Notify JavaScript to release documents when iOS sends memory warning

```swift
NotificationCenter.default.addObserver(
    forName: UIApplication.didReceiveMemoryWarningNotification,
    object: nil,
    queue: .main
) { _ in
    context.evaluateScript("NoteCoveBridge.clearDocumentCache()")
}
```

## Security Considerations

### Sandboxing

- JavaScriptCore provides natural sandboxing (no file access, no network)
- All I/O goes through Swift layer
- Swift validates all inputs before passing to JS
- Swift validates all JS outputs before using

### Input Validation

```swift
func validateNoteId(_ noteId: String) throws {
    guard noteId.range(of: "^[a-zA-Z0-9-]+$", options: .regularExpression) != nil else {
        throw CRDTBridgeError.invalidNoteId
    }
}
```

## Performance Characteristics

### Expected Performance

- **JavaScript execution**: ~5-10ms for typical CRDT operations
- **Marshaling overhead**: ~1-2ms per call (base64 encoding)
- **Total overhead vs native**: ~10-20% (acceptable for code sharing benefits)

### Optimization Strategies

1. **Batch operations**: Group multiple JS calls when possible
2. **Binary protocol**: Use MessagePack instead of JSON for large objects
3. **Caching**: Keep hot documents in JS memory
4. **Lazy loading**: Load JS bundle on-demand, not at app launch

## Testing Strategy

### Unit Tests

- Test Swift ↔ JS marshaling (both directions)
- Test error handling (JS exceptions → Swift errors)
- Test each bridge function independently
- Mock FileIOManager for bridge tests

### Integration Tests

- Load real CRDT files created by desktop app
- Verify round-trip: Swift → JS → Swift
- Test multi-document scenarios
- Test memory usage under load

### Cross-Platform Tests

- Create note on desktop, load on iOS
- Create note on iOS, load on desktop
- Verify CRDT convergence (concurrent edits)

## Alternatives Considered

### 1. Pure Swift CRDT Implementation

**Pros**: Native performance, no JS overhead
**Cons**:

- Reimplement Yjs in Swift (~10K+ lines)
- Maintain compatibility with desktop
- High risk of divergence

**Decision**: Rejected due to code duplication and maintenance burden

### 2. React Native

**Pros**: Code sharing with potential web version
**Cons**:

- Overkill for notes app
- Larger bundle size
- Less native feel
- Doesn't help with desktop (still Electron)

**Decision**: Rejected

### 3. WebAssembly

**Pros**: Fast, portable
**Cons**:

- No WebAssembly runtime on iOS (yet)
- Would need to compile TypeScript to Wasm
- Ecosystem immaturity

**Decision**: Rejected (maybe revisit in 2-3 years)

## Implementation Plan

### Phase 3.2.1: Basic Bridge (This Phase)

- [ ] Bundle `packages/shared` to single JS file
- [ ] Create `CRDTBridge.swift` with basic JSContext setup
- [ ] Implement data marshaling helpers
- [ ] Expose basic note operations (create, load, applyUpdate)
- [ ] Unit tests for bridge

### Phase 3.2.2: File I/O

- [ ] Implement `FileIOManager.swift`
- [ ] Integrate with CRDTBridge
- [ ] Handle iCloud Drive paths
- [ ] Error handling for file operations

### Phase 3.2.3: SQLite Integration

- [ ] Add GRDB dependency to project
- [ ] Port database schema from TypeScript to Swift
- [ ] Implement CRUD operations
- [ ] FTS5 search setup

### Phase 3.2.4: File Watching

- [ ] Implement `FileWatcher.swift` with FileManager
- [ ] Handle iCloud Drive sync delays
- [ ] Debouncing logic
- [ ] Integrate with CRDTBridge for reload

### Phase 3.2.5: Folder Tree Support

- [ ] Expose folder tree operations to Swift
- [ ] Implement folder CRUD in bridge
- [ ] Tests for folder operations

### Phase 3.2.6: Advanced Features

- [ ] Snapshot creation
- [ ] Pack creation
- [ ] Garbage collection
- [ ] History/timeline support

## Open Questions

1. **Bundle size**: What's the size of bundled JS? (Aim: <500KB)
2. **Startup time**: How long to parse JS bundle? (Aim: <100ms)
3. **Memory usage**: How much RAM for JSContext + documents? (Monitor)
4. **iCloud sync**: How to detect when iCloud Drive finishes syncing?

## References

- [JavaScriptCore Documentation](https://developer.apple.com/documentation/javascriptcore)
- [GRDB Documentation](https://github.com/groue/GRDB.swift)
- [Yjs Documentation](https://docs.yjs.dev/)
- NoteCove Desktop CRDT Manager: `packages/desktop/src/main/crdt/crdt-manager.ts`
- NoteCove Shared Package: `packages/shared/`

---

**Next Steps**: Proceed with Phase 3.2.1 implementation (basic bridge setup).
