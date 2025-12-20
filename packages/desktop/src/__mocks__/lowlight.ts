/**
 * Mock for lowlight syntax highlighting library
 *
 * For unit tests, we mock lowlight to avoid ESM issues.
 * E2E tests will verify actual syntax highlighting works.
 */

// Mock language grammar
const mockGrammar = {};

// Mock registered languages
const mockLanguages = new Map<string, unknown>();

// Pre-populate with common languages
const commonLanguages = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'ruby',
  'php',
  'html',
  'css',
  'sql',
  'json',
  'markdown',
  'bash',
  'shell',
  'xml',
  'diff',
];

commonLanguages.forEach((lang) => mockLanguages.set(lang, mockGrammar));

// Mock highlight result
const createMockHighlightResult = (code: string, language?: string) => ({
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'span',
      properties: { className: ['hljs-keyword'] },
      children: [{ type: 'text', value: code.split(' ')[0] ?? '' }],
    },
    {
      type: 'text',
      value: code.slice((code.split(' ')[0] ?? '').length),
    },
  ],
  data: { language: language ?? 'plaintext' },
});

// Mock lowlight instance
export const createLowlight = jest.fn(() => ({
  register: jest.fn((name: string, grammar: unknown) => {
    mockLanguages.set(name, grammar);
  }),
  registered: jest.fn((name: string) => mockLanguages.has(name)),
  listLanguages: jest.fn(() => Array.from(mockLanguages.keys())),
  highlight: jest.fn((language: string, code: string) => createMockHighlightResult(code, language)),
  highlightAuto: jest.fn((code: string) => createMockHighlightResult(code)),
}));

// Mock common grammars export
export const common = commonLanguages.reduce<Record<string, unknown>>((acc, lang) => {
  acc[lang] = mockGrammar;
  return acc;
}, {});

// Mock all grammars export (same as common for testing)
export const all = common;

export default { createLowlight, common, all };
