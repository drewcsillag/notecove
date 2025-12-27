#!/usr/bin/env node

/**
 * Build script for iOS TipTap editor bundle
 *
 * Bundles TipTap, Y.js, and extensions into a single JavaScript file
 * that can be loaded in WKWebView without ES module imports.
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function build() {
  const outDir = path.join(__dirname, '../../ios/Sources/Resources');
  const outFile = path.join(outDir, 'tiptap-bundle.js');

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('🔨 Building TipTap editor bundle...');
  console.log(`   Output: ${outFile}`);

  // Create a temporary entry file that imports everything we need
  const entryContent = `
// TipTap core and extensions
// Note: TipTap 3 includes Underline in StarterKit, no separate import needed
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';

// Y.js for CRDT
import * as Y from 'yjs';
import * as YProsemirror from 'y-prosemirror';

// Export to global scope for use in HTML
window.TipTap = {
  Editor,
  StarterKit,
  Collaboration,
};

window.Y = Y;
window.YProsemirror = YProsemirror;

console.log('✅ TipTap bundle loaded successfully');
`;

  const tempEntry = path.join(__dirname, '../.temp-editor-entry.js');
  fs.writeFileSync(tempEntry, entryContent);

  try {
    await esbuild.build({
      entryPoints: [tempEntry],
      bundle: true,
      format: 'iife', // Browser-compatible
      platform: 'browser',
      target: ['es2020'],
      outfile: outFile,
      minify: false, // Keep readable for debugging
      sourcemap: false,
      treeShaking: true,
      logLevel: 'info',
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    });

    // Clean up temp file
    fs.unlinkSync(tempEntry);

    console.log('✅ TipTap editor bundle built successfully');
    console.log(`   Size: ${(fs.statSync(outFile).size / 1024).toFixed(2)} KB`);
  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempEntry)) {
      fs.unlinkSync(tempEntry);
    }
    throw error;
  }
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
