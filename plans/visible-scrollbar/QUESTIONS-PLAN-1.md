# Plan Questions - Code Block Scrollbar Behavior

## Issue Discovered

CSS limitation: Once we customize scrollbars with `::-webkit-scrollbar`, we cannot revert specific elements back to the OS default overlay scrollbar behavior. There's no "unset" that restores native scrollbars.

## Options

### Option A: Selective Styling (Recommended)

Apply scrollbar styles to specific app containers rather than globally:

- `.MuiBox-root` containers for panels
- Or use a custom class like `.custom-scrollbar` on containers we want styled

**Pros**: Code blocks naturally excluded, cleaner
**Cons**: Slightly more manual, but these containers don't change often

### Option B: Global + Accept Code Blocks Get Styled

Apply globally, code blocks also get visible scrollbars.

**Pros**: Simplest implementation
**Cons**: Code blocks won't have "default behavior" as you requested

### Option C: Global + Style Code Blocks Minimally

Apply globally, but give code blocks a very thin/subtle scrollbar that's less intrusive.

**Pros**: Consistent behavior everywhere
**Cons**: Still not truly "default"

---

## Question

Which approach do you prefer for handling code blocks?

- **A)** Selective styling - only style main app containers (code blocks excluded)
- **B)** Global styling - accept code blocks also get visible scrollbars
- **C)** Global + minimal code block scrollbars

B
