# Phase 1: Foundation

**Progress:** `95%` ✅

**Goal**: Build the backend infrastructure for fetching and caching oEmbed data.

## Implementation Notes

Phase 1 is essentially complete. All core infrastructure is in place:

- **Database**: v11 migration adds `oembed_fetch_cache`, `favicon_cache`, `thumbnail_cache` tables
- **Types**: Full oEmbed type definitions in `@notecove/shared`
- **Registry**: Bundled `providers.json` with `OEmbedRegistry` class for URL→endpoint lookup
- **Service**: `OEmbedService` handles fetching with caching, `FaviconService` handles favicons
- **IPC**: Complete set of handlers including `unfurl`, `refresh`, `clearCache`, `getCacheStats`, `getFavicon`
- **Preload**: Full API exposed to renderer via `window.electronAPI.oembed`
- **Debug**: OEmbedInspector in Storage Inspector, logging throughout

Only `ThumbnailProxy` is deferred (not needed for chip rendering).

---

## 1.1 Database Schema

**File**: `packages/desktop/src/main/database/oembed-repository.ts`

**Note**: oEmbed data is now stored in document CRDT, not the database. The database is only used for:

1. **Session cache** - Deduplicate fetches within a session (in-memory or short-lived)
2. **Favicon cache** - Persisted, shared across documents
3. **Thumbnail cache** - Persisted, shared across documents

### Schema

```sql
-- Session-level fetch cache (optional, can be in-memory)
CREATE TABLE IF NOT EXISTS oembed_fetch_cache (
  url TEXT PRIMARY KEY,
  raw_json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- Shared across all documents
CREATE TABLE IF NOT EXISTS favicon_cache (
  domain TEXT PRIMARY KEY,
  data_url TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS thumbnail_cache (
  url TEXT PRIMARY KEY,
  data_url TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);
```

### Repository Methods

```typescript
interface OEmbedRepository {
  // Session cache (for deduplication during fetch)
  getRecentFetch(url: string, maxAgeMs: number): Promise<OEmbedResponse | null>;
  cacheRecentFetch(url: string, data: OEmbedResponse): Promise<void>;
  clearFetchCache(): Promise<void>;

  // Favicon cache
  getFavicon(domain: string): Promise<string | null>;
  upsertFavicon(domain: string, dataUrl: string): Promise<void>;

  // Thumbnail cache
  getThumbnail(url: string): Promise<string | null>;
  upsertThumbnail(url: string, dataUrl: string, sizeBytes: number): Promise<void>;
  getThumbnailStats(): Promise<{ count: number; totalSizeBytes: number }>;
  clearThumbnails(): Promise<void>;
}
```

### Tasks

- [x] ✅ Add migrations for cache tables (v11 migration in schema-repository.ts)
- [x] ✅ Create oembed-repository.ts with methods
- [x] ✅ Add to Database class
- [ ] 🟡 Write tests: `oembed-repository.test.ts` (deferred)

---

## 1.2 oEmbed Types

**File**: `packages/shared/src/oembed/types.ts`

### Types

```typescript
// Response types per oEmbed spec
export type OEmbedType = 'photo' | 'video' | 'link' | 'rich';

export interface OEmbedResponseBase {
  type: OEmbedType;
  version: '1.0';
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  provider_url?: string;
  cache_age?: number;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export interface OEmbedPhotoResponse extends OEmbedResponseBase {
  type: 'photo';
  url: string; // Required: direct image URL
  width: number; // Required
  height: number; // Required
}

export interface OEmbedVideoResponse extends OEmbedResponseBase {
  type: 'video';
  html: string; // Required: embed HTML
  width: number; // Required
  height: number; // Required
}

export interface OEmbedLinkResponse extends OEmbedResponseBase {
  type: 'link';
}

export interface OEmbedRichResponse extends OEmbedResponseBase {
  type: 'rich';
  html: string; // Required: embed HTML
  width: number; // Required
  height: number; // Required
}

export type OEmbedResponse =
  | OEmbedPhotoResponse
  | OEmbedVideoResponse
  | OEmbedLinkResponse
  | OEmbedRichResponse;

// Provider registry types
export interface OEmbedProviderEndpoint {
  schemes?: string[];
  url: string;
  discovery?: boolean;
  formats?: ('json' | 'xml')[];
}

export interface OEmbedProvider {
  provider_name: string;
  provider_url: string;
  endpoints: OEmbedProviderEndpoint[];
}

// Cache entry
export interface OEmbedCacheEntry {
  url: string;
  data: OEmbedResponse;
  fetchedAt: number;
}

// API result types
export interface OEmbedResult {
  success: boolean;
  data?: OEmbedResponse;
  error?: string;
  fromCache?: boolean;
}
```

### Tasks

- [x] ✅ Create types.ts in shared package
- [x] ✅ Export from shared/src/oembed/index.ts
- [x] ✅ Update shared package exports

---

## 1.3 Registry Bundling

**Files**:

- `packages/shared/src/oembed/registry.ts`
- `packages/shared/src/oembed/providers.json` (generated)
- `scripts/fetch-oembed-registry.ts` (build script)

