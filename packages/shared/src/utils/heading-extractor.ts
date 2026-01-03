/**
 * Heading Extraction Utilities
 *
 * Provides functions to extract headings from note content,
 * generate heading IDs, and look up headings.
 */

import * as Y from 'yjs';

/**
 * Information about a heading in a document
 */
export interface HeadingInfo {
  /** The heading text content */
  text: string;
  /** The heading level (1-6) */
  level: number;
  /** Unique heading ID (format: h_XXXXXXXX) */
  id: string;
}

/**
 * Generate a unique heading ID.
 * Format: h_XXXXXXXX (8 random base64url characters with h_ prefix)
 *
 * @returns A unique heading ID
 */
export function generateHeadingId(): string {
  // Generate 8 random base64url characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = 'h_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Check if a string is a valid heading ID format
 * @param id The string to check
 * @returns true if valid heading ID format
 */
export function isValidHeadingId(id: string): boolean {
  return /^h_[A-Za-z0-9_-]{8}$/.test(id);
}

/**
 * Generate a URL-safe slug from heading text.
 *
 * Slug generation rules:
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove special characters (keep only alphanumeric and hyphens)
 * - Collapse multiple hyphens into one
 * - Trim leading/trailing hyphens
 *
 * @param text The heading text to convert
 * @returns A URL-safe slug
 */
export function generateHeadingSlug(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return (
    text
      .toLowerCase()
      .trim()
      // Remove special characters except alphanumeric, spaces, and hyphens
      .replace(/[^\w\s-]/g, '')
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Collapse multiple hyphens
      .replace(/-+/g, '-')
      // Trim leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Extract headings from plain text content (markdown-style).
 *
 * Recognizes markdown heading syntax:
 * - `# Heading 1` (h1)
 * - `## Heading 2` (h2)
 * - etc., up to h6
 *
 * Note: This generates temporary IDs for each heading since plain text
 * doesn't have persisted IDs. For ProseMirror documents with persisted IDs,
 * use extractHeadingsFromProseMirrorDoc instead.
 *
 * @param text The plain text content to parse
 * @returns Array of HeadingInfo objects in document order
 */
export function extractHeadingsFromText(text: string): HeadingInfo[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const headings: HeadingInfo[] = [];
  const lines = text.split('\n');

  // Regex to match markdown headings: # to ###### followed by space and text
  const headingRegex = /^(#{1,6})\s+(.+)$/;

  for (const line of lines) {
    const match = headingRegex.exec(line.trim());
    if (match && match[1] && match[2]) {
      const level = match[1].length;
      const headingText = match[2].trim();

      if (headingText) {
        headings.push({
          text: headingText,
          level,
          id: generateHeadingId(), // Generate temporary ID
        });
      }
    }
  }

  return headings;
}

/**
 * Extract headings from a ProseMirror document JSON structure.
 *
 * @param doc The ProseMirror document as a JSON object
 * @returns Array of HeadingInfo objects in document order
 */
export function extractHeadingsFromProseMirrorDoc(doc: {
  content?: Array<{
    type: string;
    attrs?: { level?: number; id?: string };
    content?: Array<{ text?: string }>;
  }>;
}): HeadingInfo[] {
  if (!doc || !doc.content || !Array.isArray(doc.content)) {
    return [];
  }

  const headings: HeadingInfo[] = [];

  for (const node of doc.content) {
    if (node.type === 'heading') {
      const level = node.attrs?.level ?? 1;
      const id = node.attrs?.id;

      // Extract text content from the heading node
      let text = '';
      if (node.content) {
        for (const child of node.content) {
          if (child.text) {
            text += child.text;
          }
        }
      }

      text = text.trim();
      if (text) {
        headings.push({
          text,
          level,
          // Use existing ID if present, otherwise generate one
          id: id && isValidHeadingId(id) ? id : generateHeadingId(),
        });
      }
    }
  }

  return headings;
}

/**
 * Find a heading by its ID.
 *
 * @param headings Array of headings to search
 * @param id The heading ID to find
 * @returns The matching HeadingInfo, or null if not found
 */
export function findHeadingById(headings: HeadingInfo[], id: string): HeadingInfo | null {
  if (!headings || !id) {
    return null;
  }

  return headings.find((h) => h.id === id) ?? null;
}

/**
 * Find a heading by its slug (for display/search purposes).
 * Note: Use findHeadingById for navigation - slugs may not be unique.
 *
 * @param headings Array of headings to search
 * @param slug The slug to find
 * @returns The matching HeadingInfo, or null if not found
 */
export function findHeadingBySlug(headings: HeadingInfo[], slug: string): HeadingInfo | null {
  if (!headings || !slug) {
    return null;
  }

  const normalizedSlug = slug.toLowerCase();
  const generatedSlug = (h: HeadingInfo) => generateHeadingSlug(h.text);
  return headings.find((h) => generatedSlug(h).toLowerCase() === normalizedSlug) ?? null;
}

/**
 * Extract headings from a Y.XmlFragment (CRDT document content).
 *
 * This is used by the main process to get headings from a note's CRDT content
 * for autocomplete and heading text lookup.
 *
 * @param fragment The Y.XmlFragment containing the note content
 * @returns Array of HeadingInfo objects in document order
 */
export function extractHeadingsFromFragment(fragment: Y.XmlFragment): HeadingInfo[] {
  const headings: HeadingInfo[] = [];

  // Iterate through top-level nodes
  for (let i = 0; i < fragment.length; i++) {
    const node = fragment.get(i);

    if (!node || !(node instanceof Y.XmlElement)) {
      continue;
    }

    // Check if it's a heading element
    if (node.nodeName === 'heading') {
      // Get the level attribute (default to 1)
      const levelAttr = node.getAttribute('level');
      const level = typeof levelAttr === 'number' ? levelAttr : parseInt(String(levelAttr), 10) || 1;
      // Get the id attribute (may be undefined for old notes)
      const existingId = node.getAttribute('id');

      // Extract text from the heading
      const text = extractTextFromXmlElement(node);

      if (text.trim()) {
        headings.push({
          text: text.trim(),
          level,
          // Use existing ID if valid, otherwise generate one
          id: existingId && isValidHeadingId(existingId) ? existingId : generateHeadingId(),
        });
      }
    }
  }

  return headings;
}

/**
 * Extract all text from a Y.XmlElement recursively.
 *
 * @param element The Y.XmlElement to extract text from
 * @returns The concatenated text content
 */
function extractTextFromXmlElement(element: Y.XmlElement): string {
  let text = '';

  element.forEach((child) => {
    if (child instanceof Y.XmlText) {
      text += child.toString();
    } else if (child instanceof Y.XmlElement) {
      text += extractTextFromXmlElement(child);
    }
  });

  return text;
}
