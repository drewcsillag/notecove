# Claude Code Learning System

A self-contained, portable system for Claude Code to learn from its mistakes and detect when it has forgotten instructions.

## Features

### Memory Canaries

Detect when Claude has "forgotten" CLAUDE.md instructions due to context window limits.

Uses environment variable prefix style for Claude Code allowlist compatibility:

- `nc_canary=1` - Required as prefix on all bash commands (proves instructions remembered)
- `nc_ci_passed=1` - Required for git commits (affirms CI was run)
- `nc_user_said_push=1` - Required for git push (affirms user permission)

### Mistake Learning

Automatically capture and learn from mistakes:

- Failed commands are logged to `pending-lessons.jsonl`
- `/learn-mistake` command to record patterns
- `/review-failures` command to extract lessons
- Shared `MISTAKES.md` across worktrees

### Read-Before-Edit Guard

Prevents editing files that weren't read first in the session.

## Installation

### From tarball (portable)

```bash
# Extract anywhere
tar -xzf claude-learning-system.tar.gz

# Install to a project
./learning-system/install.sh /path/to/project [project-id]
```

### From this repo

```bash
# Install to current directory
.claude/learning-system/install.sh

# Install to another project
.claude/learning-system/install.sh /path/to/other/project

# Install with custom project ID (for sharing state across projects)
.claude/learning-system/install.sh /path/to/project myproject
```

### Creating a portable package

```bash
.claude/learning-system/package.sh
# Creates: claude-learning-system.tar.gz
```

## Package Contents

This is a **self-contained** package. Copy the entire `learning-system/` folder to install elsewhere:

```
learning-system/
├── install.sh              # Installer script
├── package.sh              # Create distributable tarball
├── README.md               # This file
├── CLAUDE-SNIPPET.md       # Copy to your CLAUDE.md
├── hooks/                  # Hook scripts (bundled)
│   ├── common.sh           # Shared configuration
│   ├── bash-canary.sh      # PreToolUse: canary checks
│   ├── post-bash.sh        # PostToolUse: log failures
│   ├── edit-canary.sh      # PreToolUse: read-before-edit
│   └── track-read.sh       # PostToolUse: track reads
├── commands/               # Slash commands (bundled)
│   ├── learn-mistake.md    # /learn-mistake command
│   └── review-failures.md  # /review-failures command
└── templates/              # Templates (bundled)
    ├── MISTAKES.md         # Learned patterns template
    ├── settings.json       # Hooks config (version controlled)
    └── settings.local.json # Permissions (gitignored)
```

## Shared State

| Location                               | Contents                           | Scope                                            |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| `~/.claude/shared-learning/<project>/` | MISTAKES.md, pending-lessons.jsonl | Shared across all worktrees with same project ID |
| `.claude/hooks/`, `.claude/commands/`  | Hook scripts, slash commands       | Per-project (version controlled)                 |
| `.claude/settings.json`                | Hooks configuration                | Per-project (version controlled)                 |
| `.claude/settings.local.json`          | Personal permissions/allowlist     | Per-worktree (gitignored)                        |
| `.claude/state/`                       | recent-reads.txt                   | Per-worktree session (gitignored)                |

**Multiple worktrees**: Use the same project ID to share learned mistakes across all worktrees of a project.

## Configuration

Edit `.claude/hooks/common.sh` to customize:

- `PROJECT_ID` - Change to share state across different project names
- `SHARED_STATE_DIR` - Override shared state location
- `LOCAL_STATE_DIR` - Override local state location

Environment variables:

- `CLAUDE_LEARNING_PROJECT` - Override project ID at runtime
- `CLAUDE_LOCAL_STATE_DIR` - Override local state directory

## Usage

### Adding Canaries

```bash
# Every command needs nc_canary=1 prefix
nc_canary=1 pnpm build

# Commits need nc_ci_passed=1
nc_canary=1 nc_ci_passed=1 git commit -m "feat: thing"

# Pushes need nc_user_said_push=1
nc_canary=1 nc_user_said_push=1 git push
```

### Recording Mistakes

When you discover you took the wrong approach:

```
/learn-mistake "Ran full CI during development" "Should run targeted tests" "When feature is incomplete"
```

### Reviewing Failures

Periodically extract lessons from logged failures:

```
/review-failures
```

## How It Works

1. **PreToolUse hooks** fire before every Bash/Edit/Write
2. **bash-canary.sh** checks for required canary markers
3. If missing, hook returns `additionalContext` telling Claude to re-read instructions
4. **PostToolUse hooks** fire after Bash/Read
5. **post-bash.sh** logs failures for later review
6. **track-read.sh** records reads so edit-canary knows what was read

## After Installation

1. **Add to .gitignore**:

   ```
   .claude/state/
   .claude/settings.local.json
   ```

2. **Add canary section to CLAUDE.md**: See `CLAUDE-SNIPPET.md`

3. **Restart Claude Code** to activate hooks
