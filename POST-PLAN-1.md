# Post-Plan Discussion - Round 1

Excellent catches! You've identified several issues with the plan ordering and some ambiguities. Let me address each:

---

## Issue 1: Testing Framework Setup Order

**Your observation:** Testing framework (1.5) comes after CRDT implementation (1.2-1.4) which needs ~100% test coverage.

**You're absolutely correct.** Testing framework setup should come BEFORE the components that need testing.

**Proposed Fix:**
Reorder Phase 1 tasks:

- 1.1 Project Setup & Repository Structure
- **1.2 Testing Framework Setup** (moved from 1.5)
- 1.3 CRDT Core Implementation (was 1.2)
- 1.4 File System Operations (was 1.3)
- 1.5 Local Database & Cache (was 1.4)
- 1.6 Logging and Error Handling (was 1.6)

This way, Jest, Playwright, and XCTest are ready before we start implementing CRDT logic, allowing proper TDD.

---

## Issue 2: `saveNote` in IPC Commands (2.1)

**Your observation:** `saveNote` seems out of place since CRDTs handle persistence automatically.

**You're right - this is misleading.** With Yjs, there's no explicit "save" operation. Changes are automatically captured as CRDT updates and written to disk by the sync mechanism.

**What the IPC actually needs:**

- `loadNote(noteId)` - Load a note's Yjs document into main process memory, start watching its files
- `unloadNote(noteId)` - Unload from memory when no windows have it open
- `createNote(sdId, folderId, initialContent)` - Create new note (generates UUID, creates CRDT files)
- `deleteNote(noteId)` - Mark note as deleted in CRDT
- `moveNote(noteId, newFolderId)` - Update note's folder association
- `getNoteMetadata(noteId)` - Get title, modified date, etc. from SQLite cache
- Events: `noteUpdated(noteId, changes)` - Notify renderers when CRDT changes (from local edits or remote sync)

**Clarification:**
The renderer process never directly writes to CRDT files. Instead:

1. User types in TipTap editor (renderer)
2. TipTap generates Yjs updates (in-memory, in renderer)
3. Updates are sent to main process via IPC
4. Main process applies updates to its Yjs document
5. Main process writes updates to disk files
6. Main process broadcasts updates to other renderer windows via IPC

**Proposed Fix:**
Update section 2.1 to clarify:

- Remove `saveNote` (misleading)
- Add proper IPC commands as listed above
- Add note about the flow: renderer → main process → disk → other renderers

---

## Issue 3: Phase 2 Steps Before Editor (2.6) - How to Handle Note Content?

**Your observation:** Steps 2.3-2.5 (folder tree, tags panel, notes list) need to display note content/titles, but the editor isn't built until 2.6.

**You're absolutely right - this is a chicken-and-egg problem.**

**Current situation:**

- Notes list (2.5) needs to show note titles
- Note titles come from first line of note content
- Note content is in Yjs documents (Y.XmlFragment for TipTap)
- Without TipTap, how do we extract the title?

**Solutions:**

**Option A: Reorder - Editor First**
Move 2.6 (Note Editor) to before 2.3-2.5. Build editor early so we can create and view notes, then build the organizational UI around it.

**New order:**

- 2.1 Electron App Structure
- 2.2 Three-Panel Layout
- **2.3 Note Editor (Basic TipTap)** ← moved earlier
- 2.4 Folder Tree Panel
- 2.5 Tags Panel
- 2.6 Notes List Panel
- ... rest

**Option B: Use Placeholder Content Initially**
Build the UI with mock/fixture data first, then integrate real CRDT content when editor is ready.

**Option C: Extract Title Without Full Editor**
Implement a lightweight "title extraction" utility that can parse Yjs Y.XmlFragment without full TipTap setup. This feels over-engineered.

**My Recommendation: Option A** - Build editor first (at least basic version). This gives us:

1. Ability to create real notes
2. Ability to extract real titles
3. Something tangible to work with while building organizational UI
4. Better developer experience (can test with real data)

