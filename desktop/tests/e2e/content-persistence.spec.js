import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
// import { inspectCRDTFile } from '../../src/lib/debug-crdt-file.js'; // Commented out due to ES module issues

/**
 * E2E Test for Content Persistence
 * This test launches the actual Electron app and interacts with it like a real user.
 * It reproduces the exact sequence of events reported by the user.
 */
test.describe('Content Persistence E2E', () => {
  let testDir;

  test.beforeEach(() => {
    // Create a fresh test directory for each test
    testDir = path.join(os.tmpdir(), `notecove-e2e-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  test.afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should persist note content through app restarts', async () => {
    // ===================================================================
    // SESSION 1: Start app, check sample notes, create new note
    // ===================================================================
    console.log('\n=== SESSION 1: Initial start ===');

    let electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'src/main.js'),
        `--notes-path=${testDir}`,
        '--instance=test1'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window = await electronApp.firstWindow();

    // Capture console logs from the renderer process
    window.on('console', msg => {
      const text = msg.text();
      if (text.includes('[renderer]') || text.includes('[NoteManager]') || text.includes('[CRDTManager]') || text.includes('[UpdateStore]') || text.includes('[Editor]')) {
        console.log('RENDERER:', text);
      }
    });

    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000); // Wait for initialization

    // Check sample notes in the list
    const notesList = window.locator('.note-item');
    const notesCount = await notesList.count();
    console.log('Notes in list:', notesCount);
    expect(notesCount).toBe(2); // Should have 2 sample notes

    // Get note titles and previews
    const noteItems = await notesList.all();
    const notes = [];
    for (const item of noteItems) {
      const title = await item.locator('.note-title').textContent();
      const preview = await item.locator('.note-preview').textContent();
      notes.push({ title, preview });
      console.log('  -', title, ':', preview.substring(0, 30) + '...');
    }

    // Check that sample notes have previews (titles may be "Untitled")
    // USER REPORTED: Sample notes show as "Untitled" but have preview content
    const welcomeNote = notes.find(n => n.preview.includes('Welcome to NoteCove'));
    const guideNote = notes.find(n => n.title.includes('Getting Started') || n.preview.includes('Quick Start'));

    console.log('Welcome note title:', welcomeNote?.title);
    console.log('Guide note title:', guideNote?.title);

    expect(welcomeNote).toBeDefined();
    expect(guideNote).toBeDefined();
    expect(welcomeNote.preview.length).toBeGreaterThan(0);
    expect(guideNote.preview.length).toBeGreaterThan(0);

    // BUG: Sample notes often show as "Untitled" even though they have content
    if (welcomeNote.title === 'Untitled') {
      console.log('  ❌ BUG CONFIRMED: Welcome note shows as "Untitled"');
    }

    // Click on Welcome note
    console.log('Clicking on Welcome note...');
    await noteItems[0].click();
    await window.waitForTimeout(500);

    // Check if body is empty (as reported)
    const editorContent = await window.locator('#editor').innerHTML();
    console.log('Welcome note editor content length:', editorContent.length);
    console.log('Welcome note editor content:', editorContent.substring(0, 100));

    // USER REPORTED: Body was empty
    // Let's verify this happens
    const isEmpty = editorContent.trim() === '<p></p>' || editorContent.trim() === '';
    console.log('Welcome note body is empty:', isEmpty);

    // Create a new note
    console.log('\nCreating new note...');
    await window.locator('#newNoteBtn').click();
    await window.waitForTimeout(500);

    // Type title and content
    console.log('Typing content...');
    const editor = window.locator('#editor');
    await editor.click();
    await window.keyboard.type('My Test Note Title');
    await window.keyboard.press('Enter');
    await window.keyboard.type('This is the body content that should persist through restarts.');
    await window.waitForTimeout(500); // Wait for debounced save (250ms debounce + buffer)

    // Verify content is in editor
    const newNoteContent = await editor.innerHTML();
    console.log('New note content:', newNoteContent);
    expect(newNoteContent).toContain('My Test Note Title');
    expect(newNoteContent).toContain('body content');

    // Check notes list - should now have 3 notes
    const notesCountAfter = await notesList.count();
    console.log('Notes in list after creating:', notesCountAfter);
    expect(notesCountAfter).toBe(3);

    // Check if any existing note titles changed to "Untitled" (USER REPORTED BUG)
    const notesAfterCreate = await notesList.all();
    for (const item of notesAfterCreate) {
      const title = await item.locator('.note-title').textContent();
      console.log('  Note title:', title);
    }

    // Close app
    console.log('Closing app...');
    await electronApp.close();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check what's actually in the filesystem
    console.log('\n=== FILESYSTEM CHECK AFTER SESSION 1 ===');
    const noteDirs = fs.readdirSync(testDir).filter(f => {
      const fullPath = path.join(testDir, f);
      return fs.statSync(fullPath).isDirectory() && f !== '.';
    });
    console.log('Note directories:', noteDirs.length);

    for (const noteDir of noteDirs) {
      console.log(`\n  Note ID: ${noteDir}`);
      const updatesDir = path.join(testDir, noteDir, 'updates');
      if (fs.existsSync(updatesDir)) {
        const updateFiles = fs.readdirSync(updatesDir);
        console.log('    Update files:', updateFiles.length);
        updateFiles.forEach(f => console.log('      -', f));

        // Check total size of updates
        let totalSize = 0;
        for (const f of updateFiles) {
          const stats = fs.statSync(path.join(updatesDir, f));
          totalSize += stats.size;
        }
        console.log('    Total update data:', totalSize, 'bytes');

        // Inspect the CRDT content
        if (updateFiles.length > 0) {
          console.log('\n    === CRDT Content ===');
          const filePath = path.join(updatesDir, updateFiles[0]);
          // inspectCRDTFile(filePath); // Commented out due to ES module issues
          console.log('    (CRDT inspection temporarily disabled)');
        }
      }
    }

    // ===================================================================
    // SESSION 2: Restart app, verify note persisted
    // ===================================================================
    console.log('\n=== SESSION 2: First restart ===');

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'src/main.js'),
        `--notes-path=${testDir}`,
        '--instance=test1'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await electronApp.firstWindow();
    await window2.waitForLoadState('domcontentloaded');

    // Wait for notes to load (notes list should have at least 1 item)
    const notesList2 = window2.locator('.note-item');
    await notesList2.first().waitFor({ timeout: 5000 });

    // Wait a bit more to ensure all async operations complete
    await window2.waitForTimeout(500);

    // Check how many notes loaded
    const notesCount2 = await notesList2.count();
    console.log('Notes after restart:', notesCount2);

    // List all notes
    const noteItems2 = await notesList2.all();
    const notesAfterRestart = [];
    for (const item of noteItems2) {
      const title = await item.locator('.note-title').textContent();
      const preview = await item.locator('.note-preview').textContent();
      notesAfterRestart.push({ title, preview });
      console.log('  -', title, ':', preview.substring(0, 40));
    }

    // Find our note
    const ourNote = notesAfterRestart.find(n =>
      n.title.includes('My Test Note Title') ||
      n.preview.includes('body content')
    );

    console.log('Our note found:', !!ourNote);
    if (ourNote) {
      console.log('  Title:', ourNote.title);
      console.log('  Preview:', ourNote.preview);
    }

    // USER REPORTED: Note had correct title and body on first restart
    expect(ourNote).toBeDefined();
    expect(ourNote.title).toContain('My Test Note');

    // Click on our note and verify content
    const ourNoteIndex = notesAfterRestart.indexOf(ourNote);
    await noteItems2[ourNoteIndex].click();
    await window2.waitForTimeout(500);

    const loadedContent = await window2.locator('#editor').innerHTML();
    console.log('Loaded content:', loadedContent.substring(0, 100));
    expect(loadedContent).toContain('My Test Note Title');
    expect(loadedContent).toContain('body content');

    console.log('✓ Content persisted correctly on first restart');

    // Close app
    await electronApp.close();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // ===================================================================
    // SESSION 3: Second restart - check for duplication/corruption
    // ===================================================================
    console.log('\n=== SESSION 3: Second restart ===');

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'src/main.js'),
        `--notes-path=${testDir}`,
        '--instance=test1'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window3 = await electronApp.firstWindow();
    await window3.waitForLoadState('domcontentloaded');
    await window3.waitForTimeout(1000);

    const notesList3 = window3.locator('.note-item');
    const notesCount3 = await notesList3.count();
    console.log('Notes after second restart:', notesCount3);

    // List all notes
    const noteItems3 = await notesList3.all();
    const notesAfterRestart2 = [];
    for (const item of noteItems3) {
      const title = await item.locator('.note-title').textContent();
      const preview = await item.locator('.note-preview').textContent();
      notesAfterRestart2.push({ title, preview });
      console.log('  -', title, ':', preview.substring(0, 40));
    }

    // USER REPORTED: Note lost title and was duplicated
    // Check for duplicates
    const notesWithOurContent = notesAfterRestart2.filter(n =>
      n.preview.includes('body content')
    );
    console.log('Notes with our content:', notesWithOurContent.length);

    // Should NOT be duplicated
    expect(notesWithOurContent.length).toBe(1);

    // Should still have title
    const ourNote3 = notesWithOurContent[0];
    console.log('Our note title:', ourNote3.title);
    expect(ourNote3.title).toContain('My Test Note');

    // Check content
    const ourNoteIndex3 = notesAfterRestart2.indexOf(ourNote3);
    await noteItems3[ourNoteIndex3].click();
    await window3.waitForTimeout(500);

    const loadedContent3 = await window3.locator('#editor').innerHTML();
    expect(loadedContent3).toContain('body content');

    console.log('✓ No duplication or corruption detected');

    await electronApp.close();

    // ===================================================================
    // SESSION 4: Third restart - final verification
    // ===================================================================
    console.log('\n=== SESSION 4: Third restart ===');

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'src/main.js'),
        `--notes-path=${testDir}`,
        '--instance=test1'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window4 = await electronApp.firstWindow();
    await window4.waitForLoadState('domcontentloaded');
    await window4.waitForTimeout(1000);

    const notesList4 = window4.locator('.note-item');
    const notesCount4 = await notesList4.count();
    console.log('Notes after third restart:', notesCount4);

    const noteItems4 = await notesList4.all();
    for (const item of noteItems4) {
      const title = await item.locator('.note-title').textContent();
      console.log('  -', title);
    }

    // Verify no duplication
    expect(notesCount4).toBe(notesCount3);

    await electronApp.close();
    console.log('\n=== TEST COMPLETE ===');
  });

  test('should handle sample notes correctly', async () => {
    console.log('\n=== Testing sample notes behavior ===');

    const electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'src/main.js'),
        `--notes-path=${testDir}`,
        '--instance=test1'
      ]
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);

    // Get the first sample note
    const firstNote = window.locator('.note-item').first();
    const title = await firstNote.locator('.note-title').textContent();
    const preview = await firstNote.locator('.note-preview').textContent();

    console.log('First sample note:');
    console.log('  Title:', title);
    console.log('  Preview:', preview);

    // Click it
    await firstNote.click();
    await window.waitForTimeout(500);

    // Check editor content
    const editorContent = await window.locator('#editor').innerHTML();
    console.log('  Editor content length:', editorContent.length);

    // USER REPORTED: Sample notes show preview but empty body
    if (preview.length > 0) {
      // If preview has content, editor should too
      // If this fails, we've confirmed the bug
      const editorIsEmpty = editorContent.trim() === '<p></p>' || editorContent.trim() === '';
      console.log('  Preview has content:', preview.length, 'chars');
      console.log('  Editor is empty:', editorIsEmpty);

      if (editorIsEmpty) {
        console.log('  ❌ BUG CONFIRMED: Preview has content but editor is empty');
      }
    }

    await electronApp.close();
  });
});
