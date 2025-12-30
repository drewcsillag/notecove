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
 * Render a text node with marks
 */
function renderText(node: JSONContent): string {
  let text = escapeHtml(node.text ?? '');

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
