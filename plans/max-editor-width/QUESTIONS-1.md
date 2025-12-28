# Questions - Max Editor Width Feature

## Context

You want the note editor to have a maximum width similar to Google Docs and Dropbox Paper - where content doesn't stretch edge-to-edge even on very wide screens, but rather centers with a comfortable reading/writing width.

## Questions

### 1. What maximum width value should be used?

Common values in similar apps:

- **Google Docs**: ~816px (matches 8.5" page width at 96 DPI)
- **Dropbox Paper**: ~720px
- **Medium**: ~680px
- **Notion**: ~900px (wider for tables/databases)

Do you have a preference, or should I start with a commonly used value like 720px-800px?

720-800px sounds decent. Just make it easy to change if it feels wrong.

### 2. Should the toolbar also be constrained to the same max-width?

Currently the `EditorToolbar` sits above the editor content. Options:

- **Option A**: Toolbar also constrained to match content width (Google Docs style)
- **Option B**: Toolbar stays full width, only content is constrained (some apps do this)

Option A

### 3. Should there be a user preference to adjust or disable this?

- Should users be able to toggle between "full width" and "centered" modes?
- Should the max-width be configurable in settings?
- Or just implement a fixed behavior for now?

just fixed width for now

### 4. How should this interact with wide content like tables and images?

- **Option A**: Tables and images respect the same max-width (may require horizontal scrolling for wide tables)
- **Option B**: Allow certain content types to break out of the max-width constraint
- **Option C**: Keep everything constrained but ensure tables handle this gracefully (with internal scrolling if needed)

Option C - Keep everything constrained, tables use internal horizontal scrolling (already implemented).

### 5. Should the comment panel (when open) affect the centering?

When the comment panel is open, the editor panel becomes narrower. Should:

- **Option A**: The max-width content stay centered in the available space
- **Option B**: The max-width remain the same but shift left as space decreases

Option A - Stay centered in available space.
