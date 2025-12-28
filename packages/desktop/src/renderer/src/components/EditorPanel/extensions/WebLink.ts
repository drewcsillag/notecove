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
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorState } from '@tiptap/pm/state';
import { InputRule } from '@tiptap/core';
import type { Node as PMNode, Mark } from '@tiptap/pm/model';
import { createWebLinkChipPlugin, webLinkChipPluginKey } from './WebLinkChipPlugin';
import { detectLinkContext, countLinksInParagraph } from '../utils/linkContext';
import { getCurrentLinkDisplayPreference } from '../../../contexts/LinkDisplayPreferenceContext';

// Debug logging enabled in development mode
// Check for Vite's import.meta.env or fallback to process.env for Jest
const DEBUG: boolean =
  typeof window !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).__NOTECOVE_DEV_MODE__ === true;

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
 * Type for decoration spec objects used by the chip plugin
 */
interface ChipDecorationSpec {
  class?: string;
}

/**
 * Check if a position is within a web link that's displayed as a chip.
 * Returns the range of the link if found, or null if not in a chip.
 */
function isPositionInChipLink(
  state: EditorState,
  pos: number
): { from: number; to: number; href: string } | null {
  // Get the chip decorations from the plugin
  const decoSet = webLinkChipPluginKey.getState(state);
  if (!decoSet) return null;

  // Check if there are any chip decorations at or around this position
  // The chip consists of an inline decoration hiding the text and a widget
  const $pos = state.doc.resolve(pos);
  const parentStart = $pos.start();
  const parentEnd = $pos.end();

  // Look for web-link-hidden decorations in this paragraph
  const decorations = decoSet.find(parentStart, parentEnd, (spec: ChipDecorationSpec) => {
    return spec.class === 'web-link-hidden';
  });

  // Find if we're within any of the hidden link ranges
  for (const deco of decorations) {
    // Check if pos is at or just after the decoration's end
    // (because cursor can be at the end of the hidden text)
    if (pos > deco.from && pos <= deco.to) {
      // Get the link mark at this position
      const node = state.doc.nodeAt(deco.from);
      if (node) {
        const linkMark = node.marks.find((m: Mark) => m.type.name === 'link');
        if (linkMark) {
          return {
            from: deco.from,
            to: deco.to,
            href: linkMark.attrs['href'] as string,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Find a chip link ending at the given position (cursor is right after the chip)
 */
function findChipLinkEndingAt(
  state: EditorState,
  pos: number
): { from: number; to: number } | null {
  const decoSet = webLinkChipPluginKey.getState(state);
  if (!decoSet) return null;

  const $pos = state.doc.resolve(pos);
  const parentStart = $pos.start();
  const parentEnd = $pos.end();

  // Look for web-link-hidden decorations
  const decorations = decoSet.find(parentStart, parentEnd, (spec: ChipDecorationSpec) => {
    return spec.class === 'web-link-hidden';
  });

  // Find if there's a decoration ending exactly at pos
  for (const deco of decorations) {
    if (deco.to === pos) {
      return { from: deco.from, to: deco.to };
    }
  }

  return null;
}

/**
 * Find a chip link starting at the given position (cursor is right before the chip)
 */
function findChipLinkStartingAt(
  state: EditorState,
  pos: number
): { from: number; to: number } | null {
  const decoSet = webLinkChipPluginKey.getState(state);
  if (!decoSet) return null;

  const $pos = state.doc.resolve(pos);
  const parentStart = $pos.start();
  const parentEnd = $pos.end();

  // Look for web-link-hidden decorations
  const decorations = decoSet.find(parentStart, parentEnd, (spec: ChipDecorationSpec) => {
    return spec.class === 'web-link-hidden';
  });

  // Find if there's a decoration starting exactly at pos
  for (const deco of decorations) {
    if (deco.from === pos) {
      return { from: deco.from, to: deco.to };
    }
  }

  return null;
}

/**
 * Display mode for web links
 * - 'auto': Let the system decide based on context (default)
 * - 'chip': Compact chip with favicon and domain
 * - 'unfurl': Full preview card with title, description, thumbnail
 * - 'link': Plain text link (no decoration)
 */
export type WebLinkDisplayMode = 'auto' | 'chip' | 'unfurl' | 'link';

/**
 * WebLink extension for handling external web links
 *
 * Extends the base TipTap Link extension with custom click handling
 * and restricted protocols (http/https only).
 */
export const WebLink = Link.extend({
  name: 'link',

  addAttributes() {
    return {
      ...this.parent?.(),
      /**
       * Display mode for this link
       * Determines how the link should be rendered (chip, unfurl, or plain link)
       */
      displayMode: {
        default: 'auto' as WebLinkDisplayMode,
        parseHTML: (element: HTMLElement) =>
          (element.getAttribute('data-display-mode') as WebLinkDisplayMode | null) ?? 'auto',
        renderHTML: (attributes: { displayMode?: WebLinkDisplayMode }) => {
          if (!attributes.displayMode || attributes.displayMode === 'auto') {
            return {};
          }
          return { 'data-display-mode': attributes.displayMode };
        },
      },
    };
  },

  addOptions() {
    // TipTap 3 has stricter LinkOptions types - we spread parent defaults
    // and override only what we need. Type assertion is needed because
    // TypeScript can't verify the spread includes all required properties.
    return {
      // Optional chaining required here - without it, the app fails to render (blank window bug)
      ...this.parent?.(),
      // Only allow http and https protocols
      protocols: ['http', 'https'],
      // Default protocol for URLs without a scheme
      defaultProtocol: 'https',
      // Don't select whole link on click
      enableClickSelection: false,
      // Auto-detect URLs when typing (on space/enter)
      autolink: true,
      // Only auto-link URLs that have a scheme (http:// or https://)
      // This prevents bare domains like "foo.bar" or "localhost" from being linked
      shouldAutoLink: (url: string) => {
        return url.startsWith('http://') || url.startsWith('https://');
      },
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
      // TipTap 3 required options - use sensible defaults
      validate: (url: string) => !!url,
      isAllowedUri: () => true,
    };
  },

  // Override inclusive to false - typing at link boundaries should NOT extend the link
  // The parent Link extension ties inclusive to autolink, but we want autolink ON
  // while still preventing text typed adjacent to links from becoming part of the link
  inclusive() {
    return false;
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

      // Arrow key navigation for chip links
      ArrowLeft: () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Only handle collapsed selections (cursor, no range)
        if (!selection.empty) {
          return false;
        }

        const pos = selection.from;

        // Check if there's a chip link ending at the cursor position
        // If so, moving left would enter the chip - skip over it
        const linkRange = findChipLinkEndingAt(state, pos);
        if (linkRange) {
          const tr = state.tr.setSelection(TextSelection.create(state.doc, linkRange.from));
          view.dispatch(tr);
          return true;
        }

        // Also check if cursor is inside a chip (shouldn't happen, but handle it)
        const insideChip = isPositionInChipLink(state, pos);
        if (insideChip) {
          const tr = state.tr.setSelection(TextSelection.create(state.doc, insideChip.from));
          view.dispatch(tr);
          return true;
        }

        return false;
      },

      ArrowRight: () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Only handle collapsed selections (cursor, no range)
        if (!selection.empty) {
          return false;
        }

        const pos = selection.from;

        // Check if there's a chip link starting at the cursor position
        // If so, moving right would enter the chip - skip over it
        const linkRange = findChipLinkStartingAt(state, pos);
        if (linkRange) {
          const tr = state.tr.setSelection(TextSelection.create(state.doc, linkRange.to));
          view.dispatch(tr);
          return true;
        }

        // Also check if cursor is inside a chip (shouldn't happen, but handle it)
        const insideChip = isPositionInChipLink(state, pos);
        if (insideChip) {
          const tr = state.tr.setSelection(TextSelection.create(state.doc, insideChip.to));
          view.dispatch(tr);
          return true;
        }

        return false;
      },

      Backspace: () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Only handle collapsed selections (cursor, no range)
        if (!selection.empty) {
          return false;
        }

        const pos = selection.from;

        // Check if there's a chip link ending at the cursor position
        const linkRange = findChipLinkEndingAt(state, pos);
        if (!linkRange) {
          return false;
        }

        // Check if the link is already selected
        if (selection.from === linkRange.from && selection.to === linkRange.to) {
          // Link already selected, let default behavior delete it
          return false;
        }

        // Select the chip link
        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, linkRange.from, linkRange.to)
        );
        view.dispatch(tr);
        return true;
      },

      Delete: () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Only handle collapsed selections (cursor, no range)
        if (!selection.empty) {
          return false;
        }

        const pos = selection.from;

        // Check if there's a chip link starting at the cursor position
        const linkRange = findChipLinkStartingAt(state, pos);
        if (!linkRange) {
          return false;
        }

        // Check if the link is already selected
        if (selection.from === linkRange.from && selection.to === linkRange.to) {
          // Link already selected, let default behavior delete it
          return false;
        }

        // Select the chip link
        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, linkRange.from, linkRange.to)
        );
        view.dispatch(tr);
        return true;
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

    // Create chip decoration plugin for rendering links as chips
    const chipPlugin = createWebLinkChipPlugin();

    // Plugin to bake in displayMode when links are created
    // This ensures changing global preferences doesn't affect existing links
    const displayModeBakeInPlugin = new Plugin({
      key: new PluginKey('webLinkDisplayModeBakeIn'),

      appendTransaction: (transactions, oldState, newState) => {
        // Only process if document changed
        if (!transactions.some((tr) => tr.docChanged)) {
          return null;
        }

        const globalPreference = getCurrentLinkDisplayPreference();

        // Track positions of links in old state
        const oldLinkPositions = new Set<string>();
        oldState.doc.descendants((node: PMNode, pos: number) => {
          if (!node.isText) return true;
          const linkMark = node.marks.find((m: Mark) => m.type.name === 'link');
          if (linkMark) {
            const href = linkMark.attrs['href'] as string;
            oldLinkPositions.add(`${pos}:${href}`);
          }
          return true;
        });

        // Find new links with 'auto' displayMode and bake in the appropriate mode
        const linksToUpdate: {
          pos: number;
          nodeSize: number;
          mark: Mark;
          newDisplayMode: string;
        }[] = [];

        newState.doc.descendants((node: PMNode, pos: number) => {
          if (!node.isText) return true;

          const linkMark = node.marks.find((m: Mark) => m.type.name === 'link');
          if (!linkMark) return true;

          const href = linkMark.attrs['href'] as string;
          const key = `${pos}:${href}`;

          // Skip if this exact link existed before
          if (oldLinkPositions.has(key)) return true;

          // Skip if displayMode is already explicitly set (not 'auto')
          const currentDisplayMode = linkMark.attrs['displayMode'] as string | undefined;
          if (currentDisplayMode && currentDisplayMode !== 'auto') return true;

          // Determine the display mode to bake in based on global preference and context
          let newDisplayMode: string;
          if (globalPreference === 'secure' || globalPreference === 'none') {
            newDisplayMode = 'link';
          } else if (globalPreference === 'chip') {
            newDisplayMode = 'chip';
          } else {
            // 'unfurl' preference - check context
            const context = detectLinkContext(newState, pos);
            if (context === 'paragraph') {
              const linkCount = countLinksInParagraph(newState, pos);
              newDisplayMode = linkCount === 1 ? 'unfurl' : 'chip';
            } else if (context === 'code') {
              newDisplayMode = 'link';
            } else {
              newDisplayMode = 'chip';
            }
          }

          linksToUpdate.push({ pos, nodeSize: node.nodeSize, mark: linkMark, newDisplayMode });
          return true;
        });

        // No links to update
        if (linksToUpdate.length === 0) {
          return null;
        }

        // Create transaction to update displayMode
        let tr = newState.tr;
        const linkMarkType = newState.schema.marks['link'];
        if (!linkMarkType) return null;

        // Process in reverse order to maintain positions
        for (const { pos, nodeSize, mark, newDisplayMode } of linksToUpdate.reverse()) {
          const newMark = linkMarkType.create({
            ...mark.attrs,
            displayMode: newDisplayMode,
          });
          tr = tr.removeMark(pos, pos + nodeSize, mark).addMark(pos, pos + nodeSize, newMark);
        }

        return tr;
      },
    });

    // Auto-unfurl plugin - inserts OEmbedUnfurl blocks when links are added in paragraphs
    // Only active when the link's displayMode is 'unfurl'
    const autoUnfurlPlugin = new Plugin({
      key: new PluginKey('webLinkAutoUnfurl'),

      appendTransaction: (transactions, oldState, newState) => {
        // Only process if document changed
        if (!transactions.some((tr) => tr.docChanged)) {
          return null;
        }

        // Find new links added in this transaction
        const newLinks: { url: string; pos: number; paragraphEnd: number }[] = [];

        // Track positions of links in old state
        const oldLinkPositions = new Set<string>();
        oldState.doc.descendants((node: PMNode, pos: number) => {
          if (!node.isText) return true;
          const linkMark = node.marks.find((m: Mark) => m.type.name === 'link');
          if (linkMark) {
            const href = linkMark.attrs['href'] as string;
            oldLinkPositions.add(`${pos}:${href}`);
          }
          return true;
        });

        // Find links in new state that weren't in old state
        newState.doc.descendants((node: PMNode, pos: number) => {
          if (!node.isText) return true;

          const linkMark = node.marks.find((m: Mark) => m.type.name === 'link');
          if (!linkMark) return true;

          const href = linkMark.attrs['href'] as string;
          const key = `${pos}:${href}`;

          // Skip if this exact link existed before
          if (oldLinkPositions.has(key)) return true;

          // Only unfurl if displayMode is 'unfurl' (baked in by displayModeBakeInPlugin)
          const displayMode = linkMark.attrs['displayMode'] as string | undefined;
          if (displayMode !== 'unfurl') return true;

          // Check context - only unfurl in paragraph
          const context = detectLinkContext(newState, pos);
          if (context !== 'paragraph') return true;

          // Find the end of the paragraph
          const $pos = newState.doc.resolve(pos);
          const paragraphEnd = $pos.end($pos.depth);

          // Check if unfurl already exists after this paragraph
          const nextPos = paragraphEnd + 1;
          if (nextPos < newState.doc.content.size) {
            const nextNode = newState.doc.nodeAt(nextPos);
            if (nextNode?.type.name === 'oembedUnfurl') {
              return true; // Already has unfurl
            }
          }

          newLinks.push({ url: href, pos, paragraphEnd });
          return true;
        });

        // No new single-link paragraphs found
        if (newLinks.length === 0) {
          return null;
        }

        // Create transaction to insert unfurl blocks
        let tr = newState.tr;

        // Process in reverse order to maintain positions
        for (const link of newLinks.reverse()) {
          debugLog(`Auto-inserting unfurl for: ${link.url}`);

          // Get the OEmbedUnfurl node type
          const unfurlType = newState.schema.nodes['oembedUnfurl'];
          if (!unfurlType) {
            debugLog('OEmbedUnfurl node type not found in schema');
            continue;
          }

          // Create the unfurl node
          const unfurlNode = unfurlType.create({
            url: link.url,
            isLoading: true,
          });

          // Insert after the paragraph (paragraphEnd + 1 is after the closing tag)
          tr = tr.insert(link.paragraphEnd + 1, unfurlNode);
        }

        return tr;
      },
    });

    // Put our plugins BEFORE parentPlugins so they run first
    // Order: click handler, chip decorations, displayMode bake-in, auto-unfurl, then parent plugins
    return [clickPlugin, chipPlugin, displayModeBakeInPlugin, autoUnfurlPlugin, ...parentPlugins];
  },
});
