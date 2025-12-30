/**
 * Wizard Styles
 *
 * Shared styles for wizard components, matching ProfilePicker design language.
 */

import type React from 'react';

export const wizardStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: '16px',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,

  title: {
    fontSize: '20px',
    fontWeight: 600,
    margin: 0,
    color: '#1a1a1a',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  } as React.CSSProperties,

  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
  } as React.CSSProperties,

  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    paddingTop: '16px',
    borderTop: '1px solid #eee',
  } as React.CSSProperties,

  footerLeft: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  footerRight: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  // Form elements
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  } as React.CSSProperties,

  inputFocused: {
    borderColor: '#0066cc',
  } as React.CSSProperties,

  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
    marginBottom: '4px',
    display: 'block',
  } as React.CSSProperties,

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  } as React.CSSProperties,

  // Buttons
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  } as React.CSSProperties,

  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,

  buttonSecondary: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  } as React.CSSProperties,

  // Mode cards
  modeCard: {
    padding: '16px',
    borderRadius: '8px',
    border: '2px solid #ddd',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    backgroundColor: '#fafafa',
  } as React.CSSProperties,

  modeCardSelected: {
    borderColor: '#0066cc',
    backgroundColor: '#e8f4ff',
  } as React.CSSProperties,

  modeCardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: '4px',
  } as React.CSSProperties,

  modeCardDescription: {
    fontSize: '13px',
    color: '#666',
    lineHeight: 1.4,
  } as React.CSSProperties,

  // Storage path display
  pathDisplay: {
    padding: '10px 12px',
    fontSize: '13px',
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '6px',
    color: '#666',
    wordBreak: 'break-all',
  } as React.CSSProperties,

  // Cloud provider selector
  providerOption: {
    padding: '12px',
    borderRadius: '6px',
    border: '2px solid transparent',
    backgroundColor: '#f9f9f9',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,

  providerOptionSelected: {
    borderColor: '#0066cc',
    backgroundColor: '#e8f4ff',
  } as React.CSSProperties,

  providerName: {
    fontWeight: 500,
    fontSize: '14px',
    color: '#1a1a1a',
  } as React.CSSProperties,

  providerPath: {
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace',
  } as React.CSSProperties,

  // Summary section
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #eee',
  } as React.CSSProperties,

  summaryLabel: {
    fontSize: '14px',
    color: '#666',
  } as React.CSSProperties,

  summaryValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#1a1a1a',
  } as React.CSSProperties,

  // Info box
  infoBox: {
    padding: '12px',
    backgroundColor: '#f0f7ff',
    borderRadius: '6px',
    border: '1px solid #cce0ff',
    fontSize: '13px',
    color: '#0052a3',
    lineHeight: 1.4,
  } as React.CSSProperties,

  // Warning box
  warningBox: {
    padding: '12px',
    backgroundColor: '#fff8e6',
    borderRadius: '6px',
    border: '1px solid #ffe4a0',
    fontSize: '13px',
    color: '#8a6d00',
    lineHeight: 1.4,
  } as React.CSSProperties,

  // Step indicator
  stepIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
  } as React.CSSProperties,

  stepDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ddd',
  } as React.CSSProperties,

  stepDotActive: {
    backgroundColor: '#0066cc',
  } as React.CSSProperties,

  stepDotCompleted: {
    backgroundColor: '#4caf50',
  } as React.CSSProperties,
};
