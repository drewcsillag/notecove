# Questions - Code Block Plain Text Option

## Analysis

The current implementation has:

1. `SUPPORTED_LANGUAGES` array in `CodeBlockLowlight.ts` - curated list of ~20 languages
2. `LANGUAGE_DISPLAY_NAMES` map in `CodeBlockComponent.tsx` - user-friendly display names

Adding plain text requires:

1. Adding `'plaintext'` to `SUPPORTED_LANGUAGES` (lowlight/highlight.js recognizes this as the official name)
2. Adding display name mapping (e.g., "Plain Text")

## Questions

1. **Display name preference**: The standard language name is `plaintext`. What should the dropdown display?
   - "Plain Text" (title case, spaced)
   - "Plaintext" (single word)
   - "Text" (shorter)

"Plan Text"

2. **Position in list**: Where should Plain Text appear in the language dropdown?
   - At the top (first option after "Auto-detect")
   - Alphabetically sorted with other languages (would be between "PHP" and "Python")
   - At the bottom of the list

At the top, the rest should be alphabetized as they're sorta just in random order
