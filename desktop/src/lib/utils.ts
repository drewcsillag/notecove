/**
 * Utility functions for NoteCove desktop app
 */

/**
 * Note interface representing a note's data structure
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  created: string;
  modified: string;
  tags: string[];
  folderId?: string;
  deleted?: boolean;
}

/**
 * Escape HTML entities in text
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate a preview of note content
 * @param content - Full note content (HTML or plain text)
 * @param maxLength - Maximum preview length
 * @returns Preview text with all formatting stripped
 */
export function getPreview(content: string, maxLength: number = 60): string {
  if (!content) return '';

  // Strip HTML tags to get plain text
  let plainText = '';
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = content;
    plainText = div.textContent || div.innerText || '';
  } else {
    // Fallback for environments without DOM (e.g., tests)
    plainText = content.replace(/<[^>]*>/g, '');
  }

  // Remove newlines and extra whitespace
  const cleaned = plainText.replace(/\s+/g, ' ').trim();

  // Truncate to max length
  const preview = cleaned.substring(0, maxLength);
  return preview.length < cleaned.length ? preview + '...' : preview;
}

/**
 * Debounce function calls
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function executedFunction(...args: Parameters<T>): void {
    const later = (): void => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate unique UUID v4
 * @returns UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Format date for display
 * @param date - Date to format
 * @returns Formatted date
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - d.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return 'Today';
  } else if (diffDays === 2) {
    return 'Yesterday';
  } else if (diffDays <= 7) {
    return `${diffDays} days ago`;
  } else {
    return d.toLocaleDateString();
  }
}

/**
 * Validate note data structure
 * @param note - Note object to validate
 * @returns True if valid
 */
export function validateNote(note: any): note is Note {
  return !!(note &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.content === 'string' &&
    typeof note.created === 'string' &&
    typeof note.modified === 'string' &&
    Array.isArray(note.tags));
}

/**
 * Sanitize filename for file system
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 255); // Limit length
}
