---
description: Sync progress update with session context
---

# Sync Progress

Sync your progress to the dashboard with auto-generated session context.

## Step 1: Generate Session Summary

From your conversation context, summarize what was accomplished this session:
- Recent code changes and commits
- Tasks completed
- Features implemented or bugs fixed
- Key decisions made

Create 3-5 concise bullet points.

## Step 2: Generate Next Tasks

From OpenSpec and conversation context, identify what should be done next:
- Remaining tasks from current OpenSpec change
- Blockers or pending items mentioned
- Follow-up work identified during session

Create 2-4 actionable next task items.

## Step 3: Run mc sync

```bash
mc sync --notes "First accomplishment
Second accomplishment
Third item" --next "Next task 1
Next task 2"
```

Use multiline strings - each line becomes one item.

## Step 4: Show Confirmation

```
PROGRESS SYNCED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Session Summary:
- [generated notes]

Next Session:
- [generated next tasks]
```
