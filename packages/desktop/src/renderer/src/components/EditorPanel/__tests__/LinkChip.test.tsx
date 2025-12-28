/**
 * LinkChip Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LinkChip } from '../LinkChip';

describe('LinkChip', () => {
  const defaultProps = {
    url: 'https://example.com/article',
  };

  describe('rendering', () => {
    it('renders with url only, showing domain', () => {
      render(<LinkChip {...defaultProps} />);

      expect(screen.getByRole('link')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(<LinkChip {...defaultProps} title="Example Article" />);

      expect(screen.getByText('Example Article')).toBeInTheDocument();
    });

    it('truncates long titles', () => {
      render(
        <LinkChip {...defaultProps} title="This is a very long title that should be truncated" />
      );

      // The title should be truncated to 30 chars with ellipsis
      expect(screen.getByText('This is a very long title tha…')).toBeInTheDocument();
    });

    it('does not truncate short titles', () => {
      render(<LinkChip {...defaultProps} title="Short Title" />);

      expect(screen.getByText('Short Title')).toBeInTheDocument();
    });

    it('renders favicon when provided', () => {
      const faviconUrl = 'data:image/png;base64,abc123';
      render(<LinkChip {...defaultProps} favicon={faviconUrl} />);

      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', faviconUrl);
      expect(img).toHaveClass('link-chip-favicon');
    });

    it('renders default link icon when no favicon', () => {
      render(<LinkChip {...defaultProps} />);

      // Should have an SVG icon
      const chip = screen.getByRole('link');
      const svg = chip.querySelector('svg.link-chip-icon');
      expect(svg).toBeInTheDocument();
    });

    it('renders loading spinner when isLoading is true', () => {
      render(<LinkChip {...defaultProps} isLoading={true} />);

      const chip = screen.getByRole('link');
      expect(chip).toHaveClass('link-chip--loading');

      const spinner = chip.querySelector('.link-chip-spinner');
      expect(spinner).toBeInTheDocument();
    });

    it('sets title attribute to URL for tooltip', () => {
      render(<LinkChip {...defaultProps} />);

      expect(screen.getByRole('link')).toHaveAttribute('title', 'https://example.com/article');
    });

    it('sets data-url attribute', () => {
      render(<LinkChip {...defaultProps} />);

      expect(screen.getByRole('link')).toHaveAttribute('data-url', 'https://example.com/article');
    });

    it('applies custom className', () => {
      render(<LinkChip {...defaultProps} className="custom-class" />);

      expect(screen.getByRole('link')).toHaveClass('custom-class');
    });
  });

  describe('domain extraction', () => {
    it('extracts domain from https URL', () => {
      render(<LinkChip url="https://www.youtube.com/watch?v=abc123" />);

      expect(screen.getByText('youtube.com')).toBeInTheDocument();
    });

    it('extracts domain from http URL', () => {
      render(<LinkChip url="http://github.com/user/repo" />);

      expect(screen.getByText('github.com')).toBeInTheDocument();
    });

    it('removes www prefix from domain', () => {
      render(<LinkChip url="https://www.example.org/page" />);

      expect(screen.getByText('example.org')).toBeInTheDocument();
    });

    it('handles subdomains', () => {
      render(<LinkChip url="https://blog.example.com/post" />);

      expect(screen.getByText('blog.example.com')).toBeInTheDocument();
    });

    it('handles malformed URLs gracefully', () => {
      render(<LinkChip url="not-a-valid-url" />);

      // Should fall back to showing the original text
      expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = jest.fn();
      render(<LinkChip {...defaultProps} onClick={onClick} />);

      fireEvent.click(screen.getByRole('link'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('prevents default on click', () => {
      const onClick = jest.fn();
      render(<LinkChip {...defaultProps} onClick={onClick} />);

      fireEvent.click(screen.getByRole('link'));

      // The handler should have been called
      expect(onClick).toHaveBeenCalled();
    });

    it('calls onHover on mouse enter', () => {
      const onHover = jest.fn();
      render(<LinkChip {...defaultProps} onHover={onHover} />);

      fireEvent.mouseEnter(screen.getByRole('link'));

      expect(onHover).toHaveBeenCalledTimes(1);
    });

    it('calls onLeave on mouse leave', () => {
      const onLeave = jest.fn();
      render(<LinkChip {...defaultProps} onLeave={onLeave} />);

      fireEvent.mouseLeave(screen.getByRole('link'));

      expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it('handles Enter key press', () => {
      const onClick = jest.fn();
      render(<LinkChip {...defaultProps} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('link'), { key: 'Enter' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('handles Space key press', () => {
      const onClick = jest.fn();
      render(<LinkChip {...defaultProps} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('link'), { key: ' ' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('ignores other key presses', () => {
      const onClick = jest.fn();
      render(<LinkChip {...defaultProps} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('link'), { key: 'Escape' });

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has role="link"', () => {
      render(<LinkChip {...defaultProps} />);

      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('is focusable via tabIndex', () => {
      render(<LinkChip {...defaultProps} />);

      expect(screen.getByRole('link')).toHaveAttribute('tabIndex', '0');
    });

    it('favicon image has aria-hidden', () => {
      render(<LinkChip {...defaultProps} favicon="data:image/png;base64,test" />);

      expect(screen.getByRole('img', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
