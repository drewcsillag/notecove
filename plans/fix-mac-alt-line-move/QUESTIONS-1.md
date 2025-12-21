# Questions for Fix Mac Alt+Arrow Line Move

## Background

The current implementation in `MoveBlock.ts` uses:

```typescript
addKeyboardShortcuts() {
  return {
    'Alt-Up': () => this.editor.commands.moveBlockUp(),
    'Alt-Down': () => this.editor.commands.moveBlockDown(),
  };
}
```

This doesn't work on Mac because the Option key (Alt) on macOS is a **character modifier**, not a command modifier. When you press Option+ArrowUp on Mac, the browser may not generate the expected `'Alt-Up'` event that TipTap/ProseMirror is listening for.

## Questions

### 1. Which shortcut should we use on Mac?

Common choices for "move line" shortcuts on Mac:

**Option A: `Cmd-Option-Up/Down` (Meta-Alt-Up/Down)**

- Pros: Similar to Alt-Up/Down, just with Cmd added
- Cons: A bit awkward to press

**Option B: `Ctrl-Cmd-Up/Down` (Ctrl-Meta-Up/Down)**

- Pros: Common pattern in many Mac apps
- Cons: Different from the Windows/Linux shortcut

**Option C: `Cmd-Shift-Up/Down` (Meta-Shift-Up/Down)**

- Pros: Easy to press
- Cons: May conflict with selection extension shortcuts

**Option D: Keep trying Alt-Up/Down but investigate if there's a configuration issue**

- We might be missing something - could be worth a quick investigation first

Which do you prefer?

Option up/down to match VSCode -- it's already bound to something kinda odd.

### 2. Should Windows/Linux shortcuts stay as `Alt-Up/Down`?

This is the standard in VS Code and many other editors on those platforms. I assume yes, but want to confirm.

Yes

### 3. Should we show platform-specific shortcuts in any UI/documentation?

Are there tooltips or help text that reference these shortcuts? Should they show different shortcuts based on platform?

Not that I can think of.
