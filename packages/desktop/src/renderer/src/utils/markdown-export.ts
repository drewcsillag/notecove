/**
 * Markdown Export Utilities
 *
 * Converts ProseMirror/TipTap JSON to Markdown format.
 * Handles standard formatting as well as custom nodes:
 * - Hashtags: #tag (these are just decorated text, so they export naturally)
 * - Inter-note links: [[note-id]] -> [[Note Title]]
 * - Tri-state checkboxes: [ ] / [x] / [-]
 */

import type { JSONContent } from '@tiptap/core';

// Lookup function type for resolving note IDs to titles
export type NoteTitleLookup = (noteId: string) => string | undefined;

// Inter-note link pattern: [[uuid]] or [[note-id]]
const LINK_PATTERN = /\[\[([^\]]+)\]\]/g;

/**
 * Convert ProseMirror JSON content to Markdown string
 */
export function prosemirrorToMarkdown(
  content: JSONContent,
  noteTitleLookup: NoteTitleLookup
): string {
  if (!content.content || content.content.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const node of content.content) {
    const line = convertNode(node, noteTitleLookup, 0);
    if (line !== null) {
      lines.push(line);
    }
  }

  return lines.join('\n\n');
}

/**
 * Convert a single node to markdown
 */
function convertNode(
  node: JSONContent,
  noteTitleLookup: NoteTitleLookup,
  listDepth: number
): string | null {
  switch (node.type) {
    case 'paragraph':
      return convertParagraph(node, noteTitleLookup);

    case 'heading':
      return convertHeading(node, noteTitleLookup);

    case 'bulletList':
      return convertBulletList(node, noteTitleLookup, listDepth);

    case 'orderedList':
      return convertOrderedList(node, noteTitleLookup, listDepth);

    case 'listItem':
      return convertListItem(node, noteTitleLookup, listDepth);

    case 'taskItem':
      return convertTaskItem(node, noteTitleLookup, listDepth);

    case 'blockquote':
      return convertBlockquote(node, noteTitleLookup);

    case 'codeBlock':
      return convertCodeBlock(node);

    case 'horizontalRule':
      return '---';

    case 'text':
      return convertTextNode(node, noteTitleLookup);

    // Legacy inline checkbox (may still exist in old documents)
    case 'triStateCheckbox':
      return convertCheckbox(node);

    // NoteCove image node
    case 'notecoveImage':
      return convertNotecoveImage(node);

    // oEmbed unfurl block
    case 'oembedUnfurl':
      return convertOEmbedUnfurl(node);

    default:
      // For unknown nodes, try to extract text content
      if (node.content) {
        return node.content
          .map((n) => convertNode(n, noteTitleLookup, listDepth))
          .filter((s) => s !== null)
          .join('');
      }
      return null;
  }
}

/**
 * Convert paragraph node
 */
function convertParagraph(node: JSONContent, noteTitleLookup: NoteTitleLookup): string {
  if (!node.content || node.content.length === 0) {
    return '';
  }

  return node.content
    .map((n) => convertNode(n, noteTitleLookup, 0))
    .filter((s) => s !== null)
    .join('');
}

/**
 * Convert heading node
 */
function convertHeading(node: JSONContent, noteTitleLookup: NoteTitleLookup): string {
  const level = (node.attrs?.['level'] as number) || 1;
  const prefix = '#'.repeat(level) + ' ';

  if (!node.content || node.content.length === 0) {
    return prefix;
  }

  const text = node.content
    .map((n) => convertNode(n, noteTitleLookup, 0))
    .filter((s) => s !== null)
    .join('');

  return prefix + text;
}

/**
 * Convert bullet list node
 */
function convertBulletList(
  node: JSONContent,
  noteTitleLookup: NoteTitleLookup,
  listDepth: number
): string {
  if (!node.content) return '';

  return node.content
    .map((item) => {
      const indent = '  '.repeat(listDepth);

      // Check if this is a task item
      if (item.type === 'taskItem') {
        const taskPrefix = getTaskPrefix(item);
        const itemContent = convertTaskItem(item, noteTitleLookup, listDepth + 1);
        return `${indent}- ${taskPrefix} ${itemContent}`;
      }

      const itemContent = convertListItem(item, noteTitleLookup, listDepth + 1);
      return `${indent}- ${itemContent}`;
    })
    .join('\n');
}

/**
 * Convert ordered list node
 */
