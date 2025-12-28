# oEmbed Link Unfurling - Implementation Plan

**Overall Progress:** `90%`

## Summary

Implement oEmbed-based link unfurling in the note editor, allowing links to display as rich preview cards or compact chips. Follows patterns established by Google Docs and Notion.

## Requirements Summary

| Requirement            | Decision                                                   |
| ---------------------- | ---------------------------------------------------------- |
| Default behavior       | Full unfurl in paragraphs, chips elsewhere                 |
| User control           | Per-link toggle, persisted                                 |
| Automatic unfurling    | Yes, on link creation                                      |
| Registry               | Bundle at build + periodic delta updates                   |
| Discovery              | User setting, default enabled                              |
| Cache                  | Until manually refreshed                                   |
| Rate limiting          | Visible only, max 3 concurrent, queue others               |
| Storage                | **In document CRDT** (syncs across devices, works offline) |
| Rich HTML              | Sandbox in iframe                                          |
| Video embeds           | Playable inline                                            |
| Link text preservation | Text becomes chip, unfurl is separate block                |
| iOS compatibility      | Desktop only for now (don't preclude iOS)                  |
| Markdown export        | Link with title: `[Title](url)`                            |
| Clipboard              | Rich format if supported, else plain URL                   |
| Thumbnail caching      | Cache forever (until manual clear)                         |
| Debug tooling          | Yes, add oEmbed tab to Storage Inspector                   |

## Phases Overview

| Phase | Description                         | Status      |
| ----- | ----------------------------------- | ----------- |
| 1     | Foundation (IPC, database, fetcher) | ✅ Complete |
| 2     | Link Chips (inline, hover preview)  | ✅ Complete |
| 3     | Full Unfurl Cards (block-level)     | ✅ Complete |
| 4     | Video/Rich Embeds (iframe, players) | ✅ Complete |
| 5     | Registry Updates & Polish           | 🟥 To Do    |

---

## Phase 1: Foundation ✅

**Goal**: Build the backend infrastructure for fetching and caching oEmbed data.

See: [PLAN-PHASE-1.md](./PLAN-PHASE-1.md)

### Tasks

- [x] ✅ **1.1 Database Schema**
  - [x] ✅ Add cache tables (oembed_fetch_cache, favicon_cache, thumbnail_cache)
  - [x] ✅ Add repository methods (OEmbedRepository)
  - [x] ✅ Add v11 migration for oEmbed tables

- [x] ✅ **1.2 oEmbed Types**
  - [x] ✅ Define TypeScript types for oEmbed responses (photo, video, link, rich)
  - [x] ✅ Define types for provider registry schema
  - [x] ✅ Add to shared package

- [x] ✅ **1.3 Registry Bundling**
  - [x] ✅ Bundle providers.json from oembed.com
  - [x] ✅ Create registry lookup utility (OEmbedRegistry)
  - [x] ✅ Implement glob-style URL matching

- [x] ✅ **1.4 oEmbed Fetcher Service**
  - [x] ✅ Create OEmbedService class in main process
  - [x] ✅ Implement registry-based endpoint lookup
  - [x] ✅ Implement HTML discovery fallback (oembed-discovery.ts)
  - [x] ✅ Implement HTTP fetching via Electron `net`
  - [x] ✅ Implement caching logic

- [x] ✅ **1.5 IPC Handlers**
  - [x] ✅ Create oembed-handlers.ts
  - [x] ✅ Implement `oembed:unfurl` handler
  - [x] ✅ Implement `oembed:refresh` handler
  - [x] ✅ Implement `oembed:clearCache` handler
  - [x] ✅ Implement `oembed:getCacheStats` handler
  - [x] ✅ Implement `oembed:getFavicon` handler
  - [x] ✅ Implement debug handlers (listFavicons, listThumbnails, etc.)
  - [x] ✅ Register handlers in index.ts

- [x] ✅ **1.6 Preload API**
  - [x] ✅ Create oembed-api.ts
  - [x] ✅ Expose unfurl/refresh/clearCache/getCacheStats/getFavicon methods
  - [x] ✅ Expose debug methods

- [x] ✅ **1.7 Favicon Service**
  - [x] ✅ Add favicon_cache table
  - [x] ✅ Create FaviconService class (uses Google favicon API + fallback)
  - [x] ✅ Add IPC handler (oembed:getFavicon) and preload API

- [ ] 🟡 **1.8 Thumbnail Proxy** (deferred - not needed for chips)
  - [x] ✅ Add thumbnail_cache table
  - [ ] 🟥 Create ThumbnailProxy class
  - [ ] 🟥 Add IPC handler and preload API

- [x] ✅ **1.9 Debug Infrastructure**
  - [x] ✅ Add logging to OEmbedService
  - [x] ✅ Create OEmbedInspector component for Storage Inspector
  - [x] ✅ Add debug IPC handlers for cache inspection

---

## Phase 2: Link Chips ✅

**Goal**: Render links as compact chips with hover previews.

See: [PLAN-PHASE-2.md](./PLAN-PHASE-2.md)

### Tasks

- [x] ✅ **2.1 WebLink Extension Updates**
  - [x] ✅ Add `displayMode` attribute to WebLink mark (auto | chip | unfurl | link)
  - [x] ✅ Store display mode preference with link

- [x] ✅ **2.2 Link Chip Rendering**
  - [x] ✅ Create chip rendering via WebLinkChipPlugin (ProseMirror decorations)
  - [x] ✅ Implement favicon fetching (via main process IPC)
  - [x] ✅ Implement oEmbed title fetching
  - [x] ✅ Add CSS styles for chip appearance (.link-chip, etc.)
  - [x] ✅ Fallback to full URL when no oEmbed title available

- [x] ✅ **2.3 Hover Preview Card**
  - [x] ✅ Create LinkPreviewCard component
  - [x] ✅ Integrate with Floating UI for positioning (via createFloatingPopup)
  - [x] ✅ Show on chip hover (with delay) - via useChipHoverPreview hook
  - [x] ✅ Display: thumbnail, title, description, URL
  - [ ] 🟡 Write tests for preview card integration (deferred)

- [x] ✅ **2.4 Context Detection**
  - [x] ✅ Detect link context (heading, list, blockquote, paragraph, code, table)
  - [x] ✅ Auto-set display mode based on context (all contexts → chip for now)
  - [x] ✅ Write tests for context detection (linkContext.test.ts)

- [x] ✅ **2.5 Multiple Links Detection**
  - [x] ✅ Detect multiple links in same paragraph (countLinksInParagraph)
  - [x] ✅ Auto-convert to chips when multiple
  - [x] ✅ Write tests

- [x] ✅ **2.6 Chip Decoration Plugin**
  - [x] ✅ Create WebLinkChipPlugin with ProseMirror decorations
  - [x] ✅ Create chip DOM element factory
  - [x] ✅ Handle click to open in browser
  - [x] ✅ Handle hover events for preview card (dispatches custom events)

---

## Phase 3: Full Unfurl Cards ✅

**Goal**: Render rich preview cards as block-level elements.

See: [PLAN-PHASE-3.md](./PLAN-PHASE-3.md)

### Tasks

- [x] ✅ **3.1 Unfurl Block Node**
  - [x] ✅ Create OEmbedUnfurl TipTap node extension
  - [x] ✅ Define node attributes (url, oembedType, title, description, etc.)
  - [x] ✅ Implement NodeView with React component

- [x] ✅ **3.2 Unfurl Card Component**
  - [x] ✅ Create UnfurlCard component
  - [x] ✅ Layout: inline, text on top, image below (preserves aspect ratio)
  - [x] ✅ Loading state with skeleton
  - [x] ✅ Error state with retry option
  - [x] ✅ CSS styles (via MUI sx props, supports light/dark theme)
  - [x] ✅ Write tests (UnfurlCard.test.tsx)

- [x] ✅ **3.3 Unfurl Toolbar**
  - [x] ✅ Integrated into UnfurlCard (shows on hover)
  - [x] ✅ Actions: Refresh, Delete, Open in browser, Convert to chip

- [ ] 🟡 **3.4 Lazy Loading & Queue** (deferred to Phase 5)
  - [ ] 🟡 Implement Intersection Observer for visible detection
  - [ ] 🟡 Implement unfurl queue (max 3 concurrent)
  - [ ] 🟡 Priority: visible first, then queued

- [x] ✅ **3.5 Auto-Unfurl on Link Insert**
  - [x] ✅ Detect new link insertion (appendTransaction plugin)
  - [x] ✅ Check context - only paragraphs with single link
  - [x] ✅ Insert unfurl block below paragraph

- [x] ✅ **3.6 Chip ↔ Unfurl Conversion**
  - [x] ✅ Convert unfurl to chip (toolbar button)
  - [x] ✅ Convert chip to unfurl (expand button in hover preview)
  - [x] ✅ Preserve displayMode in link mark to prevent re-unfurling

- [x] ✅ **3.7 Fallback for Sites Without oEmbed**
  - [x] ✅ Open Graph / Twitter Card metadata scraping
  - [x] ✅ Tolerate missing oEmbed fields (only 'type' required)

---

## Phase 4: Video/Rich Embeds ✅

**Goal**: Embed playable videos and sandboxed rich content.

See: [PLAN-PHASE-4.md](./PLAN-PHASE-4.md)

### Tasks

- [x] ✅ **4.1 Video Embed Component**
  - [x] ✅ Create VideoEmbed component with thumbnail preview + play button
  - [x] ✅ Support YouTube, Vimeo, Dailymotion, Twitch, Loom
  - [x] ✅ Responsive sizing with aspect ratio support
  - [x] ✅ Toolbar: refresh, delete, convert to chip, open in browser
  - [x] ✅ Write tests (15 tests in VideoEmbed.test.tsx)

- [x] ✅ **4.2 Rich Content Sandbox**
  - [x] ✅ Create RichEmbed component with sandboxed iframe
  - [x] ✅ Define allowed providers whitelist (Twitter, Spotify, GitHub, etc.)
  - [x] ✅ Implement CSP headers and sandbox attributes
  - [x] ✅ Auto-resize iframe based on content height
  - [x] ✅ Write tests (22 tests in RichEmbed.test.tsx)

- [x] ✅ **4.3 Provider-Specific Handling**
  - [x] ✅ Create providerEmbed.ts utilities
  - [x] ✅ YouTube: Extract video ID from multiple URL formats
  - [x] ✅ Vimeo: Extract video ID, use embed URL
  - [x] ✅ Dailymotion: Extract video ID
  - [x] ✅ Twitch: Handle channel and video URLs
  - [x] ✅ Loom: Handle share URLs
  - [x] ✅ Fallback to oEmbed html for other video/rich types
  - [x] ✅ Write tests (29 tests in providerEmbed.test.ts)

- [x] ✅ **4.4 Integrate with OEmbedUnfurl**
  - [x] ✅ Update OEmbedUnfurl NodeView to detect video/rich types
  - [x] ✅ Route to VideoEmbed, RichEmbed, or UnfurlCard based on type
  - [x] ✅ Dynamic imports for code splitting

---

## Phase 5: Registry Updates & Polish

**Goal**: Keep registry updated and add user preferences.

See: [PLAN-PHASE-5.md](./PLAN-PHASE-5.md)

### Tasks

- [ ] 🟥 **5.1 Registry Delta Updates**
  - [ ] 🟥 Implement periodic check (weekly) for registry updates
  - [ ] 🟥 Store registry version in database
  - [ ] 🟥 Download and merge updates
  - [ ] 🟥 Write tests

- [ ] 🟥 **5.2 User Preferences**
  - [ ] 🟥 Add oEmbed settings to preferences
  - [ ] 🟥 Discovery enabled/disabled toggle
  - [ ] 🟥 Default display mode preference
  - [ ] 🟥 Write tests

- [ ] 🟥 **5.3 Cache Management**
  - [ ] 🟥 Add "Refresh all" option in preferences
  - [ ] 🟥 Add "Clear cache" option
  - [ ] 🟥 Show cache stats (count, size)
  - [ ] 🟥 Write tests

- [ ] 🟥 **5.4 Error Handling Polish**
  - [ ] 🟥 Graceful degradation when fetch fails
  - [ ] 🟥 Retry logic with exponential backoff
  - [ ] 🟥 User-friendly error messages
  - [ ] 🟥 Write tests

- [ ] 🟥 **5.5 Export Behavior**
  - [ ] 🟥 Markdown export: unfurl → `[Title](url)`
  - [ ] 🟥 Clipboard: rich format with plain fallback
  - [ ] 🟥 Write tests

- [ ] 🟥 **5.6 Offline Handling**
  - [ ] 🟥 Show "Offline" state for new links
  - [ ] 🟥 Queue and retry on reconnection
  - [ ] 🟥 Write tests

- [ ] 🟥 **5.7 Documentation**
  - [ ] 🟥 Update website docs with oEmbed feature
  - [ ] 🟥 Add screenshots

---

## Architecture Notes

### Data Flow

```
User pastes link (e.g., [Check this out](https://youtube.com/...))
       ↓
WebLink extension detects new link
       ↓
Check context (heading/list/paragraph)
       ↓
If paragraph with single link:
  → Convert link text to chip (inline)
  → Insert OEmbedUnfurl block below paragraph
  → Trigger unfurl fetch via IPC
Else (heading/list/blockquote/multiple links):
  → Convert to LinkChip only (no unfurl block)
       ↓
Main process:
  → Check cache (return if fresh)
  → Lookup provider in registry
  → If not found, attempt discovery
  → Fetch oEmbed data + thumbnail + favicon
  → Cache all results
  → Return to renderer
       ↓
Renderer updates display
```

### Storage

- **Document (CRDT)**: Full oEmbed data stored in node attributes
  - Link chips: displayMode + cached title/favicon in WebLink mark
  - Unfurl blocks: Full oEmbed response (title, description, thumbnail, html) in OEmbedUnfurl node
- **Database**: Temporary fetch cache only (deduplication during session)
  - Favicon cache (persisted - small, shared across docs)
  - Thumbnail cache (persisted - avoids re-fetch)

### File Structure

```
packages/shared/src/oembed/
├── types.ts                 # oEmbed types
├── registry.ts              # Provider registry lookup
└── providers.json           # Bundled registry (build artifact)

packages/desktop/src/main/oembed/
├── oembed-service.ts        # Core fetching logic
├── oembed-discovery.ts      # HTML discovery
├── favicon-service.ts       # Favicon fetching + caching
├── metadata-scraper.ts      # Open Graph / Twitter Card fallback
└── thumbnail-proxy.ts       # Thumbnail proxy + caching

packages/desktop/src/main/ipc/handlers/
└── oembed-handlers.ts       # IPC handlers

packages/desktop/src/preload/api/
└── oembed-api.ts            # Preload API

packages/desktop/src/renderer/src/components/StorageInspector/
└── OEmbedInspector.tsx      # Debug inspector tab

packages/desktop/src/renderer/src/components/EditorPanel/
├── extensions/
│   ├── WebLinkChipPlugin.ts # ProseMirror chip decorations
│   └── OEmbedUnfurl.ts      # Block node extension (Phase 3+4)
├── utils/
│   └── providerEmbed.ts     # Provider URL extraction (Phase 4)
├── LinkChip.tsx             # Chip component
├── LinkPreviewCard.tsx      # Hover preview card
├── useChipHoverPreview.tsx  # Hover state management hook
├── UnfurlCard.tsx           # Block unfurl card (Phase 3)
├── VideoEmbed.tsx           # Video player iframe (Phase 4)
└── RichEmbed.tsx            # Sandboxed rich embed (Phase 4)
```

---

## Questions Reference

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up research and answers
- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Staff engineer review of the plan
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Questions from plan critique
