# Phase 4: Video/Rich Embeds ✅

**Progress:** `100%`

**Goal**: Embed playable videos and sandboxed rich content.

**Depends on**: Phase 1-3

**Completed**: 2024-12-28

---

## 4.1 Video Embed Component

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/VideoEmbed.tsx`

### Component Design

```typescript
interface VideoEmbedProps {
  provider: 'youtube' | 'vimeo' | 'dailymotion' | 'twitch' | 'other';
  embedUrl: string;
  title?: string;
  width?: number;
  height?: number;
  aspectRatio?: number; // Default: 16/9
}
```

### Visual Design

```
┌─────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────┐ │
│ │                                                 │ │
│ │              [Embedded Video Player]            │ │
│ │                     (iframe)                    │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│  Video Title - youtube.com             [↗] [⟳] [🗑]│
└─────────────────────────────────────────────────────┘

- Responsive width (100% of content area, max 640px)
- 16:9 aspect ratio (or provider-specified)
- Minimal chrome around the video
- Title and provider below
- Toolbar on hover
```

### Iframe Attributes

```html
<iframe
  src="${embedUrl}"
  width="100%"
  style="aspect-ratio: 16/9"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
  loading="lazy"
></iframe>
```

### Tasks

- [x] ✅ Create VideoEmbed component
- [x] ✅ Implement responsive sizing with aspect ratio
- [x] ✅ Add thumbnail preview with play button (click to load)
- [x] ✅ Add title/provider bar
- [x] ✅ Add toolbar (open, refresh, convert to chip, delete)
- [x] ✅ Write tests: `VideoEmbed.test.tsx` (15 tests)

---

## 4.2 Rich Content Sandbox

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/RichEmbed.tsx`

### Security Considerations

oEmbed "rich" type returns arbitrary HTML. We need to sandbox this safely:

1. **Allowed providers whitelist** - Only render rich HTML from trusted sources
2. **Sandboxed iframe** - Isolate content execution
3. **CSP headers** - Restrict what embedded content can do

### Allowed Providers (Initial List)

```typescript
const ALLOWED_RICH_PROVIDERS = [
  'youtube.com',
  'vimeo.com',
  'twitter.com',
  'x.com',
  'spotify.com',
  'soundcloud.com',
  'codepen.io',
  'codesandbox.io',
  'figma.com',
  'gist.github.com',
  'loom.com',
  'miro.com',
];
```

### Sandbox Implementation

```typescript
function RichEmbed({ html, providerUrl }: RichEmbedProps) {
  const isAllowed = ALLOWED_RICH_PROVIDERS.some(
    p => providerUrl?.includes(p)
  );

  if (!isAllowed) {
    // Fallback to preview card
    return <UnfurlCard ... />;
  }

  // Wrap in sandboxed iframe
  const sandboxedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'self' https:; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:;">
        <style>
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  return (
    <iframe
      srcDoc={sandboxedHtml}
      sandbox="allow-scripts allow-same-origin allow-popups"
      style={{ width: '100%', border: 'none' }}
    />
  );
}
```

### Tasks

- [x] ✅ Define allowed providers whitelist (in providerEmbed.ts)
- [x] ✅ Create RichEmbed component
- [x] ✅ Implement sandboxed iframe with CSP
- [x] ✅ Auto-resize iframe via postMessage
- [x] ✅ Return null for disallowed providers (caller handles fallback)
- [x] ✅ Write tests: `RichEmbed.test.tsx` (22 tests)

---

## 4.3 Provider-Specific Handling

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/utils/providerEmbed.ts`

### YouTube

```typescript
function getYouTubeEmbedUrl(url: string): string | null {
  // Match: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  return null;
}
```

### Vimeo

```typescript
function getVimeoEmbedUrl(url: string): string | null {
  // Match: vimeo.com/ID
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (match) {
    return `https://player.vimeo.com/video/${match[1]}`;
  }
  return null;
}
```

### Twitter/X

```typescript
function getTwitterEmbedHtml(oembedData: OEmbedResponse): string {
  // Twitter returns HTML in oEmbed response
  if (oembedData.html) {
    return oembedData.html;
  }
  return null;
}
```

### GitHub Gist

```typescript
function getGistEmbedHtml(url: string): string {
  // Match: gist.github.com/user/id
  const match = url.match(/gist\.github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return `<script src="https://gist.github.com/${match[1]}/${match[2]}.js"></script>`;
  }
  return null;
}
```

### Unified Handler

```typescript
interface ProviderEmbed {
  type: 'video' | 'rich';
  embedUrl?: string;
  embedHtml?: string;
  aspectRatio?: number;
}

