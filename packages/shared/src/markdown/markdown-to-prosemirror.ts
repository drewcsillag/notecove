/**
 * Markdown to ProseMirror JSON Conversion
 *
 * Uses the `markdown-it` library to parse markdown into tokens,
 * then converts those tokens to ProseMirror JSON format.
 *
 * This runs in Node.js without DOM dependencies.
 */

import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type { ProseMirrorNode, ProseMirrorMark } from './prosemirror-to-yjs';

// Create markdown-it instance with GFM features
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
}).enable(['strikethrough', 'table']);

/**
 * Convert markdown string to ProseMirror JSON document
 */
export function markdownToProsemirror(markdown: string): ProseMirrorNode {
  if (!markdown || markdown.trim() === '') {
    return { type: 'doc', content: [] };
  }

  const tokens = md.parse(markdown, {});
  return {
    type: 'doc',
    content: convertTokens(tokens),
  };
}

/**
 * Convert an array of markdown-it tokens to ProseMirror nodes
 */
function convertTokens(tokens: Token[]): ProseMirrorNode[] {
  const result: ProseMirrorNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    const { node, skip } = convertToken(token, tokens, i);
    if (node) {
      if (Array.isArray(node)) {
        result.push(...node);
      } else {
        result.push(node);
      }
    }
    i += skip;
  }

  return result;
}

/**
 * Convert a single token (and potentially its children) to ProseMirror node(s)
 * Returns the node and how many tokens to skip
 */
function convertToken(
  token: Token,
  tokens: Token[],
  index: number
): { node: ProseMirrorNode | ProseMirrorNode[] | null; skip: number } {
  switch (token.type) {
    case 'paragraph_open':
      return convertParagraph(tokens, index);

    case 'heading_open':
      return convertHeading(tokens, index);

    case 'fence':
      return { node: convertCodeBlock(token), skip: 1 };

    case 'code_block':
      return { node: convertCodeBlock(token), skip: 1 };

    case 'blockquote_open':
      return convertBlockquote(tokens, index);

    case 'bullet_list_open':
      return convertList(tokens, index, 'bulletList');

    case 'ordered_list_open':
      return convertList(tokens, index, 'orderedList');

    case 'hr':
      return { node: { type: 'horizontalRule' }, skip: 1 };

    case 'table_open':
      return convertTable(tokens, index);

    case 'html_block':
      return { node: convertHtmlBlock(token), skip: 1 };

    default:
      // Skip unknown or closing tokens
      return { node: null, skip: 1 };
  }
}

/**
 * Convert a paragraph (paragraph_open ... paragraph_close)
 */
function convertParagraph(tokens: Token[], index: number): { node: ProseMirrorNode; skip: number } {
  let skip = 1;
  const content: ProseMirrorNode[] = [];

  // Find inline content
  for (let i = index + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'paragraph_close') {
      skip = i - index + 1;
      break;
    }
    if (token.type === 'inline' && token.children) {
      content.push(...convertInlineTokens(token.children));
    }
  }

  return {
    node: { type: 'paragraph', content: content.length > 0 ? content : undefined },
    skip,
  };
}

/**
 * Convert a heading (heading_open ... heading_close)
 */
function convertHeading(tokens: Token[], index: number): { node: ProseMirrorNode; skip: number } {
  const openToken = tokens[index];
  const level = parseInt(openToken.tag.substring(1), 10); // h1 -> 1
  let skip = 1;
  const content: ProseMirrorNode[] = [];

  for (let i = index + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_close') {
      skip = i - index + 1;
      break;
    }
    if (token.type === 'inline' && token.children) {
      content.push(...convertInlineTokens(token.children));
    }
  }

  return {
    node: {
      type: 'heading',
      attrs: { level },
      content: content.length > 0 ? content : undefined,
    },
    skip,
  };
}

/**
 * Convert a code block (fence or code_block token)
 */
function convertCodeBlock(token: Token): ProseMirrorNode {
  // Remove trailing newline if present
  const text = token.content.endsWith('\n') ? token.content.slice(0, -1) : token.content;

  return {
    type: 'codeBlock',
    attrs: { language: token.info || '' },
    content: text ? [{ type: 'text', text }] : undefined,
  };
}

/**
 * Convert a blockquote (blockquote_open ... blockquote_close)
 */
