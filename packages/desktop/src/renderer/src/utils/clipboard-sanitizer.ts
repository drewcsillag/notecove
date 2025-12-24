/**
 * Sanitizes HTML content from clipboard for safe insertion into TipTap editor.
 *
 * Handles HTML from various sources:
 * - Browser copy (may include <meta charset>, <style> tags)
 * - Microsoft Office (mso-* styles, o:p tags)
 * - Internal copy (already clean)
 *
 * Preserves:
 * - Text formatting (bold, italic, underline, etc.)
 * - Links
 * - Lists
 * - Other TipTap-supported elements
 *
 * @param html - Raw HTML string from clipboard
 * @returns Sanitized HTML safe for insertion
 */
export function sanitizeClipboardHtml(html: string): string {
  // Handle empty or whitespace-only input
  if (!html.trim()) {
    return '';
  }

  // Parse HTML into DOM
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Remove unwanted elements that should never appear in editor content
  const unwantedSelectors = ['meta', 'style', 'script', 'link', 'title'];

  for (const selector of unwantedSelectors) {
    doc.querySelectorAll(selector).forEach((el) => {
      el.remove();
    });
  }

  // Remove Microsoft Office o:p tags (Office paragraph markers)
  // These use XML namespace syntax which querySelectorAll handles differently
  // We need to walk the DOM to find them
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);

  const nodesToRemove: Element[] = [];
  let currentNode: Node | null = walker.currentNode;

  while (currentNode) {
    // Check for o:p or similar namespace-prefixed tags
    if (currentNode instanceof Element && currentNode.tagName.toLowerCase().includes(':')) {
      nodesToRemove.push(currentNode);
    }
    currentNode = walker.nextNode();
  }

  // Remove collected nodes (can't remove during traversal)
  for (const node of nodesToRemove) {
    node.remove();
  }

  // Remove mso-* inline styles (Microsoft Office specific styles)
  doc.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style');
    if (style) {
      // Remove mso-* style properties
      // Match: mso-property-name: value; or mso-property-name: value (at end)
      const cleaned = style
        .replace(/mso-[^:]+:[^;]*;?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned) {
        el.setAttribute('style', cleaned);
      } else {
        el.removeAttribute('style');
      }
    }
  });

  // Get body content - DOMParser always creates html/head/body structure
  return doc.body.innerHTML.trim();
}
