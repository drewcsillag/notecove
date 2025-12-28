# Phase 2: Link Chips

**Progress:** `100%` ✅

**Goal**: Render links as compact chips with hover previews.

**Depends on**: Phase 1 (Foundation) ✅

**Note**: Task order adjusted based on plan critique - context detection before chip rendering.

## Implementation Notes

Phase 2 is complete:

- **Chip Rendering**: Links now display as chips with favicon + title (or URL if no oEmbed title)
- **Favicon Fetching**: Favicons fetched via `oembed:getFavicon` IPC (uses Google's favicon API)
- **oEmbed Titles**: Titles fetched via `oembed:unfurl` IPC, cached in linkMetadataCache
- **Context Detection**: All link contexts (heading, list, blockquote, paragraph, code, table) detected
- **Display Mode**: Currently all contexts → chip mode (unfurl deferred to Phase 3)
- **ProseMirror Plugin**: WebLinkChipPlugin handles decoration rendering
- **Hover Preview**: useChipHoverPreview hook manages hover state with delay logic and Floating UI positioning

---

## 2.1 WebLink Extension Updates

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/extensions/WebLink.ts`

### Changes

Add a `displayMode` attribute to store user preference per-link:

```typescript
// New attribute
displayMode: {
  default: 'auto',  // 'auto' | 'chip' | 'unfurl' | 'link'
  parseHTML: element => element.getAttribute('data-display-mode'),
  renderHTML: attributes => ({
    'data-display-mode': attributes.displayMode,
  }),
}

// 'auto' means: use context-aware defaults
// 'chip' means: always show as chip
// 'unfurl' means: always show as unfurl block
// 'link' means: plain link, no preview
```

### Tasks

- [x] ✅ Add displayMode attribute to WebLink mark
- [x] ✅ Update mark storage/parsing
- [x] ✅ Write tests for attribute persistence (WebLink.test.ts)

---

## 2.2 Link Chip Rendering

**Files**:

- `packages/desktop/src/renderer/src/components/EditorPanel/LinkChip.tsx`
- `packages/desktop/src/renderer/src/components/EditorPanel/tipTapEditorStyles.ts`

### Component Design

```typescript
interface LinkChipProps {
  url: string;
  title?: string;
  favicon?: string;
  isLoading?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}
```

### Visual Design

```
┌──────────────────────────────┐
│ 🔗  How to Build a Start... │
└──────────────────────────────┘

- Rounded pill shape
- Favicon on left (or generic link icon if none)
- Truncated title (max ~30 chars)
- Subtle background color
- Hover: slightly darker background
- Click: opens link in browser
```

### CSS Classes

```css
.link-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--chip-bg);
  font-size: 0.9em;
  cursor: pointer;
}

.link-chip:hover {
  background: var(--chip-bg-hover);
}

.link-chip-favicon {
  width: 14px;
  height: 14px;
  margin-right: 4px;
}

