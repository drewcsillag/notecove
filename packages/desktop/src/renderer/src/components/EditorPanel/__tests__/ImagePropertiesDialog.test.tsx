/**
 * ImagePropertiesDialog Tests
 *
 * Tests for the image properties dialog component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImagePropertiesDialog } from '../ImagePropertiesDialog';
import type { ImageNodeAttrs } from '../extensions/Image';

describe('ImagePropertiesDialog', () => {
  const defaultAttrs: ImageNodeAttrs = {
    imageId: 'test-image-123',
    sdId: 'test-sd-456',
    alt: '',
    caption: '',
    alignment: 'center',
    width: null,
    linkHref: null,
    display: 'block',
  };

  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    attrs: defaultAttrs,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders dialog when open', () => {
      render(<ImagePropertiesDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Image Properties')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<ImagePropertiesDialog {...defaultProps} open={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<ImagePropertiesDialog {...defaultProps} />);

      // Alt text field
      expect(screen.getByLabelText(/alt text/i)).toBeInTheDocument();

      // Caption field
      expect(screen.getByLabelText(/caption/i)).toBeInTheDocument();

      // Alignment options
      expect(screen.getByLabelText(/left/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/center/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/right/i)).toBeInTheDocument();

      // Link URL field
      expect(screen.getByLabelText(/link url/i)).toBeInTheDocument();

      // Action buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
  });

  describe('alt text', () => {
    it('displays existing alt text', () => {
      const attrs = { ...defaultAttrs, alt: 'Existing alt text' };
      render(<ImagePropertiesDialog {...defaultProps} attrs={attrs} />);

      const altInput = screen.getByLabelText(/alt text/i);
      expect(altInput).toHaveValue('Existing alt text');
    });

    it('updates alt text on input', () => {
      render(<ImagePropertiesDialog {...defaultProps} />);

      const altInput = screen.getByLabelText(/alt text/i);
      fireEvent.change(altInput, { target: { value: 'New alt text' } });

      expect(altInput).toHaveValue('New alt text');
    });

    it('saves alt text on submit', () => {
      const onSave = jest.fn();
      render(<ImagePropertiesDialog {...defaultProps} onSave={onSave} />);

      const altInput = screen.getByLabelText(/alt text/i);
      fireEvent.change(altInput, { target: { value: 'My alt text' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ alt: 'My alt text' }));
    });
  });

  describe('caption', () => {
    it('displays existing caption', () => {
      const attrs = { ...defaultAttrs, caption: 'Existing caption' };
      render(<ImagePropertiesDialog {...defaultProps} attrs={attrs} />);

      const captionInput = screen.getByLabelText(/caption/i);
      expect(captionInput).toHaveValue('Existing caption');
    });

    it('saves caption on submit', () => {
      const onSave = jest.fn();
      render(<ImagePropertiesDialog {...defaultProps} onSave={onSave} />);

      const captionInput = screen.getByLabelText(/caption/i);
      fireEvent.change(captionInput, { target: { value: 'My caption' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ caption: 'My caption' }));
    });

    it('shows hint that caption only shows for block images', () => {
      render(<ImagePropertiesDialog {...defaultProps} />);
      expect(screen.getByText(/block images only/i)).toBeInTheDocument();
    });
  });

  describe('alignment', () => {
    it('displays current alignment as selected', () => {
      const attrs = { ...defaultAttrs, alignment: 'right' as const };
      render(<ImagePropertiesDialog {...defaultProps} attrs={attrs} />);

      const rightOption = screen.getByLabelText(/right/i);
      expect(rightOption).toBeChecked();
    });

    it('updates alignment on selection', () => {
      const onSave = jest.fn();
      render(<ImagePropertiesDialog {...defaultProps} onSave={onSave} />);

      const leftOption = screen.getByLabelText(/left/i);
      fireEvent.click(leftOption);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ alignment: 'left' }));
    });
  });

  describe('link URL', () => {
    it('displays existing link URL', () => {
      const attrs = { ...defaultAttrs, linkHref: 'https://example.com' };
      render(<ImagePropertiesDialog {...defaultProps} attrs={attrs} />);

      const linkInput = screen.getByLabelText(/link url/i);
      expect(linkInput).toHaveValue('https://example.com');
    });

    it('saves link URL on submit', () => {
      const onSave = jest.fn();
      render(<ImagePropertiesDialog {...defaultProps} onSave={onSave} />);

      const linkInput = screen.getByLabelText(/link url/i);
      fireEvent.change(linkInput, { target: { value: 'https://example.com' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ linkHref: 'https://example.com' })
      );
    });

    it('validates link URL format', async () => {
      render(<ImagePropertiesDialog {...defaultProps} />);

      const linkInput = screen.getByLabelText(/link url/i);
      fireEvent.change(linkInput, { target: { value: 'not-a-valid-url' } });

      // Trigger validation by blurring
      fireEvent.blur(linkInput);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid url/i)).toBeInTheDocument();
      });
    });

    it('allows empty link URL', () => {
      const onSave = jest.fn();
      const attrs = { ...defaultAttrs, linkHref: 'https://example.com' };
      render(<ImagePropertiesDialog {...defaultProps} attrs={attrs} onSave={onSave} />);

      const linkInput = screen.getByLabelText(/link url/i);
      fireEvent.change(linkInput, { target: { value: '' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ linkHref: null }));
    });
  });

  describe('cancel behavior', () => {
    it('calls onClose when cancel clicked', () => {
      const onClose = jest.fn();
      render(<ImagePropertiesDialog {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('does not call onSave when cancel clicked', () => {
      const onSave = jest.fn();
      render(<ImagePropertiesDialog {...defaultProps} onSave={onSave} />);

      // Make some changes
      const altInput = screen.getByLabelText(/alt text/i);
      fireEvent.change(altInput, { target: { value: 'Some text' } });

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onSave).not.toHaveBeenCalled();
    });

    it('resets form when reopened after cancel', () => {
      const { rerender } = render(<ImagePropertiesDialog {...defaultProps} />);

      // Make changes
      const altInput = screen.getByLabelText(/alt text/i);
      fireEvent.change(altInput, { target: { value: 'Changed text' } });

      // Close
      rerender(<ImagePropertiesDialog {...defaultProps} open={false} />);

      // Reopen
      rerender(<ImagePropertiesDialog {...defaultProps} open={true} />);

      // Should show original value (empty)
      const newAltInput = screen.getByLabelText(/alt text/i);
      expect(newAltInput).toHaveValue('');
    });
  });
});