function convertBlockquote(
  tokens: Token[],
  index: number
): { node: ProseMirrorNode; skip: number } {
  let skip = 1;
  let depth = 1;
  const innerTokens: Token[] = [];

  for (let i = index + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'blockquote_open') {
      depth++;
      innerTokens.push(token);
    } else if (token.type === 'blockquote_close') {
      depth--;
      if (depth === 0) {
        skip = i - index + 1;
        break;
      }
      innerTokens.push(token);
    } else {
      innerTokens.push(token);
    }
  }

  return {
    node: {
      type: 'blockquote',
      content: convertTokens(innerTokens),
    },
    skip,
  };
}

/**
 * Convert a list (bullet_list_open/ordered_list_open ... close)
 */
function convertList(
  tokens: Token[],
  index: number,
  listType: 'bulletList' | 'orderedList'
): { node: ProseMirrorNode; skip: number } {
  let skip = 1;
  let depth = 1;
  const items: ProseMirrorNode[] = [];
  let currentItemTokens: Token[] = [];
  let inItem = false;
  let itemDepth = 0;

  const closeType = listType === 'bulletList' ? 'bullet_list_close' : 'ordered_list_close';
  const openType = listType === 'bulletList' ? 'bullet_list_open' : 'ordered_list_open';

  for (let i = index + 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === openType) {
      depth++;
      if (inItem) {
        currentItemTokens.push(token);
      }
    } else if (token.type === closeType) {
      depth--;
      if (depth === 0) {
        skip = i - index + 1;
        // Flush last item
        if (currentItemTokens.length > 0) {
          items.push(convertListItem(currentItemTokens));
        }
        break;
      }
      if (inItem) {
        currentItemTokens.push(token);
      }
    } else if (token.type === 'list_item_open') {
      if (inItem && itemDepth === 0) {
        // Flush previous item
        items.push(convertListItem(currentItemTokens));
        currentItemTokens = [];
      }
      if (itemDepth === 0) {
        inItem = true;
      } else {
        currentItemTokens.push(token);
      }
      itemDepth++;
    } else if (token.type === 'list_item_close') {
      itemDepth--;
      if (itemDepth === 0) {
        items.push(convertListItem(currentItemTokens));
        currentItemTokens = [];
        inItem = false;
      } else {
        currentItemTokens.push(token);
      }
    } else if (inItem) {
      currentItemTokens.push(token);
    }
  }

  return {
    node: { type: listType, content: items },
    skip,
  };
}

/**
 * Convert list item tokens to a listItem or taskItem node
 */
function convertListItem(tokens: Token[]): ProseMirrorNode {
  // Check if this is a task item (checkbox at the start)
  const firstInline = tokens.find((t) => t.type === 'inline');
  if (firstInline && firstInline.content) {
    const taskMatch = firstInline.content.match(/^\[([ xX])\]\s*/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked' : 'unchecked';
      // Remove the checkbox from content
      const modifiedTokens = tokens.map((t) => {
        if (t === firstInline && t.children) {
          // Create a shallow copy with modified content using Object.assign to preserve Token prototype
          const newToken = Object.assign(
            Object.create(Object.getPrototypeOf(t) as object | null) as Token,
            t
          );
          newToken.content = t.content.replace(/^\[([ xX])\]\s*/, '');
          // Also update children
          if (t.children.length > 0 && t.children[0].type === 'text') {
            const firstChild = t.children[0];
            const newChild = Object.assign(
              Object.create(Object.getPrototypeOf(firstChild) as object | null) as Token,
              firstChild
            );
            newChild.content = firstChild.content.replace(/^\[([ xX])\]\s*/, '');
            newToken.children = [newChild, ...t.children.slice(1)];
          }
          return newToken;
        }
        return t;
      });
      return {
        type: 'taskItem',
        attrs: { checked },
        content: convertListItemContent(modifiedTokens),
      };
    }
  }

  return {
    type: 'listItem',
    content: convertListItemContent(tokens),
  };
}

/**
 * Convert list item content tokens to ProseMirror nodes
 */
function convertListItemContent(tokens: Token[]): ProseMirrorNode[] {
  const result: ProseMirrorNode[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'paragraph_open') {
      // Find the inline content and paragraph_close
      const content: ProseMirrorNode[] = [];
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'paragraph_close') {
          i = j;
          break;
        }
        const children = tokens[j].children;
        if (tokens[j].type === 'inline' && children) {
          content.push(...convertInlineTokens(children));
        }
      }
      result.push({ type: 'paragraph', content: content.length > 0 ? content : undefined });
    } else if (token.type === 'bullet_list_open') {
      const { node, skip } = convertList(tokens, i, 'bulletList');
      result.push(node);
      i += skip - 1;
    } else if (token.type === 'ordered_list_open') {
      const { node, skip } = convertList(tokens, i, 'orderedList');
      result.push(node);
      i += skip - 1;
    }
  }

  return result;
}

