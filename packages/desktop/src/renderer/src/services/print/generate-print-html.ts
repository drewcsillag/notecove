/**
 * Print HTML Generator
 *
 * Converts TipTap/ProseMirror JSON content to print-ready HTML.
 */

import type { JSONContent } from '@tiptap/core';

/**
 * Comment thread with full details (placeholder for Phase 4)
 * TODO: Import from @notecove/shared when comments export is added
 */
export interface CommentThreadForPrint {
  id: string;
  content: string;
  resolved?: boolean;
  // Other fields will be added in Phase 4
}

/**
 * Options for print HTML generation
 */
export interface PrintOptions {
  /** Whether to include resolved comments in the output */
  includeResolvedComments: boolean;
}

/**
 * Generate print-ready HTML from note content
 *
 * @param content - TipTap/ProseMirror JSON content
 * @param comments - Comment threads to include as endnotes
 * @param options - Print options
 * @returns HTML string ready for printing
 */
export function generatePrintHtml(
  content: JSONContent,
  comments: CommentThreadForPrint[],
  options: PrintOptions
): string {
  if (!content.content || content.content.length === 0) {
    return '';
  }

  // Filter comments based on options
  const filteredComments = options.includeResolvedComments
    ? comments
    : comments.filter((c) => !(c as { resolved?: boolean }).resolved);

  // Generate main content HTML
  const contentHtml = content.content.map((node) => renderNode(node)).join('');

  // TODO: Add comment endnotes section when comments are provided
  // For now, just return content
  void filteredComments; // Will be used in Phase 4

  return contentHtml;
}

/**
 * Render a single node to HTML
 */
function renderNode(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph':
      return renderParagraph(node);
    case 'heading':
      return renderHeading(node);
    case 'text':
      return renderText(node);
    case 'bulletList':
      return renderBulletList(node);
    case 'orderedList':
      return renderOrderedList(node);
    case 'listItem':
      return renderListItem(node);
    case 'blockquote':
      return renderBlockquote(node);
    case 'taskList':
      return renderTaskList(node);
    case 'taskItem':
      return renderTaskItem(node);
    case 'codeBlock':
      return renderCodeBlock(node);
    case 'image':
    case 'notecoveImage':
      return renderImage(node);
    case 'table':
      return renderTable(node);
    case 'tableRow':
      return renderTableRow(node);
    case 'tableCell':
      return renderTableCell(node);
    case 'tableHeader':
      return renderTableHeader(node);
    default:
      // For now, just render children if any
      if (node.content) {
        return node.content.map((child) => renderNode(child)).join('');
      }
      return '';
  }
}

/**
 * Render a paragraph node
 */
function renderParagraph(node: JSONContent): string {
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<p>${content}</p>`;
}

/**
 * Render a heading node
 */
function renderHeading(node: JSONContent): string {
  const level = (node.attrs?.['level'] as number | undefined) ?? 1;
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<h${level}>${content}</h${level}>`;
}

/**
 * Render a bullet list node
 */
function renderBulletList(node: JSONContent): string {
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<ul>${content}</ul>`;
}

/**
 * Render an ordered list node
 */
function renderOrderedList(node: JSONContent): string {
  const start = (node.attrs?.['start'] as number | undefined) ?? 1;
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  if (start !== 1) {
    return `<ol start="${start}">${content}</ol>`;
  }
  return `<ol>${content}</ol>`;
}

/**
 * Render a list item node
 */
function renderListItem(node: JSONContent): string {
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<li>${content}</li>`;
}

/**
 * Render a blockquote node
 */
function renderBlockquote(node: JSONContent): string {
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<blockquote>${content}</blockquote>`;
}

/**
 * Render a task list node
 */
function renderTaskList(node: JSONContent): string {
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<ul class="task-list">${content}</ul>`;
}

/**
 * Render a task item node with styled checkbox
 * Uses CSS classes to match editor appearance:
 * - unchecked: empty checkbox
 * - checked: green checkbox with checkmark
 * - nope: red checkbox with X
 *
 * Note: The editor uses string values 'unchecked', 'checked', 'nope'
 * for the checked attribute (from TriStateTaskItem extension).
 */
