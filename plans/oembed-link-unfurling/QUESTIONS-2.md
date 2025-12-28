# oEmbed Link Unfurling - Questions Round 2

Based on research into Google Docs, Notion, and Dropbox Paper.

## Q2 Follow-up: Link Chip Design

**Google Docs approach**: Icon + short title inline, with hover card showing full preview.

**Recommendation for NoteCove link chips:**

- **Chip**: Favicon + truncated page title (e.g., `🎬 How to Build a Startup - Y...`)
- **Hover**: Show preview card with full title, description, thumbnail (like Google Docs)

Does this approach work for you? Or would you prefer something different?

## sounds good to me

## Q3 Follow-up: Full Unfurl Design

**Notion's approach** (which I recommend):

- **Bookmark blocks**: Card with thumbnail on left, title + description + URL on right
- **Embed blocks**: Full interactive content (videos play inline, maps are interactive)

**Proposed design for NoteCove:**

```
┌─────────────────────────────────────────────────────┐
│ ┌─────────┐  Title of the Page                      │
│ │         │  Description text that can wrap to      │
│ │  thumb  │  multiple lines but gets truncated...   │
│ │         │  🔗 example.com                         │
│ └─────────┘                                         │
└─────────────────────────────────────────────────────┘
```

For videos (YouTube, Vimeo, etc.):

```
┌─────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────┐    │
│  │                                             │    │
│  │            [Embedded Video Player]          │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│  Video Title - youtube.com                          │
└─────────────────────────────────────────────────────┘
```

Does this design direction work? Any adjustments?

## looks good to me

## Q9: Editing vs Reading Behavior (Still Needs Answer)

When the cursor is in/near an unfurled link:

- Should the unfurl **collapse to chip/link** while editing nearby?
- Should it **stay expanded** but not be editable?
- Should there be a **hover/focus** state that shows edit options?

**My recommendation**: Stay expanded, show a subtle toolbar on hover/selection with options to:

- Convert to chip
- Remove unfurl (back to plain link)
- Refresh preview
- Open in browser

Agree with recommendation

---

## Q10: Multiple Links on Same Line (Still Needs Answer)

If a paragraph has multiple links like "Check out [YouTube](url1) and [Vimeo](url2)":

- Should **both** unfurl (could look cluttered)?
- Should **only the first/last** unfurl?
- Should they become **chips** instead of full unfurls?

**My recommendation**: Multiple links on the same line become chips by default. User can manually expand any to full unfurl, which would then display as a block below the paragraph.

## sounds good, lets go with that

## Q11 Follow-up: Links in Special Contexts

I couldn't find specific documentation on how these apps handle links in headings/lists/blockquotes.

**My recommendation**:

- **Headings**: Chip only (full unfurl would break heading visual hierarchy)
- **List items**: Chip only (full unfurl would disrupt list flow)
- **Blockquotes**: Chip only
- **Regular paragraphs**: Full unfurl by default
- **Code blocks**: No unfurling (as you agreed)

Does this context-aware behavior make sense?

It does. Lets go with that

---

## New Question: Unfurl vs Chip Persistence

When a user manually converts an unfurl to a chip (or vice versa), should this preference:

- **A) Persist per-link** (stored with the link, syncs across devices)
- **B) Be session-only** (resets to default on reload)

I'm assuming A (persist per-link) based on your earlier answer about per-link control. Confirm?

## A - agree

## Summary of Your Answers So Far

| Question            | Your Answer                                  |
| ------------------- | -------------------------------------------- |
| Default behavior    | Unfurl by default                            |
| User control        | Per-link toggle                              |
| Automatic vs manual | Automatic                                    |
| Registry strategy   | Bundle + periodic delta updates              |
| Discovery fallback  | User setting, default to always              |
| Cache duration      | Until manually refreshed                     |
| Rate limiting       | Visible only, max 3 concurrent, queue others |
| Storage             | Local database cache (option B)              |
| Rich HTML           | Sandbox in iframe                            |
| Phased approach     | Yes, likes phases                            |

Once you answer the remaining questions, I'll create the implementation plan.
