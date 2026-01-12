---
description: Load context and show what to work on
---

# Prime Context

Load project context at the start of your session.

## Step 1: Get Current Context

```bash
mc context --json
```

## Step 2: Get OpenSpec Progress

Check current OpenSpec change and progress:
```bash
mc progress
```

## Step 3: Load Last Session Notes

From the context output, identify:
- **Last session summary** - What was accomplished
- **Next tasks** - What was planned for this session
- **Current change** - The OpenSpec change being worked on
- **Progress** - Tasks completed vs total

## Step 4: Show Context Summary

Display to the user:

```
SESSION CONTEXT LOADED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: [project name]
Change: [current openspec change]
Progress: [tasks_done]/[tasks_total] ([percentage]%)

Last Session:
- [notes from last update]

Planned for This Session:
- [next tasks from last update]

Ready to continue? Use /mc:progress to see detailed status.
```

## Step 5: Suggest Next Action

Based on context, suggest what to work on:
- If there are "next" tasks, suggest starting with those
- If OpenSpec has incomplete tasks, mention them
- If no context, suggest running `mc connect` or starting fresh
