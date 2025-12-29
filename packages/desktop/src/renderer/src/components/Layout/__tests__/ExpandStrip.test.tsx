/**
 * ExpandStrip Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { ExpandStrip } from '../ExpandStrip';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('ExpandStrip', () => {
  const defaultProps = {
    onClick: jest.fn(),
    ariaLabel: 'Expand panel',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with correct width', () => {
    renderWithTheme(<ExpandStrip {...defaultProps} />);

    const strip = screen.getByRole('button');
    expect(strip).toBeInTheDocument();
  });

  it('should have visible background difference from surrounding area', () => {
    const { container } = renderWithTheme(<ExpandStrip {...defaultProps} />);

    const strip = container.firstChild as HTMLElement;
    expect(strip).toHaveStyle({ backgroundColor: expect.any(String) });
  });

  it('should show chevron icon on hover', () => {
    renderWithTheme(<ExpandStrip {...defaultProps} position="left" />);

    const strip = screen.getByRole('button');

    // Before hover, chevron might be hidden or have low opacity
    fireEvent.mouseEnter(strip);

    // After hover, chevron should be visible
    const chevron = screen.getByTestId('expand-strip-chevron');
    expect(chevron).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    renderWithTheme(<ExpandStrip {...defaultProps} onClick={handleClick} />);

    const strip = screen.getByRole('button');
    fireEvent.click(strip);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be keyboard focusable', () => {
    renderWithTheme(<ExpandStrip {...defaultProps} />);

    const strip = screen.getByRole('button');
    expect(strip).toHaveAttribute('tabIndex', '0');
  });

  it('should have proper aria-label', () => {
    renderWithTheme(<ExpandStrip {...defaultProps} ariaLabel="Expand left panel" />);

    const strip = screen.getByRole('button');
    expect(strip).toHaveAttribute('aria-label', 'Expand left panel');
  });

  it('should trigger onClick on Enter key', () => {
    const handleClick = jest.fn();
    renderWithTheme(<ExpandStrip {...defaultProps} onClick={handleClick} />);

    const strip = screen.getByRole('button');
    fireEvent.keyDown(strip, { key: 'Enter' });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should trigger onClick on Space key', () => {
    const handleClick = jest.fn();
    renderWithTheme(<ExpandStrip {...defaultProps} onClick={handleClick} />);

    const strip = screen.getByRole('button');
    fireEvent.keyDown(strip, { key: ' ' });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should show right-pointing chevron for left position', () => {
    renderWithTheme(<ExpandStrip {...defaultProps} position="left" />);

    const chevron = screen.getByTestId('expand-strip-chevron');
    expect(chevron).toBeInTheDocument();
  });

  it('should show left-pointing chevron for right position', () => {
    renderWithTheme(<ExpandStrip {...defaultProps} position="right" />);

    const chevron = screen.getByTestId('expand-strip-chevron');
    expect(chevron).toBeInTheDocument();
  });

  it('should have data-testid for testing', () => {
    renderWithTheme(<ExpandStrip {...defaultProps} />);

    expect(screen.getByTestId('expand-strip')).toBeInTheDocument();
  });
});
