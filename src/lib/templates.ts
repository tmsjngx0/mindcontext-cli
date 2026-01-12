/**
 * Templates for .claude/ generation.
 * Embedded in code for easy npm distribution.
 */

export const COMMAND_TEMPLATES = {
  'prime.md': `---
description: Load context and show what to work on
---

# Prime Context

Load project context at the start of your session.

## Step 1: Get Current Context

\`\`\`bash
mc context --json
\`\`\`

## Step 2: Load Last Session Notes

From the context output, identify:
- **Last session summary** - What was accomplished
- **Next tasks** - What was planned for this session
- **Current change** - The OpenSpec change being worked on
- **Progress** - Tasks completed vs total

## Step 3: Show Context Summary

Display to the user:

\`\`\`
SESSION CONTEXT LOADED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: [project name]
Change: [current openspec change]
Progress: [tasks_done]/[tasks_total] ([percentage]%)

Last Session:
- [notes from last update]

Planned for This Session:
- [next tasks from last update]
\`\`\`

## Step 4: Suggest Next Action

Based on context, suggest what to work on next.
`,

  'update.md': `---
description: Save session context and sync progress
---

# Update Context

Save your session progress with auto-generated context.

## Step 1: Generate Session Summary

From your conversation context, summarize what was accomplished:
- Recent code changes and commits
- Tasks completed
- Features implemented or bugs fixed

Create 3-5 concise bullet points.

## Step 2: Generate Next Tasks

From OpenSpec and conversation context, identify what should be done next:
- Remaining tasks from current OpenSpec change
- Blockers or pending items mentioned

Create 2-4 actionable next task items.

## Step 3: Run mc sync

\`\`\`bash
mc sync --notes "First accomplishment
Second accomplishment" --next "Next task 1
Next task 2"
\`\`\`

Use multiline strings - each line becomes one item.

## Step 4: Show Confirmation

\`\`\`
PROGRESS SYNCED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Session Summary:
- [generated notes]

Next Session:
- [generated next tasks]
\`\`\`
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
