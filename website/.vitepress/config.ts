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
      { text: 'Technical Docs', link: '/technical_documents/' },
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
            { text: 'Backup & Recovery', link: '/guide/backup-recovery' },
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
      '/technical_documents/': [
        {
          text: 'Technical Documents',
          items: [{ text: 'Overview', link: '/technical_documents/' }],
        },
        {
          text: 'Storage System',
          items: [
            { text: 'Storage Format Design', link: '/technical_documents/STORAGE-FORMAT-DESIGN' },
            { text: 'Storage Supplemental', link: '/technical_documents/STORAGE-SUPPLEMENTAL' },
          ],
        },
        {
          text: 'Architecture',
          items: [
            {
              text: 'Cross-SD Move State Machine',
              link: '/technical_documents/cross-sd-move-state-machine',
            },
          ],
        },
        {
          text: 'Integration',
          items: [
            { text: 'IPC Protocol', link: '/technical_documents/ipc-protocol' },
            {
              text: 'TipTap-Yjs Compatibility',
              link: '/technical_documents/tiptap-yjs-compatibility',
            },
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
