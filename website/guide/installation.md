# Installation

## Desktop Application

### Prerequisites

- **Node.js**: Version 18 or higher
- **pnpm**: Version 8 or higher

### Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/notecove/notecove.git
cd notecove
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Build shared packages**

```bash
pnpm build
```

4. **Run the desktop app**

```bash
pnpm --filter @notecove/desktop dev
```

The app will launch in development mode with hot-reload enabled.

### Production Build

To create a production build:

```bash
pnpm --filter @notecove/desktop build
```

The built application will be available in `packages/desktop/dist/`.

## iOS Application

The iOS app is currently in development. Check back soon for installation instructions.

## System Requirements

### Desktop

- **macOS**: 10.13 or later
- **Windows**: Windows 10 or later
- **Linux**: Ubuntu 18.04 or equivalent

### iOS

- **iOS**: 15.0 or later (coming soon)

## Cloud Storage Setup

NoteCove syncs via shared folders on your cloud storage provider:

- **Dropbox**: Install Dropbox desktop app and ensure sync is enabled
- **Google Drive**: Install Google Drive desktop app (Drive File Stream or Backup and Sync)
- **iCloud Drive**: Built into macOS, ensure iCloud Drive is enabled in System Preferences

After NoteCove is installed, you'll configure which cloud folder to use for sync during first launch.

## Troubleshooting

### Build Errors

If you encounter build errors, try:

```bash
# Clean all build artifacts
pnpm clean

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Rebuild
pnpm build
```

### Sync Issues

If notes aren't syncing:

1. Verify your cloud storage desktop app is running and syncing
2. Check the sync folder permissions
3. Review the activity log (Help → View Activity Log)

## Next Steps

- [Learn basic usage](/guide/basic-usage)
- [Configure sync](/guide/sync-configuration)