### Build Script

```typescript
// scripts/fetch-oembed-registry.ts
// Run during build: downloads https://oembed.com/providers.json
// Saves to packages/shared/src/oembed/providers.json
```

### Registry Lookup

```typescript
// registry.ts
export class OEmbedRegistry {
  private providers: OEmbedProvider[];

  constructor(providers: OEmbedProvider[]) {
    this.providers = providers;
  }

  // Find provider endpoint for a URL
  findEndpoint(url: string): { provider: OEmbedProvider; endpoint: OEmbedProviderEndpoint } | null;

  // Build oEmbed API URL with parameters
  buildOEmbedUrl(
    endpoint: OEmbedProviderEndpoint,
    targetUrl: string,
    maxWidth?: number,
    maxHeight?: number
  ): string;
}

// Glob pattern matching for schemes like "https://*.youtube.com/*"
function matchesScheme(url: string, scheme: string): boolean;
```

### Tasks

- [x] ✅ Bundle providers.json (static bundling approach)
- [x] ✅ Create registry.ts with lookup logic (OEmbedRegistry class)
- [x] ✅ Implement glob-style URL matching
- [x] ✅ Write tests: `registry.test.ts`

---

## 1.4 oEmbed Fetcher Service

**File**: `packages/desktop/src/main/oembed/oembed-service.ts`

### Service Interface

```typescript
export class OEmbedService {
  constructor(
    private database: Database,
    private registry: OEmbedRegistry
  ) {}

  // Main entry point
  async unfurl(url: string, options?: UnfurlOptions): Promise<OEmbedResult>;

  // Force refresh (bypass cache)
  async refresh(url: string): Promise<OEmbedResult>;

  // Clear cache for URL
  async clearCache(url: string): Promise<void>;

  // Clear all cache
  async clearAllCache(): Promise<void>;
}

interface UnfurlOptions {
  maxWidth?: number;
  maxHeight?: number;
  skipCache?: boolean;
  skipDiscovery?: boolean;
}
```

### Implementation Steps

1. Check cache → return if exists
2. Look up provider in registry
3. If found → fetch from provider endpoint
4. If not found → attempt HTML discovery (if enabled)
5. Parse response (JSON)
6. Validate response
7. Cache result
8. Return

### Discovery

**File**: `packages/desktop/src/main/oembed/oembed-discovery.ts`

```typescript
// Fetch HTML page and look for <link rel="alternate" type="application/json+oembed">
export async function discoverOEmbedEndpoint(url: string): Promise<string | null>;
```

### Tasks

- [x] ✅ Create oembed-service.ts
- [x] ✅ Create oembed-discovery.ts
- [x] ✅ Implement HTTP fetching with Electron `net`
- [x] ✅ Implement response validation
- [x] ✅ Implement caching logic
- [ ] 🟡 Write tests: `oembed-service.test.ts` (deferred)
- [ ] 🟡 Write tests: `oembed-discovery.test.ts` (deferred)

---

## 1.5 IPC Handlers

**File**: `packages/desktop/src/main/ipc/handlers/oembed-handlers.ts`

### Handlers

```typescript
// oembed:unfurl - Fetch oEmbed data for a URL
ipcMain.handle('oembed:unfurl', async (event, url: string, options?: UnfurlOptions) => {
  return oembedService.unfurl(url, options);
});

// oembed:refresh - Force refresh (bypass cache)
ipcMain.handle('oembed:refresh', async (event, url: string) => {
  return oembedService.refresh(url);
});

// oembed:clearCache - Clear cache for URL or all
ipcMain.handle('oembed:clearCache', async (event, url?: string) => {
  if (url) {
    await oembedService.clearCache(url);
  } else {
    await oembedService.clearAllCache();
  }
});

// oembed:getCacheStats - Get cache statistics
ipcMain.handle('oembed:getCacheStats', async () => {
  return database.getOEmbedStats();
});
```

### Tasks

- [x] ✅ Create oembed-handlers.ts
- [x] ✅ Implement all handlers (unfurl, refresh, clearCache, getCacheStats, getFavicon, debug handlers)
- [x] ✅ Register in handlers/index.ts
- [x] ✅ Add OEmbedService to HandlerContext
- [ ] 🟡 Write tests: `oembed-handlers.test.ts` (deferred)

---

## 1.6 Preload API

**File**: `packages/desktop/src/preload/api/oembed-api.ts`

### API

```typescript
export const oembedApi = {
  unfurl: (url: string, options?: UnfurlOptions): Promise<OEmbedResult> =>
    ipcRenderer.invoke('oembed:unfurl', url, options),

  refresh: (url: string): Promise<OEmbedResult> => ipcRenderer.invoke('oembed:refresh', url),

  clearCache: (url?: string): Promise<void> => ipcRenderer.invoke('oembed:clearCache', url),

  getCacheStats: (): Promise<{ count: number; oldestFetchedAt: number }> =>
    ipcRenderer.invoke('oembed:getCacheStats'),
};
```

### Tasks

- [x] ✅ Create oembed-api.ts
- [x] ✅ Export from preload/api/index.ts
- [x] ✅ Expose in preload/index.ts
- [x] ✅ Add types to electron.d.ts

