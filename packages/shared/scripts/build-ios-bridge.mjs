#!/usr/bin/env node
/**
 * Build script for iOS JavaScriptCore bridge bundle
 *
 * Creates a single self-contained JavaScript file that can be loaded
 * into JavaScriptCore on iOS. All dependencies (yjs, lib0, etc.) are
 * bundled inline.
 */

import * as esbuild from 'esbuild';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Output directory
const outDir = join(projectRoot, 'dist', 'ios');
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: [join(projectRoot, 'src', 'ios-bridge.ts')],
      bundle: true,
      format: 'iife',
      globalName: '__iosBridgeModule',
      outfile: join(outDir, 'ios-bridge-bundle.js'),
      target: 'es2020',
      platform: 'neutral',
      minify: false, // Keep readable for debugging
      sourcemap: false,
      // Define globals that will be provided by Swift
      external: [],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      // Polyfills for JavaScriptCore environment
      banner: {
        js: `
// Crypto polyfill for JavaScriptCore (required by lib0/Yjs)
if (typeof crypto === 'undefined') {
  globalThis.crypto = {
    getRandomValues: function(array) {
      for (var i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    randomUUID: function() {
      // Generate a v4 UUID using getRandomValues
      var bytes = new Uint8Array(16);
      this.getRandomValues(bytes);
      // Set version (4) and variant (10xx) bits
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      // Convert to hex string with dashes
      var hex = '';
      for (var i = 0; i < 16; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      return hex.slice(0,8) + '-' + hex.slice(8,12) + '-' + hex.slice(12,16) + '-' + hex.slice(16,20) + '-' + hex.slice(20);
    }
  };
} else if (typeof crypto.randomUUID === 'undefined') {
  // crypto exists but randomUUID doesn't
  crypto.randomUUID = function() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = '';
    for (var i = 0; i < 16; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex.slice(0,8) + '-' + hex.slice(8,12) + '-' + hex.slice(12,16) + '-' + hex.slice(16,20) + '-' + hex.slice(20);
  };
}
// TextEncoder/TextDecoder polyfill for JavaScriptCore
if (typeof TextEncoder === 'undefined') {
  globalThis.TextEncoder = function() {};
  TextEncoder.prototype.encode = function(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0xd800 || c >= 0xe000) {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(bytes);
  };
}
if (typeof TextDecoder === 'undefined') {
  globalThis.TextDecoder = function() {};
  TextDecoder.prototype.decode = function(bytes) {
    var str = '';
    var i = 0;
    while (i < bytes.length) {
      var c = bytes[i++];
      if (c < 0x80) {
        str += String.fromCharCode(c);
      } else if (c < 0xe0) {
        str += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
      } else if (c < 0xf0) {
        str += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
      } else {
        var cp = ((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        cp -= 0x10000;
        str += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      }
    }
    return str;
  };
}
// Base64 polyfill for JavaScriptCore
if (typeof atob === 'undefined') {
  globalThis.atob = function(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/=+$/, '');
    for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++);
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
        ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6))
        : 0) {
      buffer = chars.indexOf(buffer);
    }
    return output;
  };
}
if (typeof btoa === 'undefined') {
  globalThis.btoa = function(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (let block, charCode, idx = 0, map = chars;
      str.charAt(idx | 0) || (map = '=', idx % 1);
      output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {
      charCode = str.charCodeAt(idx += 3/4);
      block = block << 8 | charCode;
    }
    return output;
  };
}
// Minimal console polyfill for JavaScriptCore
if (typeof console === 'undefined') {
  globalThis.console = {
    log: function() {},
    warn: function() {},
    error: function() {},
    info: function() {},
    debug: function() {}
  };
}
`,
      },
    });

    console.log('✅ iOS bridge bundle built successfully');
    console.log(`   Output: ${join(outDir, 'ios-bridge-bundle.js')}`);

    // Also output bundle size
    const bundleContent = readFileSync(join(outDir, 'ios-bridge-bundle.js'), 'utf-8');
    console.log(`   Size: ${(bundleContent.length / 1024).toFixed(1)} KB`);

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
