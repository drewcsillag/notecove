/**
 * ProseMirror JSON to Y.XmlFragment Conversion
 *
 * This module converts ProseMirror JSON (the output of TipTap's generateJSON)
 * directly to Y.XmlFragment without needing a DOM or full ProseMirror runtime.
 *
 * This is essential for importing markdown content in the main process where
 * we don't have access to browser APIs.
 *
 * The conversion mirrors the structure used by y-prosemirror's ySyncPlugin,
 * ensuring compatibility with the TipTap editor.
 */

import * as Y from 'yjs';

/**
 * ProseMirror text mark (formatting)
 */
export interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/**
 * ProseMirror node (element or text)
 */
export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: ProseMirrorMark[];
}

/**
 * Convert ProseMirror JSON to Y.XmlFragment
 *
 * @param json The ProseMirror JSON document (type: 'doc')
 * @param fragment The Y.XmlFragment to populate
 */
export function prosemirrorJsonToYXmlFragment(
  json: ProseMirrorNode,
  fragment: Y.XmlFragment
): void {
  const doc = fragment.doc;
  if (!doc) {
    throw new Error('Y.XmlFragment must be part of a Y.Doc');
  }

  doc.transact(() => {
    // Clear existing content
    while (fragment.length > 0) {
      fragment.delete(0, 1);
    }

    // Convert and insert content nodes
    if (json.content) {
      const children = json.content.map(convertNode).filter((n): n is Y.XmlElement => n !== null);
      fragment.insert(0, children);
    }
  });
}

/**
 * Convert a single ProseMirror node to Y.XmlElement or handle text nodes
 */
function convertNode(node: ProseMirrorNode): Y.XmlElement | null {
  // Text nodes are handled specially (they become Y.XmlText inside their parent)
  if (node.type === 'text') {
    // Text nodes should be handled by the parent element
    // This shouldn't be called directly for text nodes at the top level
    return null;
  }

  // Create element for this node type
  const element = new Y.XmlElement(node.type);

  // Set attributes
  if (node.attrs) {
    for (const [key, value] of Object.entries(node.attrs)) {
      if (value !== undefined && value !== null) {
        // Y.XmlElement.setAttribute can handle string, number, boolean, etc.
        element.setAttribute(key, value as string);
      }
    }
  }

  // Process content
  if (node.content && node.content.length > 0) {
    const children = processNodeContent(node.content);
    if (children.length > 0) {
      element.insert(0, children);
    }
  }

  return element;
}

/**
 * Process an array of child nodes, merging adjacent text nodes into Y.XmlText
 */
function processNodeContent(nodes: ProseMirrorNode[]): (Y.XmlElement | Y.XmlText)[] {
  const result: (Y.XmlElement | Y.XmlText)[] = [];

  // Collect consecutive text nodes to merge into a single Y.XmlText
  let textBuffer: ProseMirrorNode[] = [];

  const flushTextBuffer = () => {
    if (textBuffer.length > 0) {
      const xmlText = createYXmlTextFromNodes(textBuffer);
      result.push(xmlText);
      textBuffer = [];
    }
  };

  for (const node of nodes) {
    if (node.type === 'text') {
      textBuffer.push(node);
    } else {
      // Flush any pending text nodes
      flushTextBuffer();

      // Convert the element node
      const element = convertNode(node);
      if (element) {
        result.push(element);
      }
    }
  }

  // Flush remaining text nodes
  flushTextBuffer();

  return result;
}

/**
 * Create a Y.XmlText from an array of ProseMirror text nodes
 *
 * ProseMirror represents formatted text as multiple text nodes with marks.
 * Y.XmlText uses a delta format where formatting is stored as attributes.
 *
 * Note: We track position manually instead of using xmlText.length because
 * accessing .length on a Y.XmlText that hasn't been added to a Y.Doc triggers warnings.
 *
 * Important: When inserting text with Y.XmlText.insert(), if no attributes are passed,
 * the text inherits attributes from the previous character. To insert plain text after
 * formatted text, we must explicitly pass null for each attribute to clear it.
 */
function createYXmlTextFromNodes(textNodes: ProseMirrorNode[]): Y.XmlText {
  const xmlText = new Y.XmlText();
  let position = 0;
  let previousAttributes: Record<string, unknown> = {};

  for (const node of textNodes) {
    if (!node.text) continue;

    const text = node.text;
    const nodeAttributes = marksToAttributes(node.marks || []);

    // Build the attributes to pass to insert()
    // We need to explicitly null out any previously active attributes
    const insertAttributes: Record<string, unknown> = { ...nodeAttributes };

    // For any attribute that was active before but isn't now, set to null to clear it
    for (const key of Object.keys(previousAttributes)) {
      if (!(key in nodeAttributes)) {
        insertAttributes[key] = null;
      }
    }

    // Always pass attributes to prevent inheritance issues
    xmlText.insert(position, text, insertAttributes);
    position += text.length;

    // Track current attributes for next iteration
    previousAttributes = nodeAttributes;
  }

  return xmlText;
}

/**
 * Convert ProseMirror marks to Y.XmlText attributes
 *
 * y-prosemirror uses a specific format for marks:
 * - Simple marks (bold, italic): { markType: {} }
 * - Marks with attrs (link): { markType: { href: '...' } }
 */
function marksToAttributes(marks: ProseMirrorMark[]): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  for (const mark of marks) {
    // If the mark has attributes, use them; otherwise use empty object
    attributes[mark.type] = mark.attrs && Object.keys(mark.attrs).length > 0 ? mark.attrs : {};
  }

  return attributes;
}
