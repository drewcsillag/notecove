/**
 * StepConfirmation Tests
 *
 * Tests for the confirmation step component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepConfirmation } from '../StepConfirmation';
import type { StepProps } from '../types';

describe('StepConfirmation', () => {
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
    availableCloudProviders: [],
    defaultStoragePath,
    ...extras,
  });

  interface ConfirmationStepProps extends StepProps {
    onCreate: () => Promise<void>;
  }

  const createProps = (overrides: Partial<ConfirmationStepProps> = {}): ConfirmationStepProps => ({
    state: createState('local'),
    onStateChange: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    onCancel: jest.fn(),
    onCreate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it('should show the title', () => {
    const props = createProps();
    render(<StepConfirmation {...props} />);

    expect(screen.getByText('Review & Create')).toBeInTheDocument();
    expect(screen.getByText('Confirm your profile settings')).toBeInTheDocument();
  });

  it('should display profile name in summary', () => {
    const props = createProps({ state: createState('local', { profileName: 'My Work Notes' }) });
    render(<StepConfirmation {...props} />);

    expect(screen.getByText('Profile Name')).toBeInTheDocument();
    expect(screen.getByText('My Work Notes')).toBeInTheDocument();
  });

  it('should display mode in summary', () => {
    const props = createProps({ state: createState('local') });
    render(<StepConfirmation {...props} />);

    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  describe('Storage path display', () => {
    it('should NOT show storage path for local mode', () => {
      const props = createProps({ state: createState('local') });
      render(<StepConfirmation {...props} />);

      // For local mode, we don't show the storage path - it's in the profile
      expect(screen.queryByText('Storage')).not.toBeInTheDocument();
      expect(screen.queryByText(defaultStoragePath)).not.toBeInTheDocument();
    });

    it('should NOT show storage path for paranoid mode', () => {
      const props = createProps({ state: createState('paranoid') });
      render(<StepConfirmation {...props} />);

      // For paranoid mode, we don't show the storage path - it's in the profile
      expect(screen.queryByText('Storage')).not.toBeInTheDocument();
      expect(screen.queryByText(defaultStoragePath)).not.toBeInTheDocument();
    });

    it('should show cloud path with NoteCove suffix for cloud mode', () => {
      const props = createProps({
        state: createState('cloud', {
          cloudProvider: 'Dropbox',
          storagePath: '/Users/test/Dropbox',
        }),
      });
      render(<StepConfirmation {...props} />);

      expect(screen.getByText('/Users/test/Dropbox/NoteCove')).toBeInTheDocument();
    });

    it('should show cloud provider name for cloud mode', () => {
      const props = createProps({
        state: createState('cloud', {
          cloudProvider: 'iCloudDrive',
          storagePath: '/Users/test/Library/Mobile Documents',
        }),
      });
      render(<StepConfirmation {...props} />);

      expect(screen.getByText('Cloud Provider')).toBeInTheDocument();
      expect(screen.getByText('iCloudDrive')).toBeInTheDocument();
    });

    it('should show custom path for custom mode', () => {
      const props = createProps({
        state: createState('custom', { storagePath: '/my/custom/path' }),
      });
      render(<StepConfirmation {...props} />);

      expect(screen.getByText('/my/custom/path')).toBeInTheDocument();
    });
  });

  describe('User info display', () => {
    it('should show username when provided', () => {
      const props = createProps({
        state: createState('local', { username: 'John Doe' }),
      });
      render(<StepConfirmation {...props} />);

      expect(screen.getByText('Display Name')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should show handle when provided', () => {
      const props = createProps({
        state: createState('local', { handle: '@johndoe' }),
      });
      render(<StepConfirmation {...props} />);

      expect(screen.getByText('Handle')).toBeInTheDocument();
      expect(screen.getByText('@johndoe')).toBeInTheDocument();
    });

    it('should not show user info for paranoid mode', () => {
      const props = createProps({
        state: createState('paranoid', { username: 'John', handle: '@john' }),
      });
      render(<StepConfirmation {...props} />);

      // These should NOT be displayed even if set (paranoid mode doesn't collect user info)
      expect(screen.queryByText('Display Name')).not.toBeInTheDocument();
      expect(screen.queryByText('@john')).not.toBeInTheDocument();
    });
  });

  describe('Paranoid mode warning', () => {
    it('should show privacy features enabled for paranoid mode', () => {
      const props = createProps({ state: createState('paranoid') });
      render(<StepConfirmation {...props} />);

      expect(screen.getByText(/Privacy Features Enabled:/)).toBeInTheDocument();
      expect(screen.getByText(/No link previews or network requests/i)).toBeInTheDocument();
      expect(screen.getByText(/Cloud storage options hidden/i)).toBeInTheDocument();
      expect(screen.getByText(/User info not collected/i)).toBeInTheDocument();
    });

    it('should not show privacy warning for non-paranoid modes', () => {
      const props = createProps({ state: createState('local') });
      render(<StepConfirmation {...props} />);

      expect(screen.queryByText(/Privacy Features Enabled:/)).not.toBeInTheDocument();
    });
  });

  describe('Create button', () => {
    it('should call onCreate when Create Profile button is clicked', async () => {
      const onCreate = jest.fn().mockResolvedValue(undefined);
      const props = createProps({ onCreate });
      render(<StepConfirmation {...props} />);

      const createButton = screen.getByText('Create Profile');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(onCreate).toHaveBeenCalled();
      });
    });

    it('should show "Creating..." while creating', async () => {
      const onCreate = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const props = createProps({ onCreate });
      render(<StepConfirmation {...props} />);

      const createButton = screen.getByText('Create Profile');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });

    it('should disable buttons while creating', async () => {
      const onCreate = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const props = createProps({ onCreate });
      render(<StepConfirmation {...props} />);

      const createButton = screen.getByText('Create Profile');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeDisabled();
        expect(screen.getByText('Cancel')).toBeDisabled();
        expect(screen.getByText('Back')).toBeDisabled();
      });
    });

    it('should show error message on creation failure', async () => {
      const onCreate = jest.fn().mockRejectedValue(new Error('Profile already exists'));
      const props = createProps({ onCreate });
      render(<StepConfirmation {...props} />);

      const createButton = screen.getByText('Create Profile');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Profile already exists')).toBeInTheDocument();
      });
    });

    it('should show generic error message for non-Error failures', async () => {
      const onCreate = jest.fn().mockRejectedValue('Something went wrong');
      const props = createProps({ onCreate });
      render(<StepConfirmation {...props} />);

      const createButton = screen.getByText('Create Profile');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create profile')).toBeInTheDocument();
      });
    });

    it('should re-enable button after error', async () => {
      const onCreate = jest.fn().mockRejectedValue(new Error('Error'));
      const props = createProps({ onCreate });
      render(<StepConfirmation {...props} />);

      const createButton = screen.getByText('Create Profile');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Create Profile')).not.toBeDisabled();
      });
    });
  });

  describe('Navigation', () => {
    it('should call onBack when Back button is clicked', () => {
      const onBack = jest.fn();
      const props = createProps({ onBack });
      render(<StepConfirmation {...props} />);

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      expect(onBack).toHaveBeenCalled();
    });

    it('should call onCancel when Cancel button is clicked', () => {
      const onCancel = jest.fn();
      const props = createProps({ onCancel });
      render(<StepConfirmation {...props} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });
});
