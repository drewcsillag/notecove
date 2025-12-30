/**
 * Print HTML Generator
 *
 * Converts TipTap/ProseMirror JSON content to print-ready HTML.
 */

import type { JSONContent } from '@tiptap/core';
import { LINK_PATTERN } from '@notecove/shared';
import { all, createLowlight } from 'lowlight';

// Create lowlight instance with all languages
const lowlight = createLowlight(all);

/**
 * Convert a hast tree to HTML string
 * Simple implementation to avoid adding hast-util-to-html dependency
 */
function hastToHtml(node: {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: unknown[];
}): string {
  if (node.type === 'text') {
    return escapeHtml(node.value ?? '');
  }
  if (node.type === 'element' && node.tagName) {
    const props = node.properties ?? {};
    const className = props['className'] as string[] | undefined;
    const classAttr = className ? ` class="${className.join(' ')}"` : '';
    const children = (node.children ?? [])
      .map((child) =>
        hastToHtml(
          child as {
            type: string;
            value?: string;
            tagName?: string;
            properties?: Record<string, unknown>;
            children?: unknown[];
          }
        )
      )
      .join('');
    return `<${node.tagName}${classAttr}>${children}</${node.tagName}>`;
  }
  if (node.type === 'root' && node.children) {
    return (
      node.children as {
        type: string;
        value?: string;
        tagName?: string;
        properties?: Record<string, unknown>;
        children?: unknown[];
      }[]
    )
      .map(hastToHtml)
      .join('');
  }
  return '';
}

/**
 * Date pattern for YYYY-MM-DD dates (matches DateChip.ts)
 */
const DATE_PATTERN = /\b(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/g;

/**
 * Reply for a comment thread
 */
export interface CommentReplyForPrint {
  id: string;
  threadId: string;
  content: string;
  authorName: string;
  authorHandle: string;
  created: number;
}

/**
 * Comment thread with full details for printing
 */
export interface CommentThreadForPrint {
  id: string;
  content: string;
  originalText: string;
  authorName: string;
  authorHandle: string;
  created: number;
  resolved?: boolean;
  replies?: CommentReplyForPrint[];
}

/**
 * Options for print HTML generation
 */
export interface PrintOptions {
  /** Whether to include resolved comments in the output */
  includeResolvedComments: boolean;
}

/**
 * Context for rendering comments with superscript numbers
 */
interface CommentRenderContext {
  /** Map from threadId to superscript number */
  threadNumbers: Map<string, number>;
  /** Set of threadIds that have matching comment data (not orphaned) */
  validThreadIds: Set<string>;
}

/**
 * Extract all comment threadIds from the document in document order
 * Assigns sequential numbers starting from 1
 */
function extractCommentThreadIds(
  content: JSONContent,
  validThreadIds: Set<string>
): Map<string, number> {
  const threadOrder: string[] = [];
  const seen = new Set<string>();

  function walk(node: JSONContent): void {
    // Check text nodes for comment marks
    if (node.type === 'text' && node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'commentMark' && mark.attrs?.['threadId']) {
          const threadId = mark.attrs['threadId'] as string;
          // Only number if it's valid (has matching comment data) and not seen
          if (validThreadIds.has(threadId) && !seen.has(threadId)) {
            seen.add(threadId);
            threadOrder.push(threadId);
          }
        }
      }
    }
    // Recurse into children
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(content);

  // Build map from threadId to number
  const threadNumbers = new Map<string, number>();
  threadOrder.forEach((threadId, index) => {
    threadNumbers.set(threadId, index + 1);
  });

  return threadNumbers;
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
    : comments.filter((c) => !c.resolved);

  // Build set of valid threadIds (those with matching comment data)
  const validThreadIds = new Set(filteredComments.map((c) => c.id));

  // Extract threadIds in document order and assign numbers
  const threadNumbers = extractCommentThreadIds(content, validThreadIds);

  // Create render context
  const ctx: CommentRenderContext = {
    threadNumbers,
    validThreadIds,
  };

  // Generate main content HTML
  const contentHtml = content.content.map((node) => renderNode(node, ctx)).join('');

  // Generate endnotes section if there are comments
  const endnotesHtml = generateEndnotesSection(filteredComments, threadNumbers);

  return contentHtml + endnotesHtml;
}

/**
 * Render a single node to HTML
 */
