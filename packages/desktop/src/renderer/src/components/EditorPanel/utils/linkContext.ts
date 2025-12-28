/**
 * Link Context Detection Utilities
 *
 * Determines how web links should be displayed based on their context in the document.
 * Links in headings, lists, and blockquotes render as chips.
 * Links in paragraphs can render as unfurl cards (unless there are multiple links).
 * Links in code blocks are not decorated.
 */

import type { EditorState } from '@tiptap/pm/state';

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
 * Get the default display mode based on link context
 *
 * @param context - The detected link context
 * @returns The default display mode for that context
 */
export function getDefaultDisplayMode(context: LinkContext): LinkDisplayMode {
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
      // Use chip for now; unfurl can be added later as user preference
      return 'chip';
    case 'code':
      return 'link'; // No decoration in code blocks
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
 * 1. User preference (from displayMode attribute)
 * 2. Context (heading, list, paragraph, etc.)
 * 3. Multiple links in same paragraph (forces chip mode)
 *
 * @param state - The editor state
 * @param pos - The position of the link
 * @param userPreference - The user's explicit preference ('auto', 'chip', 'unfurl', 'link')
 * @returns The effective display mode to use
 */
export function getEffectiveDisplayMode(
  state: EditorState,
  pos: number,
  userPreference: 'auto' | 'chip' | 'unfurl' | 'link' = 'auto'
): LinkDisplayMode {
  // If user explicitly chose a mode, respect it
  if (userPreference !== 'auto') {
    return userPreference;
  }

  // Detect context
  const context = detectLinkContext(state, pos);

  // Code blocks never get decorations
  if (context === 'code') {
    return 'link';
  }

  // Get default mode for this context
  const defaultMode = getDefaultDisplayMode(context);

  // If default mode would be unfurl, check for multiple links
  if (defaultMode === 'unfurl') {
    const linkCount = countLinksInParagraph(state, pos);
    if (linkCount > 1) {
      // Multiple links in paragraph: use chips instead
      return 'chip';
    }
  }

  return defaultMode;
}
