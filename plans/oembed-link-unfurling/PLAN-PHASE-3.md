# Phase 3: Full Unfurl Cards

**Progress:** `100%` ✅

**Goal**: Render rich preview cards as block-level elements.

**Depends on**: Phase 1 (Foundation) ✅, Phase 2 (Link Chips) ✅

## Implementation Notes

Phase 3 is complete:

- **OEmbedUnfurl Extension**: Created TipTap node extension with all attributes
- **UnfurlCard Component**: Inline layout (text on top, image below), preserves aspect ratio
- **Auto-Unfurl**: Plugin detects new links and auto-inserts unfurl blocks in paragraphs
- **Toolbar**: Integrated into UnfurlCard (refresh, delete, open in browser, convert to chip)
- **Chip ↔ Unfurl Conversion**: Bidirectional conversion between chips and unfurl cards
- **Fallback Scraping**: Open Graph / Twitter Card metadata for sites without oEmbed
- **Error Tolerance**: Only requires 'type' field from oEmbed response

**Deferred to Phase 5**: Lazy loading, queue management

---

## 3.1 Unfurl Block Node

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/extensions/OEmbedUnfurl.ts`

### Node Definition

**Storage Decision**: Full oEmbed data stored in node attributes (syncs via CRDT).

```typescript
export const OEmbedUnfurl = Node.create({
  name: 'oembedUnfurl',
  group: 'block',
  atom: true, // Can't edit inside
  draggable: true, // Can drag to reorder

  addAttributes() {
    return {
      // Core
      url: { default: null },
      displayMode: { default: 'unfurl' }, // 'unfurl' | 'chip'

      // oEmbed data (stored in document, syncs across devices)
      oembedType: { default: null }, // 'photo' | 'video' | 'link' | 'rich'
      title: { default: null },
      description: { default: null },
      thumbnailUrl: { default: null },
      thumbnailDataUrl: { default: null }, // Base64 for offline
      providerName: { default: null },
      providerUrl: { default: null },
      authorName: { default: null },
      html: { default: null }, // For video/rich embeds
      width: { default: null },
      height: { default: null },

      // Metadata
      fetchedAt: { default: null }, // Timestamp for staleness check
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-oembed-unfurl]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-oembed-unfurl': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(UnfurlCardNodeView);
  },
});
```

### NodeView Component

```typescript
function UnfurlCardNodeView({ node, selected, deleteNode, updateAttributes }: NodeViewProps) {
  const { url, displayMode, title, description, thumbnailDataUrl, fetchedAt } = node.attrs;

  // Data is stored in the node - no fetching needed for display
  const hasData = title !== null;
  const isStale = fetchedAt && (Date.now() - fetchedAt > 30 * 24 * 60 * 60 * 1000); // 30 days

  // Refresh handler - fetches new data and updates node attributes
  const handleRefresh = async () => {
    const result = await window.electronAPI.oembed.unfurl(url);
    if (result.success && result.data) {
      updateAttributes({
        oembedType: result.data.type,
        title: result.data.title,
        description: result.data.description,
        thumbnailUrl: result.data.thumbnail_url,
        thumbnailDataUrl: await fetchThumbnailAsDataUrl(result.data.thumbnail_url),
        providerName: result.data.provider_name,
        html: result.data.html,
        fetchedAt: Date.now(),
      });
    }
  };

  if (displayMode === 'chip') {
    return <LinkChip url={url} title={title} />;
  }

  return (
    <UnfurlCard
      url={url}
      title={title}
      description={description}
      thumbnailDataUrl={thumbnailDataUrl}
      hasData={hasData}
      isStale={isStale}
      selected={selected}
      onRefresh={handleRefresh}
      onDelete={deleteNode}
    />
  );
}
```

### Tasks

- [x] ✅ Create OEmbedUnfurl.ts extension
- [x] ✅ Define node attributes
- [x] ✅ Create NodeView wrapper (uses dynamic React rendering)
- [x] ✅ Register in getEditorExtensions.ts
- [ ] 🟡 Write tests: `OEmbedUnfurl.test.ts` (deferred)

---

## 3.2 Unfurl Card Component

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/UnfurlCard.tsx`

