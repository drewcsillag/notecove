# Onboarding Wizard - Questions Round 3

## Paranoid Mode Network Safety

I've identified a gap in the current plan regarding markdown imports in paranoid mode.

### The Problem

The `welcome.md` file contains links with explicit chip/unfurl display modes:

```markdown
- [The Onion](https://theonion.com/...){.chip} — fetches favicon
- [YouTube Video](https://www.youtube.com/...){.unfurl} — fetches preview data
```

When `markdownToProsemirror()` processes this:

1. Links get `displayMode: 'chip'` or `displayMode: 'unfurl'` baked into the mark attrs
2. `oembedUnfurl` block nodes are created with `isLoading: true`
3. When rendered, these nodes will attempt network requests regardless of the global preference

The "secure" preference prevents NEW links from fetching, but existing chip/unfurl nodes would still try.

### Proposed Solutions

**Option A: Secure import mode**
Add a `secureMode` parameter to `markdownToProsemirror()` that:

- Forces all link display modes to `'link'` (plain)
- Skips creation of `oembedUnfurl` blocks
- Use this for all markdown imports in paranoid mode

**Option B: Separate welcome file**
Create `welcome-paranoid.md` with no chip/unfurl links at all

**Option C: Both + editor safety**
Implement secure import mode AND add a check in the chip/unfurl renderers to verify the global preference before making any network requests (defense-in-depth)

I recommend **Option C** because:

1. Secure import mode handles the welcome note and any future markdown imports
2. Editor-level checks provide defense-in-depth for edge cases
3. If someone copies content from another profile, the editor check still protects them

C - yeah, I can see full fidelity note import/export at some point not too far away, and I'd want to make sure that it did the right thing here (which would be to show it as plain link no matter what form it originally appeared as).

### Questions

1. **Agreed on Option C approach?** (secure import + editor safety checks)

2. **Should markdown export also be affected?** When exporting from a paranoid profile, should we:
   - Export with `{.link}` on all links (no chip/unfurl syntax)
   - Export as-is (the import is the protection, not export)

   I'm leaning toward exporting as-is since the protection should be on import.

exporting as-is should be fine. The importer might not be paranoid and so we'd want that to do the chip/unfurl
