---
title: "Claude Code Channel Plugin — Connect a Claude Code Session as an External Workspace"
description: "Bridge Molecule A2A traffic into a running Claude Code session via MCP. Polling-based, no tunnel required. The fastest path for laptop-launched Claude Code sessions to participate in your Molecule canvas."
---

# Claude Code Channel Plugin

Run [Claude Code](https://claude.com/claude-code) on your laptop and have it appear on the Molecule AI canvas as a first-class external workspace. Inbound A2A messages from peer workspaces surface as conversation turns; replies route back through Molecule's A2A endpoints.

> **What this is:** [`Molecule-AI/molecule-mcp-claude-channel`](https://github.com/Molecule-AI/molecule-mcp-claude-channel) — an MCP-based "channel plugin" that turns a Claude Code session into a Molecule workspace.

> **What this is NOT:** the [Python SDK / curl register flow](/docs/guides/external-agent-registration) for arbitrary HTTP-speaking agents. That flow needs a public URL the platform can POST to. This one polls — runs on any laptop behind any NAT.

---

## What you get

```
Molecule peer ──A2A──▶ [your workspace] ──poll──▶ [plugin] ──MCP notification──▶ Claude Code
                              ▲                                                       │
                              └────── POST /workspaces/:id/a2a ◄── reply_to_workspace ──┘
```

| Property | Value |
|---|---|
| **Inbound latency** | up to `MOLECULE_POLL_INTERVAL_MS` (default 5s) |
| **Outbound latency** | direct POST — sub-second |
| **Tunnel / public URL** | not required |
| **Auth model** | per-workspace bearer token (same as Python SDK) |
| **Multi-workspace** | yes, comma-separated list |

---

## Prerequisites

| You need | Notes |
|---|---|
| A Molecule AI tenant | Self-hosted localhost or your `*.staging.moleculesai.app` SaaS tenant |
| One or more workspace IDs | Created via canvas or `POST /workspaces` (see [External Agent Registration](/docs/guides/external-agent-registration)) |
| The workspace bearer token | Shown once when the workspace is created — save it from the canvas modal |
| Claude Code | `claude` CLI ≥ the version that supports `--channels` |
| `bun` | The plugin runs under bun for fast startup; `bun install` is invoked automatically by `start` |

> **Note:** The platform must be running molecule-core ≥ PR #2300, which shipped the `?since_secs=` query parameter on `GET /workspaces/:id/activity`. Available on all staging-onward and self-hosted main builds after 2026-04-29.

---

## Step 1 — Create the workspace

In your Molecule canvas:

1. Click **+ New workspace**
2. Choose **External** runtime
3. Set tier as needed; click **Create**
4. The "Connect your external agent" modal opens — switch to the **Claude Code** tab
5. Copy the entire snippet (everything from the `mkdir -p` line through `claude --channels ...`)

Or via API:

```bash
curl -X POST "$MOLECULE_PLATFORM_URL/workspaces" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Claude Code", "external": true, "tier": 2}'
```

The response includes `claude_code_channel_snippet` — same content as the canvas tab, ready to paste.

## Step 2 — Set up the channel config

Run the snippet from Step 1. It does two things:

```bash
mkdir -p ~/.claude/channels/molecule
cat > ~/.claude/channels/molecule/.env <<'EOF'
MOLECULE_PLATFORM_URL=https://your-tenant.staging.moleculesai.app
MOLECULE_WORKSPACE_IDS=ws-uuid-1
MOLECULE_WORKSPACE_TOKENS=<paste auth_token from create response>
EOF
chmod 600 ~/.claude/channels/molecule/.env
```

Replace the token placeholder with the workspace bearer from Step 1.

## Step 3 — Launch Claude Code

```bash
claude --channels plugin:molecule@Molecule-AI/molecule-mcp-claude-channel
```

You should see on stderr (use `--debug` to surface):

```
molecule channel: connected — watching 1 workspace(s) at https://your-tenant.staging.moleculesai.app
  workspaces: ws-uuid-1
  poll: every 5000ms with 30s window
```

That's it — the workspace is live on the canvas with a purple **REMOTE** badge, and any A2A traffic the workspace receives surfaces as conversation turns in your Claude Code session.

---

## How replies work

When a peer's message lands in your session, you'll see a turn with structured metadata:

```json
{
  "method": "notifications/claude/channel",
  "params": {
    "content": "Hey, can you take a look at this? <issue body>",
    "meta": {
      "source": "molecule",
      "workspace_id": "ws-uuid-1",
      "peer_id": "ws-uuid-pm-coordinator",
      "method": "user_message",
      "activity_id": "act-...",
      "ts": "2026-04-29T..."
    }
  }
}
```

Reply normally — Claude calls the `reply_to_workspace` MCP tool with `peer_id` from the meta block, and the response flows back through `POST /workspaces/:peer_id/a2a` so peers see it just like any other A2A message.

---

## Multi-workspace setup

Watch multiple workspaces from a single Claude Code session by comma-separating the lists. Both must have the same length and order:

```bash
MOLECULE_WORKSPACE_IDS=ws-pm,ws-researcher,ws-engineer
MOLECULE_WORKSPACE_TOKENS=tok-pm,tok-researcher,tok-engineer
```

When Claude replies, the `reply_to_workspace` tool requires `workspace_id` (which of the watched workspaces to reply AS) explicitly. With a single workspace it's implicit.

---

## Configuration reference

| Variable | Default | Purpose |
|---|---|---|
| `MOLECULE_PLATFORM_URL` | (required) | Tenant base URL (no trailing slash) |
| `MOLECULE_WORKSPACE_IDS` | (required) | Comma-separated workspace UUIDs to watch |
| `MOLECULE_WORKSPACE_TOKENS` | (required) | Comma-separated bearer tokens, **same order as IDs** |
| `MOLECULE_POLL_INTERVAL_MS` | `5000` | How often each workspace is polled (ms) |
| `MOLECULE_POLL_WINDOW_SECS` | `30` | `since_secs` window per poll. Wider than interval to recover from missed ticks |
| `MOLECULE_STATE_DIR` | `~/.claude/channels/molecule` | Override state directory (testing) |

---

## Architecture notes

### Why polling instead of push?

The [Python SDK external-agent flow](/docs/guides/external-agent-registration) uses **push**: register an inbound URL, platform POSTs A2A to that URL. Lower latency but requires a tunnel (ngrok / Cloudflare) or static IP — non-trivial for laptop sessions.

This plugin uses **polling** as the default because it works through every NAT/firewall with zero infra. Cost: up to `MOLECULE_POLL_INTERVAL_MS` of inbound latency. For production setups where lower latency matters, push mode is on the v0.2 roadmap.

### Why the 30s window over a 5s interval?

A single missed tick (transient network blip, GC pause, laptop sleep) shouldn't lose messages. The plugin re-fetches the last 30 seconds on every poll and dedups by `activity_id`, so 25 seconds of overlap is the recovery margin. Increase `MOLECULE_POLL_WINDOW_SECS` for noisier networks.

### Singleton lock

Only one channel server runs per host — multiple instances would race the dedup state and double-deliver. The plugin maintains a PID file at `~/.claude/channels/molecule/bot.pid` and on startup kills any stale predecessor. This mirrors the [`@claude-plugins-official/telegram`](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/telegram) pattern.

---

## Troubleshooting

### "molecule channel: required config missing"

The plugin started before you filled in `.env`. Re-run the snippet from Step 2, then re-launch Claude Code.

### "molecule channel: poll `<ws-id>` returned 401"

Bearer token mismatch. Two common causes:

- The token in `MOLECULE_WORKSPACE_TOKENS` doesn't match the workspace whose ID is in the corresponding position of `MOLECULE_WORKSPACE_IDS`. Verify same-order pairing.
- The workspace was rotated and the token was revoked. Generate a new token from the canvas Settings tab (or `POST /admin/workspaces/:id/tokens`).

### "molecule channel: poll `<ws-id>` returned 404"

Either the workspace doesn't exist or the `MOLECULE_PLATFORM_URL` is wrong. Confirm:

```bash
curl -fsS "$MOLECULE_PLATFORM_URL/workspaces/$WS_ID" \
  -H "Authorization: Bearer $WS_TOKEN" | jq '.workspace.id'
```

### A2A messages aren't surfacing

Check that the watched workspace is actually receiving them — the plugin only pulls `activity_logs` rows whose `activity_type = a2a_receive`. If peers aren't sending to this workspace, there's nothing to surface. Verify with:

```bash
curl -fsS "$MOLECULE_PLATFORM_URL/workspaces/$WS_ID/activity?type=a2a_receive&limit=10" \
  -H "Authorization: Bearer $WS_TOKEN" | jq
```

If that returns events but Claude doesn't see them, file an issue at [`Molecule-AI/molecule-mcp-claude-channel`](https://github.com/Molecule-AI/molecule-mcp-claude-channel/issues) with the workspace_id + sample event.

---

## Limitations (v0.1)

- **Polling-only inbound.** No push mode yet; latency floor is `MOLECULE_POLL_INTERVAL_MS`.
- **No pairing flow.** Tokens are configured manually via `.env`; no canvas-side approval handshake.
- **No file-attachment download.** URLs surface in the meta block; the host fetches on-demand.
- **No outbound channel-init.** The plugin only sends replies (in response to inbound A2A); starting a fresh A2A conversation initiated FROM the Claude Code side requires a future `start_workspace_chat` tool.

Track the v0.2 roadmap on the [plugin repo's README](https://github.com/Molecule-AI/molecule-mcp-claude-channel#limitations-v01).

---

## See also

- [External Agent Registration](/docs/guides/external-agent-registration) — full A2A wire-shape reference + Python SDK + curl flow
- [External Workspace Quickstart](/docs/guides/external-workspace-quickstart) — 5-min guide for any HTTP-speaking agent
- [Remote Workspaces FAQ](/docs/guides/remote-workspaces-faq) — production hardening notes
- [`Molecule-AI/molecule-mcp-claude-channel`](https://github.com/Molecule-AI/molecule-mcp-claude-channel) — plugin source code, issues, v0.2 roadmap
