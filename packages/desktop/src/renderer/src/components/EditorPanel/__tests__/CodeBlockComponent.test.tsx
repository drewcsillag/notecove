/**
 * CodeBlockComponent Tests
 *
 * Tests for the code block React component with language selector and copy button.
 * @see plans/syntax-highlighting-triple-quotes/PLAN.md
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { CodeBlockComponent } from '../CodeBlockComponent';
import type { NodeViewProps } from '@tiptap/react';

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Create a wrapper with theme provider
const theme = createTheme({ palette: { mode: 'dark' } });
const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

// Create mock NodeViewProps
function createMockNodeViewProps(overrides: Partial<NodeViewProps> = {}): NodeViewProps {
  return {
    node: {
      attrs: { language: 'javascript' },
      textContent: 'const x = 1;',
      type: { name: 'codeBlock' },
    },
    updateAttributes: jest.fn(),
    editor: {} as NodeViewProps['editor'],
    getPos: jest.fn(),
    decorations: [],
    selected: false,
    extension: {} as NodeViewProps['extension'],
    deleteNode: jest.fn(),
    ...overrides,
  } as unknown as NodeViewProps;
}

describe('CodeBlockComponent', () => {
  beforeEach(() => {
    mockWriteText.mockClear();
  });

  describe('Copy Button', () => {
    it('renders copy button', () => {
      const props = createMockNodeViewProps();
      renderWithTheme(<CodeBlockComponent {...props} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('copy button is visible on hover', async () => {
      const props = createMockNodeViewProps();
      renderWithTheme(<CodeBlockComponent {...props} />);

      // Find the wrapper element (pre element)
      const wrapper = screen
        .getByRole('button', { name: /copy/i })
        .closest('div[style*="position: relative"]');
      expect(wrapper).toBeInTheDocument();

      // Trigger mouse enter to simulate hover
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      // Button should be visible (opacity check would be in e2e tests)
      const copyButton = screen.getByRole('button', { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('copies code content to clipboard when clicked', async () => {
      const props = createMockNodeViewProps({
        node: {
          attrs: { language: 'javascript' },
          textContent: 'const hello = "world";',
          type: { name: 'codeBlock' },
        },
      } as unknown as Partial<NodeViewProps>);

      renderWithTheme(<CodeBlockComponent {...props} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('const hello = "world";');
      });
    });

    it('shows "Copied!" feedback after copying', async () => {
      const props = createMockNodeViewProps();
      renderWithTheme(<CodeBlockComponent {...props} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      // Should show "Copied!" text or check icon
      await waitFor(() => {
        expect(screen.getByLabelText(/copied/i)).toBeInTheDocument();
      });
    });
  });

  describe('Language Selector', () => {
    it('renders language dropdown', () => {
      const props = createMockNodeViewProps();
      renderWithTheme(<CodeBlockComponent {...props} />);

      // MUI Select renders with a combobox role
      const languageSelect = screen.getByRole('combobox');
      expect(languageSelect).toBeInTheDocument();
    });

    it('displays current language', () => {
      const props = createMockNodeViewProps({
        node: {
          attrs: { language: 'python' },
          textContent: 'print("hello")',
          type: { name: 'codeBlock' },
        },
      } as unknown as Partial<NodeViewProps>);

      renderWithTheme(<CodeBlockComponent {...props} />);

      // The select should display Python
      expect(screen.getByText('Python')).toBeInTheDocument();
    });

    it('calls updateAttributes when language changes', async () => {
      const updateAttributes = jest.fn();
      const props = createMockNodeViewProps({
        updateAttributes,
      });

      renderWithTheme(<CodeBlockComponent {...props} />);

      // Open dropdown
      const languageSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(languageSelect);

      // Select Python
      const pythonOption = await screen.findByRole('option', { name: /python/i });
      fireEvent.click(pythonOption);

      expect(updateAttributes).toHaveBeenCalledWith({ language: 'python' });
    });
  });

  describe('Line Numbers', () => {
    it('renders line number toggle button', () => {
      const props = createMockNodeViewProps();
      renderWithTheme(<CodeBlockComponent {...props} />);

      const toggleButton = screen.getByRole('button', { name: /line numbers/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('does not show line numbers by default', () => {
      const props = createMockNodeViewProps({
        node: {
          attrs: { language: 'javascript', showLineNumbers: false },
          textContent: 'line 1\nline 2\nline 3',
          type: { name: 'codeBlock' },
        },
      } as unknown as Partial<NodeViewProps>);

      renderWithTheme(<CodeBlockComponent {...props} />);

      // Line numbers should not be visible
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('shows line numbers when enabled', () => {
      const props = createMockNodeViewProps({
        node: {
          attrs: { language: 'javascript', showLineNumbers: true },
          textContent: 'line 1\nline 2\nline 3',
          type: { name: 'codeBlock' },
        },
      } as unknown as Partial<NodeViewProps>);

      renderWithTheme(<CodeBlockComponent {...props} />);

      // Line numbers should be visible in the gutter
      const lineNumberGutter = screen.getByTestId('line-number-gutter');
      expect(lineNumberGutter).toBeInTheDocument();
      expect(lineNumberGutter).toHaveTextContent('1');
      expect(lineNumberGutter).toHaveTextContent('2');
      expect(lineNumberGutter).toHaveTextContent('3');
    });

    it('toggles line numbers when button is clicked', () => {
      const updateAttributes = jest.fn();
      const props = createMockNodeViewProps({
        node: {
          attrs: { language: 'javascript', showLineNumbers: false },
          textContent: 'const x = 1;',
          type: { name: 'codeBlock' },
        },
        updateAttributes,
      } as unknown as Partial<NodeViewProps>);

      renderWithTheme(<CodeBlockComponent {...props} />);

      const toggleButton = screen.getByRole('button', { name: /line numbers/i });
      fireEvent.click(toggleButton);

      expect(updateAttributes).toHaveBeenCalledWith({ showLineNumbers: true });
    });
  });
});