function convertOrderedList(
  node: JSONContent,
  noteTitleLookup: NoteTitleLookup,
  listDepth: number
): string {
  if (!node.content) return '';

  return node.content
    .map((item, index) => {
      const indent = '  '.repeat(listDepth);

      // Check if this is a task item
      if (item.type === 'taskItem') {
        const taskPrefix = getTaskPrefix(item);
        const itemContent = convertTaskItem(item, noteTitleLookup, listDepth + 1);
        return `${indent}${index + 1}. ${taskPrefix} ${itemContent}`;
      }

      const itemContent = convertListItem(item, noteTitleLookup, listDepth + 1);
      return `${indent}${index + 1}. ${itemContent}`;
    })
    .join('\n');
}

/**
 * Convert list item node
 */
function convertListItem(
  node: JSONContent,
  noteTitleLookup: NoteTitleLookup,
  listDepth: number
): string {
  if (!node.content) return '';

  const parts: string[] = [];

  for (const child of node.content) {
    if (child.type === 'paragraph') {
      const text = convertParagraph(child, noteTitleLookup);
      parts.push(text);
    } else if (child.type === 'bulletList' || child.type === 'orderedList') {
      // Nested list
      const nestedList = convertNode(child, noteTitleLookup, listDepth);
      if (nestedList) {
        parts.push('\n' + nestedList);
      }
    } else {
      const text = convertNode(child, noteTitleLookup, listDepth);
      if (text !== null) {
        parts.push(text);
      }
    }
  }

  return parts.join('');
}

/**
 * Convert blockquote node
 */
function convertBlockquote(node: JSONContent, noteTitleLookup: NoteTitleLookup): string {
  if (!node.content) return '>';

  const content = node.content
    .map((n) => convertNode(n, noteTitleLookup, 0))
    .filter((s) => s !== null)
    .join('\n');

  // Add > prefix to each line
  return content
    .split('\n')
    .map((line) => '> ' + line)
    .join('\n');
}

/**
 * Convert code block node
 */
function convertCodeBlock(node: JSONContent): string {
  const language = (node.attrs?.['language'] as string | undefined) ?? '';
  const code = node.content?.map((n) => n.text ?? '').join('') ?? '';

  return '```' + language + '\n' + code + '\n```';
}

/**
 * Convert text node with marks
 */
function convertTextNode(node: JSONContent, noteTitleLookup: NoteTitleLookup): string {
  let text = node.text ?? '';

  // Replace inter-note links [[note-id]] with [[Note Title]]
  text = text.replace(LINK_PATTERN, (_match, noteId: string) => {
    const title = noteTitleLookup(noteId.toLowerCase());
    return title ? `[[${title}]]` : `[[${noteId}]]`;
  });

  // Apply marks
  if (node.marks && node.marks.length > 0) {
    for (const mark of node.marks) {
      text = applyMark(text, mark);
    }
  }

  return text;
}

/**
 * Get the display mode suffix for markdown export
 * Only adds suffix for explicitly set modes (not 'auto' or undefined)
 */
function getDisplayModeSuffix(displayMode: string | undefined): string {
  if (!displayMode || displayMode === 'auto') {
    return '';
  }

  // Only export valid display modes
  if (displayMode === 'link' || displayMode === 'chip' || displayMode === 'unfurl') {
    return `{.${displayMode}}`;
  }

  return '';
}

/**
 * Apply a mark to text
 */
function applyMark(text: string, mark: { type: string; attrs?: Record<string, unknown> }): string {
  switch (mark.type) {
    case 'bold':
      return `**${text}**`;

    case 'italic':
      return `*${text}*`;

    case 'underline':
      // Markdown doesn't have native underline, use HTML
      return `<u>${text}</u>`;

    case 'strike':
      return `~~${text}~~`;

    case 'code':
      return `\`${text}\``;

    case 'link': {
      const href = mark.attrs?.['href'] as string;
      if (!href) return text;

      // Get displayMode if explicitly set (not 'auto')
      const displayMode = mark.attrs?.['displayMode'] as string | undefined;
      const suffix = getDisplayModeSuffix(displayMode);

      return `[${text}](${href})${suffix}`;
    }

    default:
      return text;
  }
}

/**
 * Convert tri-state checkbox node (legacy inline checkboxes)
 */
function convertCheckbox(node: JSONContent): string {
  const state = node.attrs?.['checked'] as string;

  switch (state) {
    case 'checked':
      return '[x]';
    case 'nope':
      return '[-]';
    case 'unchecked':
    default:
      return '[ ]';
  }
}

/**
 * Get the task checkbox prefix based on state
 */
function getTaskPrefix(node: JSONContent): string {
  const state = node.attrs?.['checked'] as string;

  switch (state) {
    case 'checked':
      return '[x]';
    case 'nope':
      return '[-]';
    case 'unchecked':
    default:
      return '[ ]';
  }
}

/**
 * Convert task item node (list item with checkbox state)
 */
