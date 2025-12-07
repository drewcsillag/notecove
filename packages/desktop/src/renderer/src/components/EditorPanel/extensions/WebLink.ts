/**
 * Web Link TipTap Extension
 *
 * Extends TipTap's Link extension to provide web link support with:
 * - Auto-detection of bare URLs (on space/enter/paste)
 * - Click handling (single-click popover, Cmd+click direct open)
 * - Only http:// and https:// protocols allowed
 *
 * This uses TipTap's mark-based approach where the link is stored as a mark
 * on the text with an href attribute. This is different from InterNoteLink
 * which uses decorations and stores [[uuid]] as plain text.
 *
 * @see PLAN-WEBLINKS-QUESTIONS.md for architecture decision rationale
 */

import Link from '@tiptap/extension-link';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { InputRule } from '@tiptap/core';

// Debug logging enabled in development mode
// Use import.meta.env for Vite compatibility (process.env doesn't exist in renderer)
const DEBUG = import.meta.env.DEV;

/**
 * Regex pattern for markdown-style links: [text](url) followed by space
 * Captures:
 * - Group 1: Link text (anything except [ and ])
 * - Group 2: URL (must start with http:// or https://)
 *
 * This regex handles URLs with parentheses (like Wikipedia) by matching
 * greedily and letting post-processing balance the parens.
 *
 * Note: TipTap InputRules need a trigger character (space) to fire, so
 * the regex matches [text](url) followed by a space.
 */
// eslint-disable-next-line no-useless-escape
const MARKDOWN_LINK_REGEX = /\[([^\[\]]+)\]\((https?:\/\/[^\s<>]*)\) $/;

/**
 * Balance parentheses in a URL by trimming trailing ) if unbalanced
 * Handles Wikipedia-style URLs like: https://en.wikipedia.org/wiki/Test_(disambiguation)
 */
function balanceUrlParentheses(url: string): string {
  let openCount = 0;
  let closeCount = 0;

  for (const char of url) {
    if (char === '(') openCount++;
    else if (char === ')') closeCount++;
  }

  // If we have more closing parens than opening, trim trailing parens
  while (closeCount > openCount && url.endsWith(')')) {
    url = url.slice(0, -1);
    closeCount--;
  }

  return url;
}

/**
 * Log debug messages for WebLink operations
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.log(`[WebLink] ${message}`, ...args);
  }
}

/**
 * Configuration options for the WebLink extension
 */
export interface WebLinkOptions {
  /**
   * Callback when user Cmd+clicks a link (direct open)
   * @param href The URL to open
   */
  onCmdClick?: (href: string) => void;

  /**
   * Callback when user single-clicks a link (show popover)
   * @param href The URL of the clicked link
   * @param element The DOM element that was clicked
   * @param from Start position of the link in the document
   * @param to End position of the link in the document
   */
  onSingleClick?: (href: string, element: HTMLElement, from: number, to: number) => void;

  /**
   * Callback when user presses Cmd+K (insert/edit link)
   * The callback should determine the appropriate action based on:
   * - If cursor is in link: show edit popover
   * - If text is selected: show URL input
   * - If no selection: show text+URL dialog
   */
  onCmdK?: () => void;
}

// Module-level storage for callbacks (set via setWebLinkCallbacks)
let webLinkCallbacks: WebLinkOptions = {};

// Test hook: stores the last URL that would be opened externally
// This is used for e2e testing since we can't mock Electron's frozen contextBridge objects
declare global {
  interface Window {
    __webLinkTestHook?: {
      lastOpenedUrl: string | null;
      openCount: number;
    };
  }
}

/**
 * Set the callbacks for web link interactions
 * Call this before using the WebLink extension
 */
export function setWebLinkCallbacks(callbacks: WebLinkOptions): void {
  webLinkCallbacks = callbacks;
  debugLog('Callbacks set:', {
    hasOnCmdClick: !!callbacks.onCmdClick,
    hasOnSingleClick: !!callbacks.onSingleClick,
  });
}

/**
 * WebLink extension for handling external web links
 *
 * Extends the base TipTap Link extension with custom click handling
 * and restricted protocols (http/https only).
 */
