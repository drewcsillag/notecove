# Phase 5: @-Mentions

**Progress:** `0%`

## Goal

Enable @-mentioning users in comments with autocomplete from profile presence files.

---

## 5.1 Create Mention User IPC Handler

**Status:** 🟥 To Do

**File:** `packages/desktop/src/main/ipc/handlers.ts`

```typescript
interface MentionUser {
  profileId: string;
  handle: string;    // @drew
  name: string;      // Drew Colthorp
}

ipcMain.handle('mention:getUsers', this.handleGetMentionUsers.bind(this));

private async handleGetMentionUsers(): Promise<MentionUser[]> {
  const users: MentionUser[] = [];

  // Current user
  const currentProfileId = this.profileId;
  const currentName = await this.database.getState(AppStateKey.Username) ?? '';
  const currentHandle = await this.database.getState(AppStateKey.UserHandle) ?? '';

  if (currentHandle) {
    users.push({
      profileId: currentProfileId,
      handle: currentHandle,
      name: currentName,
    });
  }

  // Users from profile presence files in all SDs
  const sds = await this.database.getAllStorageDirs();
  for (const sd of sds) {
    const presences = await this.profilePresenceReader.getPresences(sd.id);
    for (const presence of presences) {
      if (presence.profileId === currentProfileId) continue;
      if (!presence.user) continue;
      if (users.find(u => u.profileId === presence.profileId)) continue;

      users.push({
        profileId: presence.profileId,
        handle: presence.user,
        name: presence.username,
      });
    }
  }

  return users;
}
```

Add to preload:

```typescript
mention: {
  getUsers: (): Promise<MentionUser[]> =>
    ipcRenderer.invoke('mention:getUsers'),
},
```

---

## 5.2 Build MentionAutocomplete Component

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/MentionAutocomplete.tsx`

```typescript
interface MentionAutocompleteProps {
  query: string;
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  onSelect,
  onClose,
  anchorEl,
}) => {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [filtered, setFiltered] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load users on mount
  useEffect(() => {
    window.electronAPI.mention.getUsers().then(setUsers);
  }, []);

  // Filter on query change
  useEffect(() => {
    const q = query.toLowerCase();
    const matches = users.filter(
      u => u.handle.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    ).slice(0, 5);
    setFiltered(matches);
    setSelectedIndex(0);
  }, [query, users]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (!anchorEl || filtered.length === 0) return null;

  return (
    <Popper open anchorEl={anchorEl} placement="bottom-start">
      <Paper elevation={8} sx={{ mt: 1 }}>
        <List dense>
          {filtered.map((user, i) => (
            <ListItem
              key={user.profileId}
              button
              selected={i === selectedIndex}
              onClick={() => onSelect(user)}
            >
              <ListItemAvatar>
                <Avatar sx={{ width: 28, height: 28 }}>{user.name.charAt(0)}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={user.name} secondary={user.handle} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Popper>
  );
};
```

---

## 5.3 Integrate with CommentInput

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/CommentInput.tsx`

Track @ trigger and show autocomplete:

```typescript
const [mentionState, setMentionState] = useState<{
  active: boolean;
  query: string;
  startIndex: number;
} | null>(null);

const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const value = e.target.value;
  const cursor = e.target.selectionStart;
  setContent(value);

  // Check for @ trigger
  const textBefore = value.slice(0, cursor);
  const match = textBefore.match(/@(\w*)$/);

  if (match) {
    setMentionState({
      active: true,
      query: match[1],
      startIndex: match.index!,
    });
  } else {
    setMentionState(null);
  }
};

const handleMentionSelect = (user: MentionUser) => {
  if (!mentionState || !inputRef.current) return;

  const before = content.slice(0, mentionState.startIndex);
  const after = content.slice(inputRef.current.selectionStart);
  const newContent = `${before}${user.handle} ${after}`;

  setContent(newContent);
  setMentionState(null);

  // Move cursor after inserted mention
  const newPos = mentionState.startIndex + user.handle.length + 1;
  requestAnimationFrame(() => {
    inputRef.current?.setSelectionRange(newPos, newPos);
    inputRef.current?.focus();
  });
};

// In render:
{mentionState?.active && (
  <MentionAutocomplete
    query={mentionState.query}
    onSelect={handleMentionSelect}
    onClose={() => setMentionState(null)}
    anchorEl={inputRef.current}
  />
)}
```

---

## 5.4 Style Mentions in Rendered Comments

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/CommentContent.tsx`

Parse and render @mentions with styling:

```typescript
const MENTION_REGEX = /@\w+/g;

export const CommentContent: React.FC<{ content: string }> = ({ content }) => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    // Text before mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // Styled mention
    parts.push(
      <Typography
        key={match.index}
        component="span"
        sx={{
          color: 'primary.main',
          fontWeight: 500,
          bgcolor: 'primary.light',
          borderRadius: 0.5,
          px: 0.5,
        }}
      >
        {match[0]}
      </Typography>
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <>{parts}</>;
};
```

Use CommentContent when rendering thread.content and reply.content.

---

## 5.5 Write Tests

**Status:** 🟥 To Do

- Unit: MentionAutocomplete filters correctly
- Unit: CommentContent parses mentions
- Unit: @ trigger detection in CommentInput
- Integration: getUsers returns profile presences
- E2E: Type @, see autocomplete, select user, mention styled

---

## Definition of Done

- [ ] IPC returns users from profile presence
- [ ] Autocomplete shows filtered users
- [ ] Keyboard navigation works
- [ ] Selecting user inserts @handle
- [ ] Mentions styled in rendered comments
- [ ] All tests passing
