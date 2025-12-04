# Profile Presence Design

## Overview

Each profile that connects to an SD writes a presence file identifying itself. This enables the Stale Sync UI to show meaningful device/user names instead of UUIDs.

## File Location

```
{SD}/profiles/{profileId}.json
```

## Schema

```typescript
interface ProfilePresence {
  profileId: string; // UUID, same as activity log filename
  profileName: string; // e.g., "Personal", "Work"
  user: string; // @mention handle, e.g., "@drew"
  username: string; // Display name, e.g., "Drew Colthorp"
  hostname: string; // Machine name, e.g., "Drews-MacBook-Pro.local"
  platform: string; // "darwin" | "win32" | "linux"
  appVersion: string; // e.g., "0.1.2"
  lastUpdated: number; // Unix timestamp (ms)
}
```

## Write Triggers

The presence file is written when:

1. **First connect to SD** - Profile mounts an SD it hasn't seen before
2. **@user changes** - User updates their mention handle in settings
3. **username changes** - User updates their display name in settings
4. **profileName changes** - User renames the profile
5. **hostname changes** - Detected on app startup (compare to cached value)
6. **appVersion changes** - App upgrade detected on startup

## Read Strategy

### On SD Mount

1. Read `{SD}/profiles/*.json`
2. Parse each file
3. Cache in local DB table `profile_presence_cache`
4. If parse fails, keep existing cached value

### Cache Table Schema

```sql
CREATE TABLE profile_presence_cache (
  profile_id TEXT PRIMARY KEY,
  sd_id TEXT NOT NULL,
  profile_name TEXT,
  user TEXT,
  username TEXT,
  hostname TEXT,
  platform TEXT,
  app_version TEXT,
  last_updated INTEGER,
  cached_at INTEGER NOT NULL
);
```

### Handling Partial Writes

Cloud sync can expose partially-written files. Strategy:

1. Attempt JSON parse
2. If parse fails, log warning and use cached value
3. Retry parse on next SD poll (e.g., every 30 seconds)
4. `lastUpdated` field helps detect if cached value is stale

## Deriving "Last Seen"

Instead of updating presence file continuously, derive "last seen" from:

```typescript
// Get most recent activity log entry for this profile
const activityLogPath = `${sdPath}/activity/${profileId}.log`;
const lastLine = readLastLine(activityLogPath);
const [noteId, instanceSeq] = lastLine.split('|');
// instanceSeq contains timestamp implicitly via sequence ordering
```

For display purposes, can show relative time based on file mtime of the activity log.

## UI Display

In Stale Sync UI:

| From                | Derived Display                              |
| ------------------- | -------------------------------------------- |
| `user` + `hostname` | "@drew (MacBook Pro)"                        |
| Missing presence    | "{profileId} (unknown device)"               |
| Stale presence      | "@drew (MacBook Pro) - info may be outdated" |

Staleness indicator: If `lastUpdated` is >7 days old AND activity log has recent entries, show the hint.
