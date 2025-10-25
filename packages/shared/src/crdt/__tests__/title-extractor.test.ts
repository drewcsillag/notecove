/**
 * Title Extraction Tests
 */

import * as Y from 'yjs';
import { extractTitleFromFragment, extractTitleFromDoc } from '../title-extractor';

describe('extractTitleFromFragment', () => {
  it('should extract title from paragraph', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');
    const p = new Y.XmlElement('p');
    p.insert(0, [new Y.XmlText('This is the title')]);
    fragment.insert(0, [p]);

    const title = extractTitleFromFragment(fragment);
    expect(title).toBe('This is the title');
  });

  it('should extract title from heading', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');
    const h1 = new Y.XmlElement('h1');
    h1.insert(0, [new Y.XmlText('Heading Title')]);
    fragment.insert(0, [h1]);

    const title = extractTitleFromFragment(fragment);
    expect(title).toBe('Heading Title');
  });

  it('should skip empty paragraphs and find first non-empty', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');

    // Empty paragraph
    const p1 = new Y.XmlElement('p');
    p1.insert(0, [new Y.XmlText('   ')]);

    // Non-empty paragraph
    const p2 = new Y.XmlElement('p');
    p2.insert(0, [new Y.XmlText('First real content')]);

    fragment.insert(0, [p1, p2]);

    const title = extractTitleFromFragment(fragment);
    expect(title).toBe('First real content');
  });

  it('should return "Untitled" for empty fragment', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');
    const title = extractTitleFromFragment(fragment);
    expect(title).toBe('Untitled');
  });

  it('should return "Untitled" for fragment with only whitespace', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');
    const p = new Y.XmlElement('p');
    p.insert(0, [new Y.XmlText('   \n\t  ')]);
    fragment.insert(0, [p]);

    const title = extractTitleFromFragment(fragment);
    expect(title).toBe('Untitled');
  });

  it('should extract from nested elements', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');
    const p = new Y.XmlElement('p');
    const strong = new Y.XmlElement('strong');
    strong.insert(0, [new Y.XmlText('Bold Title')]);
    p.insert(0, [strong]);
    fragment.insert(0, [p]);

    const title = extractTitleFromFragment(fragment);
    expect(title).toBe('Bold Title');
  });

  it('should concatenate text from multiple children', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');
    const p = new Y.XmlElement('p');
    const text1 = new Y.XmlText('Hello ');
    const strong = new Y.XmlElement('strong');
    strong.insert(0, [new Y.XmlText('World')]);
    const text2 = new Y.XmlText('!');
    p.insert(0, [text1, strong, text2]);
    fragment.insert(0, [p]);

    const title = extractTitleFromFragment(fragment);
    expect(title).toBe('Hello World!');
  });

  it('should trim whitespace from extracted title', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('test');
    const p = new Y.XmlElement('p');
    p.insert(0, [new Y.XmlText('  Trimmed Title  ')]);
    fragment.insert(0, [p]);

    const title = extractTitleFromFragment(fragment);
    expect(title).toBe('Trimmed Title');
  });
});

describe('extractTitleFromDoc', () => {
  it('should extract title from default fragment', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('default');
    const p = new Y.XmlElement('p');
    p.insert(0, [new Y.XmlText('Document Title')]);
    fragment.insert(0, [p]);

    const title = extractTitleFromDoc(doc);
    expect(title).toBe('Document Title');
  });

  it('should extract title from custom fragment', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('custom');
    const p = new Y.XmlElement('p');
    p.insert(0, [new Y.XmlText('Custom Fragment Title')]);
    fragment.insert(0, [p]);

    const title = extractTitleFromDoc(doc, 'custom');
    expect(title).toBe('Custom Fragment Title');
  });

  it('should return "Untitled" for empty document', () => {
    const doc = new Y.Doc();
    const title = extractTitleFromDoc(doc);
    expect(title).toBe('Untitled');
  });

  it('should handle complex document structure', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('default');

    // Create a complex structure: <h1><strong>Main</strong> Title</h1>
    const h1 = new Y.XmlElement('h1');
    const strong = new Y.XmlElement('strong');
    strong.insert(0, [new Y.XmlText('Main')]);
    const text = new Y.XmlText(' Title');
    h1.insert(0, [strong, text]);
    fragment.insert(0, [h1]);

    const title = extractTitleFromDoc(doc);
    expect(title).toBe('Main Title');
  });
});
