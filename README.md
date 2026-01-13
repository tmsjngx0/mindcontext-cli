# mindcontext

Git-based project progress tracker for Claude Code. Track progress across multiple projects and machines without merge conflicts.

## Features

- **Zero merge conflicts** - Machine-unique timestamped files, not a single state file
- **Multi-project dashboard** - See all your projects in one place
- **Offline-first** - Works locally, syncs when online
- **OpenSpec integration** - Auto-detects tasks and progress from `openspec/changes/`
- **Claude Code integration** - Generated commands for session context loading

## Installation

```bash
npm install -g mindcontext
```

Requires Node.js 18+.

## Quick Start

### One-time setup

```bash
# Initialize mindcontext
mc init

# When prompted, enter your dashboard repo URL
# (Create one from https://github.com/tmsjngx0/mindcontext-template)
```

This creates `~/.mindcontext/` with your configuration and clones the dashboard repo.

### Per-project setup

```bash
cd my-project
mc connect

# Or with category and auto-sync hooks
mc connect --category work --with-hooks
```

This:
1. Registers the project in your config
2. Detects OpenSpec if present
3. Creates `.claude/commands/mc/` with Claude Code commands

### Daily usage

```bash
mc sync              # Create progress update and push
mc progress          # View progress in terminal
mc progress --web    # Open dashboard in browser
mc pull              # Get updates from other machines
```

## Commands

### `mc init`

Initialize mindcontext on your machine.

```bash
mc init
```

Creates `~/.mindcontext/` directory with:
- `config.json` - Settings and project registry
- `repo/` - Git repository for progress updates

**Options:**
- `--quiet, -q` - Suppress output

### `mc connect`

Connect current project to mindcontext.

```bash
mc connect
mc connect --category work
mc connect my-custom-name --category personal
mc connect --with-hooks
```

**Options:**
- `--category <name>` - Categorize the project (default: "default")
- `--with-hooks` - Generate `.claude/hooks/session-end.js` for auto-sync
- `--quiet, -q` - Suppress output

Generated files in `.claude/commands/mc/`:
- `prime.md` - Load context at session start
- `update.md` - Save context at session end
- `progress.md` - Show progress
- `context.md` - Output raw context

### `mc sync`

Create a progress update and push to remote.

```bash
mc sync
mc sync --dry-run
mc sync --notes "Fixed auth bug
Added unit tests" --next "Deploy to staging
Write docs"
```

**Options:**
- `--notes <text>` - Session notes (newline-separated)
- `--next <text>` - Next tasks (newline-separated)
- `--dry-run` - Show what would be created without writing
- `--quiet, -q` - Suppress output

Creates a timestamped JSON file in the dashboard repo:
```
~/.mindcontext/repo/projects/{project}/updates/{timestamp}_{machine}_{hash}.json
```

### `mc pull`

Pull latest updates from remote.

```bash
mc pull
```

Fetches updates from all machines and team members.

### `mc context`

Output current project context.

```bash
mc context
mc context --json
```

**Options:**
- `--json` - Output as JSON (for scripting/integration)
- `--quiet, -q` - Suppress headers

Shows:
- Project connection status
- Current OpenSpec change and progress
- Last update details

### `mc progress`

Show progress across all projects.

```bash
mc progress
mc progress --web
```

**Options:**
- `--web` - Open the web dashboard in your browser
- `--quiet, -q` - Suppress decorations

### `mc config`

View or update configuration.

```bash
mc config                              # Show all config
mc config --get dashboard-repo         # Get specific value
mc config --dashboard-repo git@github.com:user/repo.git
mc config --dashboard-url https://user.github.io/repo
```

**Options:**
- `--get <key>` - Get a specific config value
- `--dashboard-repo <url>` - Set dashboard git repository
- `--dashboard-url <url>` - Set dashboard web URL
- `--quiet, -q` - Suppress output

### `mc migrate`

Migrate from legacy `.project/` and `focus.json`.

```bash
mc migrate
mc migrate --dry-run
mc migrate --yes
mc migrate --skip-project --skip-focus
```

**Options:**
- `--dry-run` - Show what would be migrated
- `--yes, -y` - Auto-confirm (required for actual migration)
- `--skip-project` - Skip `.project/` directory migration
- `--skip-focus` - Skip `focus.json` migration
- `--quiet, -q` - Suppress output

### `mc cleanup`

Remove old update files.

```bash
mc cleanup
mc cleanup --older-than 60
mc cleanup --dry-run
```

**Options:**
- `--older-than <days>` - Days threshold (default: 30)
- `--dry-run` - Show what would be deleted
- `--quiet, -q` - Suppress output

### `mc reset`

Remove mindcontext completely and start fresh.

```bash
mc reset --force
mc reset --force --dry-run
```

**Options:**
- `--force` - Required to confirm destructive action
- `--dry-run` - Show what would be deleted
- `--quiet, -q` - Suppress output

## OpenSpec Integration

MindContext automatically detects and reads OpenSpec changes:

```
my-project/
├── openspec/
│   └── changes/
│       └── add-feature/
│           └── tasks.md    ← Auto-parsed for progress
```

The `mc sync` command:
1. Finds the active change (not in `archive/`)
2. Counts checked `- [x]` vs unchecked `- [ ]` tasks
3. Includes progress in the update file

## Claude Code Integration

After `mc connect`, use these commands in Claude Code:

| Command | Purpose |
|---------|---------|
| `/mc:prime` | Load context at session start |
| `/mc:update` | Save context at session end |
| `/mc:progress` | Show current progress |
| `/mc:context` | Output raw context JSON |

### Auto-sync with hooks

With `--with-hooks`, a session-end hook automatically syncs:

```javascript
// .claude/hooks/session-end.js
module.exports = async function() {
  execSync('mc sync --quiet', { timeout: 10000 });
};
```

## Update File Format

Each sync creates a JSON file:

```json
{
  "timestamp": "2025-01-08T10:30:00Z",
  "machine": "thomas-mac",
  "project": "my-project",
  "progress": {
    "change": "add-feature",
    "tasks_done": 3,
    "tasks_total": 7,
    "source": "openspec"
  },
  "context": {
    "current_task": "Working on add-feature",
    "status": "in_progress",
    "notes": ["Fixed auth bug", "Added tests"],
    "next": ["Deploy to staging"]
  },
  "recent_commits": [
    "abc1234 feat: add login endpoint"
  ]
}
```

## Directory Structure

```
~/.mindcontext/
├── config.json          # Settings + project registry
├── repo/                # Dashboard git clone
│   └── projects/
│       └── my-project/
│           └── updates/
│               └── 2025-01-08T10-30-00Z_thomas-mac_abc123.json
└── pending.json         # Offline queue (auto-managed)
```

## Configuration File

```json
{
  "dashboard_repo": "git@github.com:user/dashboard.git",
  "dashboard_url": "https://user.github.io/dashboard",
  "machine": {
    "id": "abc123def456",
    "name": "thomas-mac"
  },
  "projects": {
    "my-project": {
      "path": "/home/user/my-project",
      "category": "work",
      "openspec": true
    }
  }
}
```

## Team Collaboration

Multiple team members can use the same dashboard repository:

1. Each member runs `mc init` with the same dashboard repo URL
2. Each `mc sync` creates a unique file (no conflicts!)
3. `mc pull` fetches everyone's updates
4. Dashboard shows who's working on what

## Offline Support

- `mc sync` always commits locally
- Push only happens when online (failure is OK)
- Run `mc sync` again when back online to push pending changes

## License

MIT
