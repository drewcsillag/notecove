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
  console.log('[TitleExtractor] ========== Extracting title from fragment ==========');
  console.log('[TitleExtractor] Fragment length:', fragment.length);
  console.log('[TitleExtractor] Fragment type:', fragment.constructor.name);

  // Iterate through top-level nodes
  for (let i = 0; i < fragment.length; i++) {
    const node = fragment.get(i);
    console.log(`[TitleExtractor] Node ${i}:`, node ? node.constructor.name : 'null');

    if (!node) {
      console.log(`[TitleExtractor] Node ${i} is null, skipping`);
      continue;
    }

    // Check if it's an XmlElement (like <p>, <h1>, etc.)
    if (node instanceof Y.XmlElement) {
      console.log(`[TitleExtractor] Node ${i} is XmlElement, tag:`, node.nodeName);
      console.log(`[TitleExtractor] Node ${i} has ${node.length} children`);
      const text = extractTextFromElement(node);
      console.log(`[TitleExtractor] Node ${i} extracted text: "${text}"`);
      console.log(`[TitleExtractor] Node ${i} trimmed length: ${text.trim().length}`);
      if (text.trim().length > 0) {
        console.log(`[TitleExtractor] ✅ Returning title: "${text.trim()}"`);
        return text.trim();
      }
    }
    // Check if it's an XmlText node
    else if (node instanceof Y.XmlText) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const text = node.toString();
      console.log(`[TitleExtractor] Node ${i} is XmlText: "${text}"`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (text.trim().length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        console.log(`[TitleExtractor] ✅ Returning title from XmlText: "${text.trim()}"`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return text.trim();
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      console.log(`[TitleExtractor] Node ${i} is unknown type: ${(node as any).constructor.name}`);
    }
  }

  console.log('[TitleExtractor] ❌ No title found, returning "Untitled"');
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
