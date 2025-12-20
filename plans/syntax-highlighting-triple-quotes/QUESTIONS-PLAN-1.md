# Plan Critique Questions

## 1. Language Aliases

Should we support common aliases like `js` for `javascript`, `ts` for `typescript`, `py` for `python`?

Lowlight/highlight.js has built-in alias support, so this may "just work" - I'll verify during implementation.

**Options:**

- A) Yes, rely on lowlight's built-in aliases
- B) Add explicit alias mapping for control
- C) Don't worry about it for now

A

## 2. No Language Specified

When a user creates a code block without specifying a language (just ` ``` `), what should happen?

**Options:**

- A) Plain text (no highlighting) - current behavior
- B) Auto-detect language (adds complexity, can be wrong)
- C) Default to a specific language (e.g., "plaintext" or "text")

B

## 3. Keyboard Shortcut

Should we add a keyboard shortcut for creating code blocks?

**Options:**

- A) Yes, Cmd+Shift+C (or Ctrl+Shift+C on Windows/Linux)
- B) Yes, but different shortcut (specify which)
- C) No, toolbar + markdown syntax is enough

A

## 4. Markdown Import

The plan covers export testing. Should I also verify/test that markdown import correctly sets the language attribute when importing files like:

```markdown
Here's some code:

` ` `python
def hello():
    print("world")
` ` `
```

(I suspect it already works since the schema has the language attr, but should confirm.)

**Options:**

- A) Yes, add explicit import test
- B) No, trust existing implementation

## A -- great catch!

## My Recommendations

1. **Aliases**: A (rely on lowlight)
2. **No language**: A (plain text, matches GitHub behavior)
3. **Keyboard shortcut**: C (defer, can add later)
4. **Import test**: A (verify it works)
