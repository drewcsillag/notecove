# Questions: Code Block Exit at Document End

## Context

When a code block (fenced by triple backticks) is at the end of a note, it should always be possible to add content after it. Currently, there's a problem where users cannot get past the code block.

## What I Found

TipTap's built-in `@tiptap/extension-code-block` already has two mechanisms to exit a code block at the document end:

1. **`exitOnTripleEnter: true`** (default) - Press Enter three times at the end of a code block to exit and create a paragraph after it
2. **`exitOnArrowDown: true`** (default) - Press down arrow at the end of a code block to exit when there's no content after

Both mechanisms use ProseMirror's `exitCode` command which:

- Creates a new paragraph after the code block
- Moves the cursor to the new paragraph

Our `NotecoveCodeBlock` extension extends `@tiptap/extension-code-block-lowlight` which inherits from `@tiptap/extension-code-block`, so these behaviors _should_ be working.

## Questions

### 1. Can you reproduce the issue?

Please try:

1. Create a code block at the end of a note (type ` ``` ` and press Enter or space)
2. Add some text inside the code block
3. Try to get out of the code block using:
   - Press **Enter 3 times** at the end of the code block
   - Press **down arrow** when cursor is at the last line of the code block

Does either method work? Or are both failing?

Neither works

### 2. Is this a cursor position problem or a new content problem?

When you try to exit:

- Does a new paragraph appear but cursor stays inside code block?
- Does nothing happen at all?
- Does something else happen?

If I hit enter, it stays in the code block. If I arrow down, nothing happens

### 3. Is this related to our custom NodeView?

Our `CodeBlockComponent` uses `ReactNodeViewRenderer` which creates a custom React component wrapper. This might be interfering with the keyboard handlers.

Should I investigate whether the React NodeView is blocking these keyboard events?

If you think it's worthwhile and there's no simpler explanation

### 4. Is this happening on both desktop (Electron) and web?

This could be browser/platform specific.

Web server doesn't work right now, so can't check. But electron definitely

### 5. Any additional context?

- Is this a regression (did it used to work)?
- Are there specific conditions that trigger it (e.g., only when code block is the last AND only block)?
- Does clicking below the code block allow you to add content?

I don't think this ever worked.
It only seems to happen if the code block is last, no other specifics
clicking below the code block doesn't allow me to add content
