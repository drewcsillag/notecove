/**
 * oEmbed module
 *
 * Types and utilities for oEmbed-based link unfurling.
 */

export * from './types';
export * from './registry';

// Export the bundled providers for use in desktop package
import providers from './providers.json';
export { providers as oembedProviders };
