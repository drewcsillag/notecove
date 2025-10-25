/**
 * Title Extraction Utility
 *
 * Extracts the title from a note by finding the first line with text content.
 * Used to display note titles in the notes list without rendering the full editor.
 */

import * as Y from 'yjs';

/**
 * Extract title from a Yjs XmlFragment
 *
 * Searches for the first text node with non-whitespace content.
 * Returns "Untitled" if no text is found.
 *
 * @param fragment - The Y.XmlFragment containing the note content
 * @returns The extracted title (first line with text) or "Untitled"
 */
export function extractTitleFromFragment(fragment: Y.XmlFragment): string {
  // Iterate through top-level nodes
  for (let i = 0; i < fragment.length; i++) {
    const node = fragment.get(i);

    if (!node) continue;

    // Check if it's an XmlElement (like <p>, <h1>, etc.)
    if (node instanceof Y.XmlElement) {
      const text = extractTextFromElement(node);
      if (text.trim().length > 0) {
        return text.trim();
      }
    }
    // Check if it's an XmlText node
    else if (node instanceof Y.XmlText) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const text = node.toString();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (text.trim().length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return text.trim();
      }
    }
  }

  return 'Untitled';
}

/**
 * Extract all text from an XmlElement recursively
 *
 * @param element - The Y.XmlElement to extract text from
 * @returns The concatenated text content
 */
function extractTextFromElement(element: Y.XmlElement): string {
  let text = '';

  // Recursively collect text from child nodes
  element.forEach((child) => {
    if (child instanceof Y.XmlText) {
      text += child.toString();
    } else if (child instanceof Y.XmlElement) {
      text += extractTextFromElement(child);
    }
  });

  return text;
}

/**
 * Extract title from a note's Y.Doc
 *
 * Convenience function that gets the 'default' fragment from the Y.Doc
 * and extracts the title.
 *
 * @param doc - The Y.Doc containing the note
 * @param fragmentName - The name of the fragment (defaults to 'default')
 * @returns The extracted title or "Untitled"
 */
export function extractTitleFromDoc(doc: Y.Doc, fragmentName = 'default'): string {
  const fragment = doc.getXmlFragment(fragmentName);
  return extractTitleFromFragment(fragment);
}
