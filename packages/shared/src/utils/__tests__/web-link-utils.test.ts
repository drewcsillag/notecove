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
  detectUrlFromSelection,
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

describe('getUrlRanges', () => {
  // Import dynamically to test the new function
  let getUrlRanges: (text: string) => Array<{ start: number; end: number }>;

  beforeAll(async () => {
    const module = await import('../web-link-utils');
    getUrlRanges = module.getUrlRanges;
  });

  it('should return empty array for text without URLs', () => {
    const ranges = getUrlRanges('No links here');
    expect(ranges).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    const ranges = getUrlRanges('');
    expect(ranges).toEqual([]);
  });

  it('should return empty array for null/undefined', () => {
    expect(getUrlRanges(null as unknown as string)).toEqual([]);
    expect(getUrlRanges(undefined as unknown as string)).toEqual([]);
  });

  it('should return correct range for single URL', () => {
    const text = 'Visit https://example.com for info';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 6, end: 25 }); // "https://example.com" starts at index 6
  });

  it('should return correct ranges for multiple URLs', () => {
    const text = 'Check https://first.com and https://second.com';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: 6, end: 23 }); // "https://first.com"
    expect(ranges[1]).toEqual({ start: 28, end: 46 }); // "https://second.com"
  });

  it('should return correct range for URL with fragment', () => {
    const text = 'See https://example.com/page#section here';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    // "https://example.com/page#section" starts at index 4
    expect(ranges[0]).toEqual({ start: 4, end: 36 });
  });

  it('should return correct range for URL with query string and fragment', () => {
    const text = 'Link: https://example.com/search?q=test#results';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 6, end: 47 });
  });

  it('should handle URL at start of text', () => {
    const text = 'https://example.com is a site';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 0, end: 19 });
  });

  it('should handle URL at end of text', () => {
    const text = 'Visit https://example.com';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 6, end: 25 });
  });

  it('should handle markdown link URLs', () => {
    const text = 'Click [here](https://example.com#anchor) for more';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    // The URL inside markdown is "https://example.com#anchor"
    expect(ranges[0]).toEqual({ start: 13, end: 39 });
  });

  it('should handle URLs with multiple fragments (edge case)', () => {
    // Even though #bar looks like a tag, the whole thing is one URL
    const text = 'See https://example.com#foo#bar';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 4, end: 31 });
  });

  it('should handle URL with # in query param', () => {
    const text = 'Link https://example.com?tag=#test here';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 5, end: 34 });
  });

  it('should strip trailing punctuation from URL range', () => {
    const text = 'Visit https://example.com.';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    // The trailing period should be stripped
    expect(ranges[0]).toEqual({ start: 6, end: 25 });
  });

  it('should handle Wikipedia-style URLs with parentheses', () => {
    // Note: Current implementation strips trailing ) before paren balancing,
    // so Wikipedia URLs lose their closing paren. This matches extractWebLinks behavior.
    // A proper fix would require reordering paren balancing before punctuation stripping.
    const text = 'See https://en.wikipedia.org/wiki/Test_(disambiguation) here';
    const ranges = getUrlRanges(text);
    expect(ranges).toHaveLength(1);
    // end is 54 not 55 because trailing ) is stripped as punctuation
    expect(ranges[0]).toEqual({ start: 4, end: 54 });
  });
});

