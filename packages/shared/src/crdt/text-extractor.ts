/**
 * Text Extraction Utility
 *
 * Extracts plain text from Yjs XmlFragment documents with proper newline handling.
 * Used for generating searchable content and snippets for the notes list.
 */

import * as Y from 'yjs';

/**
 * Extract all text from a Yjs XmlFragment with proper newlines between blocks.
 *
 * Each top-level block element (paragraph, heading, code block, etc.) is
 * separated by a newline. Internal structure (bold, italic, links) is
 * flattened to plain text.
 *
 * @param fragment - The Y.XmlFragment containing the document content
 * @returns Plain text with newlines between block elements
 */
export function extractTextFromFragment(fragment: Y.XmlFragment): string {
  const lines: string[] = [];

  fragment.forEach((node) => {
    if (node instanceof Y.XmlElement) {
      const text = extractTextFromElement(node);
      lines.push(text);
    } else if (node instanceof Y.XmlText) {
      const text = String(node.toString());
      lines.push(text);
    }
  });

  return lines.join('\n');
}

/**
 * Extract all text from a Yjs XmlElement recursively.
 *
 * Concatenates text from all child nodes without adding separators,
 * preserving the natural flow of inline content.
 *
 * @param element - The Y.XmlElement to extract text from
 * @returns Plain text content
 */
function extractTextFromElement(element: Y.XmlElement): string {
  let text = '';

  element.forEach((child) => {
    if (child instanceof Y.XmlText) {
      text += String(child.toString());
    } else if (child instanceof Y.XmlElement) {
      text += extractTextFromElement(child);
    }
  });

  return text;
}

/**
 * Extract a snippet from plain text, skipping the title line and empty lines.
 *
 * The snippet is meant for display in the notes list as a preview of content.
 * It skips the first line (assumed to be the title) and any following empty lines,
 * then takes up to `maxLength` characters.
 *
 * @param text - Plain text with newlines
 * @param maxLength - Maximum length of the snippet (default 200)
 * @returns The snippet text
 */
export function extractSnippet(text: string, maxLength = 200): string {
  const lines = text.split('\n');

  // Skip first line (title)
  const contentLines = lines.slice(1);

  // Filter out empty/whitespace-only lines
  const nonEmptyLines = contentLines.filter((line) => line.trim().length > 0);

  // Join and truncate
  const content = nonEmptyLines.join('\n');
  return content.substring(0, maxLength);
}

/**
 * Extract both full text and snippet from a Yjs XmlFragment.
 *
 * Convenience function that combines extractTextFromFragment and extractSnippet.
 *
 * @param fragment - The Y.XmlFragment containing the document content
 * @param snippetMaxLength - Maximum length of the snippet (default 200)
 * @returns Object with contentText and contentPreview
 */
export function extractTextAndSnippet(
  fragment: Y.XmlFragment,
  snippetMaxLength = 200
): { contentText: string; contentPreview: string } {
  const contentText = extractTextFromFragment(fragment);
  const contentPreview = extractSnippet(contentText, snippetMaxLength);

  return { contentText, contentPreview };
}
