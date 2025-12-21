/**
 * CodeBlockLowlight Extension
 *
 * TipTap extension for syntax-highlighted code blocks using lowlight.
 * Supports auto-detection when no language is specified.
 *
 * @see plans/syntax-highlighting-triple-quotes/PLAN.md
 */

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { all, createLowlight } from 'lowlight';
import { CodeBlockComponent } from '../CodeBlockComponent';

/**
 * Supported languages for syntax highlighting.
 * These are the most commonly used languages and are available in the language selector.
 * Lowlight supports many more languages via auto-detection.
 */
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'go',
  'rust',
  'ruby',
  'php',
  'html',
  'css',
  'sql',
  'json',
  'yaml',
  'markdown',
  'bash',
  'shell',
  'xml',
  'diff',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Create lowlight instance with all languages for maximum compatibility
// This includes go, rust, yaml, and 190+ other languages
const lowlight = createLowlight(all);

/**
 * NotecoveCodeBlock extension
 *
 * Extends TipTap's CodeBlockLowlight with:
 * - Common language subset for syntax highlighting
 * - Auto-detection when no language specified
 * - Language selector dropdown via React NodeView
 * - Keyboard shortcut: Cmd+Shift+C (Mac) / Ctrl+Shift+C (Win/Linux)
 * - Optional line numbers (per-block toggle)
 */
export const NotecoveCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    const parentAttributes = this.parent?.() ?? {};
    return {
      ...parentAttributes,
      showLineNumbers: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-show-line-numbers') === 'true',
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes['showLineNumbers']) {
            return {};
          }
          return { 'data-show-line-numbers': 'true' };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => {
        return this.editor.commands.toggleCodeBlock();
      },
    };
  },
}).configure({
  lowlight,
  // Default to no language (triggers auto-detect)
  defaultLanguage: null,
});

export default NotecoveCodeBlock;