function renderTaskItem(node: JSONContent): string {
  const checked = node.attrs?.['checked'] as string | boolean | undefined;

  // Determine state class and checkbox content
  // Handle both string states ('unchecked', 'checked', 'nope') and legacy boolean
  let stateClass: string;
  let checkboxContent: string;

  if (checked === 'nope' || checked === 'cancelled') {
    stateClass = 'task-item--nope';
    checkboxContent = '✕';
  } else if (checked === 'checked' || checked === true) {
    stateClass = 'task-item--checked';
    checkboxContent = '✓';
  } else {
    // 'unchecked', false, or undefined
    stateClass = 'task-item--unchecked';
    checkboxContent = '';
  }

  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<li class="task-item ${stateClass}"><span class="task-checkbox">${checkboxContent}</span><span class="task-content">${content}</span></li>`;
}

/**
 * Render a code block node
 */
function renderCodeBlock(node: JSONContent): string {
  const language = node.attrs?.['language'] as string | undefined;
  // Code blocks contain text nodes directly, extract and escape the text
  const codeText = node.content
    ? node.content.map((child) => escapeHtml(child.text ?? '')).join('')
    : '';

  const languageClass = language ? ` class="language-${language}"` : '';
  return `<pre><code${languageClass}>${codeText}</code></pre>`;
}

/**
 * Render an image node
 * Images can have either src (URL) or imageId/sdId (local storage reference)
 */
function renderImage(node: JSONContent): string {
  const src = node.attrs?.['src'] as string | undefined;
  const imageId = node.attrs?.['imageId'] as string | undefined;
  const sdId = node.attrs?.['sdId'] as string | undefined;
  const alt = node.attrs?.['alt'] as string | undefined;
  const title = node.attrs?.['title'] as string | undefined;
  const width = node.attrs?.['width'] as number | undefined;
  const height = node.attrs?.['height'] as number | undefined;

  // Build attributes
  const attrParts: string[] = [];

  // For local images, use data attributes that will be resolved later
  if (imageId && sdId) {
    attrParts.push(`data-image-id="${escapeHtml(imageId)}"`);
    attrParts.push(`data-sd-id="${escapeHtml(sdId)}"`);
    attrParts.push(`src=""`); // Will be filled by image resolver
  } else if (src) {
    attrParts.push(`src="${escapeHtml(src)}"`);
  }

  if (alt !== undefined) {
    attrParts.push(`alt="${escapeHtml(alt)}"`);
  }
  if (title !== undefined) {
    attrParts.push(`title="${escapeHtml(title)}"`);
  }
  if (width !== undefined) {
    attrParts.push(`width="${width}"`);
  }
  if (height !== undefined) {
    attrParts.push(`height="${height}"`);
  }

  return `<img ${attrParts.join(' ')} style="max-width: 100%;" />`;
}

/**
 * Render a table node
 */
function renderTable(node: JSONContent): string {
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<table class="print-table">${content}</table>`;
}

/**
 * Render a table row node
 */
function renderTableRow(node: JSONContent): string {
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
  return `<tr>${content}</tr>`;
}

/**
 * Render a table cell node
 */
function renderTableCell(node: JSONContent): string {
  const colspan = node.attrs?.['colspan'] as number | undefined;
  const rowspan = node.attrs?.['rowspan'] as number | undefined;
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';

  let attrs = '';
  if (colspan !== undefined && colspan > 1) {
    attrs += ` colspan="${colspan}"`;
  }
  if (rowspan !== undefined && rowspan > 1) {
    attrs += ` rowspan="${rowspan}"`;
  }

  return `<td${attrs}>${content}</td>`;
}

/**
 * Render a table header node
 */
function renderTableHeader(node: JSONContent): string {
  const colspan = node.attrs?.['colspan'] as number | undefined;
  const rowspan = node.attrs?.['rowspan'] as number | undefined;
  const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';

  let attrs = '';
  if (colspan !== undefined && colspan > 1) {
    attrs += ` colspan="${colspan}"`;
  }
  if (rowspan !== undefined && rowspan > 1) {
    attrs += ` rowspan="${rowspan}"`;
  }

  return `<th${attrs}>${content}</th>`;
}

/**
 * Render a text node with marks
 */
function renderText(node: JSONContent): string {
  let text = escapeHtml(node.text ?? '');

  // Highlight hashtags in text
  text = highlightHashtags(text);

  // Apply marks in reverse order so inner marks come first
  if (node.marks && node.marks.length > 0) {
    // Process marks from last to first so nesting is correct
    for (let i = node.marks.length - 1; i >= 0; i--) {
      const mark = node.marks[i];
      if (!mark) continue;
      text = applyMark(text, mark);
    }
  }

  return text;
}

/**
 * Hashtag pattern: # followed by a letter, then letters/numbers/underscores
 * Must match HASHTAG_PATTERN from @notecove/shared
 */
const PRINT_HASHTAG_PATTERN = /#[a-zA-Z][a-zA-Z0-9_]*/g;

/**
 * Highlight hashtags in text with styled spans
 */
function highlightHashtags(text: string): string {
  return text.replace(PRINT_HASHTAG_PATTERN, (match) => {
    return `<span class="hashtag">${match}</span>`;
  });
}

/**
 * Apply a mark to text
 */
function applyMark(text: string, mark: { type: string; attrs?: Record<string, unknown> }): string {
  switch (mark.type) {
    case 'bold':
      return `<strong>${text}</strong>`;
    case 'italic':
      return `<em>${text}</em>`;
    case 'strike':
      return `<s>${text}</s>`;
    case 'code':
      return `<code>${text}</code>`;
    case 'underline':
      return `<u>${text}</u>`;
    default:
      return text;
  }
}

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
