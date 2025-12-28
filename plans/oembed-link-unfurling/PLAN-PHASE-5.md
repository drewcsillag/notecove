# Phase 5: Registry Updates & Polish

**Progress:** `0%`

**Goal**: Keep registry updated and add user preferences.

**Depends on**: Phase 1-4

---

## 5.1 Registry Delta Updates

**Files**:

- `packages/desktop/src/main/oembed/registry-updater.ts`
- `packages/desktop/src/main/ipc/handlers/oembed-handlers.ts`

### Database Schema Addition

```sql
-- Add registry metadata table
CREATE TABLE IF NOT EXISTS oembed_registry_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Store: last_update_check, registry_version, registry_etag
```

### Update Logic

```typescript
class RegistryUpdater {
  private checkInterval = 7 * 24 * 60 * 60 * 1000; // 1 week

  async checkForUpdates(): Promise<boolean>;
  async downloadAndMerge(): Promise<void>;
  async getLastCheckTime(): Promise<number>;
}

// Check flow:
// 1. Get last check time from DB
// 2. If > 1 week ago, fetch https://oembed.com/providers.json
// 3. Compare with bundled version
// 4. If different, merge new providers (additive only)
// 5. Store updated registry in memory
// 6. Update last check time
```

### Merge Strategy

```typescript
function mergeRegistries(bundled: OEmbedProvider[], fetched: OEmbedProvider[]): OEmbedProvider[] {
  const merged = new Map<string, OEmbedProvider>();

  // Start with bundled
  for (const provider of bundled) {
    merged.set(provider.provider_name, provider);
  }

  // Add/update from fetched
  for (const provider of fetched) {
    merged.set(provider.provider_name, provider);
  }

  return Array.from(merged.values());
}
```

### Tasks

- [ ] 🟥 Add registry metadata table
- [ ] 🟥 Create RegistryUpdater class
- [ ] 🟥 Implement fetch and merge logic
- [ ] 🟥 Add IPC handler for manual check
- [ ] 🟥 Trigger check on app start (debounced)
- [ ] 🟥 Write tests: `registry-updater.test.ts`

---

## 5.2 User Preferences

**Files**:

- `packages/desktop/src/main/config/defaults.ts`
- `packages/desktop/src/renderer/src/components/SettingsWindow/OEmbedSettings.tsx`

### Settings Schema

```typescript
interface OEmbedSettings {
  enabled: boolean; // Master switch
  discoveryEnabled: boolean; // Attempt discovery for unknown URLs
  defaultDisplayMode: 'chip' | 'unfurl'; // Default for single links
  autoUnfurl: boolean; // Auto-unfurl on paste
  maxConcurrentFetches: number; // Default: 3
}

// Defaults
const OEMBED_DEFAULTS: OEmbedSettings = {
  enabled: true,
  discoveryEnabled: true,
  defaultDisplayMode: 'unfurl',
  autoUnfurl: true,
  maxConcurrentFetches: 3,
};
```

### Settings UI

```
┌─────────────────────────────────────────────────────┐
│ oEmbed Link Previews                                │
├─────────────────────────────────────────────────────┤
│ ☑ Enable link previews                             │
│                                                     │
│ Default display mode:                              │
│   ○ Chip (compact)                                 │
│   ● Full preview (recommended)                      │
│                                                     │
│ ☑ Auto-unfurl links when pasted                   │
│                                                     │
│ ☑ Try discovery for unknown websites              │
│   (May be slower for sites not in registry)        │
│                                                     │
│ Media Cache                                         │
│   42 thumbnails (12.3 MB)                          │
│   156 favicons                                      │
│   [Clear Thumbnails] [Clear Favicons]              │
│                                                     │
│ Registry                                            │
│   Last updated: Dec 25, 2024                        │
│   [Check for Updates]                               │
│                                                     │
│ Note: Unfurl data is stored in each document and   │
│ syncs across devices. Use "Refresh All Unfurls"    │
│ in the editor menu to update stale previews.       │
└─────────────────────────────────────────────────────┘
```

### Tasks

- [ ] 🟥 Add oEmbed settings to config schema
- [ ] 🟥 Add defaults
- [ ] 🟥 Create OEmbedSettings component
- [ ] 🟥 Wire up settings to actual behavior
- [ ] 🟥 Write tests

---

## 5.3 Cache Management

**Files**:

- `packages/desktop/src/main/ipc/handlers/oembed-handlers.ts`
- `packages/desktop/src/renderer/src/components/SettingsWindow/OEmbedSettings.tsx`

