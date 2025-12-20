/**
 * CodeBlockComponent - React NodeView for Code Blocks
 *
 * Renders code blocks with:
 * - Language selector dropdown
 * - Copy to clipboard button
 * - Syntax highlighting via lowlight
 *
 * @see plans/syntax-highlighting-triple-quotes/PLAN.md
 */

import React, { useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import {
  Box,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Tooltip,
  useTheme,
  type SelectChangeEvent,
} from '@mui/material';
import { ContentCopy, Check, FormatListNumbered } from '@mui/icons-material';
import { SUPPORTED_LANGUAGES } from './extensions/CodeBlockLowlight';

/**
 * Display names for languages in the dropdown
 */
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  json: 'JSON',
  yaml: 'YAML',
  markdown: 'Markdown',
  bash: 'Bash',
  shell: 'Shell',
  xml: 'XML',
  diff: 'Diff',
};

/**
 * CodeBlockComponent
 *
 * React component for rendering code blocks with language selector.
 */
export const CodeBlockComponent: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Get current language from node attributes
  const currentLanguage = (node.attrs['language'] as string | null) ?? '';
  const showLineNumbers = Boolean(node.attrs['showLineNumbers']);

  // Calculate line count for line numbers
  const lineCount = node.textContent.split('\n').length;

  // Handle language change
  const handleLanguageChange = useCallback(
    (event: SelectChangeEvent) => {
      const newLanguage = event.target.value || null;
      updateAttributes({ language: newLanguage });
    },
    [updateAttributes]
  );

  // Handle copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(node.textContent).then(
      () => {
        setIsCopied(true);
        // Reset after 2 seconds
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      },
      (err) => {
        console.error('Failed to copy code:', err);
      }
    );
  }, [node.textContent]);

  // Handle toggle line numbers
  const handleToggleLineNumbers = useCallback(() => {
    updateAttributes({ showLineNumbers: !showLineNumbers });
  }, [updateAttributes, showLineNumbers]);

  // Theme colors
  const colors = isDarkMode
    ? {
        background: '#282c34',
        foreground: '#abb2bf',
        comment: '#5c6370',
        dropdownBg: '#21252b',
        dropdownBorder: '#3e4451',
        dropdownHover: '#2c313c',
      }
    : {
        background: '#fafafa',
        foreground: '#383a42',
        comment: '#a0a1a7',
        dropdownBg: '#ffffff',
        dropdownBorder: '#e1e4e8',
        dropdownHover: '#f6f8fa',
      };

  return (
    <NodeViewWrapper
      as="div"
      style={{ position: 'relative' }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <Box
        component="pre"
        sx={{
          backgroundColor: colors.background,
          color: colors.foreground,
          padding: 2,
          paddingTop: 4, // Extra top padding for dropdown
          borderRadius: 1,
          overflow: 'auto',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          margin: 0,
          position: 'relative',
        }}
      >
        {/* Controls: Copy Button + Language Selector */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            opacity: isHovered || currentLanguage ? 1 : 0.3,
            transition: 'opacity 0.2s ease',
            zIndex: 1,
          }}
          contentEditable={false}
        >
          {/* Line Numbers Toggle */}
          <Tooltip title={showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}>
            <IconButton
              size="small"
              onClick={handleToggleLineNumbers}
              aria-label="Toggle line numbers"
              sx={{
                color: showLineNumbers ? '#61afef' : colors.foreground,
                backgroundColor: colors.dropdownBg,
                border: `1px solid ${colors.dropdownBorder}`,
                borderRadius: 0.5,
                padding: '4px',
                '&:hover': {
                  backgroundColor: colors.dropdownHover,
                },
              }}
            >
              <FormatListNumbered sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>

          {/* Copy Button */}
          <Tooltip title={isCopied ? 'Copied!' : 'Copy code'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              aria-label={isCopied ? 'Copied' : 'Copy code'}
              sx={{
                color: isCopied ? '#98c379' : colors.foreground,
                backgroundColor: colors.dropdownBg,
                border: `1px solid ${colors.dropdownBorder}`,
                borderRadius: 0.5,
                padding: '4px',
                '&:hover': {
                  backgroundColor: colors.dropdownHover,
                },
              }}
            >
              {isCopied ? (
                <Check sx={{ fontSize: '1rem' }} />
              ) : (
                <ContentCopy sx={{ fontSize: '1rem' }} />
              )}
            </IconButton>
          </Tooltip>

          {/* Language Selector */}
          <FormControl size="small" variant="standard">
            <Select
              value={currentLanguage}
              onChange={handleLanguageChange}
              displayEmpty
              sx={{
                fontSize: '0.75rem',
                color: colors.foreground,
                backgroundColor: colors.dropdownBg,
                border: `1px solid ${colors.dropdownBorder}`,
                borderRadius: 0.5,
                padding: '2px 8px',
                minWidth: 100,
                '& .MuiSelect-select': {
                  padding: '2px 24px 2px 8px',
                },
                '& .MuiSelect-icon': {
                  color: colors.foreground,
                  right: 4,
                },
                '&:hover': {
                  backgroundColor: colors.dropdownHover,
                },
                '&::before, &::after': {
                  display: 'none',
                },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: colors.dropdownBg,
                    border: `1px solid ${colors.dropdownBorder}`,
                    maxHeight: 300,
                    '& .MuiMenuItem-root': {
                      fontSize: '0.75rem',
                      color: colors.foreground,
                      '&:hover': {
                        backgroundColor: colors.dropdownHover,
                      },
                      '&.Mui-selected': {
                        backgroundColor: isDarkMode
                          ? 'rgba(97, 175, 239, 0.2)'
                          : 'rgba(64, 120, 242, 0.1)',
                      },
                    },
                  },
                },
              }}
            >
              <MenuItem value="">
                <em>Auto-detect</em>
              </MenuItem>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <MenuItem key={lang} value={lang}>
                  {LANGUAGE_DISPLAY_NAMES[lang] ?? lang}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Code Content with optional line numbers */}
        <Box sx={{ display: 'flex' }}>
          {/* Line Number Gutter */}
          {showLineNumbers && (
            <Box
              data-testid="line-number-gutter"
              contentEditable={false}
              sx={{
                userSelect: 'none',
                textAlign: 'right',
                paddingRight: 2,
                marginRight: 2,
                borderRight: `1px solid ${colors.dropdownBorder}`,
                color: colors.comment,
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: 1.6,
                minWidth: '2em',
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </Box>
          )}

          {/* Code Content - editable area */}
          <NodeViewContent
            as="code"
            className={currentLanguage ? `language-${currentLanguage}` : undefined}
            style={{
              display: 'block',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              backgroundColor: 'transparent',
              padding: 0,
              flex: 1,
            }}
          />
        </Box>
      </Box>
    </NodeViewWrapper>
  );
};

export default CodeBlockComponent;
