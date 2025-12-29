# Search

NoteCove provides powerful full-text search powered by SQLite FTS5.

## Global Search

Search across all your notes instantly:

### Basic Search

1. Press `Cmd+F` / `Ctrl+F`
2. Type search query
3. Results appear instantly
4. Click result to open note

### Search Results

Each result shows:

- **Note title**: Name of the note
- **Match preview**: Surrounding context with highlighted match
- **Folder**: Location in folder hierarchy

### Filtering by Tags

Use the Tag Panel to filter search results:

- Click tags in the Tag Panel to filter notes
- **Blue (include)**: Show only notes WITH this tag
- **Red (exclude)**: Show only notes WITHOUT this tag
- Multiple tags use AND logic (all include tags must match, all exclude tags must not match)

### Filtering by Folder

- Select a folder in the sidebar to narrow search to that folder
- Search respects folder selection

## Find in Note

Search within the current note:

1. Press `Cmd+Shift+F` / `Ctrl+Shift+F`
2. Type search query
3. Press `Enter` to jump to next match
4. Press `Esc` to close search

**Navigation:**

- `Cmd+G` / `Ctrl+G`: Next match
- `Cmd+Shift+G` / `Ctrl+Shift+G`: Previous match
- Match count shown in search box

**Options:**

- **Highlight matches**: All matches highlighted in yellow
- **Case sensitivity**: Toggle with button in search box

## Full-Text Search (FTS5)

NoteCove uses SQLite FTS5 for blazing-fast search:

### Features

**Fast:**

- Search thousands of notes instantly
- Optimized indexing
- Incremental updates

**Smart:**

- Relevance ranking
- Prefix matching

### Query Syntax

**Simple queries:**

```
search term          # Find "search" and "term"
"exact phrase"       # Find exact phrase
```

### Automatic Indexing

NoteCove automatically indexes:

- Note titles
- Note content
- Tags
- Folder names

**Incremental updates:**

- Changes indexed in real-time
- No manual rebuild needed
- Background processing

## Search Best Practices

### Writing Searchable Notes

**Use descriptive titles:**

- ✅ "Meeting Notes: Project Alpha - 2024-01-15"
- ❌ "Notes"

**Add tags:**

- Tag with relevant keywords
- Use consistent tag naming

**Include context:**

- Write full sentences
- Use proper terminology
- Add dates and names

### Search Tips

**Be specific:**

- Use exact terms when possible
- Combine multiple keywords
- Use quotes for phrases

**Use filters:**

- Narrow by folder or tag
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

### Wrong Results

**Try:**

- Use quotes for exact phrases
- Add more keywords

## Next Steps

- [Learn organization features](/features/folders-organization)
- [Understand storage architecture](/architecture/storage-architecture)
- [View keyboard shortcuts](/guide/keyboard-shortcuts)
