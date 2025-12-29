# Link Unfurling

NoteCove automatically creates rich previews for links you paste into your notes using the oEmbed protocol.

## How It Works

When you paste a URL from a supported site, NoteCove:

1. **Detects the URL** - Recognizes links from 300+ content providers
2. **Fetches metadata** - Retrieves title, description, thumbnail, and author info
3. **Creates a preview card** - Displays a rich, interactive preview inline

## Supported Providers

NoteCove supports 300+ content providers including:

### Video Platforms

- YouTube
- Vimeo
- TikTok
- Twitch
- Dailymotion

### Social Media

- Twitter/X (posts and profiles)
- Instagram
- Reddit
- LinkedIn
- Facebook

### Development

- GitHub (repos, gists, issues)
- CodePen
- JSFiddle
- Replit
- StackBlitz

### Productivity

- Figma
- Notion (public pages)
- Miro
- Loom
- Calendly

### Media

- Spotify (tracks, albums, playlists)
- SoundCloud
- Giphy
- Flickr
- Imgur

### Documents

- Google Docs/Sheets/Slides (public)
- SlideShare
- Scribd
- Speaker Deck

## Preview Card Features

Each unfurled link displays:

- **Thumbnail** - Visual preview of the content
- **Title** - Page or content title
- **Description** - Brief summary when available
- **Author** - Creator name and avatar
- **Provider** - Source website with favicon

### Interactive Actions

Hover over a preview card to reveal:

- **Open link** - Opens the URL in your browser
- **Copy URL** - Copies the link with rich HTML formatting
- **Refresh** - Re-fetches the preview metadata

## Settings

Access link unfurling settings from **Settings > oEmbed**:

### Enable Discovery

When a URL isn't recognized by a known provider, NoteCove can attempt to discover oEmbed endpoints directly from the page. This works with many sites that support oEmbed but aren't in the main registry.

Toggle this setting to control discovery behavior:

- **Enabled** (default): Attempts discovery for unknown URLs
- **Disabled**: Only unfurls URLs from known providers

### Cache Management

Preview data is cached locally to improve performance:

- **Refresh All** - Re-fetches all cached previews
- **Clear Cache** - Removes all cached preview data

The cache shows size statistics so you can monitor storage usage.

### Registry Updates

NoteCove periodically checks for updates to the oEmbed provider registry to support new services. The settings panel shows:

- Last registry check date
- Number of known providers
- Option to manually check for updates

## Keyboard Shortcuts

| Action      | Shortcut           |
| ----------- | ------------------ |
| Insert link | `Cmd+K` / `Ctrl+K` |
| Paste URL   | `Cmd+V` / `Ctrl+V` |

## Fallback Behavior

When a URL can't be unfurled:

1. **Known provider, fetch failed** - Shows error state with retry option
2. **Unknown provider, discovery disabled** - Shows as regular link
3. **Offline** - Shows cached preview if available, or offline indicator

## Privacy Considerations

- Preview fetching happens through your machine, not a central server
- Cached data is stored locally in your application data
- No tracking or analytics on which links you unfurl
- Discovery requests go directly to the target website

## Performance

Link unfurling is optimized for performance:

- **Parallel fetching** - Multiple links unfurl simultaneously
- **Smart caching** - Previews cached for 24 hours by default
- **Lazy loading** - Thumbnails load on scroll
- **Retry logic** - Automatic retry with exponential backoff on failure

## Troubleshooting

### Preview not showing?

1. Check that the URL is from a supported provider
2. Ensure you're online (previews require network access)
3. Try clicking the refresh icon on the preview card
4. Check Settings > oEmbed > Enable Discovery is on

### Preview looks outdated?

Click the refresh icon on the preview card to fetch updated metadata.

### Too many previews slowing down notes?

Preview cards are lightweight, but for notes with many links you can:

- Use the Cache Management settings to control storage
- Convert unfurled links back to regular links by deleting and re-pasting

## Next Steps

- [Learn about rich text editing](/features/rich-text-editing)
- [Explore keyboard shortcuts](/guide/keyboard-shortcuts)
- [Configure sync settings](/guide/sync-configuration)
