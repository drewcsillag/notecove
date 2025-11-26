/**
 * Profile Picker Entry Point
 *
 * Minimal entry point for the profile picker window.
 * This is a separate React app from the main renderer.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ProfilePicker } from './ProfilePicker';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ProfilePicker />
  </React.StrictMode>
);
