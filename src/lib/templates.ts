/**
 * Templates for .claude/ generation.
 * Embedded in code for easy npm distribution.
 */

export const COMMAND_TEMPLATES = {
  'sync.md': `---
description: Sync progress to dashboard
---

Run \`mc sync\` to create a progress update and push to your dashboard.

This will:
1. Read current OpenSpec progress (if present)
2. Create a timestamped update file
3. Commit and push to your dashboard repo

Options:
- \`--quiet\` - Suppress output
- \`--dry-run\` - Show what would be done without making changes
`,

  'progress.md': `---
description: Show progress
---

Run \`mc progress\` to see current progress in the terminal.

Options:
- \`--web\` - Open the web dashboard in your browser

This aggregates all update files to show:
- Current change and task completion
- Recent activity across machines
- Team member status (if collaborative)
`,

  'context.md': `---
description: Output current context
---

Run \`mc context\` to output the current project context.

Options:
- \`--json\` - Output as JSON (for integration with other tools)

This shows:
- Project connection status
- Current OpenSpec change and progress
- Last update details
- Team activity summary
`,
};

export const HOOK_TEMPLATES = {
  'session-end.js': `const { execSync } = require('child_process');

module.exports = async function() {
  try {
    execSync('mc sync --quiet', {
      stdio: 'inherit',
      timeout: 10000
    });
  } catch (e) {
    // Sync failed silently - don't block session end
  }
};
`,
};
