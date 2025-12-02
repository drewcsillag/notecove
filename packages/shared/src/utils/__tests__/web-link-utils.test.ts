/**
 * Web Link Utilities Tests
 *
 * Tests for web link (http/https) detection and extraction utilities.
 */

import {
  WEB_LINK_PATTERN,
  MARKDOWN_LINK_PATTERN,
  extractWebLinks,
  isValidWebUrl,
  balanceUrlParentheses,
} from '../web-link-utils';

describe('WEB_LINK_PATTERN', () => {
  it('should match http URLs', () => {
    const text = 'Visit http://example.com for more info';
    const matches = text.match(WEB_LINK_PATTERN);
    expect(matches).toContain('http://example.com');
  });

  it('should match https URLs', () => {
    const text = 'Visit https://example.com for more info';
    const matches = text.match(WEB_LINK_PATTERN);
    expect(matches).toContain('https://example.com');
  });

  it('should match URLs with paths', () => {
    const text = 'Check https://example.com/path/to/page.html';
    const matches = text.match(WEB_LINK_PATTERN);
    expect(matches).toContain('https://example.com/path/to/page.html');
  });

  it('should match URLs with query strings', () => {
    const text = 'Search https://example.com/search?q=test&page=1';
    const matches = text.match(WEB_LINK_PATTERN);
    expect(matches).toContain('https://example.com/search?q=test&page=1');
  });

  it('should match URLs with fragments', () => {
    const text = 'See https://example.com/page#section';
    const matches = text.match(WEB_LINK_PATTERN);
    expect(matches).toContain('https://example.com/page#section');
  });

  it('should match URLs with ports', () => {
    const text = 'Server at http://localhost:3000/api';
    const matches = text.match(WEB_LINK_PATTERN);
    expect(matches).toContain('http://localhost:3000/api');
  });

  it('should NOT match ftp URLs', () => {
    const text = 'File at ftp://example.com/file.txt';
    const matches = text.match(WEB_LINK_PATTERN);
    expect(matches).toBeNull();
  });

  it('should NOT match mailto URLs', () => {
    const text = 'Contact mailto:test@example.com';
    const matches = text.match(WEB_LINK_PATTERN);
    expect(matches).toBeNull();
  });
});

describe('MARKDOWN_LINK_PATTERN', () => {
  it('should match markdown links with http URL', () => {
    const text = 'Click [here](http://example.com) for more';
    const match = text.match(MARKDOWN_LINK_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('here');
    expect(match![2]).toBe('http://example.com');
  });

  it('should match markdown links with https URL', () => {
    const text = 'See [Google](https://google.com)';
    const match = text.match(MARKDOWN_LINK_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('Google');
    expect(match![2]).toBe('https://google.com');
  });

  it('should handle URLs with paths in markdown', () => {
    const text = '[Docs](https://example.com/docs/getting-started)';
    const match = text.match(MARKDOWN_LINK_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('Docs');
    expect(match![2]).toBe('https://example.com/docs/getting-started');
  });

  it('should handle multi-word link text', () => {
    const text = '[Click here for more](https://example.com)';
    const match = text.match(MARKDOWN_LINK_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('Click here for more');
  });

  it('should NOT match non-http URLs in markdown', () => {
    const text = '[File](ftp://example.com/file.txt)';
    const match = text.match(MARKDOWN_LINK_PATTERN);
    expect(match).toBeNull();
  });
});

describe('extractWebLinks', () => {
  it('should extract single URL from text', () => {
    const text = 'Visit https://example.com for info';
    const links = extractWebLinks(text);
    expect(links).toEqual(['https://example.com']);
  });

  it('should extract multiple URLs from text', () => {
    const text = 'Check https://first.com and https://second.com';
    const links = extractWebLinks(text);
    expect(links).toContain('https://first.com');
    expect(links).toContain('https://second.com');
    expect(links).toHaveLength(2);
  });

  it('should return unique URLs only', () => {
    const text = 'Visit https://example.com and https://example.com again';
    const links = extractWebLinks(text);
    expect(links).toEqual(['https://example.com']);
  });

  it('should return empty array for text without URLs', () => {
    const text = 'No links here';
    const links = extractWebLinks(text);
    expect(links).toEqual([]);
  });

  it('should handle null/undefined input', () => {
    expect(extractWebLinks(null as unknown as string)).toEqual([]);
    expect(extractWebLinks(undefined as unknown as string)).toEqual([]);
  });

  it('should handle empty string', () => {
    expect(extractWebLinks('')).toEqual([]);
  });
});

describe('isValidWebUrl', () => {
  it('should return true for valid http URL', () => {
    expect(isValidWebUrl('http://example.com')).toBe(true);
  });

  it('should return true for valid https URL', () => {
    expect(isValidWebUrl('https://example.com')).toBe(true);
  });

  it('should return true for URL with path', () => {
    expect(isValidWebUrl('https://example.com/path/to/page')).toBe(true);
  });

  it('should return true for URL with query string', () => {
    expect(isValidWebUrl('https://example.com?foo=bar')).toBe(true);
  });

  it('should return false for ftp URL', () => {
    expect(isValidWebUrl('ftp://example.com')).toBe(false);
  });

  it('should return false for mailto URL', () => {
    expect(isValidWebUrl('mailto:test@example.com')).toBe(false);
  });

  it('should return false for plain text', () => {
    expect(isValidWebUrl('not a url')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidWebUrl('')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isValidWebUrl(null as unknown as string)).toBe(false);
    expect(isValidWebUrl(undefined as unknown as string)).toBe(false);
  });
});

describe('balanceUrlParentheses', () => {
  it('should not modify URLs without parentheses', () => {
    expect(balanceUrlParentheses('https://example.com')).toBe('https://example.com');
  });

  it('should not modify URLs with balanced parentheses', () => {
    const url = 'https://en.wikipedia.org/wiki/Test_(disambiguation)';
    expect(balanceUrlParentheses(url)).toBe(url);
  });

  it('should trim trailing unbalanced parentheses', () => {
    const url = 'https://en.wikipedia.org/wiki/Test_(disambiguation))';
    expect(balanceUrlParentheses(url)).toBe('https://en.wikipedia.org/wiki/Test_(disambiguation)');
  });

  it('should handle multiple unbalanced trailing parens', () => {
    const url = 'https://example.com/path)))';
    expect(balanceUrlParentheses(url)).toBe('https://example.com/path');
  });

  it('should handle URLs with nested parentheses', () => {
    const url = 'https://example.com/wiki/Foo_(bar_(baz))';
    expect(balanceUrlParentheses(url)).toBe(url);
  });
});