function renderNode(node: JSONContent, ctx: CommentRenderContext): string {
  switch (node.type) {
    case 'paragraph':
      return renderParagraph(node, ctx);
    case 'heading':
      return renderHeading(node, ctx);
    case 'text':
      return renderText(node, ctx);
    case 'bulletList':
      return renderBulletList(node, ctx);
    case 'orderedList':
      return renderOrderedList(node, ctx);
    case 'listItem':
      return renderListItem(node, ctx);
    case 'blockquote':
      return renderBlockquote(node, ctx);
    case 'taskList':
      return renderTaskList(node, ctx);
    case 'taskItem':
      return renderTaskItem(node, ctx);
    case 'codeBlock':
      return renderCodeBlock(node);
    case 'image':
    case 'notecoveImage':
      return renderImage(node);
    case 'table':
      return renderTable(node, ctx);
    case 'tableRow':
      return renderTableRow(node, ctx);
    case 'tableCell':
      return renderTableCell(node, ctx);
    case 'tableHeader':
      return renderTableHeader(node, ctx);
    case 'oembedUnfurl':
      return renderOEmbedUnfurl(node);
    default:
      // For now, just render children if any
      if (node.content) {
        return node.content.map((child) => renderNode(child, ctx)).join('');
      }
      return '';
  }
}

/**
 * Render a paragraph node
 */
function renderParagraph(node: JSONContent, ctx: CommentRenderContext): string {
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  return `<p>${content}</p>`;
}

/**
 * Render a heading node
 */
function renderHeading(node: JSONContent, ctx: CommentRenderContext): string {
  const level = (node.attrs?.['level'] as number | undefined) ?? 1;
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  return `<h${level}>${content}</h${level}>`;
}

/**
 * Render a bullet list node
 */
function renderBulletList(node: JSONContent, ctx: CommentRenderContext): string {
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  return `<ul>${content}</ul>`;
}

/**
 * Render an ordered list node
 */
function renderOrderedList(node: JSONContent, ctx: CommentRenderContext): string {
  const start = (node.attrs?.['start'] as number | undefined) ?? 1;
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  if (start !== 1) {
    return `<ol start="${start}">${content}</ol>`;
  }
  return `<ol>${content}</ol>`;
}

/**
 * Render a list item node
 */
function renderListItem(node: JSONContent, ctx: CommentRenderContext): string {
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  return `<li>${content}</li>`;
}

/**
 * Render a blockquote node
 */
function renderBlockquote(node: JSONContent, ctx: CommentRenderContext): string {
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  return `<blockquote>${content}</blockquote>`;
}

/**
 * Render a task list node
 */
