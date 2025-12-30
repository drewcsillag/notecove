/**
 * Profile Picker Component
 *
 * Displays a list of profiles for the user to select from.
 * Communicates with the main process via IPC to load/select profiles.
 */

import React, { useState, useEffect } from 'react';

import type { ProfileMode } from '@notecove/shared';
import { WizardContainer } from './wizard';

/** Profile type from preload */
interface Profile {
  id: string;
  name: string;
  isDev: boolean;
  mode?: ProfileMode;
  created: number;
  lastUsed: number;
}

/** Data returned by getProfiles */
interface ProfilesData {
  profiles: Profile[];
  defaultProfileId: string | null;
  skipPicker: boolean;
  isDevBuild: boolean;
}

/** Wizard configuration for creating a profile */
interface WizardConfig {
  name: string;
  mode: ProfileMode;
  storagePath?: string;
  username?: string;
  handle?: string;
}

/** Profile picker API interface */
interface ProfilePickerAPI {
  getProfiles: () => Promise<ProfilesData>;
  selectProfile: (profileId: string, skipPicker: boolean) => Promise<void>;
  cancel: () => Promise<void>;
  createProfile: (name: string) => Promise<Profile>;
  createProfileWithConfig: (config: WizardConfig) => Promise<Profile>;
  deleteProfile: (profileId: string) => Promise<void>;
  renameProfile: (profileId: string, newName: string) => Promise<void>;
  getCloudStoragePaths: () => Promise<Record<string, string>>;
  getDefaultStoragePath: () => Promise<string>;
  selectStoragePath: (defaultPath?: string) => Promise<string | null>;
}

/** Declare the preload API type */
declare global {
  interface Window {
    profilePickerAPI: ProfilePickerAPI | undefined;
  }
}

