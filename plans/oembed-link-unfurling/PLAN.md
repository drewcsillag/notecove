# oEmbed Link Unfurling - Implementation Plan

**Overall Progress:** `0%`

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

| Phase | Description                         | Status   |
| ----- | ----------------------------------- | -------- |
| 1     | Foundation (IPC, database, fetcher) | 🟥 To Do |
| 2     | Link Chips (inline, hover preview)  | 🟥 To Do |
| 3     | Full Unfurl Cards (block-level)     | 🟥 To Do |
| 4     | Video/Rich Embeds (iframe, players) | 🟥 To Do |
| 5     | Registry Updates & Polish           | 🟥 To Do |

---

## Phase 1: Foundation

**Goal**: Build the backend infrastructure for fetching and caching oEmbed data.

See: [PLAN-PHASE-1.md](./PLAN-PHASE-1.md)

### Tasks

- [ ] 🟥 **1.1 Database Schema**
  - [ ] 🟥 Add `oembed_cache` table (url, data, fetched_at, provider)
  - [ ] 🟥 Add repository methods (upsert, get, delete, cleanup)
  - [ ] 🟥 Write tests for repository

- [ ] 🟥 **1.2 oEmbed Types**
  - [ ] 🟥 Define TypeScript types for oEmbed responses (photo, video, link, rich)
  - [ ] 🟥 Define types for provider registry schema
  - [ ] 🟥 Add to shared package

- [ ] 🟥 **1.3 Registry Bundling**
  - [ ] 🟥 Download providers.json at build time
  - [ ] 🟥 Create registry lookup utility (URL → provider endpoint)
  - [ ] 🟥 Write tests for URL matching

- [ ] 🟥 **1.4 oEmbed Fetcher Service**
  - [ ] 🟥 Create OEmbedService class in main process
  - [ ] 🟥 Implement registry-based endpoint lookup
  - [ ] 🟥 Implement HTML discovery fallback
  - [ ] 🟥 Implement HTTP fetching via Electron `net`
  - [ ] 🟥 Implement caching logic
  - [ ] 🟥 Write tests for fetcher

- [ ] 🟥 **1.5 IPC Handlers**
  - [ ] 🟥 Create oembed-handlers.ts
  - [ ] 🟥 Implement `oembed:unfurl` handler
  - [ ] 🟥 Implement `oembed:refresh` handler
  - [ ] 🟥 Implement `oembed:clearCache` handler
  - [ ] 🟥 Register handlers in index.ts
  - [ ] 🟥 Write tests for handlers

- [ ] 🟥 **1.6 Preload API**
  - [ ] 🟥 Create oembed-api.ts
  - [ ] 🟥 Expose unfurl/refresh/clearCache methods
  - [ ] 🟥 Add TypeScript types to electron.d.ts

- [ ] 🟥 **1.7 Favicon Service**
  - [ ] 🟥 Add favicon_cache table
  - [ ] 🟥 Create FaviconService class
  - [ ] 🟥 Add IPC handler and preload API

- [ ] 🟥 **1.8 Thumbnail Proxy**
  - [ ] 🟥 Add thumbnail_cache table
  - [ ] 🟥 Create ThumbnailProxy class
  - [ ] 🟥 Add IPC handler and preload API

- [ ] 🟥 **1.9 Debug Infrastructure**
  - [ ] 🟥 Add logging to OEmbedService
  - [ ] 🟥 Create OEmbedInspector component for Storage Inspector
  - [ ] 🟥 Expose debug helper on window

---

## Phase 2: Link Chips

**Goal**: Render links as compact chips with hover previews.

See: [PLAN-PHASE-2.md](./PLAN-PHASE-2.md)

### Tasks

- [ ] 🟥 **2.1 WebLink Extension Updates**
  - [ ] 🟥 Add `displayMode` attribute to WebLink mark (link | chip | unfurl)
  - [ ] 🟥 Store display mode preference with link

- [ ] 🟥 **2.2 Link Chip Rendering**
  - [ ] 🟥 Create LinkChip component (favicon + truncated title)
  - [ ] 🟥 Implement favicon fetching (via main process)
  - [ ] 🟥 Add CSS styles for chip appearance
  - [ ] 🟥 Write tests for chip rendering

- [ ] 🟥 **2.3 Hover Preview Card**
  - [ ] 🟥 Create LinkPreviewCard component
  - [ ] 🟥 Integrate with Floating UI for positioning
  - [ ] 🟥 Show on chip hover (with delay)
  - [ ] 🟥 Display: thumbnail, title, description, URL
  - [ ] 🟥 Write tests for preview card

