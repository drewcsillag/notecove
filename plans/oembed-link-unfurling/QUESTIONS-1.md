# oEmbed Link Unfurling - Questions Round 1

## Display Options

### Q1: Link Chip vs Full Unfurl - When to Use Each?

You mentioned two display options:

1. **Link Chip** - Compact representation (favicon + title in a pill/chip)
2. **Full Unfurl** - Rich preview card (thumbnail, title, description, author, etc.)

Questions:

- **Default behavior**: Should links be **chips by default** with option to expand to full unfurl? Or **unfurl by default** with option to collapse?

Unfurl by default

- **User control**: Should users be able to toggle between chip/unfurl per-link? Or set a global preference?

Yes, on a per-link basis

- **Automatic vs manual**: Should unfurling happen automatically when a link is added, or require user action (e.g., click "Unfurl" button in the link popover)?

Automatically

### Q2: Link Chip Design

For the compact link chip option:

- Should it show **favicon + title** only?
- Or **favicon + domain** (e.g., 🔗 youtube.com)?
- Or **favicon + page title truncated**?
- Any other metadata to include in the chip?

What does google docs do?

### Q3: Full Unfurl Design

For the rich preview:

- **Inline or block?** Should the unfurl appear inline (expanding the line) or as a block below the link text?
- **Image thumbnails**: Should we show thumbnail images in the preview? (Increases complexity and network usage)
- **Video embeds**: Should we actually embed playable videos, or just show a preview image with play button that opens in browser?
- **Size constraints**: Any preferred max width/height for unfurl cards?

What does notion or dropbox paper do here?

But yes, embed a playable video

## Registry & Discovery

### Q4: Registry Update Strategy

You suggested a local copy of the registry with discovery fallback. Options:

**A) Bundle at build time**

- Pros: No network request needed, instant matching
- Cons: Gets stale between app updates

**B) Fetch periodically (e.g., weekly/monthly)**

- Pros: Stays current
- Cons: More complex, needs network

**C) Bundle + periodic delta updates**

- Pros: Best of both
- Cons: Most complex

Which approach do you prefer?

C

### Q5: Discovery Fallback Behavior

When a URL doesn't match any provider in the registry:

- **Always attempt discovery** (check the page's `<link>` tags for oEmbed endpoint)?
- **Only attempt discovery on user request** (button in popover)?
- **Never attempt discovery** (only use registry)?

Discovery means an extra HTTP request to fetch the page HTML, so there's a performance/privacy tradeoff.

User setting, but default to always attempt discovery.

## Caching & Performance

### Q6: Cache Duration

How long should we cache unfurl data?

- **24 hours** (fresh but more network)
- **1 week** (good balance)
- **30 days** (minimal network, possibly stale)
- **Until manually refreshed** (user control)

Until manually refreshed

### Q7: Rate Limiting

If a note has many links (e.g., 20+), should we:

- **Unfurl all immediately** (may be slow on paste of many links)
- **Unfurl visible only** (lazy loading as user scrolls)
- **Limit concurrent unfurls** (e.g., max 3 at a time)
- **Queue and unfurl in background**?

Unfurl visible only
limit max 3
queue others

## Storage

### Q8: Where to Store Unfurl Data?

Options:
**A) In the document** (persisted with note CRDT)

- Pros: Syncs across devices, works offline
- Cons: Bloats document, data can get stale, sync conflicts

**B) In local database cache** (fetch on demand)

- Pros: Documents stay lean, always fresh
- Cons: Need network to see unfurls, may differ across devices

**C) Hybrid** (cache locally, fetch if missing)

- Store URL + preference (chip/unfurl) in document
- Fetch actual metadata on demand, cache locally

Which approach do you prefer?

~~I'm leaning B.~~ **CHANGED: Option A - Store in document CRDT** (syncs across devices, works offline)

## UX Edge Cases

### Q9: Editing vs Reading Behavior

When the cursor is in/near an unfurled link:

- Should the unfurl **collapse to chip/link** while editing nearby?
- Should it **stay expanded** but not be editable?
- Should there be a **hover/focus** state that shows edit options?

### Q10: Multiple Links on Same Line

If a paragraph has multiple links like "Check out [YouTube](url1) and [Vimeo](url2)":

- Should **both** unfurl (could look cluttered)?
- Should **only the first/last** unfurl?
- Should they become **chips** instead of full unfurls?

### Q11: Links in Special Contexts

Should we unfurl links that appear in:

- **Headings** (h1-h6)?
- **List items**?
- **Blockquotes**?
- **Code blocks** (probably not)?

Or only links in regular paragraphs?

What does google docs, notion, and dropbox paper do?
Agree not in code blocks.

## Security

### Q12: Rich HTML Content

oEmbed "rich" type returns arbitrary HTML (often iframes for embeds). How should we handle this?

- **Sandbox in iframe** (safest but adds complexity)
- **Only allow specific providers** (YouTube, Vimeo, etc.)
- **Skip rich type entirely** (just show as preview card with link)
- **Something else**?

Sandbox in iframe

## Scope

### Q13: Phase 1 Scope

Given the complexity, would you prefer a phased approach?

**Phase 1 (MVP):**

- Link chips only (favicon + title)
- Local registry, no discovery
- Most common providers (YouTube, Twitter/X, GitHub, etc.)

**Phase 2:**

- Full unfurl cards
- Discovery fallback
- All registry providers

**Phase 3:**

- Video/rich embeds
- User preferences
- Cache management UI

Or do you want the full feature in one go?

## I like the idea of phases.

Please answer these questions so I can create a detailed implementation plan. Feel free to answer with short responses or "your call" if you want me to make the decision.