### Component Design

```typescript
interface UnfurlCardProps {
  url: string;
  data?: OEmbedResponse;
  loading?: boolean;
  error?: string;
  selected?: boolean;
  onConvertToChip?: () => void;
  onRemove?: () => void;
  onRefresh?: () => void;
}
```

### Visual Design

```
┌─────────────────────────────────┐
│ Page Title Here                 │
│ Description text that can wrap  │
│ 🔗 example.com                  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │       thumbnail             │ │
│ │   (preserves aspect ratio)  │ │
│ │                             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

- Inline layout: sizes to content, not full width
- Text on top, image below
- Thumbnail: preserves aspect ratio (max-width: 100%, height: auto)
- Border: subtle, rounded corners
- On hover: show toolbar (refresh, delete, open in browser, convert to chip)
- When selected: highlight border
```

### States

1. **Loading** - Skeleton placeholder
2. **Error** - Error message with retry button
3. **Success** - Full card with data
4. **No thumbnail** - Layout without image (title/desc only)

### CSS

```css
.unfurl-card {
  display: flex;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin: 8px 0;
  cursor: pointer;
  transition: border-color 0.2s;
}

.unfurl-card:hover {
  border-color: var(--border-color-hover);
}

.unfurl-card.selected {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px var(--primary-color-alpha);
}

.unfurl-card-thumbnail {
  flex-shrink: 0;
  width: 120px;
  height: 90px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--thumbnail-placeholder);
}

.unfurl-card-content {
  flex: 1;
  min-width: 0; /* Allow text truncation */
}

.unfurl-card-title {
  font-weight: 600;
  margin-bottom: 4px;
  /* Truncate to 2 lines */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.unfurl-card-description {
  color: var(--text-secondary);
  font-size: 0.9em;
  /* Truncate to 3 lines */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.unfurl-card-url {
  margin-top: 8px;
  font-size: 0.85em;
  color: var(--text-tertiary);
}
```

### Tasks

- [x] ✅ Create UnfurlCard component
- [x] ✅ Implement loading skeleton
- [x] ✅ Implement error state with retry
- [x] ✅ Handle missing thumbnail gracefully
- [x] ✅ Add CSS styles (uses MUI sx props)
- [x] ✅ Support light/dark themes (via MUI theme)
- [x] ✅ Write tests: `UnfurlCard.test.tsx`

---

## 3.3 Unfurl Toolbar

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/UnfurlToolbar.tsx`

### Component Design

```typescript
interface UnfurlToolbarProps {
  onConvertToChip: () => void;
  onConvertToLink: () => void;
  onRefresh: () => void;
  onOpenInBrowser: () => void;
  onDelete: () => void;
}
```

### Visual Design

```
┌─────────────────────────────────────────────────────┐
│           [💊] [🔗] [⟳] [↗] [🗑]                    │
│ ┌─────────────┐  Page Title Here                    │
│ ...                                                 │

Toolbar appears on hover/selection:
- 💊 Convert to chip
- 🔗 Convert to plain link
- ⟳  Refresh preview
- ↗  Open in browser
- 🗑  Remove unfurl block
```

### Tasks

- [x] ✅ Create UnfurlToolbar component (integrated directly into UnfurlCard)
- [x] ✅ Position above card on hover (shows on hover/selection)
- [x] ✅ Implement all actions (refresh, delete, open in browser, convert to chip)
- [ ] 🟡 Keyboard shortcuts (Delete, etc.) - deferred to Phase 5
- [x] ✅ Toolbar tested via UnfurlCard.test.tsx

---

## 3.4 Lazy Loading & Queue

**File**: `packages/desktop/src/renderer/src/hooks/useOEmbedQueue.ts`

### Queue Manager

```typescript
interface QueueItem {
  url: string;
  priority: 'visible' | 'queued';
  resolve: (result: OEmbedResult) => void;
}

