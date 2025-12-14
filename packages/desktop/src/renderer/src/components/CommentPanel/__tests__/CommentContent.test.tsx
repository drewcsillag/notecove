/**
 * Tests for CommentContent component
 *
 * Tests that @-mentions are correctly parsed and styled.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CommentContent } from '../CommentContent';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('CommentContent', () => {
  it('renders plain text without mentions', () => {
    renderWithTheme(<CommentContent content="This is a regular comment" />);
    expect(screen.getByText('This is a regular comment')).toBeInTheDocument();
  });

  it('renders a single mention with styling', () => {
    renderWithTheme(<CommentContent content="Hello @drew" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('@drew')).toBeInTheDocument();
    // Check that @drew has the mention styling (Box component with specific sx props)
    const mention = screen.getByText('@drew');
    expect(mention.tagName.toLowerCase()).toBe('span');
  });

  it('renders multiple mentions', () => {
    const { container } = renderWithTheme(
      <CommentContent content="@alice and @bob are here" />
    );
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    // Verify full content is present
    expect(container.textContent).toContain('and');
    expect(container.textContent).toContain('are here');
  });

  it('renders mentions with numbers and underscores', () => {
    renderWithTheme(<CommentContent content="Hey @user_123" />);
    expect(screen.getByText('@user_123')).toBeInTheDocument();
  });

  it('renders empty content', () => {
    const { container } = renderWithTheme(<CommentContent content="" />);
    expect(container.textContent).toBe('');
  });

  it('renders content that is only a mention', () => {
    renderWithTheme(<CommentContent content="@everyone" />);
    expect(screen.getByText('@everyone')).toBeInTheDocument();
  });

  it('highlights @ patterns even in email-like text', () => {
    // The regex @\w+ will match @example in an email
    // This is acceptable - mentioning from within emails isn't a typical use case
    renderWithTheme(<CommentContent content="Contact user@example.com" />);
    // The @example part will be highlighted
    expect(screen.getByText('@example')).toBeInTheDocument();
  });

  it('preserves whitespace in content', () => {
    renderWithTheme(<CommentContent content="Line 1\nLine 2" />);
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
  });

  it('handles mentions at the start of content', () => {
    renderWithTheme(<CommentContent content="@admin please review" />);
    expect(screen.getByText('@admin')).toBeInTheDocument();
    expect(screen.getByText('please review')).toBeInTheDocument();
  });

  it('handles mentions at the end of content', () => {
    renderWithTheme(<CommentContent content="Thanks @helper" />);
    expect(screen.getByText('Thanks')).toBeInTheDocument();
    expect(screen.getByText('@helper')).toBeInTheDocument();
  });

  it('handles consecutive mentions', () => {
    renderWithTheme(<CommentContent content="@alice @bob @charlie" />);
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.getByText('@charlie')).toBeInTheDocument();
  });
});