function renderTaskList(node: JSONContent, ctx: CommentRenderContext): string {
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
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
function renderTaskItem(node: JSONContent, ctx: CommentRenderContext): string {
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

  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  return `<li class="task-item ${stateClass}"><span class="task-checkbox">${checkboxContent}</span><span class="task-content">${content}</span></li>`;
}

/**
 * Render a code block node with syntax highlighting
 */
function renderCodeBlock(node: JSONContent): string {
  const language = node.attrs?.['language'] as string | undefined;
  // Code blocks contain text nodes directly, extract the raw text (don't escape yet)
  const codeText = node.content ? node.content.map((child) => child.text ?? '').join('') : '';

  let highlightedCode: string;
  const languageClass = language ? ` class="language-${language}"` : '';

  if (language && language !== 'plaintext') {
    try {
      // Use lowlight for syntax highlighting
      const highlighted = lowlight.highlight(language, codeText);
      highlightedCode = hastToHtml(highlighted);
    } catch {
      // If language not supported, try auto-detection
      try {
        const highlighted = lowlight.highlightAuto(codeText);
        highlightedCode = hastToHtml(highlighted);
      } catch {
        // Fallback to escaped text if highlighting fails
        highlightedCode = escapeHtml(codeText);
      }
    }
  } else {
    // No language specified or plaintext - just escape
    highlightedCode = escapeHtml(codeText);
  }

  return `<pre><code${languageClass}>${highlightedCode}</code></pre>`;
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
function renderTable(node: JSONContent, ctx: CommentRenderContext): string {
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  return `<table class="print-table">${content}</table>`;
}

/**
 * Render a table row node
 */
function renderTableRow(node: JSONContent, ctx: CommentRenderContext): string {
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';
  return `<tr>${content}</tr>`;
}

/**
 * Render a table cell node
 */
function renderTableCell(node: JSONContent, ctx: CommentRenderContext): string {
  const colspan = node.attrs?.['colspan'] as number | undefined;
  const rowspan = node.attrs?.['rowspan'] as number | undefined;
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';

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
function renderTableHeader(node: JSONContent, ctx: CommentRenderContext): string {
  const colspan = node.attrs?.['colspan'] as number | undefined;
  const rowspan = node.attrs?.['rowspan'] as number | undefined;
  const content = node.content ? node.content.map((child) => renderNode(child, ctx)).join('') : '';

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
 * Render an oEmbed unfurl node as a card
 */
function renderOEmbedUnfurl(node: JSONContent): string {
  const url = node.attrs?.['url'] as string | undefined;
  const title = node.attrs?.['title'] as string | undefined;
  const description = node.attrs?.['description'] as string | undefined;
  const thumbnailUrl = node.attrs?.['thumbnailUrl'] as string | undefined;
  const providerName = node.attrs?.['providerName'] as string | undefined;
  const isLoading = node.attrs?.['isLoading'] as boolean | undefined;
  const error = node.attrs?.['error'] as string | undefined;

  // Don't render if loading or error
  if (isLoading || error || !url) {
    if (url) {
      // Show as plain link if can't render unfurl
      return `<p><a href="${escapeHtml(url)}" class="print-link">${escapeHtml(url)}</a></p>`;
    }
    return '';
  }

  // Build unfurl card HTML
  const parts: string[] = [];
  parts.push('<div class="unfurl-card">');

  // Thumbnail (if available)
  if (thumbnailUrl) {
    parts.push(
      `<div class="unfurl-thumbnail"><img src="${escapeHtml(thumbnailUrl)}" alt="" /></div>`
    );
  }

  parts.push('<div class="unfurl-content">');

  // Title
  if (title) {
    parts.push(`<div class="unfurl-title">${escapeHtml(title)}</div>`);
  }

  // Description
  if (description) {
    parts.push(`<div class="unfurl-description">${escapeHtml(description)}</div>`);
  }

  // Provider and URL
  parts.push('<div class="unfurl-meta">');
  if (providerName) {
    parts.push(`<span class="unfurl-provider">${escapeHtml(providerName)}</span>`);
  }
  parts.push(`<span class="unfurl-url">${escapeHtml(url)}</span>`);
  parts.push('</div>');

  parts.push('</div>'); // unfurl-content
  parts.push('</div>'); // unfurl-card

  return parts.join('');
}

/**
 * Render a text node with marks
 */
function renderText(node: JSONContent, ctx: CommentRenderContext): string {
  let text = escapeHtml(node.text ?? '');

  // Check if text has a link mark - if so, skip pattern highlighting
  // (links handle their own content rendering)
  const hasLinkMark = node.marks?.some((m) => m.type === 'link');

  if (!hasLinkMark) {
    // Highlight inter-note links [[uuid]] with placeholder titles
    text = highlightInterNoteLinks(text);

    // Highlight dates YYYY-MM-DD
    text = highlightDates(text);

    // Highlight hashtags in text
    text = highlightHashtags(text);
  }

  // Collect comment marks for superscripts
  const commentMarks: { type: string; attrs?: Record<string, unknown> }[] = [];
  const otherMarks: { type: string; attrs?: Record<string, unknown> }[] = [];

  if (node.marks) {
    for (const mark of node.marks) {
      if (mark.type === 'commentMark') {
        commentMarks.push(mark);
      } else {
        otherMarks.push(mark);
      }
    }
  }

  // Apply non-comment marks in reverse order so inner marks come first
  if (otherMarks.length > 0) {
    // Process marks from last to first so nesting is correct
    for (let i = otherMarks.length - 1; i >= 0; i--) {
      const mark = otherMarks[i];
      if (!mark) continue;
      text = applyMark(text, mark);
    }
  }

  // Handle comment marks - wrap in highlight and add superscripts
  if (commentMarks.length > 0) {
    // Collect superscript numbers for all valid comment marks
    const superscripts: number[] = [];
    for (const mark of commentMarks) {
      const threadId = mark.attrs?.['threadId'] as string | undefined;
      if (threadId && ctx.threadNumbers.has(threadId)) {
        const num = ctx.threadNumbers.get(threadId);
        if (num !== undefined && !superscripts.includes(num)) {
          superscripts.push(num);
        }
      }
    }

    // Sort superscripts to show in order
    superscripts.sort((a, b) => a - b);

    // Wrap in comment highlight if we have valid superscripts
    if (superscripts.length > 0) {
      const superscriptHtml = superscripts
        .map((n) => `<sup class="comment-ref">${n}</sup>`)
        .join('');
      text = `<span class="comment-highlight">${text}</span>${superscriptHtml}`;
    }
  }

  return text;
}

/**
 * Highlight inter-note links [[uuid]] with styled chip
 * Note: In print preview, we show the UUID since we don't have async title lookup.
 * The PrintPreviewWindow can resolve titles if needed.
 */
function highlightInterNoteLinks(text: string): string {
  // Create a new RegExp instance to avoid global state issues
  const regex = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);
  return text.replace(regex, (_match, uuid: string) => {
    // For print, show as a styled chip with the UUID (or title if resolved)
    // The data-note-id attribute allows post-processing to resolve titles
    return `<span class="inter-note-link" data-note-id="${escapeHtml(uuid)}">[[${escapeHtml(uuid)}]]</span>`;
  });
}

/**
 * Highlight dates YYYY-MM-DD with styled chip
 */
function highlightDates(text: string): string {
  // Create a new RegExp instance to avoid global state issues
  const regex = new RegExp(DATE_PATTERN.source, DATE_PATTERN.flags);
  return text.replace(regex, (_match, date: string) => {
    // Format the date for display
    const formatted = formatDateForPrint(date);
    return `<span class="date-chip" data-date="${escapeHtml(date)}">${escapeHtml(formatted)}</span>`;
  });
}

/**
 * Format a YYYY-MM-DD date for print display
 */
function formatDateForPrint(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year === undefined || month === undefined || day === undefined) {
      return dateStr;
    }
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
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
    case 'link':
      return renderLinkMark(text, mark.attrs);
    default:
      return text;
  }
}

/**
 * Render a link mark
 * Handles different display modes: chip, unfurl, link (plain)
 */
function renderLinkMark(text: string, attrs?: Record<string, unknown>): string {
  const href = attrs?.['href'] as string | undefined;
  const displayMode = (attrs?.['displayMode'] as string | undefined) ?? 'auto';

  if (!href) {
    return text;
  }

  // Extract domain for chip display
  let domain = '';
  try {
    const url = new URL(href);
    domain = url.hostname.replace(/^www\./, '');
  } catch {
    domain = href;
  }

  // Render based on display mode
  if (displayMode === 'chip' || displayMode === 'auto') {
    // Chip mode: show as styled chip with domain
    return `<span class="link-chip"><span class="link-chip-icon">🔗</span><span class="link-chip-text">${escapeHtml(text)}</span><span class="link-chip-domain">${escapeHtml(domain)}</span></span>`;
  } else {
    // Link mode: render as plain hyperlink
    return `<a href="${escapeHtml(href)}" class="print-link">${text}</a>`;
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

/**
 * Format a timestamp for display in endnotes
 */
function formatTimestampForPrint(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate the endnotes section for comments
 * Comments are ordered by their first appearance in the document
 */
function generateEndnotesSection(
  comments: CommentThreadForPrint[],
  threadNumbers: Map<string, number>
): string {
  // Only include comments that have a number (i.e., appeared in the document)
  const orderedComments = comments
    .filter((c) => threadNumbers.has(c.id))
    .sort((a, b) => {
      const numA = threadNumbers.get(a.id) ?? 0;
      const numB = threadNumbers.get(b.id) ?? 0;
      return numA - numB;
    });

  if (orderedComments.length === 0) {
    return '';
  }

  const parts: string[] = [];
  parts.push('<div class="comment-endnotes">');
  parts.push('<hr class="endnotes-separator" />');
  parts.push('<h3 class="endnotes-title">Comments</h3>');

  for (const comment of orderedComments) {
    const num = threadNumbers.get(comment.id) ?? 0;
    parts.push('<div class="endnote-item">');

    // Number and quoted text
    parts.push(
      `<div class="endnote-header"><strong>${num}.</strong> "${escapeHtml(comment.originalText)}"</div>`
    );

    // Main comment
    parts.push('<div class="endnote-content">');
    parts.push(
      `<div class="endnote-author">${escapeHtml(comment.authorName)} <span class="endnote-timestamp">${formatTimestampForPrint(comment.created)}</span></div>`
    );
    parts.push(`<div class="endnote-text">${escapeHtml(comment.content)}</div>`);
    parts.push('</div>');

    // Replies
    if (comment.replies && comment.replies.length > 0) {
      parts.push('<div class="endnote-replies">');
      for (const reply of comment.replies) {
        parts.push('<div class="endnote-reply">');
        parts.push(
          `<div class="endnote-author">${escapeHtml(reply.authorName)} <span class="endnote-timestamp">${formatTimestampForPrint(reply.created)}</span></div>`
        );
        parts.push(`<div class="endnote-text">${escapeHtml(reply.content)}</div>`);
        parts.push('</div>');
      }
      parts.push('</div>');
    }

    parts.push('</div>');
  }

  parts.push('</div>');

  return parts.join('');
}
