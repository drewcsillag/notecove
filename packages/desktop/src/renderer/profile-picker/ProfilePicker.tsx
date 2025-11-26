/**
 * Profile Picker Component
 *
 * Displays a list of profiles for the user to select from.
 * Communicates with the main process via IPC to load/select profiles.
 */

import React, { useState, useEffect } from 'react';

/** Profile type from preload */
interface Profile {
  id: string;
  name: string;
  isDev: boolean;
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

/** Declare the preload API type */
declare global {
  interface Window {
    profilePickerAPI?: {
      getProfiles: () => Promise<ProfilesData>;
      selectProfile: (profileId: string, skipPicker: boolean) => Promise<void>;
      cancel: () => Promise<void>;
      createProfile: (name: string) => Promise<Profile>;
    };
  }
}

export function ProfilePicker(): React.ReactElement {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDevBuild, setIsDevBuild] = useState(false);
  const [skipPicker, setSkipPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

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
        setProfiles(data.profiles);
        setIsDevBuild(data.isDevBuild);

        // Pre-select the default or most recently used profile
        if (data.defaultProfileId) {
          setSelectedId(data.defaultProfileId);
        } else if (data.profiles.length > 0) {
          // Sort by lastUsed and select the most recent
          const sorted = [...data.profiles].sort((a, b) => b.lastUsed - a.lastUsed);
          setSelectedId(sorted[0]?.id ?? null);
        }

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

  // Handle creating a new profile
  const handleCreateProfile = async (): Promise<void> => {
    if (!newProfileName.trim() || !window.profilePickerAPI) return;

    try {
      const newProfile = await window.profilePickerAPI.createProfile(newProfileName.trim());
      setProfiles((prev) => [...prev, newProfile]);
      setSelectedId(newProfile.id);
      setNewProfileName('');
      setCreatingProfile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    }
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
        <button style={styles.button} onClick={handleCancel}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Select Profile</h1>

      {isDevBuild && (
        <div style={styles.devBanner}>
          Development Build
        </div>
      )}

      <p style={styles.subtitle}>
        Choose a profile to launch NoteCove with:
      </p>

      {/* Profile list */}
      <div style={styles.profileList}>
        {profiles.length === 0 ? (
          <div style={styles.emptyState}>
            No profiles yet. Create one to get started.
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              style={{
                ...styles.profileItem,
                ...(selectedId === profile.id ? styles.profileItemSelected : {}),
              }}
              onClick={() => setSelectedId(profile.id)}
              onDoubleClick={handleSelect}
            >
              <div style={styles.profileName}>
                {profile.name}
                {profile.isDev && <span style={styles.devBadge}>DEV</span>}
              </div>
              <div style={styles.profileMeta}>
                Last used: {formatDate(profile.lastUsed)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create profile form */}
      {creatingProfile ? (
        <div style={styles.createForm}>
          <input
            type="text"
            placeholder="Profile name..."
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateProfile();
              if (e.key === 'Escape') setCreatingProfile(false);
            }}
            style={styles.input}
            autoFocus
          />
          <div style={styles.createFormButtons}>
            <button
              style={styles.buttonSecondary}
              onClick={() => setCreatingProfile(false)}
            >
              Cancel
            </button>
            <button
              style={styles.button}
              onClick={() => void handleCreateProfile()}
              disabled={!newProfileName.trim()}
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <button
          style={styles.buttonSecondary}
          onClick={() => setCreatingProfile(true)}
        >
          + New Profile
        </button>
      )}

      {/* Don't ask again checkbox (production only) */}
      {!isDevBuild && profiles.length > 0 && (
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={skipPicker}
            onChange={(e) => setSkipPicker(e.target.checked)}
          />
          <span>Don't ask again (use this profile automatically)</span>
        </label>
      )}

      {/* Action buttons */}
      <div style={styles.actions}>
        <button style={styles.buttonSecondary} onClick={() => void handleCancel()}>
          Cancel
        </button>
        <button
          style={styles.button}
          onClick={() => void handleSelect()}
          disabled={!selectedId}
        >
          Launch
        </button>
      </div>
    </div>
  );
}

/** Styles for the picker */
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px',
    maxWidth: '440px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
    maxHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #e5e5e5',
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
};