function convertTaskItem(
  node: JSONContent,
  noteTitleLookup: NoteTitleLookup,
  listDepth: number
): string {
  if (!node.content) return '';

  const parts: string[] = [];

  for (const child of node.content) {
    if (child.type === 'paragraph') {
      const text = convertParagraph(child, noteTitleLookup);
      parts.push(text);
    } else if (child.type === 'bulletList' || child.type === 'orderedList') {
      // Nested list
      const nestedList = convertNode(child, noteTitleLookup, listDepth);
      if (nestedList) {
        parts.push('\n' + nestedList);
      }
    } else {
      const text = convertNode(child, noteTitleLookup, listDepth);
      if (text !== null) {
        parts.push(text);
      }
    }
  }

  return parts.join('');
}

/**
 * Convert NoteCove image node to markdown/HTML
 *
 * Export strategy:
 * - Simple images (no caption, default alignment): Markdown ![alt](path)
 * - Images with captions: HTML <figure> with <figcaption>
 * - Images with alignment: HTML <img> with inline style
 * - Images with links: Wrapped in <a> tag
 *
 * The path uses a placeholder format that gets replaced during actual export:
 * {ATTACHMENTS}/{imageId}.{ext}
 */
function convertNotecoveImage(node: JSONContent): string {
  const attrs = node.attrs ?? {};
  const imageId = (attrs['imageId'] as string | undefined) ?? 'unknown';
  const alt = (attrs['alt'] as string | undefined) ?? '';
  const caption = (attrs['caption'] as string | undefined) ?? '';
  const alignment = (attrs['alignment'] as 'left' | 'center' | 'right' | undefined) ?? 'center';
  const width = attrs['width'] as string | null;
  const linkHref = attrs['linkHref'] as string | null;

  // Placeholder path - will be replaced by export service with actual relative path
  // Format: {ATTACHMENTS}/imageId (extension will be determined during file copy)
  const imagePath = `{ATTACHMENTS}/${imageId}`;

  // Determine if we need HTML (caption, non-left alignment, width, or link)
  const needsHtml = caption !== '' || alignment !== 'left' || width !== null || linkHref !== null;

  if (!needsHtml) {
    // Simple markdown format for left-aligned images without extras
    return `![${alt}](${imagePath})`;
  }

  // Build HTML output
  const styleAttrs: string[] = ['display: block'];

  // Alignment styles
  if (alignment === 'center') {
    styleAttrs.push('margin-left: auto', 'margin-right: auto');
  } else if (alignment === 'right') {
    styleAttrs.push('margin-left: auto');
  }
  // 'left' alignment = natural flow, no special styles

  const style = styleAttrs.join('; ');

  // Build <img> tag
  let imgTag = `<img src="${imagePath}" alt="${escapeHtml(alt)}"`;
  if (width) {
    imgTag += ` width="${width}"`;
  }
  imgTag += ` style="${style}" />`;

  // Wrap in link if needed
  if (linkHref) {
    imgTag = `<a href="${escapeHtml(linkHref)}">${imgTag}</a>`;
  }

  // Wrap in figure if caption exists
  if (caption) {
    return `<figure style="${style}">\n  ${imgTag}\n  <figcaption>${escapeHtml(caption)}</figcaption>\n</figure>`;
  }

  return imgTag;
}

/**
 * Convert oEmbed unfurl block to markdown link
 *
 * Export strategy:
 * - Use the title from oEmbed data if available
 * - Fall back to the URL if no title
 * - Format as markdown link with unfurl attribute: [title](url){.unfurl}
 */
