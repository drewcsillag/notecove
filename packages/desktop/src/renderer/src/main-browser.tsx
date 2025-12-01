/**
 * Browser Entry Point
 *
 * This is the entry point for the browser build (web interface).
 * It initializes the API stub before loading the main app.
 */

import { initBrowserApiStub } from './api/browser-stub';

// Initialize the browser API stub before anything else
initBrowserApiStub();

// Now load the regular app
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
