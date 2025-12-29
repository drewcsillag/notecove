/**
 * UserSettings Tests
 *
 * Tests for placeholder behavior and handle validation
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserSettings } from '../UserSettings';

// Mock window.electronAPI
const mockElectronAPI = {
  appState: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  },
};

// Set up global mocks before tests
beforeAll(() => {
  (global as any).window.electronAPI = mockElectronAPI;
});

describe('UserSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Placeholder behavior', () => {
    it('should show placeholder text when username is not set', async () => {
      // Return null to simulate unset values
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText<HTMLInputElement>('Username');

      // Should have empty value (not "User")
      expect(usernameInput.value).toBe('');

      // Should have placeholder
      expect(usernameInput.placeholder).toBe('Your name');
    });

    it('should show placeholder text when handle is not set', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByLabelText('Mention Handle')).toBeInTheDocument();
      });

      const handleInput = screen.getByLabelText<HTMLInputElement>('Mention Handle');

      // Should have empty value (not "user")
      expect(handleInput.value).toBe('');

      // Should have placeholder
      expect(handleInput.placeholder).toBe('yourhandle');
    });

    it('should show saved values when they exist', async () => {
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'username') return Promise.resolve('Alice');
        if (key === 'userHandle') return Promise.resolve('alice123');
        return Promise.resolve(null);
      });

      render(<UserSettings />);

      // Wait for async loading to complete - check for the value to appear
      await waitFor(
        () => {
          const usernameInput = screen.getByLabelText<HTMLInputElement>('Username');
          expect(usernameInput.value).toBe('Alice');
        },
        { timeout: 3000 }
      );

      const handleInput = screen.getByLabelText<HTMLInputElement>('Mention Handle');
      expect(handleInput.value).toBe('alice123');
    });

    it('should allow typing in empty fields', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText<HTMLInputElement>('Username');
      fireEvent.change(usernameInput, { target: { value: 'Bob' } });

      expect(usernameInput.value).toBe('Bob');
    });
  });

  describe('Save functionality', () => {
    it('should save username and handle when Save is clicked', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      // Wait for loading to complete (button becomes enabled)
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
      });

      // Type in values
      const usernameInput = screen.getByLabelText('Username');
      const handleInput = screen.getByLabelText('Mention Handle');

      fireEvent.change(usernameInput, { target: { value: 'TestUser' } });
      fireEvent.change(handleInput, { target: { value: 'testhandle' } });

      // Click save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('username', 'TestUser');
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('userHandle', 'testhandle');
      });
    });

    it('should show success message after save', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      // Wait for loading to complete
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Handle validation', () => {
    it('should accept alphanumeric handles', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
      });

      const handleInput = screen.getByLabelText('Mention Handle');
      fireEvent.change(handleInput, { target: { value: 'user123' } });

      // Should not show error
      expect(screen.queryByText(/invalid handle/i)).not.toBeInTheDocument();

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should accept handles with underscores', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
      });

      const handleInput = screen.getByLabelText('Mention Handle');
      fireEvent.change(handleInput, { target: { value: 'user_name_123' } });

      // Should not show error
      expect(screen.queryByText(/invalid handle/i)).not.toBeInTheDocument();
    });

    it('should reject handles with spaces', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
      });

      const handleInput = screen.getByLabelText('Mention Handle');
      fireEvent.change(handleInput, { target: { value: 'user name' } });

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/invalid handle/i)).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('should reject handles with special characters', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
      });

      const handleInput = screen.getByLabelText('Mention Handle');
      fireEvent.change(handleInput, { target: { value: 'user@name!' } });

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/invalid handle/i)).toBeInTheDocument();
      });
    });

    it('should reject handles longer than 20 characters', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
      });

      const handleInput = screen.getByLabelText('Mention Handle');
      fireEvent.change(handleInput, { target: { value: 'a'.repeat(21) } });

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/handle must be 20 characters or less/i)).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('should allow empty handle (optional field)', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(<UserSettings />);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
      });

      // Handle starts empty, should not show error
      expect(screen.queryByText(/invalid handle/i)).not.toBeInTheDocument();

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).not.toBeDisabled();
    });
  });
});
