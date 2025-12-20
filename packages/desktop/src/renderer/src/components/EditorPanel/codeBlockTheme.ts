/**
 * Code Block Theme Styles
 *
 * One Dark / One Light theme for syntax highlighting.
 * Based on Atom's One Dark and One Light themes.
 *
 * @see plans/syntax-highlighting-triple-quotes/PLAN.md
 */

import type { CSSObject } from '@mui/material';

/**
 * One Dark theme colors (for dark mode)
 */
const oneDark = {
  background: '#282c34',
  foreground: '#abb2bf',
  comment: '#5c6370',
  keyword: '#c678dd',
  string: '#98c379',
  number: '#d19a66',
  function: '#61afef',
  variable: '#e06c75',
  type: '#e5c07b',
  operator: '#56b6c2',
  punctuation: '#abb2bf',
  property: '#e06c75',
  tag: '#e06c75',
  attribute: '#d19a66',
  selector: '#e06c75',
  regexp: '#56b6c2',
  addition: '#98c379',
  deletion: '#e06c75',
};

/**
 * One Light theme colors (for light mode)
 */
const oneLight = {
  background: '#fafafa',
  foreground: '#383a42',
  comment: '#a0a1a7',
  keyword: '#a626a4',
  string: '#50a14f',
  number: '#986801',
  function: '#4078f2',
  variable: '#e45649',
  type: '#c18401',
  operator: '#0184bc',
  punctuation: '#383a42',
  property: '#e45649',
  tag: '#e45649',
  attribute: '#986801',
  selector: '#e45649',
  regexp: '#0184bc',
  addition: '#50a14f',
  deletion: '#e45649',
};

/**
 * Get code block syntax highlighting styles based on theme mode.
 * Returns sx styles to be spread into the ProseMirror container.
 */
export const getCodeBlockStyles = (isDarkMode: boolean): Record<string, CSSObject> => {
  const colors = isDarkMode ? oneDark : oneLight;

  return {
    // Code block container (pre)
    '& pre': {
      backgroundColor: colors.background,
      color: colors.foreground,
      padding: 2,
      borderRadius: 1,
      overflow: 'auto',
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: '0.875rem',
      lineHeight: 1.6,
      // Inner code element
      '& code': {
        padding: 0,
        backgroundColor: 'transparent',
        color: 'inherit',
        fontFamily: 'inherit',
        fontSize: 'inherit',
      },
    },

    // Highlight.js token classes
    '& .hljs': {
      color: colors.foreground,
      background: colors.background,
    },

    // Comments
    '& .hljs-comment, & .hljs-quote': {
      color: colors.comment,
      fontStyle: 'italic',
    },

    // Keywords
    '& .hljs-keyword, & .hljs-selector-tag, & .hljs-addition': {
      color: colors.keyword,
    },

    // Strings
    '& .hljs-string, & .hljs-doctag, & .hljs-regexp, & .hljs-meta .hljs-string': {
      color: colors.string,
    },

    // Numbers
    '& .hljs-number, & .hljs-literal, & .hljs-bullet, & .hljs-link': {
      color: colors.number,
    },

    // Functions
    '& .hljs-title, & .hljs-title.function_, & .hljs-section': {
      color: colors.function,
    },

    // Variables and names
    '& .hljs-variable, & .hljs-template-variable, & .hljs-name, & .hljs-deletion': {
      color: colors.variable,
    },

    // Types and classes
    '& .hljs-type, & .hljs-title.class_, & .hljs-class .hljs-title': {
      color: colors.type,
    },

    // Operators
    '& .hljs-operator, & .hljs-meta': {
      color: colors.operator,
    },

    // Built-ins and symbols
    '& .hljs-built_in, & .hljs-symbol': {
      color: colors.function,
    },

    // Attributes
    '& .hljs-attr, & .hljs-attribute': {
      color: colors.attribute,
    },

    // Properties
    '& .hljs-property': {
      color: colors.property,
    },

    // Tags (HTML/XML)
    '& .hljs-tag': {
      color: colors.tag,
    },

    // Punctuation
    '& .hljs-punctuation': {
      color: colors.punctuation,
    },

    // Selector (CSS)
    '& .hljs-selector-class, & .hljs-selector-id, & .hljs-selector-attr, & .hljs-selector-pseudo': {
      color: colors.selector,
    },

    // Emphasis
    '& .hljs-emphasis': {
      fontStyle: 'italic',
    },

    // Strong
    '& .hljs-strong': {
      fontWeight: 700,
    },

    // Diff additions/deletions
    '& .hljs-addition': {
      color: colors.addition,
      backgroundColor: isDarkMode ? 'rgba(152, 195, 121, 0.1)' : 'rgba(80, 161, 79, 0.1)',
    },
    '& .hljs-deletion': {
      color: colors.deletion,
      backgroundColor: isDarkMode ? 'rgba(224, 108, 117, 0.1)' : 'rgba(228, 86, 73, 0.1)',
    },
  };
};

export default getCodeBlockStyles;
