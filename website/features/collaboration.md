# Comments & Collaboration

NoteCove includes a powerful commenting system inspired by Google Docs, allowing you to add discussions directly to your notes.

## Threaded Comments

Add comments to any text selection in your notes:

1. **Select text** you want to comment on
2. **Click the comment icon** in the toolbar or use `Cmd+Shift+M` / `Ctrl+Shift+M`
3. **Type your comment** and press Enter to post

The selected text is highlighted and linked to your comment thread.

### Comment Threads

Comments are organized in threads:

- **Main comment**: Your initial observation or question
- **Replies**: Responses from you or collaborators
- **Thread resolution**: Mark threads as resolved when done

### Viewing Comments

Comments appear in the **Comments Panel** on the right side of the editor:

- Click a comment to jump to the highlighted text
- Click highlighted text to show its comment thread
- Expand/collapse threads to manage visual clutter

## Reactions

Add emoji reactions to comments for quick feedback:

- **Quick reactions**: Common emojis for fast responses
- **Custom emojis**: Access the full emoji picker
- **Reaction counts**: See how many people reacted

Reactions are perfect for acknowledging comments without adding more text.

## Mentions

Tag notes or concepts in your comments using mentions:

- Type `@` to start a mention
- Select from the autocomplete list
- Mentioned items become clickable links

## Use Cases

### Personal Notes

Even in personal notes, comments are valuable:

- **Questions**: Mark areas needing research
- **TODOs**: Flag sections to revisit
- **Context**: Add background information without cluttering the main text
- **Review notes**: Self-feedback during editing

### Collaboration

When sharing notes (via file sync), comments enable:

- **Feedback**: Leave suggestions on drafts
- **Discussions**: Debate ideas in context
- **Approvals**: Use reactions to signal agreement
- **Questions**: Ask for clarification on specific points

## Keyboard Shortcuts

| Action           | macOS         | Windows/Linux  |
| ---------------- | ------------- | -------------- |
| Add comment      | `Cmd+Shift+M` | `Ctrl+Shift+M` |
| Navigate threads | Arrow keys    | Arrow keys     |
| Post comment     | `Enter`       | `Enter`        |
| Cancel           | `Escape`      | `Escape`       |

## CRDT-Powered Comments

Like the rest of NoteCove, comments are built on CRDTs:

- **Sync across devices**: Comments appear on all your machines
- **Conflict-free**: Multiple users can comment simultaneously
- **Offline support**: Add comments offline, sync later
- **Guaranteed consistency**: All devices see the same comments

## Privacy

Comments are stored alongside your notes:

- **Local storage**: Comments never leave your devices (except via file sync)
- **No servers**: No cloud service sees your comments
- **Your control**: Delete comments anytime

## Next Steps

- [Learn about rich text editing](/features/rich-text-editing)
- [Understand the sync mechanism](/architecture/sync-mechanism)
- [View all keyboard shortcuts](/guide/keyboard-shortcuts)