It also aligns better with your TDD approach - we can write tests for the editor and CRDT integration, then build the UI that consumes it.

> Agree with option A

---

## Issue 4: iOS and Yjs - Recreating vs Porting vs WASM?

**Your observation:** Phase 3 for iOS - are we recreating Yjs in Swift, or porting our layer, or using WASM?

**This is a critical architectural question I didn't fully address in the plan.**

**Background:**

- Yjs is JavaScript/TypeScript library
- iOS native app is Swift/SwiftUI
- Our CRDT files on disk are Yjs binary format (.yjson)

**Options:**

### Option 1: Port Yjs to Swift (or use existing port)

**Approach:** Reimplement Yjs CRDT algorithms in Swift

- **Pros:** Native performance, no JS runtime
- **Cons:**
  - Huge effort to reimplement Yjs correctly
  - Must ensure 100% compatibility with JS Yjs
  - Ongoing maintenance to keep in sync with Yjs updates
- **Reality check:** There doesn't appear to be a mature Swift Yjs port

### Option 2: Use JavaScriptCore (iOS's built-in JS engine)

**Approach:** Bundle Yjs library, run it in JavaScriptCore on iOS

- **Pros:**
  - Uses official Yjs library (guaranteed compatibility)
  - Our shared TypeScript code could potentially run on iOS
- **Cons:**
  - Performance overhead (JS bridge)
  - Bundle size (JS runtime + Yjs)
  - Complex Swift ↔ JS bridging
- **Feasibility:** Doable, but awkward

### Option 3: WASM

**Approach:** Compile Yjs (or our layer) to WebAssembly, run on iOS

- **Pros:**
  - Better performance than JavaScriptCore
  - Could share code between platforms
- **Cons:**
  - Yjs isn't designed for WASM compilation
  - Still need WASM runtime on iOS
  - Complex integration
  - Experimental/unproven for this use case
- **Reality check:** Yjs has dependencies that may not work in WASM

### Option 4: WebView with Full Web App

**Approach:** iOS app is just a WebView running the Electron renderer code

