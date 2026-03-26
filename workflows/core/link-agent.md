---
description: Symlink the shared .agent folder into a new project so it inherits all skills, workflows, and agents automatically.
---

## Bootstrap a New Project with Shared .agent

Run this single command from your terminal, replacing `<PROJECT_PATH>` with the absolute path to the new project root:

```bash
ln -s "/Users/quantumcode/CODE/AGENTS SKILLS WF/.agent" "<PROJECT_PATH>/.agent"
```

**Example:**
```bash
ln -s "/Users/quantumcode/CODE/AGENTS SKILLS WF/.agent" "/Users/quantumcode/CODE/MY NEW PROJECT/.agent"
```

**Verify it worked:**
```bash
ls -la "<PROJECT_PATH>/.agent"
# Should show: lrwxr-xr-x ... -> /Users/quantumcode/CODE/AGENTS SKILLS WF/.agent
```

## Rules

- Only symlink projects that do **NOT** already have a `.agent/` folder.
- Projects with custom `.agent/` content (e.g., QUANTUMSTORY, MINDIFY) must **NOT** be replaced — they have unique skills/workflows.
- To remove a symlink without deleting the source: `rm "<PROJECT_PATH>/.agent"` (use `rm`, not `rm -rf`).

## Re-run Bulk Symlink (when adding many new projects)

Ask the AI to run the `/link-agent` workflow and provide the list of new project paths.
