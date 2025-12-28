# Phase 3: Full Unfurl Cards

**Progress:** `0%`

**Goal**: Render rich preview cards as block-level elements.

**Depends on**: Phase 1 (Foundation), Phase 2 (Link Chips)

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

- [ ] 🟥 Create OEmbedUnfurl.ts extension
- [ ] 🟥 Define node attributes
- [ ] 🟥 Create NodeView wrapper
- [ ] 🟥 Register in getEditorExtensions.ts
- [ ] 🟥 Write tests: `OEmbedUnfurl.test.ts`

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
┌─────────────────────────────────────────────────────┐
│ ┌─────────────┐  Page Title Here                    │
│ │             │  Description text that can wrap to  │
│ │  thumbnail  │  multiple lines but gets truncated  │
│ │   (120px)   │  after 3 lines with ellipsis...     │
│ │             │                                     │
│ └─────────────┘  🔗 example.com/path/to/page        │
└─────────────────────────────────────────────────────┘

- Max width: 100% of editor content area
- Thumbnail: 120x90px (or maintain aspect ratio)
- Border: subtle, rounded corners
- On hover: show toolbar
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

- [ ] 🟥 Create UnfurlCard component
- [ ] 🟥 Implement loading skeleton
- [ ] 🟥 Implement error state with retry
- [ ] 🟥 Handle missing thumbnail gracefully
- [ ] 🟥 Add CSS styles
- [ ] 🟥 Support light/dark themes
- [ ] 🟥 Write tests: `UnfurlCard.test.tsx`

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

- [ ] 🟥 Create UnfurlToolbar component
- [ ] 🟥 Position above card on hover
- [ ] 🟥 Implement all actions
- [ ] 🟥 Keyboard shortcuts (Delete, etc.)
- [ ] 🟥 Write tests: `UnfurlToolbar.test.tsx`

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

- [ ] 🟥 Create OEmbedQueue class
- [ ] 🟥 Create useOEmbedUnfurl hook
- [ ] 🟥 Create useIntersectionObserver hook
- [ ] 🟥 Integrate with UnfurlCard
- [ ] 🟥 Write tests: `useOEmbedQueue.test.ts`

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

- [ ] 🟥 Detect new link insertions
- [ ] 🟥 Check context and multi-link status
- [ ] 🟥 Convert link to chip display mode
- [ ] 🟥 Insert OEmbedUnfurl node after paragraph
- [ ] 🟥 Handle paste of multiple links (all become chips, no unfurl)
- [ ] 🟥 Write tests for auto-unfurl

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

- [ ] Pasting a link in paragraph auto-inserts unfurl block
- [ ] Unfurl cards show thumbnail, title, description, URL
- [ ] Loading state shows skeleton
- [ ] Error state shows retry option
- [ ] Toolbar appears on hover with all actions
- [ ] Only visible unfurls fetch (lazy loading)
- [ ] Max 3 concurrent fetches