class OEmbedQueue {
  private maxConcurrent = 3;
  private queue: QueueItem[] = [];
  private active = 0;

  enqueue(url: string, priority: 'visible' | 'queued'): Promise<OEmbedResult>;
  private processNext(): void;
  prioritize(url: string): void; // Move to front when becomes visible
}
```

### Hook

```typescript
function useOEmbedUnfurl(url: string, isVisible: boolean): OEmbedResult | null {
  const [result, setResult] = useState<OEmbedResult | null>(null);

  useEffect(() => {
    const priority = isVisible ? 'visible' : 'queued';
    oembedQueue.enqueue(url, priority).then(setResult);
  }, [url, isVisible]);

  return result;
}
```

### Intersection Observer Integration

```typescript
function UnfurlCardNodeView({ node, ... }) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref);
  const result = useOEmbedUnfurl(node.attrs.url, isVisible);

  return <div ref={ref}>...</div>;
}
```

### Tasks

- [ ] 🟡 Create OEmbedQueue class (deferred - not critical for MVP)
- [ ] 🟡 Create useOEmbedUnfurl hook (deferred)
- [ ] 🟡 Create useIntersectionObserver hook (deferred)
- [ ] 🟡 Integrate with UnfurlCard (deferred)
- [ ] 🟡 Write tests: `useOEmbedQueue.test.ts` (deferred)

**Note**: Lazy loading deferred to a later phase. Current implementation fetches immediately.

---

## 3.5 Auto-Unfurl on Link Insert

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/extensions/WebLink.ts`

### Link Text Preservation (User Decision: Option C)

When a markdown link like `[Check this out](https://youtube.com/...)` is pasted:

1. The link text "Check this out" becomes a **chip** (inline)
2. The unfurl block is inserted as a **separate block** below the paragraph

```
🎬 Check this out          ← Link text becomes chip (inline)

┌─────────────────────┐    ← Unfurl block (separate)
│ Video Title         │
│ youtube.com         │
└─────────────────────┘
```

This preserves the original link text while showing the rich preview.

### Logic

When a new link is inserted in a paragraph (not heading/list/etc), automatically:

1. Convert the link text to a chip
2. Insert an unfurl block after the paragraph

```typescript
// In WebLink extension
addProseMirrorPlugins() {
  return [
    new Plugin({
      appendTransaction(transactions, oldState, newState) {
        // Detect new links added
        for (const tr of transactions) {
          if (!tr.docChanged) continue;

          const newLinks = findNewLinks(oldState, newState);
          for (const { url, pos } of newLinks) {
            const context = detectLinkContext(newState, pos);
            if (context === 'paragraph' && !hasMultipleLinks(newState, pos)) {
              // 1. Set link display mode to 'chip'
              // 2. Insert unfurl block after paragraph
              return insertChipAndUnfurlBlock(newState, pos, url);
            }
          }
        }
        return null;
      },
    }),
  ];
}
```

### Tasks

- [x] ✅ Detect new link insertions (via appendTransaction in WebLink)
- [x] ✅ Check context and multi-link status (uses detectLinkContext, countLinksInParagraph)
- [x] ✅ Convert link to chip display mode (via WebLinkChipPlugin)
- [x] ✅ Insert OEmbedUnfurl node after paragraph
- [x] ✅ Handle paste of multiple links (all become chips, no unfurl)
- [ ] 🟡 Write tests for auto-unfurl (deferred)

---

## 3.6 Chip ↔ Unfurl Conversion

**Files**:

- `UnfurlCard.tsx` - Convert to chip button
- `useChipHoverPreview.tsx` - Expand to unfurl button
- `TipTapEditor.tsx` - Handle expand event

### Convert Unfurl → Chip

