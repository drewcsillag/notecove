#!/usr/bin/env node

/**
 * Build script for iOS JavaScriptCore bundle
 *
 * Bundles packages/shared into a single JavaScript file that can be
 * loaded into JavaScriptCore on iOS.
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function build() {
  const outDir = path.join(__dirname, '../dist/ios');
  const outFile = path.join(outDir, 'notecove-bridge.js');

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('🔨 Building iOS bundle...');
  console.log(`   Entry: src/ios-bridge.ts`);
  console.log(`   Output: ${outFile}`);

  try {
    const result = await esbuild.build({
      entryPoints: [path.join(__dirname, '../src/ios-bridge.ts')],
      bundle: true,
      format: 'iife', // Immediately-invoked function expression (browser-compatible)
      globalName: 'NoteCoveBridgeModule', // Wrap in a global variable
      platform: 'browser', // Target browser (not Node.js)
      target: ['es2020'], // Modern JavaScript, JavaScriptCore supports this
      outfile: outFile,
      minify: false, // Keep readable for debugging
      sourcemap: false, // No sourcemaps needed for iOS
      treeShaking: true, // Remove unused code
      logLevel: 'info',

      // Define global replacements
      define: {
        'process.env.NODE_ENV': '"production"',
      },

      // External dependencies that should NOT be bundled
      // (None for now - we want everything bundled)
      external: [],
    });

    // Get bundle size
    const stats = fs.statSync(outFile);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`✅ Bundle created successfully!`);
    console.log(`   Size: ${sizeKB} KB`);
    console.log(`   Warnings: ${result.warnings.length}`);

    if (result.warnings.length > 0) {
      console.warn('\n⚠️  Warnings:');
      for (const warning of result.warnings) {
        console.warn(`   ${warning.text}`);
      }
    }

    // Copy to iOS app directory
    const iOSAppPath = path.join(__dirname, '../../../ios/Sources/Resources');
    if (fs.existsSync(path.dirname(iOSAppPath))) {
      if (!fs.existsSync(iOSAppPath)) {
        fs.mkdirSync(iOSAppPath, { recursive: true });
      }
      const destFile = path.join(iOSAppPath, 'notecove-bridge.js');
      fs.copyFileSync(outFile, destFile);
      console.log(`📦 Copied to iOS app: ${destFile}`);
    } else {
      console.log(`ℹ️  iOS app directory not found, skipping copy`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
