/**
 * WizardContainer Tests
 *
 * Tests for wizard navigation, step flow, and mode restrictions.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WizardContainer } from '../WizardContainer';

describe('WizardContainer', () => {
  const defaultCloudPaths = {
    iCloudDrive: '/Users/test/Library/Mobile Documents',
    Dropbox: '/Users/test/Dropbox',
  };
  const defaultStoragePath = '/Users/test/Documents/NoteCove';

  // Create a fresh mock API for each test
  const createMockAPI = () => ({
    getCloudStoragePaths: jest.fn().mockResolvedValue(defaultCloudPaths),
    getDefaultStoragePath: jest.fn().mockResolvedValue(defaultStoragePath),
    selectStoragePath: jest.fn().mockResolvedValue('/custom/path'),
    createProfileWithConfig: jest.fn().mockResolvedValue({
      id: 'new-profile-id',
      name: 'Test Profile',
      isDev: false,
      mode: 'local',
      created: Date.now(),
      lastUsed: Date.now(),
    }),
  });

  let mockProfilePickerAPI: ReturnType<typeof createMockAPI>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfilePickerAPI = createMockAPI();
    (window as unknown as Record<string, unknown>)['profilePickerAPI'] = mockProfilePickerAPI;
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['profilePickerAPI'];
  });

  describe('Initial load', () => {
    it('should show loading state initially', () => {
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show profile name step after loading', async () => {
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Create New Profile')).toBeInTheDocument();
      });
    });

    it('should show error if profilePickerAPI is not available', async () => {
      delete (window as unknown as Record<string, unknown>)['profilePickerAPI'];
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Profile API not available')).toBeInTheDocument();
      });
    });

    it('should show error if API call fails', async () => {
      mockProfilePickerAPI.getCloudStoragePaths.mockRejectedValue(new Error('API error'));
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('API error')).toBeInTheDocument();
      });
    });
  });

  describe('Step navigation', () => {
    it('should start at profile name step', async () => {
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Create New Profile')).toBeInTheDocument();
        expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
      });
    });

    it('should navigate to mode selection step', async () => {
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
      });

      // Enter profile name
      fireEvent.change(screen.getByLabelText('Profile Name'), {
        target: { value: 'Test Profile' },
      });

      // Click next
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Choose Profile Mode')).toBeInTheDocument();
      });
    });

    it('should navigate back from mode selection to profile name', async () => {
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      // Get to mode selection step
      await waitFor(() => {
        expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Profile Name'), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Choose Profile Mode')).toBeInTheDocument();
      });

      // Go back
      fireEvent.click(screen.getByText('Back'));

      await waitFor(() => {
        expect(screen.getByText('Create New Profile')).toBeInTheDocument();
      });
    });

    it('should call onCancel when Cancel is clicked', async () => {
      const onCancel = jest.fn();
      render(<WizardContainer onComplete={jest.fn()} onCancel={onCancel} />);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Full wizard flow (local mode)', () => {
    it('should complete wizard for local mode', async () => {
      const onComplete = jest.fn();
      render(<WizardContainer onComplete={onComplete} onCancel={jest.fn()} />);

      // Step 1: Profile name
      await waitFor(() => {
        expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Profile Name'), {
        target: { value: 'My Local Profile' },
      });
      fireEvent.click(screen.getByText('Next'));

      // Step 2: Mode selection
      await waitFor(() => {
        expect(screen.getByText('Choose Profile Mode')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Local').closest('div')!);
      fireEvent.click(screen.getByText('Next'));

      // Step 3: Storage config
      await waitFor(() => {
        expect(screen.getByText('Local Storage')).toBeInTheDocument();
      });
      // Path is no longer shown for local mode - storage is in the profile
      expect(screen.queryByText(defaultStoragePath)).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Next'));

      // Step 4: User settings
      await waitFor(() => {
        expect(screen.getByText('Your Identity')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Display Name'), {
        target: { value: 'John' },
      });
      fireEvent.click(screen.getByText('Next'));

      // Step 5: Confirmation
      await waitFor(() => {
        expect(screen.getByText('Review & Create')).toBeInTheDocument();
      });
      expect(screen.getByText('My Local Profile')).toBeInTheDocument();
      expect(screen.getByText('Local')).toBeInTheDocument();

      // Create profile
      fireEvent.click(screen.getByText('Create Profile'));

      await waitFor(() => {
        expect(mockProfilePickerAPI.createProfileWithConfig).toHaveBeenCalledWith({
          name: 'My Local Profile',
          mode: 'local',
          storagePath: defaultStoragePath,
          username: 'John',
        });
        expect(onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Paranoid mode - skips user settings step', () => {
    it('should skip userSettings step for paranoid mode', async () => {
      const onComplete = jest.fn();
      render(<WizardContainer onComplete={onComplete} onCancel={jest.fn()} />);

      // Step 1: Profile name
      await waitFor(() => {
        expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Profile Name'), {
        target: { value: 'Paranoid Profile' },
      });
      fireEvent.click(screen.getByText('Next'));

      // Step 2: Select paranoid mode
      await waitFor(() => {
        expect(screen.getByText('Choose Profile Mode')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Paranoid').closest('div')!);
      fireEvent.click(screen.getByText('Next'));

      // Step 3: Storage config (with paranoid warning)
      await waitFor(() => {
        expect(screen.getByText('Secure Storage')).toBeInTheDocument();
      });
      expect(screen.getByText(/Paranoid Mode:/)).toBeInTheDocument();
      fireEvent.click(screen.getByText('Next'));

      // Should go directly to confirmation (skipping user settings)
      await waitFor(() => {
        expect(screen.getByText('Review & Create')).toBeInTheDocument();
      });

      // User settings step should have been skipped
      expect(screen.queryByText('Your Identity')).not.toBeInTheDocument();

      // Should show paranoid privacy features
      expect(screen.getByText(/Privacy Features Enabled:/)).toBeInTheDocument();
    });

    it('should include only 4 step indicators for paranoid mode', async () => {
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      // Get to mode selection and select paranoid
      await waitFor(() => {
        expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Profile Name'), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Choose Profile Mode')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Paranoid').closest('div')!);

      // After selecting paranoid, step indicator should show 4 dots
      // The step indicator renders step dots based on visible steps
      await waitFor(() => {
        // 4 steps for paranoid: profileName, modeSelection, storageConfig, confirmation
        const stepDots = document.querySelectorAll('[style*="border-radius: 50%"]');
        // Filter for small dots (step indicators are small)
        const smallDots = Array.from(stepDots).filter((dot) => {
          const style = (dot as HTMLElement).style;
          return style.width === '8px' || style.width === '12px';
        });
        expect(smallDots.length).toBe(4);
      });
    });
  });

  describe('Cloud mode flow', () => {
    it('should require cloud provider selection', async () => {
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      // Step 1: Profile name
      await waitFor(() => {
        expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Profile Name'), {
        target: { value: 'Cloud Profile' },
      });
      fireEvent.click(screen.getByText('Next'));

      // Step 2: Select cloud mode
      await waitFor(() => {
        expect(screen.getByText('Choose Profile Mode')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Cloud').closest('div')!);
      fireEvent.click(screen.getByText('Next'));

      // Step 3: Storage config - need to select provider
      await waitFor(() => {
        expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      });

      // Next should be disabled until provider is selected
      expect(screen.getByText('Next')).toBeDisabled();

      // Select a provider
      fireEvent.click(screen.getByText('Dropbox').closest('div')!);

      // Now Next should be enabled
      expect(screen.getByText('Next')).not.toBeDisabled();
    });
  });

  describe('Custom mode flow', () => {
    it('should require custom path selection', async () => {
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      // Step 1: Profile name
      await waitFor(() => {
        expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Profile Name'), {
        target: { value: 'Custom Profile' },
      });
      fireEvent.click(screen.getByText('Next'));

      // Step 2: Select custom mode
      await waitFor(() => {
        expect(screen.getByText('Choose Profile Mode')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Custom').closest('div')!);
      fireEvent.click(screen.getByText('Next'));

      // Step 3: Storage config - need to select path
      await waitFor(() => {
        expect(screen.getByText('Custom Storage')).toBeInTheDocument();
      });

      expect(screen.getByText('No folder selected')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeDisabled();

      // Click choose folder
      fireEvent.click(screen.getByText('Choose Folder...'));

      await waitFor(() => {
        expect(mockProfilePickerAPI.selectStoragePath).toHaveBeenCalled();
      });

      // After selection, path should be shown and Next enabled
      await waitFor(() => {
        expect(screen.getByText('/custom/path')).toBeInTheDocument();
        expect(screen.getByText('Next')).not.toBeDisabled();
      });
    });
  });

  describe('Error handling', () => {
    it('should show error on API load failure', async () => {
      mockProfilePickerAPI.getDefaultStoragePath.mockRejectedValue(new Error('Network error'));
      render(<WizardContainer onComplete={jest.fn()} onCancel={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Close button should be shown
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should call onCancel when Close is clicked on error', async () => {
      mockProfilePickerAPI.getDefaultStoragePath.mockRejectedValue(new Error('Error'));
      const onCancel = jest.fn();
      render(<WizardContainer onComplete={jest.fn()} onCancel={onCancel} />);

      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      expect(onCancel).toHaveBeenCalled();
    });
  });
});
