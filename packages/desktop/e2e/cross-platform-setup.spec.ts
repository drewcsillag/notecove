/**
 * Cross-platform e2e test - Setup phase
 * Desktop creates a note in shared storage for iOS to read
 */

import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import path from 'path'

test.describe('Cross-Platform Setup (Desktop)', () => {
  test('desktop creates a note in shared storage', async () => {
    // Get shared storage directory from environment variable
    const sharedSD = process.env.NOTECOVE_CROSS_PLATFORM_SD
    expect(sharedSD).toBeTruthy()

    console.log('[Desktop] Using shared SD:', sharedSD)

    // Create note directory structure
    const noteId = 'cross-platform-note-1'
    const noteDir = path.join(sharedSD!, noteId)
    const updatesDir = path.join(noteDir, 'updates')
    const snapshotsDir = path.join(noteDir, 'snapshots')
    const packsDir = path.join(noteDir, 'packs')
    const metaDir = path.join(noteDir, 'meta')

    // Create directories
    await fs.mkdir(noteDir, { recursive: true })
    await fs.mkdir(updatesDir, { recursive: true })
    await fs.mkdir(snapshotsDir, { recursive: true })
    await fs.mkdir(packsDir, { recursive: true })
    await fs.mkdir(metaDir, { recursive: true })

    console.log('[Desktop] Created note directories')

    // Create a simple CRDT update file with title
    // For now, we'll create a minimal Yjs update
    // In a real scenario, this would be a proper Yjs document with content
    const updateContent = Buffer.from(
      JSON.stringify({
        note: 'Cross-Platform Test Note',
        timestamp: Date.now()
      })
    )

    const updateFile = path.join(updatesDir, `desktop-initial-${Date.now()}.yjson`)
    await fs.writeFile(updateFile, updateContent)

    console.log('[Desktop] Created update file:', updateFile)

    // Verify files exist
    const noteExists = await fs.access(noteDir).then(() => true).catch(() => false)
    const updateExists = await fs.access(updateFile).then(() => true).catch(() => false)

    expect(noteExists).toBe(true)
    expect(updateExists).toBe(true)

    console.log('[Desktop] ✅ Setup complete - note ready for iOS to read')
  })
})
