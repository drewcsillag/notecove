/**
 * Browser App Wrapper
 *
 * Wraps the main App component and handles authentication.
 * Shows a login page if not authenticated, otherwise shows the main app.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { isAuthenticated, validateToken, activateWebClient } from './api';
import LoginPage from './components/LoginPage';
import App from './App';

const BrowserApp: React.FC = () => {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    'loading'
  );

  useEffect(() => {
    // Check for token in URL query params (from QR code)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    const checkAuth = async () => {
      if (urlToken) {
        // Token provided in URL - validate it
        const { setToken } = await import('./api');
        setToken(urlToken);

        // Clear token from URL without reloading
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }

      if (isAuthenticated()) {
        // Validate the stored token
        const valid = await validateToken();
        if (valid) {
          activateWebClient();
          setAuthState('authenticated');
        } else {
          // Token is invalid, clear it
          const { clearToken } = await import('./api');
          clearToken();
          setAuthState('unauthenticated');
        }
      } else {
        setAuthState('unauthenticated');
      }
    };

    void checkAuth();
  }, []);

  const handleLoginSuccess = useCallback(() => {
    activateWebClient();
    setAuthState('authenticated');
  }, []);

  if (authState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  return <App />;
};

export default BrowserApp;
