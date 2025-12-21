/**
 * Test interaction between Hashtag decorations and WebLink autolink
 *
 * This test investigates a bug where hashtags at the beginning of text
 * are not decorated when a URL is also present in the same line.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Hashtag } from '../Hashtag';
import { WebLink } from '../WebLink';

// Mock window.electronAPI
const mockElectronAPI = {
  tag: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined),
  },
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!global.window) {
  // @ts-expect-error - mocking global
  global.window = {};
}
// @ts-expect-error - mocking electronAPI
global.window.electronAPI = mockElectronAPI;

describe('Hashtag + URL interaction', () => {
  let editor: Editor;

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (editor) {
      editor.destroy();
    }
  });

  it('should decorate all hashtags when URL is bulk inserted (autolink does not trigger)', async () => {
    // NOTE: When content is bulk-inserted (not typed), autolink does NOT trigger
    // because it only activates when a space is typed after a URL.
    // In this case, #section is incorrectly treated as a hashtag.
    // This is expected behavior for bulk insert - the E2E test uses typing.
    editor = new Editor({
      extensions: [StarterKit, Hashtag, WebLink],
      content: '',
    });

    // Insert content all at once
    editor.commands.insertContent('#work See https://example.com#section then #project ');

    // Wait for decoration processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check the DOM for hashtag decorations
    const view = editor.view;
    const hashtagElements = view.dom.querySelectorAll('.hashtag');

    // Without autolink, we get 3 hashtags (including #section in the URL)
    // This is expected because autolink only triggers on typed input
    expect(hashtagElements.length).toBe(3);
    expect(Array.from(hashtagElements).map((el) => el.getAttribute('data-tag'))).toEqual([
      'work',
      'section',
      'project',
    ]);
  });

  it('should decorate hashtags when typed character by character', async () => {
    editor = new Editor({
      extensions: [StarterKit, Hashtag, WebLink],
      content: '',
    });

    // Type character by character like E2E test does
    const text = '#work See https://example.com#section then #project ';
    for (const char of text) {
      editor.commands.insertContent(char);
      // Tiny delay to simulate typing
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    // Wait for autolink processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    const view = editor.view;
    const hashtagElements = view.dom.querySelectorAll('.hashtag');

    // When typing char-by-char, autolink triggers and adds link mark to URL
    // So we only get 2 hashtags: #work and #project (not #section in URL)
    expect(hashtagElements.length).toBe(2);
    expect(Array.from(hashtagElements).map((el) => el.getAttribute('data-tag'))).toEqual([
      'work',
      'project',
    ]);
  });

  it('should decorate hashtags without URL (control test)', () => {
    editor = new Editor({
      extensions: [StarterKit, Hashtag, WebLink],
      content: '',
    });

    // Insert content without URL
    editor.commands.insertContent('#work See some text then #project ');

    const view = editor.view;
    const hashtagElements = view.dom.querySelectorAll('.hashtag');

    expect(hashtagElements.length).toBe(2);
    expect(Array.from(hashtagElements).map((el) => el.getAttribute('data-tag'))).toEqual([
      'work',
      'project',
    ]);
  });
});