.link-chip-title {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Favicon Fetching

Add IPC handler for favicon fetching (or use Google's favicon service):

```typescript
// Option 1: Google's public favicon API
const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

// Option 2: Fetch directly from site (more accurate but slower)
const faviconUrl = `${origin}/favicon.ico`;
```

### Tasks

- [x] ✅ Create LinkChip component (and WebLinkChipPlugin for ProseMirror decorations)
- [x] ✅ Add favicon fetching logic (via oembed:getFavicon IPC)
- [x] ✅ Add oEmbed title fetching (via oembed:unfurl IPC)
- [x] ✅ Add CSS styles to tipTapEditorStyles.ts (.link-chip, etc.)
- [x] ✅ Fallback to full URL when no title available
- [x] ✅ Support light/dark themes
- [x] ✅ Write tests: `LinkChip.test.tsx`

---

## 2.3 Hover Preview Card

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/LinkPreviewCard.tsx`

### Component Design

```typescript
interface LinkPreviewCardProps {
  url: string;
  oembedData?: OEmbedResponse;
  isLoading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onOpenInBrowser?: () => void;
}
```

### Visual Design

```
┌─────────────────────────────────────────────┐
│ ┌─────────┐  Full Page Title                │
│ │         │  Description text that wraps    │
│ │  thumb  │  to multiple lines...           │
│ │         │                                 │
│ └─────────┘  🔗 example.com    [↗] [⟳]     │
└─────────────────────────────────────────────┘

- Appears on hover after 300ms delay
- Disappears when mouse leaves (with grace period)
- Max width: 400px
- Thumbnail: 80x80px
```

### Integration with Floating UI

Use existing `createFloatingPopup` pattern from LinkPopover:

```typescript
const { refs, floatingStyles } = useFloating({
  placement: 'bottom-start',
  middleware: [offset(8), flip(), shift()],
});
```

### Tasks

- [x] ✅ Create LinkPreviewCard component
- [x] ✅ Implement hover delay logic (300ms show, 100ms hide grace) - via useChipHoverPreview hook
- [x] ✅ Integrate with Floating UI - via createFloatingPopup utility
- [x] ✅ Add loading skeleton
- [x] ✅ Add error state
- [x] ✅ Write tests: `LinkPreviewCard.test.tsx`

**Implementation**: Hover preview is managed by `useChipHoverPreview.tsx` which:

- Uses custom events (CHIP_HOVER_ENTER_EVENT, CHIP_HOVER_LEAVE_EVENT) for chip→React communication
- Implements 300ms show delay and 100ms hide grace period
- Uses createFloatingPopup for Floating UI positioning
- Dynamically renders LinkPreviewCard via react-dom/client

---

## 2.4 Context Detection

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/utils/linkContext.ts`

### Logic

Determine which display mode to use based on where the link appears:

```typescript
type LinkContext = 'heading' | 'list' | 'blockquote' | 'paragraph' | 'code' | 'other';

function detectLinkContext(state: EditorState, pos: number): LinkContext;

function getDefaultDisplayMode(context: LinkContext): 'chip' | 'unfurl' | 'none';
// heading → 'chip'
// list → 'chip'
// blockquote → 'chip'
// paragraph → 'unfurl'
// code → 'none'
// other → 'chip'
```

### Implementation

Walk up the node tree from link position to find parent block type:

```typescript
const $pos = state.doc.resolve(pos);
for (let d = $pos.depth; d >= 0; d--) {
  const node = $pos.node(d);
  if (node.type.name === 'heading') return 'heading';
  if (node.type.name === 'listItem') return 'list';
  if (node.type.name === 'blockquote') return 'blockquote';
  if (node.type.name === 'codeBlock') return 'code';
  if (node.type.name === 'paragraph') return 'paragraph';
}
return 'other';
```

### Tasks

- [x] ✅ Create linkContext.ts utility
- [x] ✅ Implement context detection (detectLinkContext)
- [x] ✅ Implement default mode mapping (getDefaultDisplayMode)
- [x] ✅ Write tests: `linkContext.test.ts`

---

## 2.5 Multiple Links Detection

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/utils/linkContext.ts`

### Logic

Detect when a paragraph contains multiple links:

```typescript
function countLinksInParagraph(state: EditorState, pos: number): number;

function shouldUseChipsForMultipleLinks(count: number): boolean {
  return count > 1;
}
```

### Implementation

Find the paragraph node containing the link, then count all link marks within it:

```typescript
const $pos = state.doc.resolve(pos);
const paragraph = $pos.node($pos.depth);
let linkCount = 0;

paragraph.descendants((node) => {
  if (node.marks.some((m) => m.type.name === 'webLink')) {
    linkCount++;
  }
});

return linkCount;
```

### Tasks

- [x] ✅ Add countLinksInParagraph function
- [x] ✅ Integrate with context detection (getEffectiveDisplayMode)
- [x] ✅ Write tests for multi-link detection

---

## 2.6 Chip Decoration Plugin

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/extensions/WebLink.ts`

### Approach

Use ProseMirror decorations to render chips over link text (similar to InterNoteLink):

```typescript
// In WebLink extension
addProseMirrorPlugins() {
  return [
    new Plugin({
      key: new PluginKey('webLinkChips'),
      props: {
        decorations: (state) => {
          const decorations: Decoration[] = [];

          state.doc.descendants((node, pos) => {
            node.marks.forEach(mark => {
              if (mark.type.name === 'webLink') {
                const displayMode = getEffectiveDisplayMode(state, pos, mark);
                if (displayMode === 'chip') {
                  decorations.push(
                    Decoration.widget(pos, () => createChipElement(mark.attrs))
                  );
                }
              }
            });
          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
  ];
}
```

### Tasks

- [x] ✅ Add decoration plugin to WebLink extension (WebLinkChipPlugin.ts)
- [x] ✅ Create chip DOM element factory (createChipElement)
- [x] ✅ Handle hover events for preview card - dispatches custom events to useChipHoverPreview
- [ ] 🟡 Write tests for decoration rendering (deferred)

---

## Testing Strategy

### Unit Tests

1. **LinkChip component** - Render states, click handling
2. **LinkPreviewCard component** - Loading, error, data states
3. **Context detection** - Each block type correctly identified
4. **Multi-link detection** - Count accuracy

### Integration Tests

1. **Chip decoration** - Links in headings render as chips
2. **Preview on hover** - Fetches data, shows card
3. **Display mode persistence** - Mode saved and restored

---

## Definition of Done

- [x] ✅ Links in headings/lists/blockquotes render as chips
- [x] ✅ Links in paragraphs render as chips (unfurl deferred to Phase 3)
- [x] ✅ Chips show favicon + truncated title (or full URL if no oEmbed title)
- [x] ✅ Hovering chip shows preview card with full details
- [x] ✅ Multiple links in paragraph auto-convert to chips
- [x] ✅ Display mode preference persists with document (displayMode attribute)