1. User clicks "Convert to chip" in unfurl toolbar
2. Find the associated link mark in the document
3. Update link's `displayMode` attribute to 'chip'
4. Delete the unfurl block

### Convert Chip → Unfurl

1. User clicks "Expand" in chip hover preview
2. Dispatch `CHIP_EXPAND_TO_CARD_EVENT` custom event
3. TipTapEditor listener finds the link and its paragraph
4. Check context - only expand in paragraphs
5. Insert OEmbedUnfurl block after paragraph
6. Close the hover preview

### DisplayMode Preservation

When a link has `displayMode: 'chip'` explicitly set, the auto-unfurl plugin skips it to prevent re-creating the unfurl block that the user just converted.

### Tasks

- [x] ✅ Add onConvertToChip to UnfurlCard toolbar
- [x] ✅ Implement handleConvertToChip in OEmbedUnfurl NodeView
- [x] ✅ Add expand button to LinkPreviewCard
- [x] ✅ Create CHIP_EXPAND_TO_CARD_EVENT custom event
- [x] ✅ Handle expand event in TipTapEditor
- [x] ✅ Preserve displayMode='chip' to prevent re-unfurling

---

## 3.7 Open Graph Fallback

**File**: `packages/desktop/src/main/oembed/metadata-scraper.ts`

### Purpose

Many sites (e.g., Reddit) don't properly implement oEmbed but do have Open Graph or Twitter Card meta tags. This fallback scrapes those tags when oEmbed fails.

### Fallback Chain

1. Try oEmbed registry lookup
2. If not found, try HTML discovery for oEmbed endpoint
3. If oEmbed fails or returns incomplete data, scrape Open Graph tags
4. If still no data, return error

### Scraped Tags

- `og:title` / `twitter:title` / `<title>` → title
- `og:description` / `twitter:description` / `<meta name="description">` → description
- `og:image` / `twitter:image` → thumbnail_url
- `og:site_name` → provider_name
- `og:url` / canonical → provider_url

### Error Tolerance

oEmbed spec requires `type` and `version` fields, but many providers (Reddit, etc.) omit `version`. Changed validation to:

- Only require `type` field
- Default `version` to "1.0" if missing

### Tasks

- [x] ✅ Create metadata-scraper.ts with scrapeMetadata function
- [x] ✅ Parse HTML with regex (avoid heavy DOM parser dependency)
- [x] ✅ Integrate into OEmbedService.unfurl() fallback chain
- [x] ✅ Relax oEmbed validation (only require 'type')
- [x] ✅ Default missing 'version' to "1.0"

---

## Testing Strategy

### Unit Tests

1. **UnfurlCard component** - All states rendered correctly
2. **UnfurlToolbar** - Actions fire correctly
3. **OEmbedQueue** - Concurrency limits, priority handling
4. **Auto-unfurl logic** - Correct insertion points

### Integration Tests

1. **Full unfurl flow** - Paste link → unfurl block appears
2. **Toolbar actions** - Convert to chip works
3. **Lazy loading** - Only visible unfurls fetch

---

## Definition of Done

- [x] ✅ Pasting a link in paragraph auto-inserts unfurl block
- [x] ✅ Unfurl cards show thumbnail, title, description, URL
- [x] ✅ Inline layout: text on top, image below, sizes to content
- [x] ✅ Images preserve aspect ratio (no stretching/cropping)
- [x] ✅ Loading state shows skeleton
- [x] ✅ Error state shows retry option
- [x] ✅ Toolbar appears on hover with all actions
- [x] ✅ Convert unfurl to chip (toolbar button)
- [x] ✅ Convert chip to unfurl (expand button in hover preview)
- [x] ✅ Open Graph fallback for sites without oEmbed (e.g., Reddit)
- [x] ✅ Chips show full title or full URL (no truncation)
- [ ] 🟡 Only visible unfurls fetch (lazy loading) - deferred to Phase 5
- [ ] 🟡 Max 3 concurrent fetches - deferred to Phase 5