/**
 * Convert a table
 */
function convertTable(tokens: Token[], index: number): { node: ProseMirrorNode; skip: number } {
  let skip = 1;
  const rows: ProseMirrorNode[] = [];
  let currentRow: ProseMirrorNode[] = [];
  let isHeader = false;

  for (let i = index + 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'table_close') {
      skip = i - index + 1;
      break;
    } else if (token.type === 'thead_open') {
      isHeader = true;
    } else if (token.type === 'thead_close') {
      isHeader = false;
    } else if (token.type === 'tr_open') {
      currentRow = [];
    } else if (token.type === 'tr_close') {
      rows.push({ type: 'tableRow', content: currentRow });
    } else if (token.type === 'th_open' || token.type === 'td_open') {
      const cellType = isHeader ? 'tableHeader' : 'tableCell';
      // Find inline content
      const content: ProseMirrorNode[] = [];
      for (let j = i + 1; j < tokens.length; j++) {
        const t = tokens[j];
        if (t.type === 'th_close' || t.type === 'td_close') {
          i = j;
          break;
        }
        if (t.type === 'inline' && t.children) {
          content.push(...convertInlineTokens(t.children));
        }
      }
      currentRow.push({
        type: cellType,
        content: [{ type: 'paragraph', content: content.length > 0 ? content : undefined }],
      });
    }
  }

  return {
    node: { type: 'table', content: rows },
    skip,
  };
}

/**
 * Convert HTML block (best effort - preserve as text)
 */
function convertHtmlBlock(token: Token): ProseMirrorNode | null {
  if (!token.content || token.content.trim() === '') {
    return null;
  }

  return {
    type: 'paragraph',
    content: [{ type: 'text', text: token.content }],
  };
}

/**
 * Convert inline tokens to text nodes with marks
 */
function convertInlineTokens(tokens: Token[]): ProseMirrorNode[] {
  const result: ProseMirrorNode[] = [];
  const markStack: ProseMirrorMark[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        if (token.content) {
          result.push(createTextNode(token.content, [...markStack]));
        }
        break;

      case 'code_inline':
        result.push(createTextNode(token.content, [...markStack, { type: 'code' }]));
        break;

      case 'strong_open':
        markStack.push({ type: 'bold' });
        break;

      case 'strong_close':
        removeMarkFromStack(markStack, 'bold');
        break;

      case 'em_open':
        markStack.push({ type: 'italic' });
        break;

      case 'em_close':
        removeMarkFromStack(markStack, 'italic');
        break;

      case 's_open':
        markStack.push({ type: 'strike' });
        break;

      case 's_close':
        removeMarkFromStack(markStack, 'strike');
        break;

      case 'link_open': {
        const href = token.attrGet('href') || '';
        markStack.push({ type: 'link', attrs: { href } });
        break;
      }

      case 'link_close':
        removeMarkFromStack(markStack, 'link');
        break;

      case 'image': {
        // Convert images to text placeholder for now
        const alt = token.content || token.attrGet('alt') || '';
        const src = token.attrGet('src') || '';
        result.push(createTextNode(`[Image: ${alt || src}]`, [...markStack]));
        break;
      }

      case 'softbreak':
        result.push(createTextNode('\n', [...markStack]));
        break;

      case 'hardbreak':
        result.push(createTextNode('\n', [...markStack]));
        break;

      default:
        // Handle any remaining content
        if (token.content) {
          result.push(createTextNode(token.content, [...markStack]));
        }
    }
  }

  return result;
}

/**
 * Remove a mark from the stack by type
 */
function removeMarkFromStack(stack: ProseMirrorMark[], type: string): void {
  const index = stack.findIndex((m) => m.type === type);
  if (index !== -1) {
    stack.splice(index, 1);
  }
}

/**
 * Create a text node with optional marks
 */
function createTextNode(text: string, marks: ProseMirrorMark[]): ProseMirrorNode {
  if (marks.length === 0) {
    return { type: 'text', text };
  }
  return { type: 'text', text, marks };
}
