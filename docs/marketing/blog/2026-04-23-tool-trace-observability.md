---
title: "See Exactly What Your AI Agent Did: Tool Trace is Live"
date: 2026-04-23
slug: tool-trace-observability
description: "Every A2A response now includes a full tool trace — see every tool your agent called, what it received, and what it returned. Debugging AI agents just got real."
tags: [observability, debugging, A2A, enterprise, platform]
---

**Status:** Live — PR #1686 merged 2026-04-23

# See Exactly What Your AI Agent Did: Tool Trace is Live

When an AI agent makes a mistake, the instinct is to ask it to explain itself. But the real answer is in what it *did* — and until now, you'd have to instrument your own tracing to see that.

Tool Trace changes that. Every A2A response from Molecule now includes a `tool_trace` array in `Message.metadata`: a structured, timestamped log of every tool your agent called, what arguments it passed, and a preview of what it got back.

No extra SDK calls. No plugin to install. It's there by default.

## What the trace looks like

```json
{
  "metadata": {
    "tool_trace": [
      {
        "tool_name": "mcp-code-search",
        "input": { "query": "org-scoped API keys creation flow" },
        "output_preview": "found 3 files in 0.12s"
      },
      {
        "tool_name": "mcp-file-read",
        "input": { "path": "docs/api-keys.md" },
        "output_preview": "...64 lines, 2 code blocks..."
      }
    ]
  }
}
```

Each entry is capped at a summary `output_preview` — not the full response — so you get the signal without the data dump. The trace is capped at 200 entries per response to prevent runaway loops from generating megabytes of metadata.

## Parallel tool calls, correctly traced

Modern AI agents often call multiple tools concurrently. Tool Trace handles this with `run_id` pairing: each tool invocation carries a run identifier that connects the start event to the end event, so you can reconstruct the full execution tree even when calls overlap in time.

```python
from molecule_core import MoleculeClient

client = MoleculeClient(org="acme-corp", token=os.environ["MOLECULE_ORG_TOKEN"])
response = client.messages.send(
    workspace_id="ws-abc123",
    text="Find all docs mentioning API keys and summarize each one"
)

for entry in response.messages[-1].metadata.get("tool_trace", []):
    print(f"[{entry['tool_name']}] {entry['input']} → {entry['output_preview']}")
```

## Why this matters for production

Tool Trace is not a debugging toy. In production, it's the foundation of a real observability practice:

- **Post-incident review** — replay exactly which tool returned bad data, which call chain led to the hallucinated answer
- **Cost attribution** — see which tool calls drove token consumption
- **Compliance auditing** — prove what actions an agent took before it touched a sensitive resource
- **SLA verification** — confirm the right tools were called in the right order for regulated workflows

## What's stored where

Trace data is written to `activity_logs.tool_trace` as a JSONB column. It persists with your activity logs and is accessible via the standard activity log query API — no separate storage path to manage.

## Try it now

Tool Trace is live on all Molecule workspaces running the current platform build. Send any task that triggers two or more tool calls and inspect the `metadata.tool_trace` on the final response message. No configuration required.

See the [A2A response format docs](/docs/api/a2a-response-format.md) for the full schema, or check the [observability guide](/docs/guides/observability.md) for integration patterns.
