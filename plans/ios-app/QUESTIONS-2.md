# Questions for iOS App Development - Round 2

Based on your answers and my deeper research, here are my analyses and remaining questions.

---

## 1. Editor Strategy: WKWebView+TipTap (A) vs Hybrid (C)

### Analysis

After researching, both approaches are viable. Here's the comparison:

**Approach A: WKWebView + Full TipTap**
- The entire app runs in a WKWebView (similar to Electron on desktop)
- SwiftUI/UIKit only for the WKWebView container
- All UI is HTML/CSS/React/TipTap

| Pros | Cons |
|------|------|
| Maximum code reuse from desktop | Feels like a "web app in a wrapper" |
| All 24 TipTap extensions work immediately | iOS keyboard handling quirks in WKWebView |
| Single codebase for editor | Memory limits in WKWebView (300-500MB) |
| Faster initial development | Harder to integrate iOS-native features |

**Approach C: Hybrid (Native shell + WebView editor)**
- Native SwiftUI for: sidebar, folder tree, note list, settings, navigation
- WKWebView only for the TipTap editor area
- Communication via JavaScript bridge

| Pros | Cons |
|------|------|
| Native iOS feel for navigation | More complexity in state sync |
| Better memory management (only editor in WKWebView) | Two rendering systems |
| Easier to add iOS-native features (widgets, shortcuts) | Bridge communication overhead |
| Proper iOS keyboard, gestures outside editor | Slightly slower editor load |

