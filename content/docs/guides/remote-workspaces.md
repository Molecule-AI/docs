---
title: Remote Workspaces
description: Run AI agents on any infrastructure — laptops, cloud VMs, CI/CD pipelines — and govern them from a single Molecule AI canvas. Phase 30 remote agent onboarding, per-workspace bearer tokens, and fleet visibility.
---

# Remote Workspaces — Run Agents Anywhere, Govern From One Platform

> Phase 30: agents running outside the platform's Docker network can now join
> your Molecule AI org, appear on the canvas, receive A2A tasks from parent
> agents, and report status — all with the same auth, lifecycle, and
> observability as containerized workspaces.

**Phase 30 GA:** 2026-04-20 | PRs: #1075–#1083, #1085–#1100 (monorepo)

---

## What Problem This Solves

Most agent platforms assume all agents run in the same environment as the
control plane. Molecule AI supported external agents as a development escape
hatch, but the production story was "all agents on this Docker network."

Phase 30 changes that. Your org can now include agents running on:

- A developer's laptop across the internet
- A server in a different cloud region
- An on-premises machine behind a NAT
- A third-party SaaS bot with an HTTP endpoint

From the canvas and from other agents, they're indistinguishable from
containerized workspaces. They have the same auth contract, the same A2A
interface, the same lifecycle controls. Where they run is a deployment
detail — not an architectural constraint.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Platform** | Molecule AI platform running v0.30+ (`go run ./cmd/server` from `workspace-server/` or the current `main` image) |
| **Admin access** | An `ADMIN_TOKEN`, org API key, or session cookie with permission to create workspaces |
| **Python ≥ 3.11** | For the `molecule-sdk-python` client (`pip install molecule-ai-sdk`) |
| **Publicly reachable endpoint** | The agent's host must be reachable from the platform over HTTPS. If behind NAT, use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/). |
| **Network** | Outbound HTTPS from the agent to the platform; inbound HTTPS from the platform to the agent's A2A endpoint |

### SDK Installation

```bash
pip install molecule-ai-sdk
```

Or from the repo checkout:

```bash
pip install -e sdk/python/
```

The SDK includes `RemoteAgentClient` — a dependency-light Python client (only `requests`) that wraps all Phase 30 endpoints.

---

## Architecture at a Glance

```
Laptop (remote agent)                Molecule AI Platform
  │                                        │
  │  POST /workspaces                      │
  │  POST /registry/register  ────────────► │  ← admin token (one-time)
  │  ←─ auth_token (256-bit)  ◄────────── │  ← shown once, saved to disk
  │                                        │
  │  GET /workspaces/:id/secrets              │  ← bearer: auth_token
  │  POST /registry/heartbeat  (30s loop)  │
  │  GET  /workspaces/:id/state  (30s loop)│
  │                                        │
  │  ◄── A2A task dispatch ────────────── │  ← platform → laptop (HTTPS)
  │  ──► A2A response  ──────────────────► │  ← laptop → platform
  │                                        │
Canvas (any browser)  ◄── WebSocket ─────► Platform
  │                        fanout
  │
  └─── sees: researcher [ONLINE] [REMOTE] badge
```

**Key properties:**
- The agent **pulls** its secrets at boot (not baked into the container at provision time)
- Liveness is maintained by **heartbeat + state polling** (no WebSocket required from the agent side)
- The platform **proxies A2A calls** to the agent's registered URL — no inbound firewall rules on the platform
- The auth token is **workspace-scoped**: a leaked token can't impersonate another workspace

---

## Quick Start

```bash
# 1. Create the workspace (admin side)
WORKSPACE=$(curl -s -X POST https://acme.moleculesai.app/workspaces \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"researcher","runtime":"external","tier":2}')
WORKSPACE_ID=$(echo $WORKSPACE | jq -r '.id')

# 2. Run the agent (any machine that can reach the platform)
pip install molecule-ai-sdk

python3 - <<'EOF'
from molecule_agent import RemoteAgentClient
import os, logging

client = RemoteAgentClient(
    workspace_id = os.environ["WORKSPACE_ID"],
    platform_url = os.environ["PLATFORM_URL"],
    org_id      = os.environ["ORG_ID"],         # optional — injected as X-Molecule-Org-Id header
    origin      = "my-agent/1.0",              # optional — injected as Origin header for tracing
    agent_card  = {"name": "researcher", "skills": ["web-search", "research"]},
)
client.register()                      # Phase 30.1 — get + cache token
secrets = client.pull_secrets()         # Phase 30.2 — decrypt API keys
print("Secrets:", list(secrets.keys()))

# Keep alive + respond to platform commands
client.run_heartbeat_loop(
    task_supplier = lambda: {
        "current_task": "idle",
        "active_tasks": 0,
    }
)
EOF
```

The agent appears on the canvas with a **purple REMOTE badge** within seconds. From there it behaves identically to any other workspace: receive A2A tasks, update its agent card, report status.

---

## RemoteAgentClient API Reference

### Constructor

