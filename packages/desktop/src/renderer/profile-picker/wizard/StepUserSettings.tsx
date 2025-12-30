/**
 * Step 4: User Settings
 *
 * Collects optional username and handle.
 * This step is skipped for Paranoid mode.
 */

import React, { useState } from 'react';
import type { StepProps } from './types';
import { wizardStyles } from './styles';

export function StepUserSettings({
  state,
  onStateChange,
  onNext,
  onBack,
  onCancel,
}: StepProps): React.ReactElement {
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [handleFocused, setHandleFocused] = useState(false);

  // This step is always valid - username and handle are optional
  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} style={wizardStyles.container}>
      <div style={wizardStyles.header}>
        <h2 style={wizardStyles.title}>Your Identity</h2>
        <p style={wizardStyles.subtitle}>Optional: Set a display name and handle for your notes</p>
      </div>

      <div style={wizardStyles.content}>
        <div style={wizardStyles.fieldGroup}>
          <label style={wizardStyles.label} htmlFor="username">
            Display Name
          </label>
          <input
            id="username"
            type="text"
            value={state.username}
            onChange={(e) => {
              onStateChange({ username: e.target.value });
            }}
            onFocus={() => {
              setUsernameFocused(true);
            }}
            onBlur={() => {
              setUsernameFocused(false);
            }}
            style={{
              ...wizardStyles.input,
              ...(usernameFocused ? wizardStyles.inputFocused : {}),
            }}
            placeholder="Your name"
          />
        </div>

        <div style={wizardStyles.fieldGroup}>
          <label style={wizardStyles.label} htmlFor="handle">
            Handle
          </label>
          <input
            id="handle"
            type="text"
            value={state.handle}
            onChange={(e) => {
              onStateChange({ handle: e.target.value });
            }}
            onFocus={() => {
              setHandleFocused(true);
            }}
            onBlur={() => {
              setHandleFocused(false);
            }}
            style={{
              ...wizardStyles.input,
              ...(handleFocused ? wizardStyles.inputFocused : {}),
            }}
            placeholder="@username"
          />
        </div>

        <div style={wizardStyles.infoBox}>
          These are used to personalize your notes and can be changed later in Settings. You can
          skip this step if you prefer.
        </div>
      </div>

      <div style={wizardStyles.footer}>
        <div style={wizardStyles.footerLeft}>
          <button type="button" style={wizardStyles.buttonSecondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div style={wizardStyles.footerRight}>
          <button type="button" style={wizardStyles.buttonSecondary} onClick={onBack}>
            Back
          </button>
          <button type="submit" style={wizardStyles.button}>
            Next
          </button>
        </div>
      </div>
    </form>
  );
}