**Note**: oEmbed data is stored in documents (CRDT), not a central cache. This section manages:

1. **Thumbnail cache** - Downloaded images (can get large)
2. **Favicon cache** - Small, shared across documents
3. **Stale data refresh** - Bulk refresh of old unfurls

### IPC Handlers

```typescript
// Get cache stats (thumbnails + favicons only)
ipcMain.handle('oembed:getCacheStats', async () => {
  const thumbnails = await database.getThumbnailStats();
  const favicons = await database.getFaviconStats();
  return { thumbnails, favicons };
});

// Clear thumbnail cache
ipcMain.handle('oembed:clearThumbnailCache', async () => {
  await database.clearThumbnails();
});

// Clear favicon cache
ipcMain.handle('oembed:clearFaviconCache', async () => {
  await database.clearFavicons();
});
```

### Cache Display

```typescript
function formatCacheStats(stats: CacheStats) {
  return {
    thumbnails: `${stats.thumbnails.count} thumbnails (${formatBytes(stats.thumbnails.totalSizeBytes)})`,
    favicons: `${stats.favicons.count} favicons`,
  };
}
```

### Refresh Stale Unfurls

Since oEmbed data is in documents, we need a way to refresh stale data:

```typescript
// In editor, add "Refresh All Unfurls" command
async function refreshAllUnfurlsInDocument(editor: Editor) {
  const unfurlNodes = findNodesOfType(editor.state.doc, 'oembedUnfurl');
  for (const { node, pos } of unfurlNodes) {
    const result = await window.electronAPI.oembed.unfurl(node.attrs.url);
    if (result.success) {
      editor.chain().focus().updateAttributesAt(pos, result.data).run();
    }
  }
}
```

### Tasks

- [ ] 🟥 Add getCacheStats IPC handler (thumbnails + favicons)
- [ ] 🟥 Display cache stats in settings
- [ ] 🟥 Add "Clear Thumbnail Cache" button
- [ ] 🟥 Add "Clear Favicon Cache" button
- [ ] 🟥 Add "Refresh All Unfurls" editor command
- [ ] 🟥 Write tests

---

## 5.4 Error Handling Polish

**Files**:

- `packages/desktop/src/main/oembed/oembed-service.ts`
- `packages/desktop/src/renderer/src/components/EditorPanel/UnfurlCard.tsx`

### Error Categories

```typescript
type OEmbedErrorType =
  | 'NETWORK_ERROR' // Failed to connect
  | 'TIMEOUT' // Request timed out
  | 'PROVIDER_ERROR' // Provider returned error
  | 'INVALID_RESPONSE' // Response wasn't valid oEmbed
  | 'NOT_FOUND' // No provider and discovery failed
  | 'RATE_LIMITED'; // Too many requests

interface OEmbedError {
  type: OEmbedErrorType;
  message: string;
  retryable: boolean;
}
```

### Retry Logic

```typescript
class OEmbedService {
  async unfurl(url: string, attempt = 1): Promise<OEmbedResult> {
    try {
      return await this.fetchOEmbed(url);
    } catch (error) {
      if (this.isRetryable(error) && attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
        await sleep(delay);
        return this.unfurl(url, attempt + 1);
      }
      throw error;
    }
  }

  private isRetryable(error: OEmbedError): boolean {
    return ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMITED'].includes(error.type);
  }
}
```

### User-Friendly Messages

```typescript
function getErrorMessage(error: OEmbedError): string {
  switch (error.type) {
    case 'NETWORK_ERROR':
      return 'Unable to connect. Check your internet connection.';
    case 'TIMEOUT':
      return 'Request timed out. The site may be slow.';
    case 'PROVIDER_ERROR':
      return 'The site returned an error.';
    case 'INVALID_RESPONSE':
      return "This site doesn't support link previews.";
    case 'NOT_FOUND':
      return 'Preview not available for this link.';
    case 'RATE_LIMITED':
      return 'Too many requests. Try again later.';
    default:
      return 'Something went wrong.';
  }
}
```

### Error State UI

```
┌─────────────────────────────────────────────────────┐
│  ⚠️ Preview not available                          │
│  This site doesn't support link previews.           │
│                                                     │
│  [Try Again]  [Show as Link]                        │
└─────────────────────────────────────────────────────┘
```

### Tasks

