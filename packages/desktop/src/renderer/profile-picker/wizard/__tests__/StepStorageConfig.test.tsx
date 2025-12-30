/**
 * StepStorageConfig Tests
 *
 * Tests for the storage configuration step component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepStorageConfig } from '../StepStorageConfig';
import type { StepProps } from '../types';

describe('StepStorageConfig', () => {
  const defaultStoragePath = '/Users/test/Documents/NoteCove';

  const createState = (
    mode: 'local' | 'cloud' | 'paranoid' | 'custom',
    extras: Partial<StepProps['state']> = {}
  ): StepProps['state'] => ({
    profileName: 'Test Profile',
    mode,
    storagePath: null,
    cloudProvider: null,
    username: '',
    handle: '',
    availableCloudProviders: [
      { name: 'iCloudDrive', path: '/Users/test/Library/Mobile Documents' },
      { name: 'Dropbox', path: '/Users/test/Dropbox' },
    ],
    defaultStoragePath,
    ...extras,
  });

  const createProps = (overrides: Partial<StepProps> = {}): StepProps => ({
    state: createState('local'),
    onStateChange: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    // Mock window.profilePickerAPI
    (window as unknown as Record<string, unknown>)['profilePickerAPI'] = {
      selectStoragePath: jest.fn().mockResolvedValue('/custom/path'),
    };
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['profilePickerAPI'];
  });

  describe('Local mode', () => {
    it('should show default storage path for local mode', () => {
      const props = createProps({ state: createState('local') });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('Local Storage')).toBeInTheDocument();
      expect(screen.getByText(defaultStoragePath)).toBeInTheDocument();
    });

    it('should enable Next button for local mode (always valid)', () => {
      const props = createProps({ state: createState('local') });
      render(<StepStorageConfig {...props} />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();
    });

    it('should show info box about storage location', () => {
      const props = createProps({ state: createState('local') });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText(/Your notes will be stored in this folder/i)).toBeInTheDocument();
    });
  });

  describe('Paranoid mode', () => {
    it('should show secure storage title for paranoid mode', () => {
      const props = createProps({ state: createState('paranoid') });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('Secure Storage')).toBeInTheDocument();
    });

    it('should show paranoid mode warning', () => {
      const props = createProps({ state: createState('paranoid') });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText(/Paranoid Mode:/i)).toBeInTheDocument();
      expect(
        screen.getByText(/will not fetch link previews or make any network requests/i)
      ).toBeInTheDocument();
    });

    it('should enable Next button for paranoid mode (always valid)', () => {
      const props = createProps({ state: createState('paranoid') });
      render(<StepStorageConfig {...props} />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('Cloud mode', () => {
    it('should show cloud provider selection for cloud mode', () => {
      const props = createProps({ state: createState('cloud') });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      expect(screen.getByText('Select Cloud Storage Provider')).toBeInTheDocument();
    });

    it('should show available cloud providers', () => {
      const props = createProps({ state: createState('cloud') });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('iCloudDrive')).toBeInTheDocument();
      expect(screen.getByText('Dropbox')).toBeInTheDocument();
    });

    it('should call onStateChange when selecting a cloud provider', () => {
      const onStateChange = jest.fn();
      const props = createProps({ state: createState('cloud'), onStateChange });
      render(<StepStorageConfig {...props} />);

      const icloudOption = screen.getByText('iCloudDrive').closest('div');
      fireEvent.click(icloudOption!);

      expect(onStateChange).toHaveBeenCalledWith({
        cloudProvider: 'iCloudDrive',
        storagePath: '/Users/test/Library/Mobile Documents',
      });
    });

    it('should disable Next button when no cloud provider selected', () => {
      const props = createProps({
        state: createState('cloud', { cloudProvider: null, storagePath: null }),
      });
      render(<StepStorageConfig {...props} />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('should enable Next button when cloud provider is selected', () => {
      const props = createProps({
        state: createState('cloud', {
          cloudProvider: 'Dropbox',
          storagePath: '/Users/test/Dropbox',
        }),
      });
      render(<StepStorageConfig {...props} />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();
    });

    it('should show NoteCove folder path when provider is selected', () => {
      const props = createProps({
        state: createState('cloud', {
          cloudProvider: 'Dropbox',
          storagePath: '/Users/test/Dropbox',
        }),
      });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('/Users/test/Dropbox/NoteCove')).toBeInTheDocument();
    });
  });

  describe('Custom mode', () => {
    it('should show custom storage title', () => {
      const props = createProps({ state: createState('custom') });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('Custom Storage')).toBeInTheDocument();
    });

    it('should show "No folder selected" when no path is set', () => {
      const props = createProps({ state: createState('custom', { storagePath: null }) });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('No folder selected')).toBeInTheDocument();
    });

    it('should show Choose Folder button', () => {
      const props = createProps({ state: createState('custom') });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('Choose Folder...')).toBeInTheDocument();
    });

    it('should call selectStoragePath when Choose Folder is clicked', async () => {
      const onStateChange = jest.fn();
      const mockSelectPath = jest.fn().mockResolvedValue('/custom/selected/path');
      (window as unknown as Record<string, unknown>)['profilePickerAPI'] = {
        selectStoragePath: mockSelectPath,
      };

      const props = createProps({ state: createState('custom'), onStateChange });
      render(<StepStorageConfig {...props} />);

      const chooseFolderButton = screen.getByText('Choose Folder...');
      fireEvent.click(chooseFolderButton);

      await waitFor(() => {
        expect(mockSelectPath).toHaveBeenCalledWith(defaultStoragePath);
      });

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith({ storagePath: '/custom/selected/path' });
      });
    });

    it('should not call onStateChange if path selection is cancelled', async () => {
      const onStateChange = jest.fn();
      const mockSelectPath = jest.fn().mockResolvedValue(null);
      (window as unknown as Record<string, unknown>)['profilePickerAPI'] = {
        selectStoragePath: mockSelectPath,
      };

      const props = createProps({ state: createState('custom'), onStateChange });
      render(<StepStorageConfig {...props} />);

      const chooseFolderButton = screen.getByText('Choose Folder...');
      fireEvent.click(chooseFolderButton);

      await waitFor(() => {
        expect(mockSelectPath).toHaveBeenCalled();
      });

      expect(onStateChange).not.toHaveBeenCalled();
    });

    it('should disable Next button when no custom path selected', () => {
      const props = createProps({
        state: createState('custom', { storagePath: null }),
      });
      render(<StepStorageConfig {...props} />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('should enable Next button when custom path is selected', () => {
      const props = createProps({
        state: createState('custom', { storagePath: '/custom/path' }),
      });
      render(<StepStorageConfig {...props} />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();
    });

    it('should show selected path', () => {
      const props = createProps({
        state: createState('custom', { storagePath: '/my/custom/folder' }),
      });
      render(<StepStorageConfig {...props} />);

      expect(screen.getByText('/my/custom/folder')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should call onBack when Back button is clicked', () => {
      const onBack = jest.fn();
      const props = createProps({ onBack });
      render(<StepStorageConfig {...props} />);

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      expect(onBack).toHaveBeenCalled();
    });

    it('should call onCancel when Cancel button is clicked', () => {
      const onCancel = jest.fn();
      const props = createProps({ onCancel });
      render(<StepStorageConfig {...props} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should call onNext when Next button is clicked', () => {
      const onNext = jest.fn();
      const props = createProps({
        state: createState('local'),
        onNext,
      });
      render(<StepStorageConfig {...props} />);

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(onNext).toHaveBeenCalled();
    });
  });
});
