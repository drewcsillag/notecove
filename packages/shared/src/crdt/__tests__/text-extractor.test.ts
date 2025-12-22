/**
 * Text Extraction Tests
 *
 * Tests for extracting plain text and snippets from Yjs documents.
 */

import * as Y from 'yjs';
import { extractTextFromFragment, extractSnippet, extractTextAndSnippet } from '../text-extractor';

describe('extractTextFromFragment', () => {
  it('should separate paragraphs with newlines', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const p1 = new Y.XmlElement('paragraph');
    p1.insert(0, [new Y.XmlText('First paragraph')]);

    const p2 = new Y.XmlElement('paragraph');
    p2.insert(0, [new Y.XmlText('Second paragraph')]);

    const p3 = new Y.XmlElement('paragraph');
    p3.insert(0, [new Y.XmlText('Third paragraph')]);

    fragment.insert(0, [p1, p2, p3]);

    const text = extractTextFromFragment(fragment);
    expect(text).toBe('First paragraph\nSecond paragraph\nThird paragraph');
  });

  it('should separate headings with newlines', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const h1 = new Y.XmlElement('heading');
    h1.insert(0, [new Y.XmlText('Main Title')]);

    const p = new Y.XmlElement('paragraph');
    p.insert(0, [new Y.XmlText('Some content')]);

    fragment.insert(0, [h1, p]);

    const text = extractTextFromFragment(fragment);
    expect(text).toBe('Main Title\nSome content');
  });

  it('should preserve internal newlines in code blocks', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const p = new Y.XmlElement('paragraph');
    p.insert(0, [new Y.XmlText('Before code')]);

    const code = new Y.XmlElement('codeBlock');
    code.insert(0, [new Y.XmlText('line 1\nline 2\nline 3')]);

    const p2 = new Y.XmlElement('paragraph');
    p2.insert(0, [new Y.XmlText('After code')]);

    fragment.insert(0, [p, code, p2]);

    const text = extractTextFromFragment(fragment);
    expect(text).toBe('Before code\nline 1\nline 2\nline 3\nAfter code');
  });

  it('should handle nested elements (bold, italic, etc.)', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const p = new Y.XmlElement('paragraph');
    const text1 = new Y.XmlText('Hello ');
    const bold = new Y.XmlElement('bold');
    bold.insert(0, [new Y.XmlText('world')]);
    const text2 = new Y.XmlText('!');
    p.insert(0, [text1, bold, text2]);

    fragment.insert(0, [p]);

    const text = extractTextFromFragment(fragment);
    expect(text).toBe('Hello world!');
  });

  it('should handle empty fragment', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const text = extractTextFromFragment(fragment);
    expect(text).toBe('');
  });

  it('should handle empty paragraphs', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const p1 = new Y.XmlElement('paragraph');
    p1.insert(0, [new Y.XmlText('First')]);

    const p2 = new Y.XmlElement('paragraph');
    // Empty paragraph

    const p3 = new Y.XmlElement('paragraph');
    p3.insert(0, [new Y.XmlText('Third')]);

    fragment.insert(0, [p1, p2, p3]);

    const text = extractTextFromFragment(fragment);
    expect(text).toBe('First\n\nThird');
  });

  it('should handle task list items', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const task1 = new Y.XmlElement('taskItem');
    task1.insert(0, [new Y.XmlText('Buy groceries')]);

    const task2 = new Y.XmlElement('taskItem');
    task2.insert(0, [new Y.XmlText('Walk the dog')]);

    fragment.insert(0, [task1, task2]);

    const text = extractTextFromFragment(fragment);
    expect(text).toBe('Buy groceries\nWalk the dog');
  });
});

describe('extractSnippet', () => {
  it('should skip first line (title) and return rest', () => {
    const text = 'Title Line\nFirst content line\nSecond content line';
    const snippet = extractSnippet(text, 200);
    expect(snippet).toBe('First content line\nSecond content line');
  });

  it('should skip empty lines after title', () => {
    const text = 'Title Line\n\n\nActual content here';
    const snippet = extractSnippet(text, 200);
    expect(snippet).toBe('Actual content here');
  });

  it('should limit snippet length', () => {
    const text = 'Title\nThis is a very long content line that should be truncated';
    const snippet = extractSnippet(text, 20);
    expect(snippet).toBe('This is a very long ');
  });

  it('should return empty for single line (title only)', () => {
    const text = 'Just a title';
    const snippet = extractSnippet(text, 200);
    expect(snippet).toBe('');
  });

  it('should return empty for title with only empty lines after', () => {
    const text = 'Title\n\n\n   \n';
    const snippet = extractSnippet(text, 200);
    expect(snippet).toBe('');
  });

  it('should handle text with no newlines', () => {
    const text = 'Single line of text';
    const snippet = extractSnippet(text, 200);
    expect(snippet).toBe('');
  });

  it('should collapse multiple empty lines in snippet', () => {
    const text = 'Title\nFirst line\n\n\nSecond line';
    const snippet = extractSnippet(text, 200);
    expect(snippet).toBe('First line\nSecond line');
  });
});

describe('extractTextAndSnippet', () => {
  it('should return both contentText and contentPreview', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const h1 = new Y.XmlElement('heading');
    h1.insert(0, [new Y.XmlText('Document Title')]);

    const p1 = new Y.XmlElement('paragraph');
    p1.insert(0, [new Y.XmlText('First paragraph of content.')]);

    const p2 = new Y.XmlElement('paragraph');
    p2.insert(0, [new Y.XmlText('Second paragraph.')]);

    fragment.insert(0, [h1, p1, p2]);

    const { contentText, contentPreview } = extractTextAndSnippet(fragment, 200);

    expect(contentText).toBe('Document Title\nFirst paragraph of content.\nSecond paragraph.');
    expect(contentPreview).toBe('First paragraph of content.\nSecond paragraph.');
  });

  it('should handle document with empty paragraphs between content', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    const h1 = new Y.XmlElement('heading');
    h1.insert(0, [new Y.XmlText('Title')]);

    const empty = new Y.XmlElement('paragraph');

    const p = new Y.XmlElement('paragraph');
    p.insert(0, [new Y.XmlText('Content after empty paragraph')]);

    fragment.insert(0, [h1, empty, p]);

    const { contentPreview } = extractTextAndSnippet(fragment, 200);
    expect(contentPreview).toBe('Content after empty paragraph');
  });
});