---

## 1.7 Favicon Service

**File**: `packages/desktop/src/main/oembed/favicon-service.ts`

### Purpose

Fetch and cache favicons for link chips. Uses Google's public favicon API for reliability.

### Implementation

```typescript
export class FaviconService {
  constructor(private database: Database) {}

  // Get favicon as base64 data URL
  async getFavicon(domain: string): Promise<string | null>;

  // Clear cached favicon
  async clearFavicon(domain: string): Promise<void>;
}

// Uses: https://www.google.com/s2/favicons?domain={domain}&sz=32
// Falls back to: {origin}/favicon.ico
```

### Database Schema Addition

```sql
CREATE TABLE IF NOT EXISTS favicon_cache (
  domain TEXT PRIMARY KEY,
  data_url TEXT NOT NULL,      -- base64 data URL
  fetched_at INTEGER NOT NULL
);
```

### Tasks

- [x] ✅ Add favicon_cache table migration (v11)
- [x] ✅ Create FaviconService class
- [x] ✅ Add IPC handler: `oembed:getFavicon` (integrated into oEmbed handlers)
- [x] ✅ Add preload API method
- [ ] 🟡 Write tests: `favicon-service.test.ts` (deferred)

---

## 1.8 Thumbnail Proxy

**File**: `packages/desktop/src/main/oembed/thumbnail-proxy.ts`

### Purpose

Fetch external thumbnails through main process to avoid CORS issues. Cache locally forever (per user preference).

### Implementation

```typescript
export class ThumbnailProxy {
  constructor(private database: Database) {}

  // Fetch thumbnail and return as base64 data URL
  async getProxiedThumbnail(url: string): Promise<string | null>;

  // Clear cached thumbnail
  async clearThumbnail(url: string): Promise<void>;

  // Get cache stats
  async getStats(): Promise<{ count: number; totalSizeBytes: number }>;
}
```

### Database Schema Addition

```sql
CREATE TABLE IF NOT EXISTS thumbnail_cache (
  url TEXT PRIMARY KEY,
  data_url TEXT NOT NULL,       -- base64 data URL
  size_bytes INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);
```

### Tasks

- [x] ✅ Add thumbnail_cache table migration (v11)
- [ ] 🟥 Create ThumbnailProxy class (deferred - not needed for chips)
- [ ] 🟥 Implement fetching with Electron `net`
- [ ] 🟥 Add IPC handler: `thumbnail:getProxied`
- [ ] 🟥 Add preload API method
- [ ] 🟥 Write tests: `thumbnail-proxy.test.ts`

---

## 1.9 Debug Infrastructure

### Logging

Add structured logging to OEmbedService:

```typescript
// Log levels: debug, info, warn, error
logger.debug('[oEmbed] Cache hit', { url });
logger.info('[oEmbed] Fetching from provider', { url, provider });
logger.warn('[oEmbed] Discovery failed, falling back', { url });
logger.error('[oEmbed] Fetch failed', { url, error });
```

### Storage Inspector Tab

**File**: `packages/desktop/src/renderer/src/components/StorageInspector/OEmbedInspector.tsx`

Add oEmbed tab to Storage Inspector showing:

- List of cached URLs with provider, type, fetched_at
- Click to view full cached data
- Refresh/delete buttons per entry
- "Clear All" button
- Cache stats (count, size)

### Console Debug Helper

```typescript
// Exposed on window for debugging
window.__debugOEmbed = {
  unfurl: (url: string) => window.electronAPI.oembed.unfurl(url),
  getCacheStats: () => window.electronAPI.oembed.getCacheStats(),
  clearCache: () => window.electronAPI.oembed.clearCache(),
};
```

### Tasks

- [x] ✅ Add logging to OEmbedService (via createLogger)
- [x] ✅ Create OEmbedInspector component
- [x] ✅ Add tab to Storage Inspector
- [x] ✅ Add debug IPC handlers for cache inspection
- [ ] 🟡 Write tests: `OEmbedInspector.test.tsx` (deferred)

---

## Testing Strategy

### Unit Tests

1. **Registry matching** - URL → provider endpoint lookup
2. **Response parsing** - Valid/invalid oEmbed JSON
3. **Cache logic** - Store/retrieve/expire
4. **Discovery** - HTML link tag parsing

### Integration Tests

1. **Full unfurl flow** - URL → cache → response
2. **IPC round-trip** - Renderer → main → renderer

### Mocking

- Mock HTTP responses for consistent testing
- Mock registry for specific provider testing
- Use in-memory database for isolation

---

## Definition of Done

- [x] ✅ Can unfurl a YouTube URL via IPC call
- [x] ✅ Cache stores and retrieves correctly
- [x] ✅ Discovery works for providers not in registry
- [x] ✅ Error handling for network failures, invalid responses
- [x] ✅ Favicons fetch and cache correctly
- [ ] 🟥 Thumbnails proxy through main process (deferred)
- [x] ✅ Storage Inspector shows oEmbed tab with cache data
- [ ] 🟡 Unit tests for all services (deferred)
