# Questions for Syntax Highlighting Feature

## Context

Currently, code blocks (triple-quoted ``` blocks) in NoteCove are rendered with basic styling:

- Background: `action.hover` (gray background)
- Padding and border-radius applied
- Monospace font via browser defaults

There is **no syntax highlighting** - all code appears as plain monospace text regardless of language.

The tech stack doc mentions `CodeBlockLowlight` as a planned extension, but it's not yet implemented.

## Questions

### 1. Language Specification UX

How should users specify the language for syntax highlighting?

**Options:**

- **A) Standard markdown fenced code blocks**: Users type ` ```javascript ` with language after the opening triple backticks (like GitHub)
- **B) Language selector dropdown**: A UI dropdown appears when creating/editing code blocks to pick language
- **C) Both**: Support markdown syntax AND provide a clickable dropdown for discoverability

The current codeBlock from TipTap's StarterKit already stores a `language` attribute (I found tests showing `attrs: { language: 'javascript' }`), so option A should work out of the box with lowlight.

C

### 2. Theme / Color Scheme

What syntax highlighting theme/color scheme do you prefer?

**Options:**

- **A) GitHub-style**: Light theme uses GitHub's light colors, dark theme uses GitHub's dark colors (familiar to developers)
- **B) One Dark/One Light (Atom-style)**: Popular with VS Code users
- **C) Custom theme**: Match NoteCove's existing blue accent colors (`#2196F3`)
- **D) Multiple themes**: Let users choose in settings (more complex, could be added later)

Note: The app already supports light/dark mode toggle, so whatever theme chosen should have both variants.

B

### 3. Supported Languages

Which programming languages should be highlighted? (This affects bundle size)

**Options:**

- **A) Common subset (~15 languages)**: javascript, typescript, python, java, c, cpp, go, rust, ruby, php, html, css, sql, json, yaml, markdown, bash
- **B) Full highlight.js library (190+ languages)**: Everything highlight.js supports, larger bundle
- **C) Auto-detect + explicit**: Support explicit language tags, fall back to auto-detection when none specified

For option A or B, users can still type any language tag - unrecognized languages just won't get highlighting.

A

### 4. Code Block Creation UX

Currently, how do users create code blocks?

From my exploration, it looks like:

- Typing ` ``` ` triggers markdown conversion via InputRules in StarterKit
- There's no toolbar button for code blocks currently

Do you want to:

- **A) Keep markdown-only**: ` ``` ` to create, ` ```lang ` to specify language
- **B) Add toolbar button**: Add a "Code Block" button to EditorToolbar that inserts a code block
- **C) Both**

C

### 5. Line Numbers

Should code blocks display line numbers?

**Options:**

- **A) No line numbers**: Clean, simple look (matches GitHub inline rendering)
- **B) Always show line numbers**: More IDE-like
- **C) Optional toggle**: Users can toggle per-block or globally in settings

Line numbers add complexity (need to handle word wrap, copy behavior, etc.).

C

### 6. Copy Button

Should code blocks have a "copy to clipboard" button?

**Options:**

- **A) Yes**: Small copy icon appears on hover (like GitHub)
- **B) No**: Users select and copy manually
- **C) Later**: Nice to have but defer to separate feature

---

A

## My Recommendations

Based on best practices and keeping scope manageable:

1. **Language specification**: Option A (markdown syntax) - already works with existing schema
2. **Theme**: Option A (GitHub-style) - familiar, well-tested, both light/dark variants exist
3. **Languages**: Option A (common subset) - keeps bundle small, covers 95% of use cases
4. **Creation UX**: Option A (markdown-only for now) - can add toolbar later
5. **Line numbers**: Option A (no line numbers) - simpler, cleaner, can add later
6. **Copy button**: Option C (later) - separate concern, can be Phase 2

This gives us a focused MVP: syntax highlighting for common languages with a familiar theme.
