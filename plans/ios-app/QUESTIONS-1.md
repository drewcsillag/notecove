# Questions for iOS App Development - Round 1

Based on my analysis of the codebase and website features, I have the following questions to clarify scope and approach before creating a plan.

## 1. Scope & Platform

### 1.1 iPad vs iPhone Initial Target

You mentioned "initially targeting iPad, as the UI should be basically the same as the desktop version." Questions:

- **Should iPhone be completely out of scope initially?** Or should I plan for an adaptive layout that works on both but is iPad-optimized first?
- **What iOS version minimum?** iOS 17+ (latest) vs iOS 16 (broader reach) vs iOS 15 (even broader)?
- **iPadOS-specific features?** Should we support Stage Manager, Split View, Slide Over, keyboard shortcuts, Apple Pencil?

plan for adaptive layout. ios17, but if there are things in ios26 (released in 2025, yes the version jumped) that can help, definitely let me consider them.

Split view, slide over, apple pencil definitely in view. Don't know enough about what stage manager is thought. Can you give me a TL;DR: of it?

### 1.2 Timeline Expectations

I know you don't want time estimates, but I need to understand priority:

- **MVP first vs full parity?** Should Phase 1 be a minimal usable app, or attempt full feature parity?
- **What's the minimum to be useful?** Is read-only sync sufficient for a first release, or must editing work?

Phase 1 is minimally useable. Read only sync works for MVP

## 2. Editor Strategy (Critical Decision)

The desktop app uses TipTap (ProseMirror-based) running in Electron's web view. For iOS, there are three main approaches:

### 2.1 Approach A: WKWebView + TipTap Bundle

- **Pros:** Reuse existing TipTap extensions (24 custom extensions!), exact desktop parity, JS/TS code sharing
- **Cons:** Not "truly native", may feel slightly non-native, WKWebView memory limits, keyboard handling quirks
- **Note:** There's already a `tiptap-bundle.js` in `packages/ios/Sources/Resources/`

### 2.2 Approach B: Native TextKit/UIKit Rich Text

- **Pros:** Truly native feel, better performance, no web view overhead
- **Cons:** Massive reimplementation effort, must rebuild all 24 extensions natively, hard to keep in sync

### 2.3 Approach C: Hybrid (Native shell + WebView editor)

- **Pros:** Native navigation/lists/sidebar, WebView only for the editor itself
- **Cons:** Context switching between native and web, state synchronization complexity

**My recommendation:** Approach A or C, since you already have a TipTap bundle prepared. But I need your input.

**Question:** Which approach do you prefer? Or should I explore further and come back with a more detailed analysis?

explore further and come back with a better analysis. But agree A or C and not B.

## 3. Sync & Storage

### 3.1 Storage Directory (SD) Location on iOS

Desktop uses folders in Dropbox/iCloud Drive/Google Drive. For iOS:

- **iCloud Drive:** Native iOS integration, cross-device sync, `~/Library/Mobile Documents/`
- **Dropbox/Google Drive:** Requires their SDKs, file picker APIs, download-on-demand
- **App sandbox only:** Notes stay in app sandbox, no cross-device sync without building our own backend

**Question:** Should the iOS app:

1. Only support iCloud Drive initially (simplest)?
2. Support all cloud providers like desktop (complex)?
3. Work offline in sandbox first, add cloud sync later?

Support ios for MVP, but quick follow to Google Drive, later Dropbox and One Drive

### 3.2 File System Access on iOS

iOS is more restrictive than macOS:

- **No direct file watching** like `chokidar` on desktop
- **Must use File Provider Extension** for integrating with Files.app
- **Security-scoped bookmarks** required for persistent folder access

**Question:** Should the iOS app be visible in Files.app, or is it okay to be self-contained?

Don't quite understand -- the question doesn't seem to follow the priors. Use more words in both as I'm not understanding something.

### 3.3 Cross-Device Sync with Desktop

If a user has both desktop and iOS:

- **Same SD:** Can they use the same iCloud Drive folder for both?
- **Instance ID:** Desktop uses a per-machine instance ID for CRDT. How should iOS behave?
- **Profile compatibility:** Desktop profiles have specific paths. How do we handle this on iOS?

**Question:** Is desktop-iOS sync a hard requirement for v1, or can it come later?

yes, hard requirement. Want to discover tricky bits early

## 4. Feature Parity Questions

From the website features and source code analysis, here's what exists on desktop. For each category, please indicate priority:

### 4.1 Core Features (assumed required)

