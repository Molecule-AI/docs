# Failed Workspace EC2 Console Output — Demo Script
**Source:** PR #1178 | **Acceptance:** Working demo + repo link + 1-min screencast

---

## What This Demo Shows

1. Trigger a workspace to fail (bootstrap error, bad config, missing env vars)
2. Open the failed workspace in Canvas
3. Open the error panel — EC2 console output is visible without leaving Canvas
4. Compare: what you used to have to do (open AWS Console, find instance, pull logs)

**Time:** ~90 seconds | **Prereqs:** Self-hosted Molecule AI with EC2 provisioning, or a deployment that has triggered a failed workspace recently

---

## Demo Script

### Step 1: Navigate to a Failed Workspace

Open Canvas. Find a workspace in `failed` state — it will have a red status indicator in the workspace list.

Click into the workspace.

> **On screen:** Red "Failed" badge on the workspace card. Status panel shows last state transition.

### Step 2: Open the Error Panel

In the workspace detail view, locate the error panel (or "Last Error" section).

> **On screen:** The error panel displays `last_sample_error` — a structured summary of what the provisioner observed.

### Step 3: Reveal EC2 Console Output

Click to expand the EC2 console output section within the error panel.

> **On screen:** Full EC2 console log from the instance at the time of failure. Scrollable, timestamped entries.

> **Narrator:** "You can see exactly what the EC2 instance recorded at the moment it failed — boot errors, service exits, OOM kills, anything that went to the console. No AWS Console tab required."

### Step 4: (Optional) Compare the Old Way

If time allows, briefly show the alternative:

1. Open AWS Console in a new tab
2. Navigate to EC2 → Instances
3. Find the instance ID from the workspace metadata
4. Open Instance Settings → Get System Log

> **Narrator:** "This is what debugging a failed workspace looked like before today's release. Two tools, two contexts, a lot of tab-switching."

---

## Screencast Notes

- Start recording before you open Canvas
- Highlight the red "Failed" badge as the entry point
- Expand the EC2 console output section slowly — let viewers read the log entries
- Mention the instance ID or timestamp to show it's real output from the actual instance
- Keep the AWS Console comparison brief — it's contrast, not the main event

**Do not include real AWS credentials or instance IDs in the recording.**

---

*Attach to Molecule-AI/internal#7 for DevRel review.*