function convertOEmbedUnfurl(node: JSONContent): string {
  const attrs = node.attrs ?? {};
  const url = (attrs['url'] as string | undefined) ?? '';
  const title = (attrs['title'] as string | undefined) ?? null;

  if (!url) {
    return '';
  }

  // Use title if available, otherwise use the URL as display text
  const displayText = title ?? url;

  // Escape special markdown characters in the title
  const escapedTitle = displayText.replace(/\[/g, '\\[').replace(/\]/g, '\\]');

  // Always add {.unfurl} suffix since this was an unfurl block
  return `[${escapedTitle}](${url}){.unfurl}`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// Image extraction utilities
// ============================================================================

/**
 * Image reference extracted from content
 */
export interface ImageReference {
  imageId: string;
  sdId: string | null;
  alt: string;
}

/**
 * Extract all image references from ProseMirror/TipTap content
 * Used by export service to know which images to copy
 */
export function extractImageReferences(content: JSONContent): ImageReference[] {
  const images: ImageReference[] = [];
  extractImagesRecursive(content, images);
  return images;
}

/**
 * Recursively extract images from content
 */
function extractImagesRecursive(node: JSONContent, images: ImageReference[]): void {
  if (node.type === 'notecoveImage' && node.attrs) {
    const imageId = node.attrs['imageId'] as string | null;
    if (imageId) {
      images.push({
        imageId,
        sdId: (node.attrs['sdId'] as string | undefined) ?? null,
        alt: (node.attrs['alt'] as string | undefined) ?? '',
      });
    }
  }

  // Recurse into children
  if (node.content) {
    for (const child of node.content) {
      extractImagesRecursive(child, images);
    }
  }
}

/**
 * Replace image placeholders in markdown with actual relative paths
 *
 * @param markdown Markdown string with {ATTACHMENTS}/imageId placeholders
 * @param attachmentsFolder Name of the attachments folder (e.g., "Note Title_attachments")
 * @param imageExtensions Map of imageId -> file extension (e.g., "abc123" -> ".png")
 * @returns Markdown with placeholders replaced
 */
export function replaceImagePlaceholders(
  markdown: string,
  attachmentsFolder: string,
  imageExtensions: Map<string, string>
): string {
  // Replace {ATTACHMENTS}/imageId with actual path
  return markdown.replace(/\{ATTACHMENTS\}\/([a-zA-Z0-9_-]+)/g, (_match, imageId: string) => {
    const extension = imageExtensions.get(imageId) ?? '';
    // URL-encode the folder name for markdown/HTML compatibility
    const encodedFolder = encodeURIComponent(attachmentsFolder).replace(/%20/g, '%20');
    return `${encodedFolder}/${imageId}${extension}`;
  });
}

// ============================================================================
// Filename utilities
// ============================================================================

/**
 * Characters that are not allowed in filenames on various operating systems
 * Note: Control characters \x00-\x1f are intentionally included for security
 */
// eslint-disable-next-line no-control-regex
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Reserved names on Windows
 */
const RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

/**
 * Maximum filename length (before extension)
 */
const MAX_FILENAME_LENGTH = 40;

/**
 * Sanitize a string to be used as a filename
 * - Replaces invalid characters with underscore
 * - Trims whitespace
 * - Handles reserved names
 */
export function sanitizeFilename(name: string): string {
  if (!name || name.trim() === '') {
    return 'Untitled';
  }

  // Replace invalid characters with underscore
  let sanitized = name.replace(INVALID_FILENAME_CHARS, '_');

  // Replace multiple consecutive underscores with single underscore
  sanitized = sanitized.replace(/_+/g, '_');

  // Trim whitespace and underscores from ends
  sanitized = sanitized.trim().replace(/^_+|_+$/g, '');

  // Handle empty result
  if (sanitized === '') {
    return 'Untitled';
  }

  // Handle Windows reserved names
  const upperName = sanitized.toUpperCase();
  if (RESERVED_NAMES.has(upperName) || RESERVED_NAMES.has(upperName.split('.')[0] ?? '')) {
    sanitized = '_' + sanitized;
  }

  return sanitized;
}

/**
 * Truncate filename to maximum length
 * - Preserves word boundaries where possible
 */
export function truncateFilename(name: string, maxLength: number = MAX_FILENAME_LENGTH): string {
  if (name.length <= maxLength) {
    return name;
  }

  // Try to truncate at word boundary
  const truncated = name.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.5) {
    // Found a space in the second half, truncate there
    return truncated.slice(0, lastSpace).trim();
  }

  // No good word boundary, just truncate
  return truncated.trim();
}

/**
 * Resolve filename collision by appending a number
 * - Returns a unique filename that doesn't exist in the set
 * - Updates the set with the new filename
 */
export function resolveFilenameCollision(
  baseFilename: string,
  existingFilenames: Set<string>
): string {
  const lowerBase = baseFilename.toLowerCase();

  if (!existingFilenames.has(lowerBase)) {
    existingFilenames.add(lowerBase);
    return baseFilename;
  }

  // Find next available number
  let counter = 2;
  let candidate: string;

  do {
    candidate = `${baseFilename} (${counter})`;
    counter++;
  } while (existingFilenames.has(candidate.toLowerCase()));

  existingFilenames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Generate a complete filename for a note
 * - Sanitizes the title
 * - Truncates to max length
 * - Resolves collisions
 * - Adds .md extension
 */
export function generateNoteFilename(title: string, existingFilenames: Set<string>): string {
  const sanitized = sanitizeFilename(title);
  const truncated = truncateFilename(sanitized);
  const unique = resolveFilenameCollision(truncated, existingFilenames);

  return `${unique}.md`;
}

// ============================================================================
// Export result types
// ============================================================================

export interface ExportProgress {
  current: number;
  total: number;
  currentNoteName: string;
}

export interface ExportResult {
  success: boolean;
  exportedCount: number;
  skippedCount: number;
  errors: string[];
  destinationPath: string;
}
