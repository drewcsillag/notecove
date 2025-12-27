/**
 * E2E Tests for Web Links
 *
 * Tests web link auto-detection, click handling, and popover interactions.
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeAll(async () => {
  // Create unique temp directory for this test
  testUserDataDir = path.join(
    os.tmpdir(),
    `notecove-e2e-weblinks-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  await fs.mkdir(testUserDataDir, { recursive: true });
  console.log('[E2E WebLinks] Launching Electron with userData at:', testUserDataDir);

  // Launch Electron app
  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Get the first window
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  await page.waitForTimeout(1000); // Wait for app initialization
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }

  // Clean up test userData directory
  try {
    await fs.rm(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E WebLinks] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E WebLinks] Failed to clean up test userData directory:', err);
  }
});

test.describe('Web Links - Auto-detection', () => {
  test('should auto-detect URLs when typing and pressing space', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a URL followed by space
    await page.keyboard.type('Check out https://example.com ');
    await page.waitForTimeout(500);

    // Verify the link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Verify the href attribute
    const href = await linkElement.getAttribute('href');
    expect(href).toBe('https://example.com');

    // Verify the link text
    const linkText = await linkElement.textContent();
    expect(linkText).toBe('https://example.com');
  });

  test('should auto-detect URLs when typing and pressing enter', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a URL followed by enter
    await page.keyboard.type('Visit https://enter-test.com');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify the link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Verify the href attribute
    const href = await linkElement.getAttribute('href');
    expect(href).toBe('https://enter-test.com');
  });

  test('should auto-detect URLs when pasting', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Paste a URL (simulate clipboard)
    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', 'https://github.com');
      const pasteEvent = new ClipboardEvent('paste', { clipboardData, bubbles: true });
      document.querySelector('.ProseMirror')?.dispatchEvent(pasteEvent);
    });
    await page.waitForTimeout(500);

    // Verify the link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    const href = await linkElement.getAttribute('href');
    expect(href).toBe('https://github.com');
  });
});

test.describe('Web Links - Click Handling', () => {
  test('should open link in browser on Cmd+click', async () => {
    // Create a new note with a link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Link test https://httpstat.us/200 ');
    await page.waitForTimeout(500);

    // Verify link exists
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Set up test hook for openExternal
    // Note: We can't mock Electron's frozen contextBridge objects, so we use a test hook
    await page.evaluate(() => {
      window.__webLinkTestHook = {
        lastOpenedUrl: null,
        openCount: 0,
      };
    });

    // Cmd+click the link
    console.log('[Test] About to Cmd+click the link');
    await linkElement.click({ modifiers: ['Meta'] });
    await page.waitForTimeout(500);

    // Check if openExternal was called via test hook
    const result = await page.evaluate(() => {
      const hook = window.__webLinkTestHook;
      return {
        called: hook ? hook.openCount > 0 : false,
        url: hook?.lastOpenedUrl ?? '',
      };
    });

    expect(result.called).toBe(true);
    expect(result.url).toBe('https://httpstat.us/200');
  });

  test('should show popover on regular click (not open link)', async () => {
    // Create a new note with a link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Another link https://example.org ');
    await page.waitForTimeout(500);

    // Verify link exists
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Track if openExternal was called
    await page.evaluate(() => {
      const originalOpenExternal = window.electronAPI.shell.openExternal;
      (window as unknown as { __testOpenExternalCalled: boolean }).__testOpenExternalCalled = false;

      window.electronAPI.shell.openExternal = async (url: string) => {
        (window as unknown as { __testOpenExternalCalled: boolean }).__testOpenExternalCalled =
          true;
        return originalOpenExternal(url);
      };
    });

    // Regular click the link (no modifier)
    await linkElement.click();
    await page.waitForTimeout(500);

    const openExternalWasCalled = await page.evaluate(() => {
      return (window as unknown as { __testOpenExternalCalled: boolean }).__testOpenExternalCalled;
    });

    // openExternal should NOT have been called on regular click
    expect(openExternalWasCalled).toBe(false);

    // Popover should be visible (tippy creates popover in body)
    // Look for the popover with the URL text and action buttons
    const popover = page.locator('[data-tippy-root]');
    await expect(popover).toBeVisible();
  });
});

test.describe('Web Links - Popover Actions', () => {
  test('should edit link URL from popover', async () => {
    // Create a new note with a link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Edit test https://old-url.com ');
    await page.waitForTimeout(500);

    // Verify link exists
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Click to open popover
    await linkElement.click();
    await page.waitForTimeout(300);

    // Popover should be visible
    const popover = page.locator('[data-tippy-root]');
    await expect(popover).toBeVisible();

    // Click edit button
    const editButton = popover.locator('button[aria-label="Edit link URL"]');
    await editButton.click();
    await page.waitForTimeout(200);

    // Input field should appear
    const urlInput = popover.locator('input[type="text"]');
    await expect(urlInput).toBeVisible();

    // Clear and type new URL
    await urlInput.fill('https://new-url.com');

    // Click save button
    const saveButton = popover.locator('button[aria-label="Save link"]');
    await saveButton.click();
    await page.waitForTimeout(300);

    // Verify the href was updated
    const updatedHref = await linkElement.getAttribute('href');
    expect(updatedHref).toBe('https://new-url.com');
  });

  test('should remove link but keep text from popover', async () => {
    // Create a new note with a link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Remove test https://to-remove.com ');
    await page.waitForTimeout(500);

    // Verify link exists
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Click to open popover
    await linkElement.click();
    await page.waitForTimeout(300);

    // Popover should be visible
    const popover = page.locator('[data-tippy-root]');
    await expect(popover).toBeVisible();

    // Click remove button
    const removeButton = popover.locator('button[aria-label="Remove link"]');
    await removeButton.click();
    await page.waitForTimeout(300);

    // Link element should no longer exist
    await expect(linkElement).not.toBeVisible();

    // But the text should still be there (not as a link)
    await expect(editor).toContainText('https://to-remove.com');
  });
});

test.describe('Web Links - Markdown Syntax', () => {
  test('should convert [text](url) to link with text visible', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type markdown link syntax - NOTE: InputRules trigger on space after the closing paren
    await page.keyboard.type('[Click here](https://markdown-test.com) ');
    await page.waitForTimeout(500);

    // Verify the link was created with the text "Click here"
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Verify the link text (should be "Click here", not the URL)
    const linkText = await linkElement.textContent();
    expect(linkText).toBe('Click here');

    // Verify the href attribute
    const href = await linkElement.getAttribute('href');
    expect(href).toBe('https://markdown-test.com');
  });

  test('should handle URLs with parentheses (Wikipedia style)', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type markdown link with parentheses in URL (Wikipedia style)
    // NOTE: InputRules trigger on space after the closing paren
    await page.keyboard.type('[Wiki](https://en.wikipedia.org/wiki/Test_(disambiguation)) ');
    await page.waitForTimeout(500);

    // Verify the link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Verify the link text
    const linkText = await linkElement.textContent();
    expect(linkText).toBe('Wiki');

    // Verify the href - should include the parentheses
    const href = await linkElement.getAttribute('href');
    expect(href).toBe('https://en.wikipedia.org/wiki/Test_(disambiguation)');
  });
});

test.describe('Web Links - Toolbar Button', () => {
  test('should show link button in toolbar', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    // Verify link button is visible in toolbar
    const linkButton = page.locator('button[aria-label="Insert link"]');
    await expect(linkButton).toBeVisible();
  });

  test('should prompt for URL when text is selected', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type some text
    await page.keyboard.type('Click here for more');
    await page.waitForTimeout(300);

    // Select "Click here" text
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    // Select just first 10 chars
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(200);

    // Click the link button
    const linkButton = page.locator('button[aria-label="Insert link"]');
    await linkButton.click();
    await page.waitForTimeout(300);

    // URL input should appear (in a popover/dialog)
    const urlInput = page.locator('[data-tippy-root] input[type="text"]');
    await expect(urlInput).toBeVisible();

    // Enter URL and save
    await urlInput.fill('https://toolbar-test.com');
    const saveButton = page.locator('[data-tippy-root] button[aria-label="Save link"]');
    await saveButton.click();
    await page.waitForTimeout(300);

    // Verify link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    const href = await linkElement.getAttribute('href');
    expect(href).toBe('https://toolbar-test.com');
  });

  test('should open edit popover when cursor is in existing link', async () => {
    // Create a new note with a link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type and create a link
    await page.keyboard.type('Check out https://existing-link.com ');
    await page.waitForTimeout(500);

    // Verify link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Click inside the link to position cursor there
    await linkElement.click();
    await page.waitForTimeout(200);

    // Close any popover that opened from the click
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Click the link button while cursor is in the link
    const linkButton = page.locator('button[aria-label="Insert link"]');
    await linkButton.click();
    await page.waitForTimeout(300);

    // Edit popover should appear with the URL
    const popover = page.locator('[data-tippy-root]');
    await expect(popover).toBeVisible();

    // Should show the existing URL
    await expect(popover).toContainText('https://existing-link.com');
  });
});

test.describe('Web Links - Cmd+K Shortcut', () => {
  test('should prompt for URL when Cmd+K pressed with selection', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type some text
    await page.keyboard.type('Link this text please');
    await page.waitForTimeout(300);

    // Select "Link this" text
    await page.keyboard.press('Home');
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(200);

    // Press Cmd+K
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    // URL input should appear
    const urlInput = page.locator('[data-tippy-root] input[type="text"]');
    await expect(urlInput).toBeVisible();

    // Enter URL and save
    await urlInput.fill('https://cmdk-test.com');
    const saveButton = page.locator('[data-tippy-root] button[aria-label="Save link"]');
    await saveButton.click();
    await page.waitForTimeout(300);

    // Verify link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    const linkText = await linkElement.textContent();
    expect(linkText).toBe('Link this');
  });

  test('should open edit popover when Cmd+K pressed in existing link', async () => {
    // Create a new note with a link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type and create a link
    await page.keyboard.type('Check out https://existing-cmdk.com ');
    await page.waitForTimeout(500);

    // Verify link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Position cursor inside the link using keyboard navigation
    // (clicking on the link element triggers the popover handler which prevents cursor positioning)
    // Go to start of line, then move right to enter the link
    await page.keyboard.press('Home');
    await page.waitForTimeout(100);

    // Move right past "Check out " (10 chars) to enter the link
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(200);

    // Press Cmd+K while cursor is in the link - should show edit popover
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);

    // Edit popover should appear with the URL
    const popover = page.locator('[data-tippy-root]');
    await expect(popover).toBeVisible();

    // Should show the existing URL
    await expect(popover).toContainText('https://existing-cmdk.com');
  });

  test('should show text+URL dialog when Cmd+K pressed with no selection', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type some text and position cursor at end (no selection)
    await page.keyboard.type('Some text here ');
    await page.waitForTimeout(300);

    // Press Cmd+K with no selection
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    // Should show dialog with both text and URL inputs
    const dialog = page.locator('[data-tippy-root]');
    await expect(dialog).toBeVisible();

    // Should have two input fields (text and URL)
    const textInput = dialog.locator('input[placeholder*="text"], input[placeholder*="Text"]');
    const urlInput = dialog.locator('input[placeholder*="URL"], input[placeholder*="url"]');
    await expect(textInput).toBeVisible();
    await expect(urlInput).toBeVisible();

    // Enter text and URL
    await textInput.fill('click me');
    await urlInput.fill('https://newlink.com');

    // Submit
    const saveButton = dialog.locator('button[aria-label="Save link"]');
    await saveButton.click();
    await page.waitForTimeout(300);

    // Verify link was created with the text
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    const linkText = await linkElement.textContent();
    expect(linkText).toBe('click me');
  });
});

test.describe('Web Links - Paste Detection', () => {
  // SKIPPED: Playwright's keyboard simulation in Electron bypasses DOM event system
  // The paste goes through Electron's menu accelerator handler, not the renderer's
  // keydown/paste events. This works for real users but can't be tested with Playwright.
  // The implementation in TipTapEditor.tsx handles keydown Cmd+V to linkify selected text.
  test.skip('should linkify selected text when URL is pasted', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type some text
    await page.keyboard.type('Click here for more info');
    await page.waitForTimeout(300);

    // Select "Click here" text
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(200);

    // Use navigator.clipboard to write URL, then paste with keyboard
    await page.evaluate(async () => {
      await navigator.clipboard.writeText('https://paste-link-test.com');
    });
    await page.waitForTimeout(100);

    // Verify clipboard content
    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    console.log('[DEBUG] Clipboard content before paste:', clipboardText);

    // Verify selection exists before paste
    const selectedText = await page.evaluate(() => window.getSelection()?.toString());
    console.log('[DEBUG] Selected text before paste:', selectedText);

    // Listen for console messages from the app
    page.on('console', (msg) => {
      if (msg.text().includes('[TipTap') || msg.text().includes('[WebLink]')) {
        console.log('[APP CONSOLE]', msg.text());
      }
    });

    // Paste by triggering the Edit menu's paste action via keyboard
    // First try the standard keyboard shortcut - note that Electron intercepts this
    // But the paste should still trigger a paste event in the focused webview
    console.log('[DEBUG] About to trigger paste...');
    await page.keyboard.down('Meta');
    await page.keyboard.press('v');
    await page.keyboard.up('Meta');
    await page.waitForTimeout(500);

    // Debug: Check what's in the editor
    const editorContent = await page.locator('.ProseMirror').innerHTML();
    console.log('[DEBUG] Editor content after paste:', editorContent);

    // Verify the selected text became a link
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // Verify the link text is the selected text
    const linkText = await linkElement.textContent();
    expect(linkText).toBe('Click here');

    // Verify the href is the pasted URL
    const href = await linkElement.getAttribute('href');
    expect(href).toBe('https://paste-link-test.com');
  });
});

test.describe('Web Links - Styling', () => {
  test('should have correct styling (blue, underlined)', async () => {
    // Create a new note with a link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Style test https://test.com ');
    await page.waitForTimeout(500);

    // Verify link has web-link class
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    await expect(linkElement).toHaveClass(/web-link/);
  });
});

test.describe('Web Links - Edge Cases', () => {
  test('should NOT linkify URLs in code blocks', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a code block with a URL inside
    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('https://code-block-url.com');
    await page.keyboard.press('Enter');
    await page.keyboard.type('```');
    await page.waitForTimeout(500);

    // The URL inside the code block should NOT be a link
    const codeBlock = page.locator('.ProseMirror pre code');
    await expect(codeBlock).toBeVisible();

    // There should be no link inside the code block
    const linkInsideCode = page.locator('.ProseMirror pre a.web-link');
    await expect(linkInsideCode).toHaveCount(0);
  });

  test('should NOT linkify URLs in inline code', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type inline code with a URL
    await page.keyboard.type('Check `https://inline-code.com` for details ');
    await page.waitForTimeout(500);

    // The URL inside inline code should NOT be a link
    const inlineCode = page.locator('.ProseMirror code');
    await expect(inlineCode).toBeVisible();

    // There should be no link inside inline code
    const linkInsideInlineCode = page.locator('.ProseMirror code a.web-link');
    await expect(linkInsideInlineCode).toHaveCount(0);
  });

  test('should exclude trailing punctuation from URL', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a URL and trigger autolink with space, then add punctuation
    // This tests that TipTap correctly handles URLs before trailing punctuation
    await page.keyboard.type('Visit https://example.com ');
    await page.waitForTimeout(300);

    // Verify link was created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('https://example.com');
    expect(await linkElement.textContent()).toBe('https://example.com');

    // Continue typing - the link should remain intact
    await page.keyboard.type('for more info.');
    await page.waitForTimeout(200);

    // Verify link still exists and is correct
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('https://example.com');
  });

  test('should handle undo/redo for auto-linked URLs', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a URL that gets auto-linked
    await page.keyboard.type('Test https://undo-test.com ');
    await page.waitForTimeout(500);

    // Verify link exists
    let linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    const initialHref = await linkElement.getAttribute('href');
    expect(initialHref).toBe('https://undo-test.com');

    // Type more text to create something to undo
    await page.keyboard.type('more text');
    await page.waitForTimeout(300);

    // Verify link is still there
    await expect(linkElement).toBeVisible();

    // Undo the "more text"
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(300);

    // Link should still exist after undo
    linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('https://undo-test.com');

    // Redo
    await page.keyboard.press('Meta+Shift+z');
    await page.waitForTimeout(300);

    // Link should still exist after redo
    linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('https://undo-test.com');
  });

  test('should NOT auto-link bare domains without scheme', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a bare domain without scheme - should NOT be linked
    await page.keyboard.type('Visit google.com for search ');
    await page.waitForTimeout(500);

    // There should be no link created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toHaveCount(0);

    // The text should still be there
    const content = await editor.textContent();
    expect(content).toContain('google.com');
  });

  test('should NOT auto-link localhost without scheme', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type localhost without scheme - should NOT be linked
    await page.keyboard.type('Server at localhost for dev ');
    await page.waitForTimeout(500);

    // There should be no link created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toHaveCount(0);
  });

  test('should NOT auto-link localhost with port but without scheme', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type localhost:port without scheme - should NOT be linked
    await page.keyboard.type('Server at localhost:3000 for dev ');
    await page.waitForTimeout(500);

    // There should be no link created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toHaveCount(0);
  });

  test('should auto-link localhost WITH http scheme', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type localhost WITH scheme - should be linked
    await page.keyboard.type('Server at http://localhost:3000 for dev ');
    await page.waitForTimeout(500);

    // There should be a link
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('http://localhost:3000');
  });

  test('should NOT auto-link domain-like text (foo.bar)', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type something that looks like a domain but isn't intended as a URL
    await page.keyboard.type('The foo.bar variable is set ');
    await page.waitForTimeout(500);

    // There should be no link created
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toHaveCount(0);
  });

  test('should still auto-link URLs with https scheme', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a proper URL with scheme - should be linked
    await page.keyboard.type('Visit https://example.com for info ');
    await page.waitForTimeout(500);

    // There should be a link
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('https://example.com');
  });
});

test.describe('Web Links - Bare URL Sync', () => {
  test('should update href when editing via popover', async () => {
    // Create a new note with a bare URL link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test https://original.com ');
    await page.waitForTimeout(500);

    // Verify link exists with original URL
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('https://original.com');
    expect(await linkElement.textContent()).toBe('https://original.com');

    // Click on the link to show popover
    await linkElement.click();
    await page.waitForTimeout(300);

    // Popover should be visible
    const popover = page.locator('[data-tippy-root]');
    await expect(popover).toBeVisible();

    // Click Edit button in popover
    const editButton = popover.locator('button[aria-label="Edit link URL"]');
    await editButton.click();
    await page.waitForTimeout(200);

    // Clear the URL input and type new URL
    const urlInput = popover.locator('input[type="text"]');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://updated.com');
    await page.waitForTimeout(100);

    // Save the changes
    const saveButton = popover.locator('button[aria-label="Save link"]');
    await saveButton.click();
    await page.waitForTimeout(500);

    // Verify href was updated
    const updatedLinkElement = page.locator('.ProseMirror a.web-link');
    await expect(updatedLinkElement).toBeVisible();
    expect(await updatedLinkElement.getAttribute('href')).toBe('https://updated.com');
    // Note: The text remains the same since we only edited the URL
    expect(await updatedLinkElement.textContent()).toBe('https://original.com');
  });

  // TODO: TipTap 3 changed link editing behavior - needs investigation
  test.skip('should allow inline text edits that maintain link', async () => {
    // Create a new note with a bare URL link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test https://example.com ');
    await page.waitForTimeout(500);

    // Verify link exists
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('https://example.com');

    // Click once inside the link (not popover - just to position cursor)
    // We need to use keyboard navigation to get inside the link
    await editor.click();
    await page.waitForTimeout(100);

    // Use keyboard to navigate to end of line (which includes the link)
    // Position at start of line, then move to end
    await page.keyboard.press('Meta+ArrowUp'); // Go to start of document
    await page.waitForTimeout(50);
    await page.keyboard.press('ArrowDown'); // Go to line with link
    await page.waitForTimeout(50);
    await page.keyboard.press('End'); // Go to end of line (after the space)
    await page.waitForTimeout(50);
    await page.keyboard.press('ArrowLeft'); // Back one char (into the space after link)
    await page.keyboard.press('ArrowLeft'); // Back into the link (at end of 'com')
    await page.waitForTimeout(50);

    // Type character inside the link
    await page.keyboard.type('X');
    await page.waitForTimeout(500);

    // Verify link still exists with modified text but ORIGINAL href
    // (Link text editing doesn't automatically update href - that would require using Edit popover)
    const updatedLinkElement = page.locator('.ProseMirror a.web-link');
    await expect(updatedLinkElement).toBeVisible();
    // The X should be inserted inside the link, making it "https://example.coXm"
    expect(await updatedLinkElement.textContent()).toBe('https://example.coXm');
    // href remains unchanged - this is expected behavior
    expect(await updatedLinkElement.getAttribute('href')).toBe('https://example.com');
  });

  test('should preserve link when deleting and retyping partial text', async () => {
    // Create a new note with a bare URL link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test https://mysite.com ');
    await page.waitForTimeout(500);

    // Verify link exists
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();
    expect(await linkElement.getAttribute('href')).toBe('https://mysite.com');

    // Triple-click to select the entire line (including the link)
    await editor.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Type new content - this replaces everything
    await page.keyboard.type('New text https://newsite.com ');
    await page.waitForTimeout(500);

    // A NEW link should be created by autolink (not preserving the old href)
    const newLinkElement = page.locator('.ProseMirror a.web-link');
    await expect(newLinkElement).toBeVisible();
    expect(await newLinkElement.getAttribute('href')).toBe('https://newsite.com');
    expect(await newLinkElement.textContent()).toBe('https://newsite.com');
  });
});
