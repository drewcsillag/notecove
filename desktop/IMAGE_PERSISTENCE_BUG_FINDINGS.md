# Image Persistence Bug - Investigation Findings

## Summary
Images inserted into notes disappear when switching between notes, despite the image data being correctly written to disk.

## Investigation Results

### ✅ WORKING: Write Path
The entire write path works correctly:

1. **Y.js Update Generation**: When an image is inserted, Y.js generates a proper update event containing the full image data (base64)
   - Update event fired: YES
   - Contains "data:image": YES
   - Contains PNG signature: YES
   - Update size: 157 bytes (sufficient for 1x1 pixel test image)

2. **UpdateStore Encoding**: Updates are correctly base64-encoded for storage
   - `encodeUpdate()` method works correctly
   - No data loss during encoding

3. **Disk Persistence**: Image data IS written to disk files
   - Found in `.notecove/{noteId}/updates/{instanceId}.{seq}.yjson` files
   - When base64-decoded, updates contain full image data including "data:image" prefix
   - File structure is correct

### ❌ BROKEN: In-Memory Persistence
The Y.Doc loses image data in memory AFTER a successful flush:

1. **Timeline**:
   - Insert image → Y.Doc hasImage: `true` ✅
   - Call flush() → Y.Doc hasImage: `true` ✅
   - Save current note → Y.Doc hasImage: `true` ✅
   - setDocument() to switch notes:
     - OLD Y.Doc before editor destroy: hasImage `true` ✅
     - OLD Y.Doc AFTER editor destroy: hasImage `true` ✅
   - **Switch to new note** → Y.Doc hasImage: `false` ❌

2. **Critical Finding**: The Y.XmlFragment content changes WITHOUT triggering Y.js mutation observers
   - `sameFragmentInstance: true` - It's the SAME object
   - No `observeDeep()` events fired
   - `<image src="...">` silently becomes empty `<paragraph></paragraph>`

3. **Load Path Not Executed**: When switching back to a note whose Y.Doc already exists in memory, `loadNote()` is skipped
   - See `renderer.ts:1434-1440`
   - Assumes Y.Doc in memory is up-to-date
   - Never reloads from disk where image data still exists

## Root Cause Hypothesis

Something in the note switching/save process is directly manipulating the Y.XmlFragment's internal state, bypassing Y.js APIs. This causes the image node to be replaced with an empty paragraph WITHOUT triggering observable mutations.

Possible culprits:
1. **UpdateStore.flush()** - May be corrupting the Y.Doc when processing batched updates
2. **CRDTManager update handlers** - May be applying updates back to the source Y.Doc incorrectly
3. **Editor.setDocument()** - May be affecting the old Y.Doc when creating new editor
4. **Y.js internal bug** - Edge case with large attributes (base64 image data) in Y.XmlElement nodes

## Verification
Test file: `desktop/tests/e2e/image-persist-basic.spec.js`

Key verification points:
- ✅ Image data in Y.Doc update events (line 76-117)
- ✅ Image data written to disk (line 189-241)
- ❌ Y.Doc mutation observer never fires (line 249-264)
- ❌ Same fragment instance but different content (line 289-320)

## Recommended Next Steps

### Immediate Fix Options

1. **Always reload from disk** (Quick fix, not ideal)
   - Remove the `hasDoc()` check in `renderer.ts:1434`
   - Always call `loadNote()` when switching notes
   - Pro: Will restore images from disk
   - Con: Performance hit, doesn't fix root cause

2. **Clear and reload Y.Docs** (Medium fix)
   - When switching away from a note, clear its Y.Doc from memory
   - Force `loadNote()` on next access
   - Pro: Ensures fresh state from disk
   - Con: Defeats purpose of in-memory CRDT

3. **Separate file storage for images** (Proper fix)
   - Don't store base64 images in Y.Doc at all
   - Store images as separate files in `{noteId}/attachments/`
   - Store only file references in Y.Doc
   - Pro: Fixes bug, better performance, enables file attachments feature
   - Con: Requires larger refactor

### Investigation To Continue

1. **Add detailed logging to UpdateStore.flush()**
   - Log Y.Doc state before/after each update is added
   - Check if flush is somehow applying updates to source docs

2. **Check if Collaboration extension has issues with large attributes**
   - TipTap @tiptap/extension-collaboration@2.26.3
   - May have bug with base64 image data in node attributes

3. **Verify Y.js version and known issues**
   - Check if this is a known Y.js bug with Y.XmlElement attributes

## Test Results Summary
```
✅ Y.js generates update with image data
✅ UpdateStore encodes update correctly
✅ Image data written to disk (verified by decoding base64)
❌ Image disappears from Y.Doc in memory after switch
❌ No Y.js mutation events fired when image disappears
❌ LoadNote() skipped because Y.Doc exists in memory
```

## Files Involved
- `desktop/src/lib/crdt-manager.ts` - Y.Doc management
- `desktop/src/lib/update-store.ts` - Disk persistence
- `desktop/src/lib/sync-manager.ts` - Syncing and loading
- `desktop/src/renderer.ts` - Note switching logic (lines 1434-1440)
- `desktop/src/lib/editor.ts` - TipTap editor management
- `desktop/tests/e2e/image-persist-basic.spec.js` - Test that reveals the bug
