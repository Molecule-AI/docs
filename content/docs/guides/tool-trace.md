---
title: "Tool Trace"
description: "See exactly what your agents did — every tool call, input, and output preview, stored in your activity logs. Tool Trace ships inside every A2A response and requires zero instrumentation."
tags: [observability, debugging, compliance, enterprise, tool-trace]
---

# Tool Trace

Tool Trace records every tool an agent calls — the tool name, input arguments, and a sanitized output preview — and stores it in your org's `activity_logs` table. It ships inside every A2A response, requires zero SDK instrumentation, and is queryable via the platform API.

> **Built in, not bolted on.** Tool Trace is enabled by default on all workspaces. There is no feature flag to enable — it starts recording the moment an agent makes its first A2A call.

## What Tool Trace captures

Each A2A response from a workspace includes a `metadata.tool_trace` array. The platform extracts it and persists it to `activity_logs` for every logged event:

```json
{
  "id": "log-abc123",
  "activity_type": "a2a_call",
  "workspace_id": "ws_01hx3k...",
  "method": "message/send",
  "created_at": "2026-04-30T12:01:00Z",
  "tool_trace": [
    {
      "tool": "mcp__files__read",
      "input": {"path": "config.yaml"},
      "output_preview": "api_version: v2, region: us-east-1, ..."
    },
    {
      "tool": "mcp__httpx__get",
      "input": {"url": "https://api.example.com/status"},
      "output_preview": "{\"status\": \"ok\", \"latency_ms\": 42}"
    }
  ],
  "duration_ms": 1842
}
```

### Field definitions

| Field | Description |
|---|---|
| `tool` | The tool or function that was invoked (e.g., `mcp__files__read`, `Bash`, `commit_memory`) |
| `input` | The arguments passed to the tool. Sensitive values (API keys, tokens, long strings) are sanitized before storage. |
| `output_preview` | First 200 characters of the tool's output. Caps large responses to prevent `activity_logs` bloat. |

## Querying activity logs

### List recent tool traces for a workspace

```bash
curl -s "https://your-tenant.moleculesai.app/workspaces/$WS_ID/activity?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | {created_at, tool_trace}'
```

### Find all calls to a specific tool

```bash
curl -s "https://your-tenant.moleculesai.app/workspaces/$WS_ID/activity?limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.[] | select(.tool_trace != null) | {created_at, tools: [.tool_trace[].tool]}'
```

### Trace a specific task

```bash
# List recent logs and filter by tool
curl -s "https://your-tenant.moleculesai.app/workspaces/$WS_ID/activity?limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '[.[] | select(.tool_trace | length > 0) | {
    time: .created_at,
    method: .method,
    calls: [.tool_trace[] | {tool, input}]
  }] | reverse | .[0:10]'
```

## How it works

When a workspace sends an A2A response back to the platform, the platform's A2A proxy extracts `metadata.tool_trace` from the JSON-RPC response body:

```
Agent → [runs task, calls tools] → A2A response with metadata.tool_trace
                                      ↓
                          extractToolTrace() in logA2ASuccess()
                                      ↓
                          Persisted to activity_logs.tool_trace (JSONB column)
                                      ↓
                          Indexed via GIN index for fast JSONB queries
```

The `tool_trace` field in the A2A response is produced by the agent runtime — it reflects the tool calls that actually executed, not the tool calls the agent said it planned to make. This distinction matters for compliance: LLM output tells you what the agent *said* it would do; Tool Trace tells you what it *actually did*.

## Use cases

### Compliance and audit

For regulated environments, Tool Trace provides the execution record that proves an agent operated within its authorized scope. Query `tool_trace` for any call that reached external APIs or modified system state.

```bash
# Find all HTTP tool calls in the last 24 hours
curl -s ".../workspaces/$WS_ID/activity?limit=200" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '[.[] | select(.tool_trace != null) |
    select(.tool_trace[] | .tool | contains("httpx"))] |
    map({time: .created_at, calls: [.tool_trace[]]})'
```

### Debugging agent behavior

When an agent produces an unexpected result, Tool Trace shows exactly which tools were called and with what inputs — faster than replaying the full conversation.

```bash
# Find a specific agent's call sequence for a given task
curl -s ".../workspaces/$WS_ID/activity?limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.[] | select(.tool_trace | length >= 3) | {created_at, count: (.tool_trace | length)}'
```

### Verifying tool coverage

Before deploying a new agent, verify it calls the expected tools under load.

```bash
# Aggregate tool call counts for a workspace
curl -s ".../workspaces/$WS_ID/activity?limit=100" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '[.[] | select(.tool_trace != null) | .tool_trace[].tool] |
    group_by(.) | map({tool: .[0], count: length}) | sort_by(.count) | reverse'
```

## Security and privacy

**Input sanitization** — API keys, long strings, and other sensitive values in `input` are sanitized before storage. The sanitization uses a best-effort pattern: sensitive key names (e.g., `key`, `token`, `password`, `secret`) and values longer than 200 characters are redacted.

**Output previews** — Tool outputs are capped at 200 characters to prevent `activity_logs` bloat and to limit the exposure of sensitive data in stored traces.

**Per-workspace isolation** — A `workspace_id` filter is required on all activity log queries. Admins cannot query other workspaces' activity logs without explicit access.

## Limitations

- **Requires A2A** — Tool Trace is recorded for A2A calls only. Direct MCP tool calls that bypass A2A do not produce traces.
- **Runtime-dependent** — The agent runtime must produce `metadata.tool_trace` in its A2A responses. Not all runtimes (e.g., custom external agents) include this field.
- **No cross-workspace trace** — Each `activity_logs` row covers a single workspace. Tracing a task that fan-out to multiple agents requires correlating `task_id` across multiple workspace logs.

## Related

- [Platform Instructions](/docs/guides/platform-instructions) — Enforce rules at the system prompt level, before the agent runs
- [Org-Scoped API Keys](/docs/guides/org-api-keys) — Attribute every tool call to a specific org key for billing and audit
- [A2A Protocol](/docs/api-protocol/a2a-protocol) — The message format that carries `tool_trace` inside every response
