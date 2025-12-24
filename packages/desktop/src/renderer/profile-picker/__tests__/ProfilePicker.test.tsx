/**
 * ProfilePicker Tests
 *
 * Tests for the profile picker pre-selection logic, particularly
 * the behavior in dev builds regarding production profiles.
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfilePicker } from '../ProfilePicker';

// Mock profile data
const devProfile1 = {
  id: 'dev-1',
  name: 'Development',
  isDev: true,
  created: 1000,
  lastUsed: 2000, // older
};

const devProfile2 = {
  id: 'dev-2',
  name: 'Dev Testing',
  isDev: true,
  created: 1500,
  lastUsed: 3000, // more recent dev profile
};

const prodProfile = {
  id: 'prod-1',
  name: 'Production',
  isDev: false,
  created: 500,
  lastUsed: 5000, // most recently used overall
};

// Mock profilePickerAPI
interface MockProfilePickerAPI {
  getProfiles: jest.Mock;
  selectProfile: jest.Mock;
  cancel: jest.Mock;
  createProfile: jest.Mock;
  deleteProfile: jest.Mock;
  renameProfile: jest.Mock;
}

const createMockAPI = (overrides: Record<string, unknown> = {}): MockProfilePickerAPI => ({
  getProfiles: jest.fn().mockResolvedValue({
    profiles: [devProfile1, devProfile2, prodProfile],
    defaultProfileId: null,
    skipPicker: false,
    isDevBuild: true,
    ...overrides,
  }),
  selectProfile: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn().mockResolvedValue(undefined),
  createProfile: jest.fn(),
  deleteProfile: jest.fn(),
  renameProfile: jest.fn(),
});

describe('ProfilePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    delete (window as unknown as Record<string, unknown>)['profilePickerAPI'];
  });

  describe('pre-selection in dev builds', () => {
    it('should NOT pre-select a production profile even if it was most recently used', async () => {
      // Arrange: prod profile has lastUsed=5000 (most recent), dev profiles are older
      const mockAPI = createMockAPI();
      (window as unknown as Record<string, unknown>)['profilePickerAPI'] = mockAPI;

      // Act
      render(<ProfilePicker />);

      // Assert: should select the most recent DEV profile (dev-2 with lastUsed=3000)
      // not the production profile (lastUsed=5000)
      await waitFor(() => {
        const devProfile2Item = screen.getByTestId('profile-item-dev-2');
        // The selected profile has a different background color via inline styles
        // We check for the border color which is set to #0066cc when selected
        expect(devProfile2Item).toHaveStyle({ borderColor: '#0066cc' });
      });

      // The production profile should NOT be selected
      const prodProfileItem = screen.getByTestId('profile-item-prod-1');
      expect(prodProfileItem).not.toHaveStyle({ borderColor: '#0066cc' });
    });

    it('should ignore defaultProfileId if it points to a production profile', async () => {
      // Arrange: defaultProfileId points to production profile
      const mockAPI = createMockAPI({
        defaultProfileId: 'prod-1', // points to production profile
      });
      (window as unknown as Record<string, unknown>)['profilePickerAPI'] = mockAPI;

      // Act
      render(<ProfilePicker />);

      // Assert: should select the most recent DEV profile instead
      await waitFor(() => {
        const devProfile2Item = screen.getByTestId('profile-item-dev-2');
        expect(devProfile2Item).toHaveStyle({ borderColor: '#0066cc' });
      });

      // Production profile should NOT be selected despite being defaultProfileId
      const prodProfileItem = screen.getByTestId('profile-item-prod-1');
      expect(prodProfileItem).not.toHaveStyle({ borderColor: '#0066cc' });
    });

    it('should pre-select defaultProfileId if it points to a dev profile', async () => {
      // Arrange: defaultProfileId points to a dev profile
      const mockAPI = createMockAPI({
        defaultProfileId: 'dev-1', // points to dev profile (not the most recent one)
      });
      (window as unknown as Record<string, unknown>)['profilePickerAPI'] = mockAPI;

      // Act
      render(<ProfilePicker />);

      // Assert: should use the defaultProfileId since it's a dev profile
      await waitFor(() => {
        const devProfile1Item = screen.getByTestId('profile-item-dev-1');
        expect(devProfile1Item).toHaveStyle({ borderColor: '#0066cc' });
      });
    });

    it('should not pre-select anything if only production profiles exist', async () => {
      // Arrange: only production profiles
      const mockAPI = createMockAPI({
        profiles: [prodProfile],
      });
      (window as unknown as Record<string, unknown>)['profilePickerAPI'] = mockAPI;

      // Act
      render(<ProfilePicker />);

      // Assert: nothing should be pre-selected (user must explicitly click)
      await waitFor(() => {
        expect(screen.getByTestId('profile-item-prod-1')).toBeInTheDocument();
      });

      const prodProfileItem = screen.getByTestId('profile-item-prod-1');
      expect(prodProfileItem).not.toHaveStyle({ borderColor: '#0066cc' });
    });
  });

  describe('pre-selection in production builds', () => {
    it('should pre-select the most recently used profile (production profiles are allowed)', async () => {
      // Arrange: production build with production profile most recently used
      const mockAPI = createMockAPI({
        isDevBuild: false,
        profiles: [devProfile1, prodProfile], // prod has lastUsed=5000
      });
      (window as unknown as Record<string, unknown>)['profilePickerAPI'] = mockAPI;

      // Act
      render(<ProfilePicker />);

      // Note: In production builds, dev profiles are filtered out
      // So only prodProfile should be visible and selected
      await waitFor(() => {
        const prodProfileItem = screen.getByTestId('profile-item-prod-1');
        expect(prodProfileItem).toHaveStyle({ borderColor: '#0066cc' });
      });
    });

    it('should use defaultProfileId in production builds', async () => {
      // Arrange: production build with defaultProfileId set
      const prodProfile2 = { ...prodProfile, id: 'prod-2', name: 'Other Prod', lastUsed: 1000 };
      const mockAPI = createMockAPI({
        isDevBuild: false,
        profiles: [prodProfile, prodProfile2],
        defaultProfileId: 'prod-2',
      });
      (window as unknown as Record<string, unknown>)['profilePickerAPI'] = mockAPI;

      // Act
      render(<ProfilePicker />);

      // Assert: should use defaultProfileId
      await waitFor(() => {
        const prod2Item = screen.getByTestId('profile-item-prod-2');
        expect(prod2Item).toHaveStyle({ borderColor: '#0066cc' });
      });
    });
  });
});