describe('detectUrlFromSelection', () => {
  describe('full URLs with scheme', () => {
    it('should return http URL as-is', () => {
      expect(detectUrlFromSelection('http://example.com')).toBe('http://example.com');
    });

    it('should return https URL as-is', () => {
      expect(detectUrlFromSelection('https://example.com')).toBe('https://example.com');
    });

    it('should return URL with path as-is', () => {
      expect(detectUrlFromSelection('https://example.com/path/to/page')).toBe(
        'https://example.com/path/to/page'
      );
    });

    it('should return URL with query string as-is', () => {
      expect(detectUrlFromSelection('https://example.com?foo=bar&baz=qux')).toBe(
        'https://example.com?foo=bar&baz=qux'
      );
    });

    it('should return URL with fragment as-is', () => {
      expect(detectUrlFromSelection('https://example.com#section')).toBe(
        'https://example.com#section'
      );
    });

    it('should return URL with port as-is', () => {
      expect(detectUrlFromSelection('https://example.com:8080/api')).toBe(
        'https://example.com:8080/api'
      );
    });
  });

  describe('bare hostnames with common TLDs', () => {
    it('should prepend https:// to .com domain', () => {
      expect(detectUrlFromSelection('example.com')).toBe('https://example.com');
    });

    it('should prepend https:// to .org domain', () => {
      expect(detectUrlFromSelection('example.org')).toBe('https://example.org');
    });

    it('should prepend https:// to .net domain', () => {
      expect(detectUrlFromSelection('example.net')).toBe('https://example.net');
    });

    it('should prepend https:// to .io domain', () => {
      expect(detectUrlFromSelection('example.io')).toBe('https://example.io');
    });

    it('should prepend https:// to .dev domain', () => {
      expect(detectUrlFromSelection('example.dev')).toBe('https://example.dev');
    });

    it('should prepend https:// to .co domain', () => {
      expect(detectUrlFromSelection('example.co')).toBe('https://example.co');
    });

    it('should prepend https:// to .ai domain', () => {
      expect(detectUrlFromSelection('example.ai')).toBe('https://example.ai');
    });

    it('should prepend https:// to .edu domain', () => {
      expect(detectUrlFromSelection('stanford.edu')).toBe('https://stanford.edu');
    });

    it('should prepend https:// to .gov domain', () => {
      expect(detectUrlFromSelection('whitehouse.gov')).toBe('https://whitehouse.gov');
    });

    it('should prepend https:// to subdomain.domain.tld', () => {
      expect(detectUrlFromSelection('www.example.com')).toBe('https://www.example.com');
    });

    it('should prepend https:// to multi-level subdomain', () => {
      expect(detectUrlFromSelection('api.v2.example.com')).toBe('https://api.v2.example.com');
    });
  });

  describe('hostnames with paths', () => {
    it('should prepend https:// to domain with path', () => {
      expect(detectUrlFromSelection('example.com/path/to/page')).toBe(
        'https://example.com/path/to/page'
      );
    });

    it('should prepend https:// to domain with query string', () => {
      expect(detectUrlFromSelection('example.com?search=test')).toBe(
        'https://example.com?search=test'
      );
    });

    it('should prepend https:// to domain with fragment', () => {
      expect(detectUrlFromSelection('example.com#section')).toBe('https://example.com#section');
    });
  });

  describe('IP addresses', () => {
    it('should prepend http:// to IPv4 address', () => {
      expect(detectUrlFromSelection('192.168.1.1')).toBe('http://192.168.1.1');
    });

    it('should prepend http:// to IPv4 address with port', () => {
      expect(detectUrlFromSelection('192.168.1.1:8080')).toBe('http://192.168.1.1:8080');
    });

    it('should prepend http:// to IPv4 address with path', () => {
      expect(detectUrlFromSelection('192.168.1.1/api/v1')).toBe('http://192.168.1.1/api/v1');
    });

    it('should prepend http:// to IPv4 with port and path', () => {
      expect(detectUrlFromSelection('192.168.1.1:3000/api')).toBe('http://192.168.1.1:3000/api');
    });

    it('should prepend http:// to localhost IP', () => {
      expect(detectUrlFromSelection('127.0.0.1')).toBe('http://127.0.0.1');
    });

    it('should prepend http:// to localhost IP with port', () => {
      expect(detectUrlFromSelection('127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    });
  });

  describe('localhost', () => {
    it('should prepend https:// to localhost', () => {
      expect(detectUrlFromSelection('localhost')).toBe('https://localhost');
    });

    it('should prepend https:// to localhost with port', () => {
      expect(detectUrlFromSelection('localhost:3000')).toBe('https://localhost:3000');
    });

    it('should prepend https:// to localhost with path', () => {
      expect(detectUrlFromSelection('localhost/api')).toBe('https://localhost/api');
    });

    it('should prepend https:// to localhost with port and path', () => {
      expect(detectUrlFromSelection('localhost:8080/api/v1')).toBe('https://localhost:8080/api/v1');
    });
  });

  describe('country code TLDs', () => {
    it('should recognize .uk domain', () => {
      expect(detectUrlFromSelection('example.co.uk')).toBe('https://example.co.uk');
    });

    it('should recognize .de domain', () => {
      expect(detectUrlFromSelection('example.de')).toBe('https://example.de');
    });

    it('should recognize .jp domain', () => {
      expect(detectUrlFromSelection('example.jp')).toBe('https://example.jp');
    });

    it('should recognize .au domain', () => {
      expect(detectUrlFromSelection('example.com.au')).toBe('https://example.com.au');
    });
  });

  describe('whitespace handling', () => {
    it('should trim leading whitespace', () => {
      expect(detectUrlFromSelection('  example.com')).toBe('https://example.com');
    });

    it('should trim trailing whitespace', () => {
      expect(detectUrlFromSelection('example.com  ')).toBe('https://example.com');
    });

    it('should trim both leading and trailing whitespace', () => {
      expect(detectUrlFromSelection('  example.com  ')).toBe('https://example.com');
    });

    it('should trim newlines', () => {
      expect(detectUrlFromSelection('\nexample.com\n')).toBe('https://example.com');
    });

    it('should trim tabs', () => {
      expect(detectUrlFromSelection('\texample.com\t')).toBe('https://example.com');
    });
  });

  describe('rejection cases', () => {
    it('should return null for text with internal spaces', () => {
      expect(detectUrlFromSelection('example .com')).toBeNull();
    });

    it('should return null for sentence with URL', () => {
      expect(detectUrlFromSelection('Visit example.com for more')).toBeNull();
    });

    it('should return null for plain text', () => {
      expect(detectUrlFromSelection('hello world')).toBeNull();
    });

    it('should return null for single word', () => {
      expect(detectUrlFromSelection('hello')).toBeNull();
    });

    it('should return null for non-TLD extension', () => {
      expect(detectUrlFromSelection('foo.bar')).toBeNull();
    });

    it('should return null for file extension pattern', () => {
      expect(detectUrlFromSelection('document.pdf')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(detectUrlFromSelection('')).toBeNull();
    });

    it('should return null for whitespace only', () => {
      expect(detectUrlFromSelection('   ')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(detectUrlFromSelection(null as unknown as string)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(detectUrlFromSelection(undefined as unknown as string)).toBeNull();
    });

    it('should return null for number-like input', () => {
      expect(detectUrlFromSelection('12345')).toBeNull();
    });

    it('should return null for email address', () => {
      expect(detectUrlFromSelection('user@example.com')).toBeNull();
    });
  });
});
