import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'NoteCove',
  description: 'Cross-platform notes with offline-first CRDT synchronization',
  base: '/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/' },
      { text: 'Architecture', link: '/architecture/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Basic Usage', link: '/guide/basic-usage' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Sync Configuration', link: '/guide/sync-configuration' },
            { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/features/' },
            { text: 'Rich Text Editing', link: '/features/rich-text-editing' },
            { text: 'Folders & Organization', link: '/features/folders-organization' },
            { text: 'Offline-First Sync', link: '/features/offline-sync' },
            { text: 'Search', link: '/features/search' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'CRDT Synchronization', link: '/architecture/crdt-sync' },
            { text: 'Storage Layer', link: '/architecture/storage' },
            { text: 'Tech Stack', link: '/architecture/tech-stack' },
          ],
        },
      ],
    },

    socialLinks: [
      // Add GitHub link when available
      // { icon: 'github', link: 'https://github.com/notecove/notecove' }
    ],

    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2025 NoteCove Contributors',
    },
  },
});
