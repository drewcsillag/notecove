/**
 * Unit tests for clipboard HTML sanitization
 *
 * Tests the sanitizeClipboardHtml function which cleans HTML from various
 * clipboard sources for safe insertion into TipTap editor.
 *
 * @see plans/fix-context-menu-paste/PLAN.md
 */

import { sanitizeClipboardHtml } from '../clipboard-sanitizer';

describe('sanitizeClipboardHtml', () => {
  describe('meta tag removal', () => {
    it('should remove <meta charset="utf-8"> from HTML', () => {
      const input = '<meta charset="utf-8">Hello World';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<meta');
      expect(result).toContain('Hello World');
    });

    it('should remove meta tags with other attributes', () => {
      const input = '<meta name="viewport" content="width=device-width"><p>Content</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<meta');
      expect(result).toContain('Content');
    });

    it('should handle multiple meta tags', () => {
      const input = '<meta charset="utf-8"><meta name="author" content="test"><p>Text</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<meta');
      expect(result).toContain('Text');
    });
  });

  describe('html/body wrapper extraction', () => {
    it('should extract content from full HTML document', () => {
      const input =
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>Content</p></body></html>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<!DOCTYPE');
      expect(result).not.toContain('<html');
      expect(result).not.toContain('<head');
      expect(result).not.toContain('<body');
      expect(result).toContain('<p>Content</p>');
    });

    it('should handle content without body wrapper', () => {
      const input = '<p>Just a paragraph</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<p>Just a paragraph</p>');
    });

    it('should handle nested body content', () => {
      const input = '<html><body><div><p>Nested</p></div></body></html>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<div><p>Nested</p></div>');
    });
  });

  describe('unwanted element removal', () => {
    it('should remove <style> tags', () => {
      const input = '<style>.red { color: red; }</style><p class="red">Styled</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<style');
      expect(result).toContain('Styled');
    });

    it('should remove <script> tags', () => {
      const input = '<script>alert("xss")</script><p>Safe</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('Safe');
    });

    it('should remove <link> tags', () => {
      const input = '<link rel="stylesheet" href="style.css"><p>Content</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<link');
      expect(result).toContain('Content');
    });

    it('should remove <title> tags', () => {
      const input = '<title>Page Title</title><p>Body</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<title');
      expect(result).toContain('Body');
    });
  });

  describe('formatting preservation', () => {
    it('should preserve bold text', () => {
      const input = '<p><strong>Bold</strong> text</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<strong>Bold</strong>');
    });

    it('should preserve italic text', () => {
      const input = '<p><em>Italic</em> text</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<em>Italic</em>');
    });

    it('should preserve underlined text', () => {
      const input = '<p><u>Underlined</u> text</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<u>Underlined</u>');
    });

    it('should preserve links', () => {
      const input = '<p><a href="https://example.com">Link</a></p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<a href="https://example.com">Link</a>');
    });

    it('should preserve lists', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('should preserve ordered lists', () => {
      const input = '<ol><li>First</li><li>Second</li></ol>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>First</li>');
    });

    it('should preserve code blocks', () => {
      const input = '<pre><code>const x = 1;</code></pre>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<pre>');
      expect(result).toContain('<code>');
      expect(result).toContain('const x = 1;');
    });

    it('should preserve inline code', () => {
      const input = '<p>Use <code>npm install</code> to install</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<code>npm install</code>');
    });

    it('should preserve blockquotes', () => {
      const input = '<blockquote>A famous quote</blockquote>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<blockquote>A famous quote</blockquote>');
    });

    it('should preserve headings', () => {
      const input = '<h1>Title</h1><h2>Subtitle</h2>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<h1>Title</h1>');
      expect(result).toContain('<h2>Subtitle</h2>');
    });
  });

  describe('Microsoft Office HTML handling', () => {
    it('should remove mso-* inline styles', () => {
      const input = '<p style="mso-spacerun:yes; color:red;">Text</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('mso-');
      // Should keep non-mso styles
      expect(result).toContain('color:red');
    });

    it('should handle multiple mso-* styles', () => {
      const input =
        '<p style="mso-bidi-font-family:Arial; mso-fareast-font-family:Times; font-weight:bold;">Text</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('mso-');
      expect(result).toContain('font-weight:bold');
    });

    it('should remove style attribute entirely if only mso-* styles remain', () => {
      const input = '<p style="mso-spacerun:yes;">Text</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('style=');
    });

    it('should remove o:p tags (Office paragraph)', () => {
      const input = '<p>Text<o:p></o:p></p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('o:p');
      expect(result).toContain('Text');
    });

    it('should handle complex Office HTML', () => {
      const input = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office">
        <head>
          <meta charset="utf-8">
          <style>
            .MsoNormal { mso-style-name: Normal; }
          </style>
        </head>
        <body>
          <p class="MsoNormal" style="mso-margin-top-alt:auto;margin-bottom:0;">
            <span style="font-family:Arial;mso-fareast-font-family:Times;">Hello</span>
            <o:p></o:p>
          </p>
        </body>
        </html>
      `;
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<meta');
      expect(result).not.toContain('<style');
      expect(result).not.toContain('mso-');
      expect(result).not.toContain('o:p');
      expect(result).toContain('Hello');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = sanitizeClipboardHtml('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only string', () => {
      const result = sanitizeClipboardHtml('   \n\t  ');
      // Should return empty or whitespace - implementation can decide
      expect(result.trim()).toBe('');
    });

    it('should handle plain text without HTML', () => {
      const input = 'Just plain text';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('Just plain text');
    });

    it('should handle self-closing tags', () => {
      const input = '<p>Line 1<br/>Line 2</p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });

    it('should handle special characters', () => {
      const input = '<p>&amp; &lt; &gt; &quot;</p>';
      const result = sanitizeClipboardHtml(input);
      // Entities may be decoded or preserved - both are acceptable
      expect(result).toContain('<p>');
    });

    it('should handle nested formatting', () => {
      const input = '<p><strong><em>Bold and italic</em></strong></p>';
      const result = sanitizeClipboardHtml(input);
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
      expect(result).toContain('Bold and italic');
    });
  });

  describe('real-world clipboard examples', () => {
    it('should handle Chrome browser copy', () => {
      // Typical Chrome copy output
      const input =
        '<meta charset="utf-8"><span style="color: rgb(0, 0, 0); font-family: Arial;">Selected text</span>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<meta');
      expect(result).toContain('Selected text');
    });

    it('should handle Safari browser copy', () => {
      // Safari often wraps in span with styles
      const input =
        '<meta charset="UTF-8"><span style="caret-color: rgb(0, 0, 0); color: rgb(0, 0, 0);">Text from Safari</span>';
      const result = sanitizeClipboardHtml(input);
      expect(result).not.toContain('<meta');
      expect(result).toContain('Text from Safari');
    });

    it('should handle the specific bug case: wolf in sheeps clothing', () => {
      // This is the exact scenario from the bug report
      const input = '<meta charset="utf-8">wolf';
      const result = sanitizeClipboardHtml(input);
      expect(result).toBe('wolf');
    });
  });
});
