/**
 * Mock for @tiptap/extension-code-block-lowlight
 *
 * Jest has trouble with ESM resolution in the TipTap 3 packages.
 * This mock uses the base CodeBlock extension and adds the lowlight interface.
 * E2E tests verify actual syntax highlighting works.
 */

import CodeBlock, { CodeBlockOptions } from '@tiptap/extension-code-block';

// Create a mock CodeBlockLowlight that extends CodeBlock
// It adds the `lowlight` option but doesn't actually use it for highlighting
const CodeBlockLowlight = CodeBlock.extend({
  name: 'codeBlock',

  addOptions(): CodeBlockOptions & { lowlight: null; defaultLanguage: null } {
    // Use non-null assertion since parent exists at runtime
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const parentOptions = this.parent!();
    return {
      ...parentOptions,
      lowlight: null,
      defaultLanguage: null,
    };
  },
});

export default CodeBlockLowlight;
export { CodeBlockLowlight };
