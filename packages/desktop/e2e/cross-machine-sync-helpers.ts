/**
 * Shared utilities for cross-machine sync E2E tests
 *
 * Common helpers and setup functions used across multiple test files.
 */

import { ElectronApplication, Page } from 'playwright';

/**
 * Helper to get the first window with a longer timeout.
 * The default firstWindow() timeout is 30 seconds, which can be flaky on slower machines.
 */
export async function getFirstWindow(app: ElectronApplication, timeoutMs = 60000): Promise<Page> {
  return app.waitForEvent('window', { timeout: timeoutMs });
}

/**
 * Type content in chunks with pauses to simulate human typing and trigger multiple sync operations.
 *
 * From QUESTIONS-1.md Q5: The goal is "ensuring that multiple sync operations have occurred on the note,
 * not that icloud syncs all the edits in one go."
 *
 * This function types content in chunks with pauses between them to trigger multiple
 * file sync operations, simulating how iCloud might sync a note incrementally rather than
 * all at once.
 */
export async function typeWithMultipleSyncs(window: Page, text: string): Promise<void> {
  // Split text into words
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordToType = i === 0 ? word! : ' ' + word!;

    // Type the word using keyboard input
    await window.keyboard.type(wordToType!);

    // Wait after each word (except the last one) to trigger multiple sync operations
    if (i < words.length - 1) {
      // 3-5 second pause to allow sync to trigger
      const pause = 3000 + Math.random() * 2000;
      console.log(`[Human Typing] Pausing for ${(pause / 1000).toFixed(1)}s to allow sync...`);
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  }
}