- **Pros:**
  - Maximum code sharing
  - TipTap works natively (it's a web component)
- **Cons:**
  - Non-native feel on iOS
  - Performance concerns
  - Can't use native iOS UI components
- **Feasibility:** This is basically like Cordova/Capacitor approach

### Option 5: Hybrid - Native UI + JS Core for CRDT

**Approach:** Native SwiftUI for all UI, JavaScriptCore only for CRDT operations

- **Pros:**
  - Native UI/UX
  - Shared CRDT logic (guaranteed compatibility)
  - Smaller JS bundle (just Yjs + our CRDT layer, no UI code)
- **Cons:**
  - Swift ↔ JS bridge for CRDT operations
  - Two implementations of UI (desktop React, iOS SwiftUI)
  - For editor: either WebView for TipTap, or native iOS rich text (incompatible)

### Option 6: React Native

**Approach:** Use React Native instead of Electron for desktop, share more code with iOS

- **Pros:**
  - Maximum code sharing across platforms
  - React on both platforms
- **Cons:**
  - Means rewriting desktop app (you specified Electron)
  - TipTap doesn't work in React Native
  - Significant departure from plan

---

## My Analysis & Recommendation

**The Editor Problem is Key:**
The core issue is TipTap + Yjs integration. TipTap is a web-based editor (runs in DOM). On iOS we have these choices:

1. **WebView with TipTap** (web content in iOS app)
2. **Native iOS rich text editor** (UITextView/TextKit) with custom Yjs binding
3. **Different editor library** that works on both platforms

**Recommended Approach: Hybrid with WebView Editor**

For **iOS Architecture:**

- **UI Layer:** Native SwiftUI for navigation, lists, folders, settings
- **Editor:** WKWebView running TipTap with Yjs (same as desktop)
- **CRDT Layer:** JavaScriptCore running official Yjs library + our shared TypeScript CRDT logic
- **Storage:** Native Swift code for file I/O, SQLite

**Why this works:**

1. **Editor compatibility:** TipTap works identically on desktop and iOS (it's in a WebView on both)
2. **CRDT compatibility:** Using official Yjs library (via JavaScriptCore) guarantees perfect compatibility
3. **Code sharing:** Our TypeScript CRDT logic (`packages/shared`) can run on both platforms
4. **Native feel:** SwiftUI for 90% of the UI, WebView only for the editor itself
5. **Proven approach:** Many apps use this pattern (native UI + WebView for rich content)

**What "porting our layer" means:**

- **File I/O:** Rewrite in Swift (reading/writing .yjson files)
- **SQLite:** Rewrite in Swift (using GRDB or similar)
- **File watching:** Rewrite in Swift (using FileManager)
- **UI:** Rewrite in SwiftUI
- **CRDT logic:** Run our TypeScript code via JavaScriptCore
- **Editor:** Embed TipTap in WKWebView

**WASM Consideration:**
While interesting, WASM is not practical here because:

1. Yjs has Node.js dependencies (not WASM-compatible)
2. No mature WASM ↔ Swift bridge for this use case
3. Adds complexity without clear benefits over JavaScriptCore (which is built into iOS)

---

## Proposed Plan Updates

**1. Reorder Phase 1:**

```
1.1 Project Setup & Repository Structure
1.2 Testing Framework Setup ← moved earlier
1.3 CRDT Core Implementation
1.4 File System Operations
1.5 Local Database & Cache
1.6 Logging and Error Handling
```

**2. Clarify Section 2.1 IPC Commands:**
Remove `saveNote`, clarify CRDT automatic persistence, list correct IPC commands

**3. Reorder Phase 2 (Editor Earlier):**

```
2.1 Electron App Structure
2.2 Three-Panel Layout
2.3 Note Editor (Basic TipTap) ← moved earlier
2.4 Folder Tree Panel
2.5 Tags Panel
2.6 Notes List Panel
... rest stays same
```

**4. Add iOS Architecture Section to Plan:**
Before Phase 3, add detailed architecture explanation:

- Native SwiftUI for UI
- WKWebView for TipTap editor
- JavaScriptCore for Yjs + shared CRDT logic
- Native Swift for file I/O, SQLite, file watching
- Explanation of code sharing strategy

**5. Update Phase 3 Tasks:**
Clarify that:

- Swift code handles file I/O, SQLite, file watching (rewrite from TypeScript)
- JavaScriptCore bridge handles CRDT operations (runs our TypeScript shared code)
- TipTap editor embedded in WKWebView
- SwiftUI for all non-editor UI

---

## Questions for You

1. **Phase 1 Reordering:** Agree with moving testing framework setup to 1.2?

> Agree

2. **Phase 2 Reordering:** Agree with building editor first (2.3), then organizational UI (2.4-2.6)?

> AGree

3. **iOS Architecture:** Agree with the hybrid approach (native UI + JavaScriptCore for CRDT + WebView for editor)? Or would you prefer a different approach?

> Do we have any issue surrounding the folder trees and CRDT stuff?

4. **Code Sharing Strategy:** Should we structure `packages/shared` to be runnable in both Node.js (Electron) and JavaScriptCore (iOS)?

> yes

5. **Alternative Consideration:** Would you be open to using WKWebView for the editor on desktop too (instead of direct Electron renderer)? This would make desktop and iOS more similar. Or prefer to keep Electron renderer with direct React/TipTap?

> I'm ok if desktop and ios are a bit different as the constraints and interactions are different.

Please let me know your preferences, and I'll update the PLAN.md accordingly before we proceed to implementation.

> Other thing: As CI/CD doesn't happen until phase 5, to ensure tests run and remain passing, we'll want some local "CI" script/command to run all lints, tests, etc. to ensure that changes need to pass before merging to main, before we have real CI/CD
