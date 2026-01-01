/**
 * Tests for CheckboxSettingsContext
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CheckboxSettingsProvider,
  useCheckboxSettings,
  getCheckboxStrikethrough,
  getCheckboxAutoReorder,
  getCheckboxNopeEnabled,
  CheckboxSettingsSync,
} from '../CheckboxSettingsContext';

// Mock window.electronAPI
const mockElectronAPI = {
  appState: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  },
  checkboxSettings: {
    onChanged: jest.fn((_callback: () => void) => () => {
      /* unsubscribe */
    }),
  },
};

// Set up global mocks before tests
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window.electronAPI = mockElectronAPI;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default to all enabled
  mockElectronAPI.appState.get.mockImplementation((key: string) => {
    if (key === 'checkboxStrikethrough') return Promise.resolve('true');
    if (key === 'checkboxAutoReorder') return Promise.resolve('true');
    if (key === 'checkboxNopeEnabled') return Promise.resolve('true');
    return Promise.resolve(null);
  });
});

// Test component to display context values
function TestConsumer() {
  const { strikethrough, autoReorder, nopeEnabled, isLoading } = useCheckboxSettings();
  return (
    <div>
      <span data-testid="strikethrough">{String(strikethrough)}</span>
      <span data-testid="autoReorder">{String(autoReorder)}</span>
      <span data-testid="nopeEnabled">{String(nopeEnabled)}</span>
      <span data-testid="isLoading">{String(isLoading)}</span>
    </div>
  );
}

describe('CheckboxSettingsContext', () => {
  describe('Provider', () => {
    it('should load settings on mount', async () => {
      render(
        <CheckboxSettingsProvider>
          <TestConsumer />
        </CheckboxSettingsProvider>
      );

      // Initially loading
      expect(screen.getByTestId('isLoading')).toHaveTextContent('true');

      // After loading, should have default values (all true)
      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('strikethrough')).toHaveTextContent('true');
      expect(screen.getByTestId('autoReorder')).toHaveTextContent('true');
      expect(screen.getByTestId('nopeEnabled')).toHaveTextContent('true');
    });

    it('should load disabled settings correctly', async () => {
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'checkboxStrikethrough') return Promise.resolve('false');
        if (key === 'checkboxAutoReorder') return Promise.resolve('false');
        if (key === 'checkboxNopeEnabled') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      render(
        <CheckboxSettingsProvider>
          <TestConsumer />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('strikethrough')).toHaveTextContent('false');
      expect(screen.getByTestId('autoReorder')).toHaveTextContent('false');
      expect(screen.getByTestId('nopeEnabled')).toHaveTextContent('false');
    });

    it('should default to true when settings are not set', async () => {
      mockElectronAPI.appState.get.mockResolvedValue(null);

      render(
        <CheckboxSettingsProvider>
          <TestConsumer />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      // Should default to true (enabled)
      expect(screen.getByTestId('strikethrough')).toHaveTextContent('true');
      expect(screen.getByTestId('autoReorder')).toHaveTextContent('true');
      expect(screen.getByTestId('nopeEnabled')).toHaveTextContent('true');
    });
  });

  describe('setters', () => {
    it('should save strikethrough setting', async () => {
      function SetterTest() {
        const { setStrikethrough } = useCheckboxSettings();
        return <button onClick={() => void setStrikethrough(false)}>Toggle</button>;
      }

      render(
        <CheckboxSettingsProvider>
          <SetterTest />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(mockElectronAPI.appState.get).toHaveBeenCalled();
      });

      screen.getByText('Toggle').click();

      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('checkboxStrikethrough', 'false');
      });
    });

    it('should save autoReorder setting', async () => {
      function SetterTest() {
        const { setAutoReorder } = useCheckboxSettings();
        return <button onClick={() => void setAutoReorder(false)}>Toggle</button>;
      }

      render(
        <CheckboxSettingsProvider>
          <SetterTest />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(mockElectronAPI.appState.get).toHaveBeenCalled();
      });

      screen.getByText('Toggle').click();

      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('checkboxAutoReorder', 'false');
      });
    });

    it('should save nopeEnabled setting', async () => {
      function SetterTest() {
        const { setNopeEnabled } = useCheckboxSettings();
        return <button onClick={() => void setNopeEnabled(false)}>Toggle</button>;
      }

      render(
        <CheckboxSettingsProvider>
          <SetterTest />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(mockElectronAPI.appState.get).toHaveBeenCalled();
      });

      screen.getByText('Toggle').click();

      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('checkboxNopeEnabled', 'false');
      });
    });
  });

  describe('sync getters for non-React code', () => {
    it('should sync module-level getters when context updates', async () => {
      render(
        <CheckboxSettingsProvider>
          <CheckboxSettingsSync />
          <TestConsumer />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      // The sync component should have updated the module-level getters
      expect(getCheckboxStrikethrough()).toBe(true);
      expect(getCheckboxAutoReorder()).toBe(true);
      expect(getCheckboxNopeEnabled()).toBe(true);
    });

    it('should reflect disabled settings in module-level getters', async () => {
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'checkboxStrikethrough') return Promise.resolve('false');
        if (key === 'checkboxAutoReorder') return Promise.resolve('true');
        if (key === 'checkboxNopeEnabled') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      render(
        <CheckboxSettingsProvider>
          <CheckboxSettingsSync />
          <TestConsumer />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      expect(getCheckboxStrikethrough()).toBe(false);
      expect(getCheckboxAutoReorder()).toBe(true);
      expect(getCheckboxNopeEnabled()).toBe(false);
    });
  });

  describe('broadcast listener', () => {
    it('should subscribe to checkbox settings broadcasts on mount', async () => {
      render(
        <CheckboxSettingsProvider>
          <TestConsumer />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(mockElectronAPI.checkboxSettings.onChanged).toHaveBeenCalled();
      });
    });

    it('should reload settings when broadcast is received', async () => {
      let broadcastCallback: () => void = () => {
        /* no-op, will be replaced by mock */
      };
      mockElectronAPI.checkboxSettings.onChanged.mockImplementation((callback: () => void) => {
        broadcastCallback = callback;
        return () => {
          /* unsubscribe */
        };
      });

      render(
        <CheckboxSettingsProvider>
          <CheckboxSettingsSync />
          <TestConsumer />
        </CheckboxSettingsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      // Initial values
      expect(screen.getByTestId('strikethrough')).toHaveTextContent('true');

      // Change the mock to return different values
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'checkboxStrikethrough') return Promise.resolve('false');
        if (key === 'checkboxAutoReorder') return Promise.resolve('true');
        if (key === 'checkboxNopeEnabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      // Trigger the broadcast
      broadcastCallback();

      // Should reload and update
      await waitFor(() => {
        expect(screen.getByTestId('strikethrough')).toHaveTextContent('false');
      });
    });
  });
});
