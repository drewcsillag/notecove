/**
 * AppearanceSettings Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppearanceSettings } from '../AppearanceSettings';
import { CheckboxSettingsProvider } from '../../../contexts/CheckboxSettingsContext';

// Mock window.electronAPI
const mockElectronAPI = {
  theme: {
    set: jest.fn().mockResolvedValue(undefined),
  },
  appState: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  },
  checkboxSettings: {
    onChanged: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
};

// Set up global mocks before tests
beforeAll(() => {
  (window as any).electronAPI = mockElectronAPI;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: all checkbox settings enabled
  mockElectronAPI.appState.get.mockImplementation((key: string) => {
    if (key === 'checkboxStrikethrough') return Promise.resolve('true');
    if (key === 'checkboxAutoReorder') return Promise.resolve('true');
    if (key === 'checkboxNopeEnabled') return Promise.resolve('true');
    return Promise.resolve(null);
  });
});

// Wrapper with CheckboxSettingsProvider
function renderWithProvider(themeMode: 'light' | 'dark' = 'light') {
  const mockOnThemeChange = jest.fn();
  return render(
    <CheckboxSettingsProvider>
      <AppearanceSettings themeMode={themeMode} onThemeChange={mockOnThemeChange} />
    </CheckboxSettingsProvider>
  );
}

describe('AppearanceSettings', () => {
  describe('Dark mode toggle', () => {
    it('should render dark mode toggle', async () => {
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Dark Mode')).toBeInTheDocument();
      });
    });

    it('should call theme.set when toggled', async () => {
      renderWithProvider('light');

      const toggle = screen.getByLabelText('Dark Mode');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockElectronAPI.theme.set).toHaveBeenCalledWith('dark');
      });
    });
  });

  describe('Checkbox settings toggles', () => {
    it('should render strikethrough toggle', async () => {
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Strikethrough completed items')).toBeInTheDocument();
      });
    });

    it('should render auto-reorder toggle', async () => {
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Move completed items to bottom')).toBeInTheDocument();
      });
    });

    it('should render nope state toggle', async () => {
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Enable nope state for checkboxes')).toBeInTheDocument();
      });
    });

    it('should save strikethrough setting when toggled', async () => {
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Strikethrough completed items')).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText('Strikethrough completed items');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('checkboxStrikethrough', 'false');
      });
    });

    it('should save auto-reorder setting when toggled', async () => {
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Move completed items to bottom')).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText('Move completed items to bottom');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('checkboxAutoReorder', 'false');
      });
    });

    it('should save nope state setting when toggled', async () => {
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Enable nope state for checkboxes')).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText('Enable nope state for checkboxes');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('checkboxNopeEnabled', 'false');
      });
    });

    it('should show toggles as checked when settings are enabled', async () => {
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Strikethrough completed items')).toBeChecked();
        expect(screen.getByLabelText('Move completed items to bottom')).toBeChecked();
        expect(screen.getByLabelText('Enable nope state for checkboxes')).toBeChecked();
      });
    });

    it('should show toggles as unchecked when settings are disabled', async () => {
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'checkboxStrikethrough') return Promise.resolve('false');
        if (key === 'checkboxAutoReorder') return Promise.resolve('false');
        if (key === 'checkboxNopeEnabled') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByLabelText('Strikethrough completed items')).not.toBeChecked();
        expect(screen.getByLabelText('Move completed items to bottom')).not.toBeChecked();
        expect(screen.getByLabelText('Enable nope state for checkboxes')).not.toBeChecked();
      });
    });
  });
});
