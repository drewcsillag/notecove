/**
 * Link Context Detection Utilities
 *
 * Determines how web links should be displayed based on their context in the document.
 * Links in headings, lists, and blockquotes render as chips.
 * Links in paragraphs can render as unfurl cards (unless there are multiple links).
 * Links in code blocks are not decorated.
 */

import type { EditorState } from '@tiptap/pm/state';
import type { LinkDisplayPreference } from '@notecove/shared';
import { getCurrentLinkDisplayPreference } from '../../../contexts/LinkDisplayPreferenceContext';

/**
 * The type of block context a link appears in
 */
export type LinkContext =
  | 'heading'
  | 'list'
  | 'blockquote'
  | 'paragraph'
  | 'code'
  | 'table'
  | 'other';

/**
 * Display mode for a link
 */
export type LinkDisplayMode = 'chip' | 'unfurl' | 'link';

/**
 * Detect the block context for a link at a given position
 *
 * @param state - The editor state
 * @param pos - The position of the link in the document
 * @returns The detected context type
 */
export function detectLinkContext(state: EditorState, pos: number): LinkContext {
  const $pos = state.doc.resolve(pos);

  // Walk up the node tree to find the parent block type
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    const nodeName = node.type.name;

    switch (nodeName) {
      case 'heading':
        return 'heading';
      case 'listItem':
      case 'taskItem':
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        return 'list';
      case 'blockquote':
        return 'blockquote';
      case 'codeBlock':
        return 'code';
      case 'table':
      case 'tableRow':
      case 'tableCell':
      case 'tableHeader':
        return 'table';
      case 'paragraph':
        // Continue searching - might be inside a list or blockquote
        continue;
      default:
        // Continue searching
        continue;
    }
  }

  // If we found a paragraph without special parent, it's a standalone paragraph
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === 'paragraph') {
      return 'paragraph';
    }
  }

  return 'other';
}

/**
 * Get the default display mode based on link context and global user preference
 *
 * @param context - The detected link context
 * @param globalPreference - The user's global preference from settings
 * @returns The default display mode for that context
 */
export function getDefaultDisplayMode(
  context: LinkContext,
  globalPreference?: LinkDisplayPreference
): LinkDisplayMode {
  // Get the global preference if not provided
  const preference = globalPreference ?? getCurrentLinkDisplayPreference();

  // If user wants no decoration (none or secure), always return 'link'
  if (preference === 'none' || preference === 'secure') {
    return 'link';
  }

  // Code blocks never get decorations
  if (context === 'code') {
    return 'link';
  }

  // If user wants chips only, return 'chip' for all decorated contexts
  if (preference === 'chip') {
    return 'chip';
  }

  // User wants unfurl - use unfurl for paragraphs, chip for structured contexts
  switch (context) {
    case 'heading':
      return 'chip';
    case 'list':
      return 'chip';
    case 'blockquote':
      return 'chip';
    case 'table':
      return 'chip';
    case 'paragraph':
      // Unfurl for standalone paragraphs
      return 'unfurl';
    case 'other':
      return 'chip';
  }
}

/**
 * Count the number of web links in the same paragraph as the given position
 *
 * @param state - The editor state
 * @param pos - A position within the paragraph
 * @returns The number of web links in the paragraph
 */
export function countLinksInParagraph(state: EditorState, pos: number): number {
  const $pos = state.doc.resolve(pos);

  // Find the paragraph node containing this position
  let paragraphNode = null;

  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === 'paragraph') {
      paragraphNode = node;
      break;
    }
  }

  if (!paragraphNode) {
    return 0;
  }

  // Count links in the paragraph
  let linkCount = 0;

  paragraphNode.descendants((node) => {
    if (node.marks.some((mark) => mark.type.name === 'link')) {
      linkCount++;
    }
    return true;
  });

  return linkCount;
}

/**
 * Determine the effective display mode for a link, considering:
 * 1. Global user preference from settings
 * 2. Per-link displayMode attribute (if explicitly set)
 * 3. Context (heading, list, paragraph, etc.)
 * 4. Multiple links in same paragraph (forces chip mode when unfurl would be used)
 *
 * @param state - The editor state
 * @param pos - The position of the link
 * @param perLinkPreference - The per-link display mode ('auto', 'chip', 'unfurl', 'link')
 * @returns The effective display mode to use
 */
export function getEffectiveDisplayMode(
  state: EditorState,
  pos: number,
  perLinkPreference: 'auto' | 'chip' | 'unfurl' | 'link' = 'auto'
): LinkDisplayMode {
  // Get global preference
  const globalPreference = getCurrentLinkDisplayPreference();

  // If global preference is 'secure', always use plain links (overrides per-link settings)
  if (globalPreference === 'secure') {
    return 'link';
  }

  // If per-link preference is explicitly set (not 'auto'), respect it
  // This ensures existing notes don't change when settings change
  if (perLinkPreference !== 'auto') {
    return perLinkPreference;
  }

  // If global preference is 'none', use plain links for new links with 'auto'
  if (globalPreference === 'none') {
    return 'link';
  }

  // Detect context
  const context = detectLinkContext(state, pos);

  // Code blocks never get decorations
  if (context === 'code') {
    return 'link';
  }

  // Get default mode for this context (respects global preference)
  const defaultMode = getDefaultDisplayMode(context, globalPreference);

  // If default mode would be unfurl, check for multiple links
  if (defaultMode === 'unfurl') {
    const linkCount = countLinksInParagraph(state, pos);
    if (linkCount > 1) {
      // Multiple links in paragraph: use chips instead
      // (We're here because globalPreference is 'unfurl', so chip is a valid fallback)
      return 'chip';
    }
  }

  return defaultMode;
}
