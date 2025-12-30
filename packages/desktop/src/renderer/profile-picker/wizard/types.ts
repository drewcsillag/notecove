/**
 * Wizard Types
 *
 * Shared types for the onboarding wizard components.
 */

import type { ProfileMode } from '@notecove/shared';

/** Wizard step identifiers */
export type WizardStep =
  | 'profileName'
  | 'modeSelection'
  | 'storageConfig'
  | 'userSettings'
  | 'confirmation';

/** Cloud storage provider information */
export interface CloudProvider {
  name: string;
  path: string;
}

/** Wizard state containing all collected data */
export interface WizardState {
  /** Profile name entered by user */
  profileName: string;
  /** Selected profile mode */
  mode: ProfileMode | null;
  /** Storage path (for cloud/custom modes) */
  storagePath: string | null;
  /** Selected cloud provider name (for cloud mode) */
  cloudProvider: string | null;
  /** Username (optional) */
  username: string;
  /** Handle (optional) */
  handle: string;
  /** Detected cloud providers */
  availableCloudProviders: CloudProvider[];
  /** Default storage path (~/Documents/NoteCove) */
  defaultStoragePath: string;
}

/** Props for step components */
export interface StepProps {
  state: WizardState;
  onStateChange: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
}
