/**
 * Login Page for Browser Access
 *
 * Allows users to enter their access token to authenticate
 * with the NoteCove web server.
 */

import React, { useState } from 'react';
import { setToken, validateToken } from '../../api';

interface LoginPageProps {
  onSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [token, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Clean the token (remove whitespace)
      const cleanToken = token.trim();

      if (!cleanToken) {
        setError('Please enter an access token');
        setIsLoading(false);
        return;
      }

      // Store the token temporarily to validate
      setToken(cleanToken);

      // Validate the token
      const isValid = await validateToken();

      if (isValid) {
        onSuccess();
      } else {
        setError('Invalid access token. Please check your token and try again.');
        // Clear the invalid token
        const { clearToken } = await import('../../api');
        clearToken();
      }
    } catch {
      setError('Failed to connect to the server. Please try again.');
      const { clearToken } = await import('../../api');
      clearToken();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NoteCove</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your access token to continue
            </p>
          </div>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Access Token
              </label>
              <input
                type="text"
                id="token"
                value={token}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                }}
                placeholder="Enter your access token"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                autoComplete="off"
                autoFocus
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/30">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              How to get your access token:
            </h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>Open NoteCove on your computer</li>
              <li>Go to Settings &gt; Web Access</li>
              <li>Start the web server</li>
              <li>Copy the access token or scan the QR code</li>
            </ol>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-500">
          Your access token is stored locally and never sent to external servers.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
