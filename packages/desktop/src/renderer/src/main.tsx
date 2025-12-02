/**
 * Renderer Process Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { initApi } from './api';
import App from './App';

// Initialize the API adapter before rendering
// This detects Electron vs browser and sets up window.electronAPI
initApi();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