```python
from molecule_agent import RemoteAgentClient

client = RemoteAgentClient(
    workspace_id = "ws-...",           # required — your workspace UUID
    platform_url = "https://...",      # required — your platform base URL
    auth_token   = "...",              # optional — set to skip the register() step if you already have a token
    org_id       = "org-...",          # optional — injected as X-Molecule-Org-Id on every request
    origin       = "my-agent/1.0",     # optional — injected as Origin header for request tracing
    agent_card   = {...},              # optional — updated on every heartbeat
)
```

| Parameter | Type | Description |
|---|---|---|
| `workspace_id` | `str` | Your workspace UUID, obtained from `POST /workspaces`. |
| `platform_url` | `str` | Your platform base URL, e.g. `https://acme.moleculesai.app`. |
| `auth_token` | `str` | Pre-obtained bearer token. If omitted, call `register()` to fetch one. |
| `org_id` | `str` | Optional org UUID. When set, injected as `X-Molecule-Org-Id` on every outbound request. |
| `origin` | `str` | Optional UA string (e.g. `"researcher/2.1"`). Injected as `Origin` header for logging/tracing. |
| `agent_card` | `dict` | Agent metadata broadcast to the canvas. Updated on every heartbeat. |

### fetch_inbound(peer_id=, before_ts=)

Poll for inbound A2A messages directed at this workspace:

```python
messages = client.fetch_inbound(peer_id="ws-peer-uuid", before_ts="2026-05-10T12:00:00Z")
for msg in messages:
    print(msg.id, msg.method, msg.peer_name, msg.peer_role)
```

| Parameter | Type | Description |
|---|---|---|
| `peer_id` | `str` | Filter to messages from a specific peer workspace UUID. Omit to receive from all peers. |
| `before_ts` | `str` | RFC3339 timestamp. Return only messages older than this cut-off. Use for pagination by tracking the oldest message seen. |

Returns a list of `InboundMessage` objects.

### InboundMessage

Each inbound message carries these fields in addition to the standard A2A fields:

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Message ID. |
| `method` | `str` | A2A method (`delegate_task`, `cancel_task`, etc.). |
| `params` | `dict` | Method parameters. |
| `peer_id` | `str` | UUID of the peer workspace that sent this message. |
| `peer_name` | `str` | Display name of the sending peer (from its agent card). |
| `peer_role` | `str` | Role of the sending peer (`"sre"`, `"frontend"`, etc.). |
| `agent_card_url` | `str` | URL of the sending peer's agent card. |
| `raw` | `dict` | Raw channel envelope for forward-compatibility. |

> **Note:** `peer_name`, `peer_role`, and `agent_card_url` are enriched from the platform's peer registry at dispatch time. They are `None` if the sending peer has not registered an agent card.

### Security: OFFSEC-003 — trust-boundary markers on peer responses

When a remote workspace receives a `delegate_task` response from an external peer, the platform wraps the peer-generated content in `[A2A_RESULT_FROM_PEER]...[/A2A_RESULT_FROM_PEER]` trust-boundary markers. These markers signal to the agent that the enclosed content originated outside the platform's trust boundary and must not be re-injected as platform-native output.

Use `strip_a2a_boundary()` to strip the wrappers before processing the content:

```python
from molecule_agent import RemoteAgentClient, strip_a2a_boundary

# Normalise inbound peer result — safe on pre-OFFSEC-003 responses (returns
# input unchanged when markers absent) and on None/empty strings.
result = strip_a2a_boundary(msg.params.get("result", ""))
```

This is particularly important when displaying peer results to users or using them as tool inputs — always strip the boundary markers first. See `molecule-core` [#334](https://git.moleculesai.app/molecule-ai/molecule-core/pull/334) for the platform-side implementation.

---

## What Phase 30 Covers

| Phase | What shipped | Endpoint |
|---|---|---|
| 30.1 | Workspace auth tokens | `POST /registry/register`, `POST /registry/heartbeat` |
| 30.2 | Token-gated secrets pull | `GET /workspaces/:id/secrets` |
| 30.3 | Plugin tarball download (remote install) | `GET /plugins/:name/download` |
| 30.4 | Workspace state polling (no WebSocket needed) | `GET /workspaces/:id/state` |
| 30.5 | A2A proxy enforces caller token | `POST /workspaces/:id/a2a` |
| 30.6 | Sibling discovery + URL caching | `GET /registry/:id/peers` |
| 30.7 | Poll-liveness for external runtime | Redis TTL (90s timeout) |
| 30.8 | Remote-agent SDK + docs | `molecule-sdk-python` |

---

## Next Steps

- **[External Agent Registration Guide →](/docs/guides/external-agent-registration)** — full endpoint reference, Python + Node.js examples, troubleshooting
- **[molecule-sdk-python →](https://git.moleculesai.app/molecule-ai/molecule-sdk-python)** — SDK source, `RemoteAgentClient` API docs
- **[SDK Examples →](https://git.moleculesai.app/molecule-ai/molecule-sdk-python/src/branch/main/examples/remote-agent)** — `run.py` demo script, annotated walkthrough
