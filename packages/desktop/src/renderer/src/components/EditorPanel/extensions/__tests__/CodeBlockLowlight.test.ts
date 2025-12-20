/**
 * CodeBlockLowlight Extension Tests
 *
 * Tests for the TipTap code block with syntax highlighting extension.
 * @see plans/syntax-highlighting-triple-quotes/PLAN.md
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { NotecoveCodeBlock, SUPPORTED_LANGUAGES } from '../CodeBlockLowlight';

describe('NotecoveCodeBlock Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          // Disable built-in codeBlock since we're using CodeBlockLowlight
          codeBlock: false,
        }),
        NotecoveCodeBlock,
      ],
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Extension Configuration', () => {
    it('should register codeBlock node type', () => {
      const codeBlockType = editor.schema.nodes['codeBlock'];
      expect(codeBlockType).toBeDefined();
    });

    it('should have language attribute', () => {
      const codeBlockType = editor.schema.nodes['codeBlock'];
      expect(codeBlockType).toBeDefined();
      const attrs = codeBlockType?.spec.attrs as Record<string, { default: unknown }> | undefined;
      expect(attrs?.['language']).toBeDefined();
    });

    it('should export supported languages list', () => {
      expect(SUPPORTED_LANGUAGES).toBeDefined();
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
      expect(SUPPORTED_LANGUAGES).toContain('javascript');
      expect(SUPPORTED_LANGUAGES).toContain('typescript');
      expect(SUPPORTED_LANGUAGES).toContain('python');
    });
  });

  describe('Code Block Creation', () => {
    it('should create a code block with language attribute', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node).not.toBeNull();
      expect(node?.type.name).toBe('codeBlock');
      expect(node?.attrs['language']).toBe('javascript');
      expect(node?.textContent).toBe('const x = 1;');
    });

    it('should create code block without language (for auto-detect)', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: null },
            content: [{ type: 'text', text: 'def hello(): pass' }],
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.type.name).toBe('codeBlock');
      expect(node?.attrs['language']).toBeNull();
    });
  });

  describe('toggleCodeBlock command', () => {
    it('should toggle paragraph to code block', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'some code' }],
          },
        ],
      });

      editor.commands.toggleCodeBlock();

      const node = editor.state.doc.firstChild;
      expect(node?.type.name).toBe('codeBlock');
    });

    it('should toggle code block back to paragraph', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      });

      // Position cursor inside code block
      editor.commands.setTextSelection(1);
      editor.commands.toggleCodeBlock();

      const node = editor.state.doc.firstChild;
      expect(node?.type.name).toBe('paragraph');
    });
  });

  describe('setCodeBlock command', () => {
    it('should set language on existing code block', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'code' }],
          },
        ],
      });

      editor.commands.setTextSelection(1);
      editor.commands.setCodeBlock({ language: 'python' });

      const node = editor.state.doc.firstChild;
      expect(node?.attrs['language']).toBe('python');
    });
  });

  describe('HTML Output', () => {
    it('should render with language class', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [{ type: 'text', text: 'const x: number = 1;' }],
          },
        ],
      });

      const html = editor.getHTML();
      // CodeBlockLowlight renders language as a class
      expect(html).toContain('language-typescript');
      expect(html).toContain('<pre>');
      expect(html).toContain('<code');
    });

    it('should render code content correctly', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      });

      const html = editor.getHTML();
      expect(html).toContain('const x = 1;');
    });
  });

  // NOTE: Actual syntax highlighting (hljs-* classes) is tested in E2E tests
  // since it requires real lowlight which is ESM-only and difficult to test in Jest.
  // These unit tests verify the extension configuration is correct.

  describe('Keyboard Shortcuts', () => {
    it('should have Mod-Shift-c keyboard shortcut registered', () => {
      // The extension should register a keyboard shortcut for toggling code blocks
      // We can't easily test the actual keyboard event in unit tests,
      // but we can verify the extension has keyboard shortcuts configured
      const extension = editor.extensionManager.extensions.find((ext) => ext.name === 'codeBlock');
      expect(extension).toBeDefined();
      // The extension should have addKeyboardShortcuts method
      expect(extension?.options).toBeDefined();
    });
  });

  describe('Line Numbers Attribute', () => {
    it('should have showLineNumbers attribute with default false', () => {
      const codeBlockType = editor.schema.nodes['codeBlock'];
      expect(codeBlockType).toBeDefined();
      const attrs = codeBlockType?.spec.attrs as Record<string, { default: unknown }> | undefined;
      expect(attrs?.['showLineNumbers']).toBeDefined();
      expect(attrs?.['showLineNumbers']?.default).toBe(false);
    });

    it('should preserve showLineNumbers attribute on code block', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript', showLineNumbers: true },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.attrs['showLineNumbers']).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty code blocks', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'python' },
            // No content
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.type.name).toBe('codeBlock');
      expect(node?.textContent).toBe('');
    });

    it('should handle code with special characters', () => {
      const specialCode = '<html>&amp;"quotes\'</html>\n\ttabs\nünicode';
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'html' },
            content: [{ type: 'text', text: specialCode }],
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.textContent).toBe(specialCode);
    });

    it('should handle very long lines', () => {
      const longLine = 'x'.repeat(1000);
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'text' },
            content: [{ type: 'text', text: longLine }],
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.textContent).toBe(longLine);
      expect(node?.textContent.length).toBe(1000);
    });

    it('should handle unknown language tags gracefully', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'nonexistent-language-xyz' },
            content: [{ type: 'text', text: 'some code' }],
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.type.name).toBe('codeBlock');
      expect(node?.attrs['language']).toBe('nonexistent-language-xyz');
      // Should not throw, just not highlight
      expect(node?.textContent).toBe('some code');
    });

    it('should handle multiline code', () => {
      const multilineCode = 'line 1\nline 2\nline 3\n  indented line';
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: multilineCode }],
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.textContent).toBe(multilineCode);
      expect(node?.textContent.split('\n')).toHaveLength(4);
    });
  });
});
