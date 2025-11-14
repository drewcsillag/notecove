# iOS Development Session Handoff

**Date**: 2025-11-13
**Branch**: `feature/phase-3-ios-app`
**Last Commit**: `bf5b255` - "feat: Implement Phase 3.2.1 - iOS JavaScriptCore CRDT bridge"

---

## What We Accomplished

### Phase 3.1 - iOS Project Setup ✅ COMPLETE

- Created Xcode project using XcodeGen (`project.yml`)
- Configured for iOS 26.1 SDK, iOS 17.0 deployment target
- Universal app (iPhone + iPad)
- SwiftUI app structure with tab navigation
- Basic models (StorageDirectory, Folder, Note, Tag)
- XCTest framework configured
- **Status**: Fully working, committed

### Phase 3.2.1 - JavaScriptCore Bridge ⚠️ CODE COMPLETE, TESTING BLOCKED

#### What's Working:

1. **JavaScript Bundling** (`packages/shared`)
   - Created `src/ios-bridge.ts` - exposes CRDT APIs to JavaScriptCore
   - Added esbuild for bundling TypeScript → single JS file
   - Created `scripts/build-ios-bundle.js` build script
   - Bundle size: 240KB (includes Yjs)
   - Location: `packages/shared/dist/ios/notecove-bridge.js`
   - Also copied to: `packages/ios/Sources/Resources/notecove-bridge.js`

