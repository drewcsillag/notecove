/**
 * Utility functions for NoteCove desktop app
 */

/**
 * Escape HTML entities in text
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate a preview of note content
 * @param {string} content - Full note content (HTML or plain text)
 * @param {number} maxLength - Maximum preview length
 * @returns {string} Preview text with all formatting stripped
 */
export function getPreview(content, maxLength = 60) {
  if (!content) return '';

  // Strip HTML tags to get plain text
  const div = document.createElement('div');
  div.innerHTML = content;
  const plainText = div.textContent || div.innerText || '';

  // Remove newlines and extra whitespace
  const cleaned = plainText.replace(/\s+/g, ' ').trim();

  // Truncate to max length
  const preview = cleaned.substring(0, maxLength);
  return preview.length < cleaned.length ? preview + '...' : preview;
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate unique UUID v4
 * @returns {string} UUID
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now - d);
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
 * @param {object} note - Note object to validate
 * @returns {boolean} True if valid
 */
export function validateNote(note) {
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
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 255); // Limit length
}