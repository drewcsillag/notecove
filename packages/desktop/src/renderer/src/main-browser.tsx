/**
 * Browser Entry Point
 *
 * This is the entry point for the browser build (web interface).
 * It initializes the API adapter before loading the main app.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { initApi } from './api';
import BrowserApp from './BrowserApp';

// Initialize the API adapter before anything else
// This will use the stub if not authenticated, or the web client if authenticated
initApi();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserApp />
  </React.StrictMode>
);
