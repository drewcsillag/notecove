#!/usr/bin/env node
/**
 * Fetch the oEmbed provider registry from oembed.com
 *
 * This script downloads the latest providers.json and saves it to
 * src/oembed/providers.json for bundling with the package.
 *
 * Usage: node scripts/fetch-oembed-registry.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REGISTRY_URL = 'https://oembed.com/providers.json';
const OUTPUT_PATH = join(__dirname, '../src/oembed/providers.json');

async function fetchRegistry() {
  console.log(`Fetching oEmbed registry from ${REGISTRY_URL}...`);

  const response = await fetch(REGISTRY_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`);
  }

  const providers = await response.json();

  if (!Array.isArray(providers)) {
    throw new Error('Invalid registry format: expected an array');
  }

  console.log(`Received ${providers.length} providers`);

  // Ensure output directory exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  // Write formatted JSON
  writeFileSync(OUTPUT_PATH, JSON.stringify(providers, null, 2) + '\n');

  console.log(`Saved to ${OUTPUT_PATH}`);
  console.log('Done!');
}

fetchRegistry().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
