---
description: Sync progress to dashboard
---

Run `mc sync` to create a progress update and push to your dashboard.

This will:
1. Read current OpenSpec progress (if present)
2. Create a timestamped update file
3. Commit and push to your dashboard repo

Options:
- `--quiet` - Suppress output
- `--dry-run` - Show what would be done without making changes