2. **Swift Bridge** (`packages/ios/Sources/CRDT/CRDTBridge.swift`)
   - Loads JavaScript bundle in JavaScriptCore
   - `@MainActor` for thread safety
   - Implements data marshaling (Swift Data ↔ JS base64)
   - Includes atob/btoa polyfills (JSCore doesn't have them)
   - Complete API:
     - Note ops: `createNote`, `applyUpdate`, `getDocumentState`, `extractTitle`, `closeNote`
     - Folder tree ops: `createFolderTree`, `loadFolderTree`, `getFolderTreeState`, `closeFolderTree`
     - Memory: `clearDocumentCache`, `getOpenDocumentCount`
   - Comprehensive error handling

3. **Tests** (`packages/ios/Tests/CRDTBridgeTests.swift`)
   - 7 unit tests written
   - Cover all major operations
   - `@MainActor` on test class (fixed concurrency issues)

4. **Recent Fixes**:
   - Fixed `deinit` error (can't call `@MainActor` methods from deinit)
   - Fixed `toInt32()` return type conversion
   - Added debug logging to show bundle contents

---

## Current Blocker: JavaScript Bundle Not Copying to App

**The Problem**:
The `notecove-bridge.js` file exists at `packages/ios/Sources/Resources/notecove-bridge.js` but is NOT being copied into the built app bundle during compilation.

**Evidence**:

```
DEBUG: Bundle contents: ["_CodeSignature", "NoteCove", "PlugIns", "NoteCove.debug.dylib", "__preview.dylib", "Frameworks", "Info.plist", "PkgInfo"]
```

Notice: No `notecove-bridge.js` file present.

**Expected**:
Should see `notecove-bridge.js` in the app bundle's root directory.

**Symptom**:
All 7 CRDTBridge tests fail with error `bridgeNotInitialized` because `Bundle.main.path(forResource: "notecove-bridge", ofType: "js")` returns `nil`.

**What We've Tried** (all in `project.yml`):

1. ❌ `resources: - path: Sources/Resources, type: folder`
2. ❌ `resources: - Sources/Resources`
3. ❌ `resources: - Sources/Resources/notecove-bridge.js`
4. ❌ `resources: - path: Sources/Resources/notecove-bridge.js, buildPhase: resources`
5. ⏳ `preBuildScripts` with manual `cp` command (currently testing, may work)

**Current `project.yml` Resource Configuration** (lines 26-32):

```yaml
resources:
  - Sources/Resources/notecove-bridge.js

preBuildScripts:
  - name: 'Copy JS Bundle'
    script: |
      cp "${PROJECT_DIR}/Sources/Resources/notecove-bridge.js" "${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app/notecove-bridge.js"
```

---

## Files Modified But Not Committed

**Need to commit these fixes**:

- `packages/ios/Sources/CRDT/CRDTBridge.swift` (deinit fix, Int cast fix, debug logging)
- `packages/ios/Tests/CRDTBridgeTests.swift` (@MainActor fixes)
- `packages/ios/project.yml` (resource configuration attempts)

---

## Options for Next Session

Please restate these options to the user and ask them to choose:

### Option A: Continue Debugging Resource Issue

**What**: Keep trying different XcodeGen configurations until the JS bundle copies correctly.

**Why Choose This**:

- Proper solution that works with XcodeGen
- Reproducible builds
- No manual steps

**Time Estimate**: Could take 2-10 more iterations (30-90 minutes)

**Next Steps**:

1. Check if `preBuildScripts` approach worked (it was building when session ended)
2. If not, try `postBuildScripts` instead
3. If not, try adding to `Copy Bundle Resources` build phase explicitly
4. If not, investigate XcodeGen documentation for resource handling
5. Last resort: Document manual Xcode configuration steps

---

### Option B: Manual Xcode Fix + Move Forward

**What**: Manually add the JS file in Xcode GUI, document the manual step, continue with Phase 3.2.2.

**Why Choose This**:

- Unblocks testing immediately
- Can continue iOS development
- Can fix XcodeGen config later

**Downsides**:

- Manual step in build process (not ideal)
- `.xcodeproj` needs to be committed (we gitignore it normally)

**Next Steps**:

1. Open `NoteCove.xcodeproj` in Xcode
2. Manually drag `Sources/Resources/notecove-bridge.js` into project
3. Ensure it's added to "Copy Bundle Resources" build phase
4. Run tests - should pass
5. Continue with Phase 3.2.2 (File I/O layer)

---

### Option C: Create iOS CI Script First, Debug Later

**What**: Create the iOS CI script now (even though tests fail), commit all work, document the resource issue.

**Why Choose This**:

- User originally asked for iOS CI script
- Can test CI infrastructure
- Documents the problem clearly

**Downsides**:

- CI will fail until resource issue is fixed
- Not ideal for TDD workflow

**Next Steps**:

1. Create `packages/ios/scripts/ci-local.sh` (similar to desktop)
2. Commit all current work with clear "KNOWN ISSUE" note
3. Return to fix resource issue later

---

## Quick Reference

### Running iOS Tests Manually

```bash
cd /Users/drew/devel/nc2/packages/ios
xcodegen generate
xcodebuild test -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'platform=iOS Simulator,id=DC9D7688-6AF0-4FB9-B863-04A0340804B0'
```

### Rebuilding JavaScript Bundle

```bash
cd /Users/drew/devel/nc2/packages/shared
pnpm build:ios
# Output: packages/shared/dist/ios/notecove-bridge.js (240KB)
```

### Key File Locations

- **Xcode project config**: `packages/ios/project.yml`
- **Swift bridge**: `packages/ios/Sources/CRDT/CRDTBridge.swift`
- **Bridge tests**: `packages/ios/Tests/CRDTBridgeTests.swift`
- **JS bundle source**: `packages/shared/dist/ios/notecove-bridge.js`
- **JS bundle in iOS**: `packages/ios/Sources/Resources/notecove-bridge.js`
- **JS bridge entry**: `packages/shared/src/ios-bridge.ts`
- **Bundle build script**: `packages/shared/scripts/build-ios-bundle.js`

### Simulator Device ID

```
iPhone 17: DC9D7688-6AF0-4FB9-B863-04A0340804B0
```

---

## Background Process

**There's a background process still running**:

```bash
# Kill it if needed:
# Process ID: fa2489
# Command: xcodebuild -downloadAllPlatforms
```

This is downloading iOS simulator runtimes. Can be killed safely if needed.

---

## User's Original Request

> "are the tests passing? We'll want a similar script for ios's CI (eventually we'll want an omnibus one to cover both, but separate for now) to make sure we don't break things as we go."

**What the user wants**:

1. iOS tests passing ✅ (blocked by resource issue)
2. iOS CI script similar to desktop's `pnpm ci-local` ⏸️ (not created yet)
3. Eventually: Unified CI for desktop + iOS ⏸️ (future)

---

## Recommendation

I recommend **Option A** first (try the `preBuildScripts` fix that was building when session ended), and if that doesn't work within 1-2 more attempts, switch to **Option B** to unblock progress.

The resource issue is annoying but solvable. Once tests pass, creating the iOS CI script is trivial (5 minutes).

---

## Session End State

- **Git status**: Clean except for uncommitted fixes mentioned above
- **Tests status**: 4/11 passing (NoteCoveTests pass, CRDTBridgeTests fail due to missing JS)
- **Build status**: Compiles successfully, resource copying issue only
- **Xcode**: May still be open showing the project
