# Phase 4: Video/Rich Embeds

**Progress:** `0%`

**Goal**: Embed playable videos and sandboxed rich content.

**Depends on**: Phase 1-3

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

- [ ] 🟥 Create VideoEmbed component
- [ ] 🟥 Implement responsive sizing
- [ ] 🟥 Add loading placeholder
- [ ] 🟥 Add title/provider bar
- [ ] 🟥 Write tests: `VideoEmbed.test.tsx`

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

- [ ] 🟥 Define allowed providers whitelist
- [ ] 🟥 Create RichEmbed component
- [ ] 🟥 Implement sandboxed iframe
- [ ] 🟥 Fallback to preview card for disallowed providers
- [ ] 🟥 Write tests: `RichEmbed.test.tsx`

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

- [ ] 🟥 Create providerEmbed.ts utilities
- [ ] 🟥 Implement YouTube embed extraction
- [ ] 🟥 Implement Vimeo embed extraction
- [ ] 🟥 Implement Twitter/X embed handling
- [ ] 🟥 Implement GitHub Gist handling
- [ ] 🟥 Add more providers as needed
- [ ] 🟥 Write tests: `providerEmbed.test.ts`

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

- [ ] 🟥 Update UnfurlCard to detect video/rich types
- [ ] 🟥 Route to VideoEmbed or RichEmbed components
- [ ] 🟥 Ensure fallback works for unsupported providers
- [ ] 🟥 Write integration tests

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

- [ ] YouTube videos embed and play inline
- [ ] Vimeo videos embed and play inline
- [ ] Twitter/X posts render as embeds
- [ ] Rich content from allowed providers renders
- [ ] Unknown/blocked providers show preview card
- [ ] Sandboxing prevents script execution outside iframe
