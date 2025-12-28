/**
 * LinkChip Component
 *
 * Renders a web link as a compact chip with favicon and truncated title.
 * Used for links in headings, lists, blockquotes, and multi-link paragraphs.
 */

import React from 'react';

/**
 * Props for the LinkChip component
 */
export interface LinkChipProps {
  /** The URL this chip links to */
  url: string;
  /** Title to display (falls back to domain if not provided) */
  title?: string;
  /** Base64 favicon data URL */
  favicon?: string;
  /** Whether the chip data is still loading */
  isLoading?: boolean;
  /** Called when user hovers over the chip */
  onHover?: () => void;
  /** Called when mouse leaves the chip */
  onLeave?: () => void;
  /** Called when user clicks the chip */
  onClick?: (event: React.MouseEvent) => void;
  /** Custom class name for additional styling */
  className?: string;
}

/**
 * Extract domain from a URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove www. prefix for cleaner display
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = /^https?:\/\/([^/]+)/.exec(url);
    return match?.[1]?.replace(/^www\./, '') ?? url;
  }
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 1) + '…';
}

/**
 * Default link icon SVG (used when no favicon is available)
 */
const DefaultLinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

/**
 * Loading spinner SVG
 */
const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="31.4 31.4"
      className="link-chip-spinner-circle"
    />
  </svg>
);

/**
 * LinkChip - Renders a compact chip for web links
 *
 * Visual design:
 * ┌──────────────────────────────┐
 * │ 🔗  How to Build a Start... │
 * └──────────────────────────────┘
 *
 * Features:
 * - Favicon on left (or generic link icon if none)
 * - Truncated title (max ~30 chars)
 * - Subtle background color
 * - Hover: slightly darker background
 */
export const LinkChip: React.FC<LinkChipProps> = ({
  url,
  title,
  favicon,
  isLoading = false,
  onHover,
  onLeave,
  onClick,
  className,
}) => {
  const domain = extractDomain(url);
  const displayText = title ? truncateText(title, 30) : domain;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent);
    }
  };

  return (
    <span
      className={`link-chip ${isLoading ? 'link-chip--loading' : ''} ${className ?? ''}`}
      onClick={handleClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
      title={url}
      data-url={url}
    >
      {isLoading ? (
        <LoadingSpinner className="link-chip-icon link-chip-spinner" />
      ) : favicon ? (
        <img src={favicon} alt="" className="link-chip-favicon" aria-hidden="true" />
      ) : (
        <DefaultLinkIcon className="link-chip-icon" />
      )}
      <span className="link-chip-title">{displayText}</span>
    </span>
  );
};

export default LinkChip;