- [ ] 🟥 **2.4 Context Detection**
  - [ ] 🟥 Detect link context (heading, list, blockquote, paragraph)
  - [ ] 🟥 Auto-set display mode based on context
  - [ ] 🟥 Write tests for context detection

- [ ] 🟥 **2.5 Multiple Links Detection**
  - [ ] 🟥 Detect multiple links in same paragraph
  - [ ] 🟥 Auto-convert to chips when multiple
  - [ ] 🟥 Write tests

---

## Phase 3: Full Unfurl Cards

**Goal**: Render rich preview cards as block-level elements.

See: [PLAN-PHASE-3.md](./PLAN-PHASE-3.md)

### Tasks

- [ ] 🟥 **3.1 Unfurl Block Node**
  - [ ] 🟥 Create OEmbedUnfurl TipTap node extension
  - [ ] 🟥 Define node attributes (url, displayMode)
  - [ ] 🟥 Implement NodeView with React component

- [ ] 🟥 **3.2 Unfurl Card Component**
  - [ ] 🟥 Create UnfurlCard component
  - [ ] 🟥 Layout: thumbnail left, title/desc/url right
  - [ ] 🟥 Loading state with skeleton
  - [ ] 🟥 Error state with retry option
  - [ ] 🟥 CSS styles (light/dark theme)
  - [ ] 🟥 Write tests

- [ ] 🟥 **3.3 Unfurl Toolbar**
  - [ ] 🟥 Create UnfurlToolbar component
  - [ ] 🟥 Show on hover/selection
  - [ ] 🟥 Actions: Convert to chip, Remove unfurl, Refresh, Open in browser
  - [ ] 🟥 Write tests

- [ ] 🟥 **3.4 Lazy Loading & Queue**
  - [ ] 🟥 Implement Intersection Observer for visible detection
  - [ ] 🟥 Implement unfurl queue (max 3 concurrent)
  - [ ] 🟥 Priority: visible first, then queued
  - [ ] 🟥 Write tests

- [ ] 🟥 **3.5 Auto-Unfurl on Link Insert**
  - [ ] 🟥 Detect new link insertion
  - [ ] 🟥 Trigger unfurl fetch
  - [ ] 🟥 Insert unfurl block below paragraph (if in paragraph context)
  - [ ] 🟥 Write tests

---

## Phase 4: Video/Rich Embeds

**Goal**: Embed playable videos and sandboxed rich content.

See: [PLAN-PHASE-4.md](./PLAN-PHASE-4.md)

### Tasks

- [ ] 🟥 **4.1 Video Embed Component**
  - [ ] 🟥 Create VideoEmbed component
  - [ ] 🟥 Support YouTube, Vimeo, and other major providers
  - [ ] 🟥 Responsive sizing
  - [ ] 🟥 Play/pause controls
  - [ ] 🟥 Write tests

- [ ] 🟥 **4.2 Rich Content Sandbox**
  - [ ] 🟥 Create sandboxed iframe wrapper
  - [ ] 🟥 Define allowed providers whitelist
  - [ ] 🟥 Implement CSP headers
  - [ ] 🟥 Write tests

- [ ] 🟥 **4.3 Provider-Specific Handling**
  - [ ] 🟥 YouTube: Extract video ID, use embed URL
  - [ ] 🟥 Vimeo: Extract video ID, use embed URL
  - [ ] 🟥 Twitter/X: Handle tweet embeds
  - [ ] 🟥 GitHub: Handle gist/repo embeds
  - [ ] 🟥 Write tests for each provider

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
└── thumbnail-proxy.ts       # Thumbnail proxy + caching

packages/desktop/src/main/ipc/handlers/
└── oembed-handlers.ts       # IPC handlers

packages/desktop/src/preload/api/
└── oembed-api.ts            # Preload API

packages/desktop/src/renderer/src/components/StorageInspector/
└── OEmbedInspector.tsx      # Debug inspector tab

packages/desktop/src/renderer/src/components/EditorPanel/
├── extensions/
│   └── OEmbedUnfurl.ts      # Block node extension
├── LinkChip.tsx             # Chip component
├── LinkPreviewCard.tsx      # Hover preview
├── UnfurlCard.tsx           # Block unfurl card
├── UnfurlToolbar.tsx        # Toolbar on hover
└── VideoEmbed.tsx           # Video player
```

---

## Questions Reference

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up research and answers
- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Staff engineer review of the plan
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Questions from plan critique