function getProviderEmbed(url: string, oembedData: OEmbedResponse): ProviderEmbed | null {
  const hostname = new URL(url).hostname;

  if (hostname.includes('youtube') || hostname.includes('youtu.be')) {
    return { type: 'video', embedUrl: getYouTubeEmbedUrl(url), aspectRatio: 16 / 9 };
  }
  if (hostname.includes('vimeo')) {
    return { type: 'video', embedUrl: getVimeoEmbedUrl(url), aspectRatio: 16 / 9 };
  }
  if (hostname.includes('twitter') || hostname.includes('x.com')) {
    return { type: 'rich', embedHtml: oembedData.html };
  }
  // ... more providers

  // Fallback: use oEmbed response directly if video/rich type
  if (oembedData.type === 'video' || oembedData.type === 'rich') {
    return { type: oembedData.type, embedHtml: oembedData.html };
  }

  return null;
}
```

### Tasks

- [x] ✅ Create providerEmbed.ts utilities
- [x] ✅ Implement YouTube embed extraction (watch, youtu.be, embed, shorts)
- [x] ✅ Implement Vimeo embed extraction
- [x] ✅ Implement Dailymotion embed extraction
- [x] ✅ Implement Twitch embed extraction (channels + videos)
- [x] ✅ Implement Loom embed extraction
- [x] ✅ Twitter/X handled via rich type with oEmbed HTML
- [x] ✅ GitHub Gist handled via rich type with oEmbed HTML
- [x] ✅ Fallback to oEmbed html for other video/rich types
- [x] ✅ Write tests: `providerEmbed.test.ts` (29 tests)

---

## 4.4 Integrate with UnfurlCard

**File**: `packages/desktop/src/renderer/src/components/EditorPanel/UnfurlCard.tsx`

### Updated Logic

```typescript
function UnfurlCard({ url, data, ... }: UnfurlCardProps) {
  // Check if we should show a video/rich embed
  const embed = data ? getProviderEmbed(url, data) : null;

  if (embed?.type === 'video' && embed.embedUrl) {
    return <VideoEmbed embedUrl={embed.embedUrl} title={data.title} />;
  }

  if (embed?.type === 'rich' && embed.embedHtml) {
    return <RichEmbed html={embed.embedHtml} providerUrl={data.provider_url} />;
  }

  // Fallback to standard card
  return (
    <div className="unfurl-card">
      {/* Standard card layout */}
    </div>
  );
}
```

### Tasks

- [x] ✅ Update OEmbedUnfurl NodeView (not UnfurlCard) to detect video/rich types
- [x] ✅ Route to VideoEmbed, RichEmbed, or UnfurlCard based on type
- [x] ✅ Use dynamic imports for code splitting
- [x] ✅ Fallback to UnfurlCard when RichEmbed returns null (disallowed provider)

---

## Testing Strategy

### Unit Tests

1. **VideoEmbed** - Renders iframe correctly
2. **RichEmbed** - Sandboxing works, blocked providers fallback
3. **Provider extractors** - All URL patterns matched

### Integration Tests

1. **YouTube unfurl** - Video player renders and plays
2. **Twitter unfurl** - Tweet renders correctly
3. **Unknown provider** - Falls back to preview card

### Manual Testing

- Verify videos actually play
- Check sandboxing blocks malicious scripts
- Test on various providers

---

## Definition of Done

- [x] ✅ YouTube videos embed and play inline
- [x] ✅ Vimeo videos embed and play inline
- [x] ✅ Dailymotion, Twitch, Loom videos embed and play inline
- [x] ✅ Twitter/X posts render as embeds (via oEmbed HTML)
- [x] ✅ Rich content from allowed providers renders
- [x] ✅ Unknown/blocked providers show preview card
- [x] ✅ Sandboxing prevents script execution outside iframe
- [x] ✅ 66 tests passing (29 providerEmbed + 15 VideoEmbed + 22 RichEmbed)

---

## Implementation Summary

### Files Created/Modified

**New Files:**

- `VideoEmbed.tsx` - Video player component with thumbnail preview
- `RichEmbed.tsx` - Sandboxed iframe for rich HTML content
- `utils/providerEmbed.ts` - Provider URL extraction utilities
- `__tests__/VideoEmbed.test.tsx` - 15 unit tests
- `__tests__/RichEmbed.test.tsx` - 22 unit tests
- `utils/__tests__/providerEmbed.test.ts` - 29 unit tests

**Modified:**

- `extensions/OEmbedUnfurl.ts` - Added video/rich detection with dynamic imports

### Architecture Notes

1. **Detection Flow**: OEmbedUnfurl NodeView uses `getProviderEmbed()` to check if URL is a video or rich embed:
   - First checks known providers (YouTube, Vimeo, etc.) via URL pattern matching
   - Falls back to oEmbed response type if available

2. **Rendering**: Based on detection result:
   - `type: 'video' + embedUrl` → VideoEmbed component
   - `type: 'rich' + embedHtml` → RichEmbed component (if provider allowed)
   - Fallback → UnfurlCard component

3. **Security**: Rich HTML only rendered from whitelisted providers in sandboxed iframe with CSP

4. **UX**: Videos show thumbnail with play button; clicking loads iframe (saves bandwidth)