export const WebLink = Link.extend({
  name: 'link',

  addOptions() {
    return {
      // Parent is always defined when extending, but TypeScript doesn't know that

      ...this.parent?.(),
      // Only allow http and https protocols
      protocols: ['http', 'https'],
      // Auto-detect URLs when typing (on space/enter)
      autolink: true,
      // Auto-link when pasting URLs
      linkOnPaste: true,
      // Don't open on click - we handle click events ourselves
      openOnClick: false,
      // HTML attributes for the link element
      HTMLAttributes: {
        class: 'web-link',
        // Security attributes for external links
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        debugLog('Cmd+K pressed');
        if (webLinkCallbacks.onCmdK) {
          webLinkCallbacks.onCmdK();
          return true; // Handled
        }
        return false; // Let other handlers process
      },
    };
  },

  addInputRules() {
    // Get the editor instance to access view.dispatch
    const editor = this.editor;
    const linkMarkType = this.type;

    // Add input rule for markdown-style links: [text](url)
    const markdownLinkRule = new InputRule({
      find: MARKDOWN_LINK_REGEX,
      handler: ({ state, range, match }) => {
        const linkText = match[1];
        const rawUrl = match[2];

        // Validate match groups exist
        if (!linkText || !rawUrl) {
          debugLog('Invalid match groups, skipping');
          return null;
        }

        const url = balanceUrlParentheses(rawUrl);

        debugLog(`Markdown link detected: text="${linkText}", url="${url}"`);

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          debugLog('Invalid URL protocol, skipping');
          return null;
        }

        // Create the link mark
        const mark = linkMarkType.create({ href: url });

        // Create a text node with the link mark
        const textNode = state.schema.text(linkText, [mark]);

        // Dispatch a transaction to replace the markdown with linked text
        // Note: We must use editor.view.dispatch() instead of returning a transaction
        // because TipTap's InputRule handler doesn't support returning transactions
        const tr = state.tr.replaceWith(range.from, range.to, textNode);
        editor.view.dispatch(tr);

        return null;
      },
    });

    // Get parent input rules and add our markdown rule
    const parentRules = this.parent?.() ?? [];
    return [...parentRules, markdownLinkRule];
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];

    // Note: Paste detection for URL linkification is handled in TipTapEditor.tsx
    // using a document-level keydown listener for Cmd+V. This is because
    // ProseMirror's handleDOMEvents doesn't reliably fire before the browser's
    // default paste handling in Electron.

    // Add click handling plugin
    const clickPlugin = new Plugin({
      key: new PluginKey('webLinkClick'),

      // Log when transactions affect links (debug only)
      appendTransaction: (transactions, _oldState, newState) => {
        if (!DEBUG) return null;

        for (const tr of transactions) {
          if (!tr.docChanged) continue;

          // Check for link marks in the new state
          // Use object to track state across callback (avoids eslint false positive)
          const linkState = { found: false };
          newState.doc.descendants((node) => {
            if (node.marks.some((mark) => mark.type.name === 'link')) {
              linkState.found = true;
              return false; // Stop descending
            }
            return true;
          });

          if (linkState.found) {
            debugLog('Document changed with links present');
          }
        }

        return null;
      },

      // Handle click events on links
      props: {
        handleClick: (view, pos, event) => {
          const target = event.target as HTMLElement;
          const linkElement = target.closest('a.web-link');

          if (!linkElement) {
            return false; // Not a web link, let other handlers process
          }

          const href = linkElement.getAttribute('href');
          const isCmdClick = event.metaKey || event.ctrlKey;
          debugLog(`Link clicked: "${href}", Cmd/Ctrl: ${isCmdClick}`);

          if (!href) {
            return false;
          }

          // Cmd+click (Mac) or Ctrl+click (Windows/Linux): Open directly in browser
          if (isCmdClick) {
            debugLog(`Opening link in browser: ${href}`);

            // Set test hook for e2e testing
            if (window.__webLinkTestHook) {
              window.__webLinkTestHook.lastOpenedUrl = href;
              window.__webLinkTestHook.openCount++;
            }

            // Use callback if provided, otherwise use default behavior
            if (webLinkCallbacks.onCmdClick) {
              webLinkCallbacks.onCmdClick(href);
            } else {
              void window.electronAPI.shell.openExternal(href);
            }
            event.preventDefault();
            event.stopPropagation();
            return true; // Handled
          }

          // Single-click without modifier: Show popover
          // Find the link mark extent at the clicked position
          let from = pos;
          let to = pos;

          // Get the resolved position and find the link mark bounds
          const $pos = view.state.doc.resolve(pos);
          const linkMark = $pos.marks().find((mark) => mark.type.name === 'link');

          if (linkMark) {
            // Find the extent of the link mark
            const parent = $pos.parent;
            const parentStart = $pos.start();

            // Scan through the parent's content to find mark boundaries
            parent.forEach((node, offset) => {
              const nodeStart = parentStart + offset;
              const nodeEnd = nodeStart + node.nodeSize;

              if (node.marks.some((m) => m.type.name === 'link' && m.attrs['href'] === href)) {
                // This node has the same link mark
                if (nodeStart <= pos && pos < nodeEnd) {
                  // The click was in this node, expand our range
                  from = Math.min(from, nodeStart);
                  to = Math.max(to, nodeEnd);
                } else if (nodeEnd === from || nodeStart === to) {
                  // Adjacent node with same link, extend
                  from = Math.min(from, nodeStart);
                  to = Math.max(to, nodeEnd);
                }
              }
            });

            debugLog(`Link bounds: from=${from}, to=${to}`);
          }

          debugLog(`Single-click on link, showing popover for: ${href}`);
          if (webLinkCallbacks.onSingleClick) {
            webLinkCallbacks.onSingleClick(href, linkElement as HTMLElement, from, to);
          }
          event.preventDefault();
          return true; // Handled
        },
      },
    });

    debugLog('Extension initialized with protocols:', this.options.protocols);

    // Put our click plugin BEFORE parentPlugins so it runs first
    return [clickPlugin, ...parentPlugins];
  },
});