- [ ] 🟥 Define error types
- [ ] 🟥 Implement retry with exponential backoff
- [ ] 🟥 Create user-friendly error messages
- [ ] 🟥 Update error state UI
- [ ] 🟥 Add "Try Again" and "Show as Link" buttons
- [ ] 🟥 Write tests

---

## 5.5 Export Behavior

**Files**:

- `packages/shared/src/export/markdown-exporter.ts`
- `packages/desktop/src/renderer/src/components/EditorPanel/clipboard.ts`

### User Decisions

- **Markdown export**: Link with title: `[Video Title](https://...)`
- **Clipboard**: Rich format if target supports it, otherwise plain URL

### Markdown Export

When exporting to markdown, unfurl blocks convert to markdown links:

```typescript
// OEmbedUnfurl node → markdown
function oembedUnfurlToMarkdown(node: Node): string {
  const { url } = node.attrs;
  const title = getCachedOEmbedTitle(url) || url;
  return `[${title}](${url})`;
}

// Link chip → markdown (same as regular link)
function linkChipToMarkdown(mark: Mark, text: string): string {
  return `[${text}](${mark.attrs.href})`;
}
```

### Clipboard Copy

When copying content with unfurls:

```typescript
// Copy to clipboard with both formats
function copyWithUnfurl(selection: Selection) {
  const plainText = extractPlainUrls(selection);
  const richHtml = extractRichHtml(selection);

  navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
      'text/html': new Blob([richHtml], { type: 'text/html' }),
    }),
  ]);
}

// Rich HTML format for unfurls
function unfurlToClipboardHtml(url: string, title: string): string {
  return `<a href="${url}">${title}</a>`;
}
```

### Tasks

- [ ] 🟥 Update markdown exporter for OEmbedUnfurl nodes
- [ ] 🟥 Update markdown exporter for link chips
- [ ] 🟥 Implement rich clipboard copy
- [ ] 🟥 Ensure plain text fallback works
- [ ] 🟥 Write tests: `oembed-export.test.ts`

---

## 5.6 Offline Handling

### Behavior When Offline

1. **Cached unfurls**: Display normally from cache
2. **New links**: Show loading state, then "Offline - will unfurl when connected"
3. **Retry on reconnect**: Queue failed unfurls, retry when online

### Implementation

```typescript
// Check online status
const isOnline = () => navigator.onLine;

// Listen for reconnection
window.addEventListener('online', () => {
  oembedQueue.retryFailed();
});

// Offline error state
if (!isOnline()) {
  return {
    success: false,
    error: 'OFFLINE',
    retryable: true,
  };
}
```

### Tasks

- [ ] 🟥 Add offline detection to OEmbedService
- [ ] 🟥 Implement "Offline" error state in UnfurlCard
- [ ] 🟥 Queue and retry on reconnection
- [ ] 🟥 Write tests: `oembed-offline.test.ts`

---

## 5.7 Documentation

**Files**:

- `website/features/link-previews.md`

### Content Outline

1. **What are Link Previews?**
   - Rich previews for links in your notes
   - Chips for compact display
   - Full cards with thumbnails

2. **How to Use**
   - Paste a link - auto-unfurls
   - Convert between chip and full preview
   - Refresh stale previews

3. **Supported Sites**
   - YouTube, Vimeo, Twitter/X, GitHub, etc.
   - Any site with oEmbed support
   - Discovery for unlisted sites

4. **Settings**
   - Enable/disable
   - Default display mode
   - Cache management

5. **Screenshots**
   - Link chip in text
   - Full unfurl card
   - Video embed
   - Settings panel

### Tasks

- [ ] 🟥 Write feature documentation
- [ ] 🟥 Add screenshots
- [ ] 🟥 Add to features index

---

## Testing Strategy

### Unit Tests

1. **Registry updater** - Merge logic, check intervals
2. **Settings** - Defaults applied, changes persisted
3. **Error handling** - Retry logic, message mapping

### Integration Tests

1. **Settings affect behavior** - Disable oEmbed stops unfurling
2. **Cache clear** - Removes all entries, forces re-fetch

### Manual Testing

- Verify registry update works (change provider)
- Test all error scenarios
- Check settings UI works

---

## Definition of Done

- [ ] Registry auto-updates weekly
- [ ] Settings UI functional with all options
- [ ] Cache can be viewed and cleared
- [ ] Errors show friendly messages with retry option
- [ ] Markdown export includes link titles
- [ ] Clipboard copy works with rich and plain formats
- [ ] Offline mode shows appropriate state and retries on reconnect
- [ ] Documentation published to website