export function ProfilePicker(): React.ReactElement {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDevBuild, setIsDevBuild] = useState(false);
  const [skipPicker, setSkipPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [renamingProfileId, setRenamingProfileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Load profiles on mount
  useEffect(() => {
    async function loadProfiles(): Promise<void> {
      if (!window.profilePickerAPI) {
        setError('Profile API not available');
        setLoading(false);
        return;
      }

      try {
        const data = await window.profilePickerAPI.getProfiles();

        // Filter profiles based on build type:
        // - Production build: hide dev profiles
        // - Dev build: show all profiles
        const filteredProfiles = data.isDevBuild
          ? data.profiles // Dev build shows all
          : data.profiles.filter((p) => !p.isDev); // Prod hides dev profiles

        setProfiles(filteredProfiles);
        setIsDevBuild(data.isDevBuild);

        // Pre-select the default or most recently used profile
        // In dev builds, only consider dev profiles for pre-selection to prevent
        // accidentally defaulting to a production profile
        const preSelectCandidates = data.isDevBuild
          ? filteredProfiles.filter((p) => p.isDev)
          : filteredProfiles;

        // Check if defaultProfileId is valid for pre-selection
        const defaultIsValid =
          data.defaultProfileId && preSelectCandidates.some((p) => p.id === data.defaultProfileId);

        if (defaultIsValid) {
          setSelectedId(data.defaultProfileId);
        } else if (preSelectCandidates.length > 0) {
          // Sort by lastUsed and select the most recent
          const sorted = [...preSelectCandidates].sort((a, b) => b.lastUsed - a.lastUsed);
          setSelectedId(sorted[0]?.id ?? null);
        }
        // If no candidates (dev build with only prod profiles), leave selectedId as null
        // User must explicitly click to select a production profile

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profiles');
        setLoading(false);
      }
    }

    void loadProfiles();
  }, []);

  // Handle profile selection
  const handleSelect = async (): Promise<void> => {
    if (!selectedId || !window.profilePickerAPI) return;

    try {
      await window.profilePickerAPI.selectProfile(selectedId, skipPicker);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select profile');
    }
  };

  // Handle wizard completion - profile was created via wizard
  const handleWizardComplete = (newProfile: Profile): void => {
    setProfiles((prev) => [...prev, newProfile]);
    setSelectedId(newProfile.id);
    setShowWizard(false);
  };

  // Handle wizard cancellation
  const handleWizardCancel = (): void => {
    setShowWizard(false);
  };

  // Handle deleting a profile
  const handleDeleteProfile = async (profileId: string): Promise<void> => {
    if (!window.profilePickerAPI) return;

    try {
      await window.profilePickerAPI.deleteProfile(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      if (selectedId === profileId) {
        setSelectedId(
          profiles.length > 1 ? (profiles.find((p) => p.id !== profileId)?.id ?? null) : null
        );
      }
      setDeletingProfileId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
    }
  };

  // Handle renaming a profile
  const handleRenameProfile = async (): Promise<void> => {
    if (!renamingProfileId || !renameValue.trim() || !window.profilePickerAPI) return;

    try {
      await window.profilePickerAPI.renameProfile(renamingProfileId, renameValue.trim());
      setProfiles((prev) =>
        prev.map((p) => (p.id === renamingProfileId ? { ...p, name: renameValue.trim() } : p))
      );
      setRenamingProfileId(null);
      setRenameValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename profile');
    }
  };

  // Start renaming a profile
  const startRename = (profile: Profile): void => {
    setRenamingProfileId(profile.id);
    setRenameValue(profile.name);
  };

  // Handle cancel
  const handleCancel = async (): Promise<void> => {
    if (!window.profilePickerAPI) return;
    await window.profilePickerAPI.cancel();
  };

  // Format date for display
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading profiles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
        <button style={styles.button} onClick={() => void handleCancel()}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Fixed Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Select Profile</h1>
        {isDevBuild && <div style={styles.devBanner}>Development Build</div>}
        <p style={styles.subtitle}>Choose a profile to launch NoteCove with:</p>
      </div>

      {/* Scrollable Middle */}
      <div style={styles.scrollableMiddle}>
        {/* Profile list */}
        <div style={styles.profileList}>
          {profiles.length === 0 ? (
            <div style={styles.emptyState}>No profiles yet. Create one to get started.</div>
          ) : (
            profiles.map((profile) => (
              <div
                key={profile.id}
                data-testid={`profile-item-${profile.id}`}
                style={{
                  ...styles.profileItem,
                  ...(selectedId === profile.id ? styles.profileItemSelected : {}),
                }}
                onClick={() => {
                  setSelectedId(profile.id);
                }}
                onDoubleClick={() => void handleSelect()}
              >
                {renamingProfileId === profile.id ? (
                  <div style={styles.renameForm}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => {
                        setRenameValue(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRenameProfile();
                        if (e.key === 'Escape') {
                          setRenamingProfileId(null);
                          setRenameValue('');
                        }
                      }}
                      style={styles.renameInput}
                      autoFocus
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />
                    <button
                      style={styles.iconButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRenameProfile();
                      }}
                      title="Save"
                    >
                      ✓
                    </button>
                    <button
                      style={styles.iconButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingProfileId(null);
                        setRenameValue('');
                      }}
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={styles.profileInfo}>
                      <div style={styles.profileName}>
                        {profile.name}
                        {profile.isDev && <span style={styles.devBadge}>DEV</span>}
                      </div>
                      <div style={styles.profileMeta}>
                        Last used: {formatDate(profile.lastUsed)}
                      </div>
                    </div>
                    <div style={styles.profileActions}>
                      <button
                        style={styles.iconButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(profile);
                        }}
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button
                        style={styles.iconButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProfileId(profile.id);
                        }}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fixed Footer */}
      <div style={styles.footer}>
        {/* New Profile button - shows wizard */}
        <button
          style={styles.buttonSecondary}
          onClick={() => {
            setShowWizard(true);
          }}
        >
          + New Profile
        </button>

        {/* Don't ask again checkbox (production only) */}
        {!isDevBuild && profiles.length > 0 && (
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={skipPicker}
              onChange={(e) => {
                setSkipPicker(e.target.checked);
              }}
            />
            <span>Don&apos;t ask again (use this profile automatically)</span>
          </label>
        )}

        {/* Action buttons */}
        <div style={styles.actions}>
          <button style={styles.buttonSecondary} onClick={() => void handleCancel()}>
            Cancel
          </button>
          <button style={styles.button} onClick={() => void handleSelect()} disabled={!selectedId}>
            Launch
          </button>
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {deletingProfileId && (
        <div style={styles.overlay}>
          <div style={styles.confirmDialog}>
            <p style={styles.confirmText}>
              Are you sure you want to delete this profile? The profile data will remain on disk.
            </p>
            <div style={styles.confirmButtons}>
              <button
                style={styles.buttonSecondary}
                onClick={() => {
                  setDeletingProfileId(null);
                }}
              >
                Cancel
              </button>
              <button
                style={styles.buttonDanger}
                onClick={() => void handleDeleteProfile(deletingProfileId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wizard overlay */}
      {showWizard && (
        <div style={styles.wizardOverlay}>
          <div style={styles.wizardContainer}>
            <WizardContainer onComplete={handleWizardComplete} onCancel={handleWizardCancel} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Styles for the picker - using explicit type for all style properties */
const stylesData = {
  container: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px',
    maxWidth: '440px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    boxSizing: 'border-box', // Include padding in height calculation
    overflow: 'hidden',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
  },
  scrollableMiddle: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0, // Required for flex child to scroll
    marginBottom: '16px',
  },
  footer: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    margin: 0,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  devBanner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'center',
  },
  profileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    border: '2px solid #ccc',
    borderRadius: '8px',
    padding: '8px',
  },
  profileItem: {
    padding: '12px',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '2px solid transparent',
    backgroundColor: '#f9f9f9',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileItemSelected: {
    backgroundColor: '#e8f4ff',
    borderColor: '#0066cc',
  },
  profileName: {
    fontWeight: 500,
    fontSize: '14px',
    color: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  profileMeta: {
    fontSize: '12px',
    color: '#888',
    marginTop: '4px',
  },
  devBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
    color: '#888',
    fontSize: '14px',
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  createFormButtons: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#666',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '8px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  buttonSecondary: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    textAlign: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileActions: {
    display: 'flex',
    gap: '4px',
    opacity: 0.5,
  },
  iconButton: {
    padding: '4px 8px',
    fontSize: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#666',
  },
  confirmDialog: {
    backgroundColor: '#fff3cd',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #ffc107',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    maxWidth: '320px',
  },
  confirmText: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: '#856404',
  },
  confirmButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  buttonDanger: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  renameForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  renameInput: {
    flex: 1,
    padding: '6px 8px',
    fontSize: '14px',
    border: '1px solid #0066cc',
    borderRadius: '4px',
    outline: 'none',
  },
  wizardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    boxSizing: 'border-box',
  },
  wizardContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
} as const satisfies Record<string, React.CSSProperties>;

// Type-safe styles access
const styles = stylesData as { [K in keyof typeof stylesData]: React.CSSProperties };
