# Search

NoteCove provides powerful full-text search powered by SQLite FTS5.

## Quick Search

### Search Current Note

Find text within the current note:

1. Press `Cmd+F` / `Ctrl+F`
2. Type search query
3. Press `Enter` to jump to next match
4. Press `Esc` to close search

**Navigation:**

- `Cmd+G` / `Ctrl+G`: Next match
- `Cmd+Shift+G` / `Ctrl+Shift+G`: Previous match
- Match count shown in search box

### Search Box Features

- **Highlight matches**: All matches highlighted in yellow
- **Case sensitivity**: Toggle with button or `Alt+C`
- **Whole word**: Match whole words only with `Alt+W`
- **Regex**: Advanced pattern matching with `Alt+R`

## Global Search

(Coming soon)

Search across all notes:

### Basic Search

1. Press `Cmd+Shift+F` / `Ctrl+Shift+F`
2. Type search query
3. Results appear instantly
4. Click result to open note

### Search Results

Each result shows:

- **Note title**: Name of the note
- **Match preview**: Surrounding context with highlighted match
- **Folder**: Location in folder hierarchy
- **Modified date**: When note was last edited
- **Match count**: Number of matches in this note

### Filters

Filter search results:

**By folder:**

- Select one or more folders
- Include/exclude subfolders
- Combine with other filters

**By date:**

- Created date range
- Modified date range
- Relative dates (last week, last month)

**By tag:**

- Filter by one or more tags
- AND/OR logic
- Combine with folder filters

**By content type:**

- Notes with images
- Notes with code blocks
- Notes with links
- Notes with tasks

## Full-Text Search (FTS5)

NoteCove uses SQLite FTS5 for blazing-fast search:

### Features

**Fast:**

- Search millions of words instantly
- Optimized indexing
- Incremental updates

**Smart:**

- Stemming (search "run" finds "running", "ran")
- Stop words filtered
- Relevance ranking

**Flexible:**

- Prefix matching
- Phrase search
- Boolean operators
- Proximity search

### Query Syntax

**Simple queries:**

```
search term          # Find "search" and "term"
"exact phrase"       # Find exact phrase
search OR term       # Either word
search NOT term      # Exclude "term"
```

**Advanced queries:**

```
search AND term      # Both words required
prefix*              # Prefix matching
NEAR(search term, 5) # Words within 5 positions
```

**Field-specific:**

```
title:search         # Search in titles only
content:term         # Search in content only
tag:work             # Search in tags
```

### Relevance Ranking

Results ranked by relevance:

1. **Title matches**: Higher weight than content matches
2. **Exact matches**: Higher than stemmed matches
3. **Proximity**: Closer matches ranked higher
4. **Frequency**: More matches = higher rank
5. **Recency**: Recent notes boosted slightly

## Search Index

### Automatic Indexing

NoteCove automatically indexes:

- Note titles
- Note content
- Tags (when implemented)
- Folder names

**Incremental updates:**

- Changes indexed in real-time
- No manual rebuild needed
- Background processing

### Index Management

(Coming soon)

Control the search index:

**Rebuild index:**

- Preferences → Search → Rebuild Index
- Use if search results seem incorrect
- Progress shown during rebuild

**Index statistics:**

- Number of indexed notes
- Index size on disk
- Last update time

**Exclude from index:**

- Exclude specific folders
- Reduce index size
- Speed up search

## Advanced Search

### Saved Searches

(Coming soon)

Save frequently-used searches:

1. Perform a search with filters
2. Click "Save Search"
3. Name your search
4. Access from sidebar

**Examples:**

- "Work TODOs": All task lists in Work folder
- "Recent Ideas": Notes in Ideas folder from last week
- "Code Snippets": Notes with code blocks

### Search Shortcuts

(Coming soon)

Quick access to common searches:

- All TODOs: `Cmd+Shift+T` / `Ctrl+Shift+T`
- Recent notes: `Cmd+Shift+R` / `Ctrl+Shift+R`
- Favorites: `Cmd+Shift+F` / `Ctrl+Shift+F`

### Regular Expressions

Enable regex mode for advanced patterns:

**Examples:**

```regex
\d{3}-\d{3}-\d{4}    # Phone numbers
\b[A-Z]{2,}\b        # Acronyms
TODO:.*              # All TODOs
```

**Use cases:**

- Find patterns
- Validate formats
- Complex matching

## Search Performance

### Optimization

NoteCove optimizes search performance:

**Caching:**

- Recent queries cached
- Instant results for repeated searches
- Cache cleared on index update

**Pagination:**

- Load results in batches
- Scroll to load more
- Smooth performance with many matches

**Background processing:**

- Indexing happens in background
- No UI blocking
- Low CPU usage

### Large Databases

Performance with many notes:

| Notes   | Index Time | Search Time |
| ------- | ---------- | ----------- |
| 1,000   | < 1s       | < 10ms      |
| 10,000  | < 10s      | < 50ms      |
| 100,000 | < 60s      | < 100ms     |

_Times approximate, depends on hardware and note size_

## Search Best Practices

### Writing Searchable Notes

**Use descriptive titles:**

- ✅ "Meeting Notes: Project Alpha - 2024-01-15"
- ❌ "Notes"

**Add tags:**

- Tag with relevant keywords
- Use consistent tag naming
- Create tag hierarchy

**Include context:**

- Write full sentences
- Use proper terminology
- Add dates and names

### Organizing for Search

**Folder structure:**

- Clear folder names
- Consistent naming
- Not too deep hierarchy

**Naming conventions:**

- Date prefixes for chronological sorting
- Action prefixes (TODO, IDEA, DRAFT)
- Consistent capitalization

### Search Tips

**Be specific:**

- Use exact terms when possible
- Combine multiple keywords
- Use quotes for phrases

**Use filters:**

- Narrow by folder or tag
- Filter by date
- Combine multiple filters

**Try variations:**

- Different word forms
- Synonyms
- Abbreviations

## Troubleshooting

### No Results Found

**Try:**

- Check spelling
- Remove filters
- Try fewer keywords
- Use prefix matching (word\*)

### Wrong Results

**Try:**

- Use quotes for exact phrases
- Add more keywords
- Use NOT to exclude terms
- Rebuild search index

### Slow Search

**Optimize:**

- Rebuild search index
- Close other windows
- Reduce result limit
- Exclude large folders from index

## Next Steps

- [Learn organization features](/features/folders-organization)
- [Understand storage architecture](/architecture/storage-architecture)
- [View keyboard shortcuts](/guide/keyboard-shortcuts)