- [1 ] **Rich text editing** - bold, italic, underline, strikethrough, code
- [1] **Headings** (H1-H3)
- [1] **Lists** - bullet, numbered, task/checkbox
- [3] **Code blocks** with syntax highlighting
- [1] **Blockquotes**
- [2] **Images** - view, drag-drop, paste, resize, lightbox
- [1] **Tables** - create, edit, resize columns
- [2] **Inter-note links** (`[[note-id]]` wiki-style)
- [2] **Full-text search** (SQLite FTS5)
- [2] **Folder organization** with hierarchy
- [2] **Tags** (#hashtags in content)
- [3] **Dark/light theme**

### 4.2 Advanced Features (need priority)

- [3] **Comments** - threaded, reactions, mentions (complex to implement)
- [4] **Link unfurling/oEmbed** - 300+ providers (network-dependent)
- [5] **Multi-window** (iPadOS Split View?)
- [x] **Markdown import/export**
- [4] **Print**
- [x] **Profiles** - multiple profiles with privacy modes
- [2] **Activity logging** (debug/sync monitoring)

**Question:** Which advanced features are must-have vs nice-to-have vs can-defer?

x means I don't think we'll ever want/need them.

### 4.3 Features NOT in Website Docs (found in code)

- [x] **Web server** - local network browsing (probably not applicable to iOS)
- [5] **Paranoid mode** - privacy profile
- [2] **Storage inspector** - debug tool
- [x] **Thumbnail generation** - for images

**Question:** Are any of these hidden features important for iOS?

x means I don't think we'll ever want/need them.

Paranoid and storage inspector

## 5. Technical Architecture

### 5.1 Swift vs SwiftUI

- **SwiftUI:** Modern, declarative, less code, better for new apps, iOS 14+
- **UIKit:** More mature, more control, better for complex interactions

**Question:** SwiftUI-first (modern) or UIKit (proven)?

Dig a little deeper and give pros/cons and a recommedation. Of the features in mind, do these feel like things where UIKit is going to avoid a lot of work(arounds)?

### 5.2 iOS Bridge

There's already `packages/shared/src/ios-bridge.ts` that exposes a `NoteCoveBridge` object for JavaScriptCore. Questions:

- **Is this the intended architecture?** (JS core logic running in JavaScriptCore, Swift for UI/IO)
- **Or native Swift implementation?** Rewrite CRDT/storage in pure Swift?

**Question:** Continue with the JavaScriptCore bridge approach, or go pure Swift?

It's a leftover from a previous attempt. Use it if it's useful, but don't if it's not.

### 5.3 Database

Desktop uses `better-sqlite3`. iOS options:

- **SQLite.swift** - Popular Swift wrapper
- **GRDB** - Another Swift SQLite library
- **Core Data** - Apple's ORM (not pure SQLite)
- **Direct SQLite C API** - Lower level

**Question:** Any preference, or should I recommend based on desktop schema compatibility?

if Core Data supports FTS, it might work. But look at what we're using in sqlite and make a recommendation

## 6. User Experience Questions

### 6.1 iPad Layout

Desktop has: Left sidebar (folders/notes), Editor (center), Comment panel (right)

For iPad:

- **Same layout?** Three-column on landscape, collapsible on portrait?
- **Navigation?** Tab bar, navigation controller, or sidebar?
- **Keyboard shortcuts?** Should Mac-style shortcuts work with external keyboard?

Same layout
Mac shortcuts should work with external keyboard

As to navigation bar, I'm not sure what precisely you're referring to in the current app, or how it would map.

### 6.2 Onboarding

Desktop has a profile picker and onboarding wizard. For iOS:

- **Same flow?** Or simplified?
- **Default profile?** Auto-create or require manual setup?
- **Cloud setup:** When should we prompt for iCloud Drive access?

Go through the wizard, but there's just only one profile

## 7. Development & Testing

### 7.1 Xcode Project Setup

- **Should the iOS app live in `packages/ios/`?** Or a new repo?
- **Monorepo structure?** Keep it in the same pnpm workspace?
- **Bundle ID / App ID:** Any existing Apple Developer setup?

packages/ios sounds good
Keep in same monorepo

No existing developer setup

### 7.2 Testing Strategy

- **Unit tests:** XCTest for Swift, Jest for JS bridge
- **UI tests:** XCTest UI, or something else?
- **Sync testing:** How to test desktop-iOS sync scenarios?

make recommendations

### 7.3 CI/CD

- **Build on CI?** GitHub Actions for iOS builds?
- **TestFlight distribution?** For beta testing?

make a script I can run locally. I don't have external CI

## 8. What's Already Done?

I found:

- `packages/ios/Sources/Resources/tiptap-bundle.js` - a TipTap bundle already prepared
- `packages/shared/src/ios-bridge.ts` - JavaScriptCore bridge with note/folder operations
- Shared package designed to work in both Node.js and JavaScriptCore

**Question:** Is there more iOS work already done somewhere? Any prototypes, designs, or notes I should look at?

Not that I know of. Again, don't take any of it as "this is precisely what I want", as I clearly abandoned a previous swing at this

## Summary: Key Decisions Needed

1. **Editor approach:** WKWebView+TipTap vs Native vs Hybrid
2. **Sync/storage:** iCloud only vs all clouds vs offline-first
3. **Desktop-iOS sync:** Required for v1?
4. **Feature priority:** MVP scope vs full parity
5. **Architecture:** JavaScriptCore bridge vs pure Swift
6. **UI framework:** SwiftUI vs UIKit

Please answer what you can, and I'll proceed to planning once I understand your preferences.
