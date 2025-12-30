# Profiles & Privacy Modes

NoteCove uses profiles to organize your notes and provide different privacy levels for different use cases.

## What Are Profiles?

Profiles are separate note collections with their own:

- **Storage location**: Notes stored in a folder you choose
- **Privacy settings**: Control over network features like link previews
- **User identity**: Optional display name and handle for comments

This lets you maintain separate note collections for different purposes (work, personal, research) or on shared computers.

## Profile Modes

When creating a new profile, you choose a **mode** that determines default settings:

### Local Mode

The standard mode for most users.

- **Storage**: `~/Documents/NoteCove`
- **Privacy**: You choose link preview behavior
- **Cloud**: Can add cloud storage directories later

Best for: Personal notes, general use

### Cloud Mode

Start with cloud-synced storage from the beginning.

- **Storage**: Your chosen cloud provider's folder (iCloud, Dropbox, Google Drive, OneDrive)
- **Privacy**: You choose link preview behavior
- **Sync**: Automatic sync across devices via cloud folder

Best for: Multi-device users, team collaboration

### Paranoid Mode

Maximum privacy for sensitive notes.

- **Storage**: `~/Documents/NoteCove` (local only)
- **Privacy**: All network features disabled
  - No link unfurling or previews
  - No favicon fetching
  - No oEmbed requests
- **Locked**: Cannot add cloud storage or change link settings

Best for: Confidential notes, air-gapped systems, privacy-conscious users

### Custom Mode

Full control over all settings.

- **Storage**: Any folder you choose
- **Privacy**: You choose link preview behavior
- **Flexibility**: Maximum configurability

Best for: Advanced users, specific workflows

## Creating a Profile

The onboarding wizard guides you through profile creation:

### Step 1: Profile Name

Give your profile a descriptive name like "Work Notes" or "Personal Journal".

### Step 2: Mode Selection

Choose from Local, Cloud, Paranoid, or Custom mode based on your needs.

### Step 3: Storage Configuration

Depending on your mode:

- **Local/Paranoid**: Confirms default location (`~/Documents/NoteCove`)
- **Cloud**: Select from detected cloud providers
- **Custom**: Browse to choose any folder

### Step 4: Your Identity (Optional)

Set a display name and handle for use in comments. You can skip this step and set them later in Settings.

### Step 5: Confirmation

Review your choices and create the profile.

## Switching Profiles

When NoteCove launches, you can:

- **Select an existing profile** from the picker
- **Create a new profile** using the wizard
- **Skip the picker** if you have a default profile set

## Profile Settings

After creation, you can modify some profile settings:

| Setting                 | Local | Cloud | Paranoid              | Custom |
| ----------------------- | ----- | ----- | --------------------- | ------ |
| Add storage directories | Yes   | Yes   | No                    | Yes    |
| Link preview mode       | Yes   | Yes   | No (locked to secure) | Yes    |
| Display name/handle     | Yes   | Yes   | No                    | Yes    |

## Privacy Considerations

### What Paranoid Mode Blocks

- **oEmbed requests**: No fetching of video previews, tweet cards, etc.
- **Favicon fetching**: No downloading site icons
- **Link unfurling**: All links appear as plain text
- **Cloud storage**: Cannot add synced storage directories

### What All Modes Share

- **Local storage**: Your notes are always stored on your device
- **No telemetry**: NoteCove never sends your note content anywhere
- **Your cloud, your choice**: Sync uses your own cloud storage accounts

## Technical Details

### Storage Locations

Profiles store notes in a designated folder:

```
~/Documents/NoteCove/           # Default for Local/Paranoid
~/Library/Mobile Documents/     # iCloud
~/Dropbox/                       # Dropbox
~/Google Drive/                  # Google Drive
~/<custom path>/                 # Custom mode
```

### Profile Data

Profile configuration is stored in:

```
~/Library/Application Support/NoteCove/profiles.json
```

This includes:

- Profile ID and name
- Mode setting
- Creation timestamp
- Last used timestamp

Note content is stored in the profile's storage directory, not in the app's data folder.

## Best Practices

### Use Separate Profiles For

- Work and personal notes
- Different clients or projects
- Shared vs. private notes
- Notes requiring extra privacy

### Profile Naming

Use clear, descriptive names:

- "Work - Company Name"
- "Personal Journal"
- "Research - Project X"
- "Confidential"

### Choosing Modes

- Use **Local** if you're unsure - it's the most flexible
- Use **Cloud** if you need sync from day one
- Use **Paranoid** only for truly sensitive content
- Use **Custom** when you have specific storage needs

## Next Steps

- [Learn about folders and organization](/features/folders-organization)
- [Configure sync settings](/guide/sync-configuration)
- [View keyboard shortcuts](/guide/keyboard-shortcuts)
