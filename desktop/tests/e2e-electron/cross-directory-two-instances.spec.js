const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Cross-Directory Move - Two Instances Sync', () => {
  let electronApp1;
  let electronApp2;
  let window1;
  let window2;
  let testDir;
  let primaryDir;
  let secondaryDir;

  test.beforeEach(async () => {
    // Create test directories
    testDir = path.join(os.tmpdir(), 'notecove-two-instances-' + Date.now());
    primaryDir = path.join(testDir, 'primary');
    secondaryDir = path.join(testDir, 'secondary');
    await fs.mkdir(primaryDir, { recursive: true });
    await fs.mkdir(secondaryDir, { recursive: true });

    // Launch first app instance (has both directories)
    electronApp1 = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        '--instance=two-instance-test-1-' + Date.now()
      ],
      env: {
        NODE_ENV: 'test'
      }
    });

    window1 = await electronApp1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');

    // Capture console output from Instance 1
    window1.on('console', msg => {
      if (msg.text().includes('performSync') || msg.text().includes('scanForNewNotes') || msg.text().includes('createNote')) {
        console.log('[Instance 1]', msg.text());
      }
    });

    await window1.waitForTimeout(2000);

    // Launch second app instance (only has primary directory)
    electronApp2 = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        '--instance=two-instance-test-2-' + Date.now()
      ],
      env: {
        NODE_ENV: 'test'
      }
    });

    window2 = await electronApp2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');

    // Capture console output from Instance 2
    window2.on('console', msg => {
      if (msg.text().includes('performSync') || msg.text().includes('scanForNewNotes')) {
        console.log('[Instance 2]', msg.text());
      }
    });

    await window2.waitForTimeout(2000);
  });

  test.afterEach(async () => {
    if (electronApp1) {
      await electronApp1.close();
    }
    if (electronApp2) {
      await electronApp2.close();
    }
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  test('second instance should see note disappear after cross-directory move', async () => {
    // ========== INSTANCE 1: Add both directories ==========
    await window1.click('.settings-btn');
    await window1.waitForTimeout(300);

    // Add primary directory
    let addDirBtn = window1.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window1.waitForTimeout(300);

    let pathInput = window1.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(primaryDir);

    let nameInput = window1.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Primary');

    let addBtn = window1.locator('button#confirmAddDir');
    await addBtn.click();
    await window1.waitForTimeout(500);

    // Add secondary directory
    addDirBtn = window1.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window1.waitForTimeout(300);

    pathInput = window1.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(secondaryDir);

    nameInput = window1.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Secondary');

    addBtn = window1.locator('button#confirmAddDir');
    await addBtn.click();
    await window1.waitForTimeout(500);

    const closeBtn = window1.locator('button#settingsClose');
    await closeBtn.click();
    await window1.waitForTimeout(500);

    // IMPORTANT: Click on Primary directory's All Notes to set currentSyncDirectoryId
    // The Primary directory is the first one added (after default My Notes)
    const primaryGroup = window1.locator('.sync-directory-group').filter({ hasText: 'Primary' });
    const primaryAllNotesInstance1 = primaryGroup.locator('.folder-item').filter({ hasText: 'All Notes' });
    await primaryAllNotesInstance1.click();
    await window1.waitForTimeout(500);

    // ========== INSTANCE 2: Add only primary directory ==========
    await window2.click('.settings-btn');
    await window2.waitForTimeout(300);

    addDirBtn = window2.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window2.waitForTimeout(300);

    pathInput = window2.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(primaryDir);

    nameInput = window2.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Primary');

    addBtn = window2.locator('button#confirmAddDir');
    await addBtn.click();
    await window2.waitForTimeout(500);

    const closeBtn2 = window2.locator('button#settingsClose');
    await closeBtn2.click();
    await window2.waitForTimeout(500);

    // IMPORTANT: Click on Primary directory's All Notes in Instance 2 as well
    const primaryGroup2 = window2.locator('.sync-directory-group').filter({ hasText: 'Primary' });
    const primaryAllNotesInstance2 = primaryGroup2.locator('.folder-item').filter({ hasText: 'All Notes' });
    await primaryAllNotesInstance2.click();
    await window2.waitForTimeout(500);

    // ========== INSTANCE 1: Create a note in primary directory ==========
    await window1.click('#newNoteBtn');
    await window1.waitForTimeout(300);
    await window1.locator('.ProseMirror').click();
    await window1.waitForTimeout(100);
    await window1.keyboard.type('Multi-Instance Test Note');
    await window1.waitForTimeout(1000);

    // Verify note count in Instance 1 - check Primary directory, not default My Notes
    const primaryGroup1Check = window1.locator('.sync-directory-group').filter({ hasText: 'Primary' });
    const primaryAllNotes1Check = primaryGroup1Check.locator('.folder-item').filter({ hasText: 'All Notes' });
    let count1 = await primaryAllNotes1Check.locator('.folder-count').textContent();
    expect(parseInt(count1)).toBe(1);

    // ========== INSTANCE 2: Verify note appears via CRDT sync ==========
    // Wait for CRDT sync to propagate (sync runs every 2 seconds, so wait at least 3 sync cycles)
    await window2.waitForTimeout(7000);

    // Refresh notes in Instance 2 (click on Primary's All Notes to force reload)
    const primaryGroup2Check = window2.locator('.sync-directory-group').filter({ hasText: 'Primary' });
    const primaryAllNotes2Check = primaryGroup2Check.locator('.folder-item').filter({ hasText: 'All Notes' });
    await primaryAllNotes2Check.click();
    await window2.waitForTimeout(500);

    // Verify Instance 2 sees the note
    let count2 = await primaryAllNotes2Check.locator('.folder-count').textContent();
    console.log(`Instance 2 sees ${count2} notes in Primary/All Notes`);
    expect(parseInt(count2)).toBe(1);

    const noteTitles2Before = await window2.locator('.note-item .note-title').allTextContents();
    expect(noteTitles2Before.some(title => title.includes('Multi-Instance Test Note'))).toBe(true);

    // ========== INSTANCE 1: Move note to secondary directory ==========
    // Right-click on note
    const noteItem = window1.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window1.waitForTimeout(300);

    // Click "Move to..."
    const contextMenu = window1.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window1.waitForTimeout(300);

    // Click on "All Notes" in the secondary sync directory
    const secondaryAllNotesPicker = window1.locator('.folder-picker-item')
      .filter({ hasText: 'All Notes' }).nth(1);
    await secondaryAllNotesPicker.click();
    await window1.waitForTimeout(500);

    // Confirm the move
    await window1.click('#crossDirectoryMoveConfirm');
    await window1.waitForTimeout(1000);

    // Verify in Instance 1: Note moved from primary to secondary
    const primaryGroupAfter1 = window1.locator('.sync-directory-group').filter({ hasText: 'Primary' });
    const primaryAllNotesAfter1 = primaryGroupAfter1.locator('.folder-item').filter({ hasText: 'All Notes' });
    const primaryCountAfter1 = await primaryAllNotesAfter1.locator('.folder-count').textContent();
    expect(parseInt(primaryCountAfter1)).toBe(0);

    const secondaryGroup1 = window1.locator('.sync-directory-group').filter({ hasText: 'Secondary' });
    const secondaryAllNotes1 = secondaryGroup1.locator('.folder-item').filter({ hasText: 'All Notes' });
    const secondaryCount1 = await secondaryAllNotes1.locator('.folder-count').textContent();
    expect(parseInt(secondaryCount1)).toBe(1);

    // ========== INSTANCE 2: Verify note disappears via CRDT sync ==========
    // Wait for CRDT sync to propagate the deletion (wait at least 3 sync cycles)
    await window2.waitForTimeout(7000);

    // Refresh notes in Instance 2 (click on Primary's All Notes again)
    await primaryAllNotes2Check.click();
    await window2.waitForTimeout(500);

    // Verify Instance 2 no longer sees the note in All Notes
    const primaryCountAfter2 = await primaryAllNotes2Check.locator('.folder-count').textContent();
    expect(parseInt(primaryCountAfter2)).toBe(0);

    // Verify note doesn't appear in notes list
    const notesList2After = window2.locator('.note-item');
    const noteCount2After = await notesList2After.count();

    if (noteCount2After > 0) {
      const noteTitles2After = await window2.locator('.note-item .note-title').allTextContents();
      expect(noteTitles2After.every(title => !title.includes('Multi-Instance Test Note'))).toBe(true);
    } else {
      expect(noteCount2After).toBe(0);
    }

    // ========== INSTANCE 2: Verify note appears in Primary's Recently Deleted ==========
    const primaryGroup2Trash = window2.locator('.sync-directory-group').filter({ hasText: 'Primary' });
    const recentlyDeleted2 = primaryGroup2Trash.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await recentlyDeleted2.click();
    await window2.waitForTimeout(500);

    // Check that Recently Deleted shows 1 note
    const trashCount2 = await recentlyDeleted2.locator('.folder-count').textContent();
    expect(parseInt(trashCount2)).toBe(1);

    // Verify the deleted note appears in Recently Deleted list
    const deletedNotes = await window2.locator('.note-item .note-title').allTextContents();
    expect(deletedNotes.some(title => title.includes('Multi-Instance Test Note'))).toBe(true);
  });
});
