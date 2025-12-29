# Plan Critique Questions

## Q1: Attribute Syntax Scope

Pandoc's full attribute syntax supports:

```markdown
[text](url){#id .class1 .class2 key=value}
```

Should we:

- **A**: Only support exactly `{.link}`, `{.chip}`, `{.unfurl}` (simplest, covers our use case)
- **B**: Support the full Pandoc attribute syntax and extract displayMode from classes (more complex, future-proof)

I recommend **A** since we only need displayMode and full Pandoc support adds complexity we don't need.

A

## Q2: Whitespace Handling

Should `[text](url) {.chip}` (with space before attribute) work?

I recommend **yes** - be lenient in what we accept. The regex would be something like:

```
\{\.(?:link|chip|unfurl)\}
```

And we'd strip it from text nodes that immediately follow a link (with optional whitespace).

sounds good, do it.