### Real-World Evidence
[A project called Pigeon](https://www.emersonkirby.com/project/1-pigeon/) used WKWebView + TipTap for an iMessage extension successfully. [TenTap Editor](https://github.com/10play/10tap-editor) is a React Native library that wraps TipTap in a WebView specifically for mobile.

### My Recommendation: Approach C (Hybrid)

Reasons:
1. **Native navigation feels right** - iPad users expect native sidebar behavior, especially with Split View and Stage Manager
2. **Memory efficiency** - Only load WebView for active note editing
3. **Future-proofing** - Easier to add iOS-specific features (Shortcuts, Widgets, Share Extension)
4. **MVP can start simpler** - Native read-only first, then add WebView editor

### Question
**Do you agree with Hybrid (C), or do you prefer full WKWebView (A)?**

Agree with C
---

## 2. SwiftUI vs UIKit Analysis

### Research Summary

From [2025 comparisons](https://www.alimertgulec.com/en/blog/swiftui-vs-uikit-2025):

| Aspect | SwiftUI | UIKit |
|--------|---------|-------|
| Maturity | Production-ready iOS 15+ | 15+ years battle-tested |
| Rich Text Editor | [Hard to build natively](https://danielsaidi.com/blog/2022/06/13/building-a-rich-text-editor-for-uikit-appkit-and-swiftui) | Better control, but still complex |
| 3-column layout | NavigationSplitView (iOS 16+) | UISplitViewController |
| Performance | 5-10% slower in benchmarks | Slightly faster |
| Team adoption | 70% use hybrid approach | Still required for complex UI |
| Keyboard shortcuts | Supports `.keyboardShortcut()` | More control via UIKeyCommand |

### For NoteCove Specifically

**We're NOT building a native rich text editor** - we're using WKWebView + TipTap. This changes the calculus significantly:

- We don't need UIKit's text editing power
- We mainly need: sidebar navigation, lists, settings, dialogs
- These are SwiftUI's strengths

### My Recommendation: SwiftUI-first with UIKit escape hatches

1. **SwiftUI** for:
   - Main navigation (NavigationSplitView)
   - Folder tree and note list (List with custom cells)
   - Settings screens
   - Dialogs and sheets
   - Toolbar and keyboard shortcuts

2. **UIKit via UIViewRepresentable** for:
   - WKWebView hosting the TipTap editor
   - Any complex gestures if needed
   - File picker integration

This is the "70% of professional teams use hybrid" approach.

### Question
**Does SwiftUI-first with UIKit for WebView sound right?**

yes
---

## 3. Database Recommendation

### Desktop SQLite Usage Analysis

From the schema, NoteCove uses:
- **FTS5** for full-text search (`notes_fts` virtual table with triggers)
- **Complex indexes** on multiple tables
- **Foreign keys** with cascade delete
- **BLOB columns** for binary CRDT state
- **11 schema migrations** with careful versioning
- **~20 tables** with specific relationships

### iOS SQLite Options

| Library | FTS5 Support | Schema Compatibility | Notes |
|---------|--------------|---------------------|-------|
| **GRDB.swift** | ✅ Full (FTS3/4/5 + custom tokenizers) | ✅ Excellent | [Most SQLite-native](https://github.com/groue/GRDB.swift/blob/master/Documentation/FullTextSearch.md) |
| **SQLite.swift** | ⚠️ Possible but manual | ✅ Good | Less feature-rich |
| **Core Data** | ❌ No native FTS | ❌ Different paradigm | [Would need SQLite workaround](https://blog.lunatech.com/posts/2013-01-24-ios-core-data-sqlite-full-text-search) |
| **SwiftData** | ❌ No FTS | ❌ Different paradigm | Even higher abstraction |

### My Recommendation: GRDB.swift

Reasons:
1. **FTS5 is a hard requirement** - Core Data and SwiftData don't support it
2. **Direct schema compatibility** - We can likely use the same SQL schema from desktop
3. **Performance** - [Direct SQLite access outperforms Core Data](https://fatbobman.com/en/posts/key-considerations-before-using-swiftdata/)
4. **BLOB support** - Native handling for CRDT state storage
5. **Recent updates** - v7.9.0 released December 2025
6. **SwiftUI integration** - [SharingGRDB](https://github.com/groue/GRDB.swift) for reactive updates

### Question
**Agreed on GRDB? Or would you prefer I explore alternatives further?**

GRDB - agree
---

## 4. File System Access - Clarified

Given your answer about iCloud for MVP, here's the refined question:

### How iCloud Drive Works on iOS

Two approaches:

**A. iCloud Container (Ubiquity Container)**
- Apple-managed folder: `~/Library/Mobile Documents/iCloud~com~notecove~NoteCove/`
- Automatic sync, no user folder picking
- Files visible in Files.app under "iCloud Drive > NoteCove"
- Works well, but path is fixed

**B. Document Picker + Security-Scoped Bookmarks**
- User picks any folder (iCloud Drive, Dropbox app folder, etc.)
- App stores "bookmark" to remember access
- More flexible, but more code
- Matches desktop behavior better

### For Desktop-iOS Sync Compatibility

On macOS desktop, users can choose any folder (e.g., `~/Library/Mobile Documents/com~apple~CloudDocs/NoteCove/`).

**Question:** For desktop-iOS to sync the same files:
1. Should iOS use a **fixed iCloud container** (simpler, but might be different path than desktop)?
2. Or should iOS let users **pick the same folder** desktop uses (more complex, but guaranteed compatibility)?

I lean toward option B for v1 since you said desktop-iOS sync is a hard requirement.

Agree B
---

## 5. MVP Feature Scoping

Based on your priority numbers (1-5), here's my proposed MVP scope:

### Phase 1: Read-Only Foundation (MVP)
**Goal: Sync with desktop, browse and read notes**

Included:
- [x] iCloud Drive storage directory selection
- [x] Desktop-iOS sync via same SD folder
- [x] Read-only note viewing (WebView renders TipTap content)
- [x] Folder tree navigation
- [x] Note list with preview
- [x] Basic full-text search
- [x] View images in notes
- [x] View tables, code blocks, lists
- [x] Activity logging for sync debugging

Not included in MVP:
- [ ] Editing (Phase 2)
- [ ] Comments
- [ ] Link unfurling
- [ ] Dark mode
- [ ] Tags filtering
- [ ] Inter-note links (can view, but not navigate)

### Question
**Is this MVP scope right? Anything to add/remove?**

That's correct
---

## 6. Remaining Clarifications

### 6.1 Instance ID for iOS
Desktop generates a unique `instanceId` per installation for CRDT vector clocks. For iOS:
- Should each iPhone/iPad have its own instance ID?
- What if user reinstalls the app? New ID or persist?

each iphone/ipad should have its own
if they reinstall... Don't have a strong preference here.

### 6.2 Profile on iOS
You said "just one profile" - should iOS:
- Have a single hardcoded "iOS" profile?
- Or let user name it during onboarding?
- Should profile be shared with desktop (same profile synced), or separate?

profiles should not be shared
hardcoded profile should be fine

### 6.3 App Bundle ID
You mentioned no existing Apple Developer setup. Do you have preferences for:
- Bundle ID: `com.notecove.NoteCove`? Or different?
- App name in App Store: "NoteCove" or "NoteCove for iPad"?

com.notecove.NoteCove
NoteCove for the name
---

## Summary of Pending Decisions

1. **Editor approach**: Hybrid (C) - agree?
2. **UI framework**: SwiftUI-first with UIKit for WebView - agree?
3. **Database**: GRDB.swift - agree?
4. **File access**: User picks folder (for desktop sync) - agree?
5. **MVP scope**: Read-only first - agree?
6. **Instance ID handling**: New ID per device?
7. **Profile approach**: Single profile, named or unnamed?
8. **Bundle ID preference**: `com.notecove.NoteCove`?

---

## Sources

- [SwiftUI vs UIKit in 2025](https://www.alimertgulec.com/en/blog/swiftui-vs-uikit-2025)
- [Building a rich text editor for UIKit/AppKit/SwiftUI](https://danielsaidi.com/blog/2022/06/13/building-a-rich-text-editor-for-uikit-appkit-and-swiftui)
- [TenTap Editor - TipTap for React Native](https://github.com/10play/10tap-editor)
- [GRDB Full Text Search Documentation](https://github.com/groue/GRDB.swift/blob/master/Documentation/FullTextSearch.md)
- [Key Considerations Before Using SwiftData](https://fatbobman.com/en/posts/key-considerations-before-using-swiftdata/)
- [Pigeon project using WKWebView + TipTap](https://www.emersonkirby.com/project/1-pigeon/)
