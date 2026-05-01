---
title: Workspace Runtime
description: Molecule AI's unified runtime image — runtime matrix, workspace/ directory structure, agent card registration, A2A server, heartbeat loop, and config format.
---

# Workspace Runtime

The `workspace/` directory is Molecule AI's unified runtime image. Every provisioned workspace starts from this image, loads its own config, selects a runtime adapter, registers an Agent Card, exposes A2A, and joins the platform heartbeat/activity loop.

## Runtime Matrix In Current `main`

Current `main` ships six adapters:

- `langgraph`
- `deepagents`
- `claude-code`
- `crewai`
- `autogen`
- `openclaw`

This is the merged runtime surface today. Branch-level experiments such as NemoClaw are separate and should be treated as roadmap/WIP, not merged support.

Adapter-specific behavior is documented in [Agent Runtime Adapters](./cli-runtime.md).

## What The Runtime Is Responsible For

- loading `config.yaml`
- running preflight checks before the workspace goes live
- selecting an adapter based on `runtime`
- loading local skills plus plugin-mounted shared rules/skills
- constructing an Agent Card
- serving A2A over HTTP
- registering with the platform and sending heartbeats
- reporting activity and task state
- integrating with awareness-backed memory when configured
- hot-reloading skills while the workspace is running

## Environment Model

Common runtime environment variables:

```bash
WORKSPACE_ID=ws-123
WORKSPACE_CONFIG_PATH=/configs
PLATFORM_URL=http://platform:8080
PARENT_ID=
AWARENESS_URL=http://awareness:37800
AWARENESS_NAMESPACE=workspace:ws-123
LANGFUSE_HOST=http://langfuse-web:3000
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
```

Important behavior:

- `WORKSPACE_CONFIG_PATH` points at the mounted config directory for that workspace.
- `AWARENESS_URL` + `AWARENESS_NAMESPACE` enable workspace-scoped awareness-backed memory.
- If awareness is absent, runtime memory tools fall back to the platform memory endpoints for compatibility.

## Startup Sequence

At a high level, `workspace/main.py` does this:

1. Initialize telemetry.
2. Load `config.yaml`.
3. Run preflight validation.
4. Build the heartbeat loop.
5. Resolve the adapter from `config.runtime`.
6. Let the adapter run `setup()` and build an executor.
7. Build the Agent Card from loaded skills and runtime config.
8. Register the workspace with `POST /registry/register`.
9. Start heartbeats.
10. Start the skill watcher when skills are configured.
11. Serve the A2A app through Uvicorn.

## Boot-Smoke Contract (`MOLECULE_SMOKE_MODE`)

The image-publish CI pipeline runs each template's image with `MOLECULE_SMOKE_MODE=1` to exercise lazy imports inside `executor.execute()` against stub credentials and no network. The runtime detects the env var, invokes `executor.execute()` once with a stubbed `RequestContext` and a short timeout, then exits — registration, heartbeats, and the A2A server are skipped.

This catches lazy imports that pure `python3 -c "import adapter"` smokes miss: imports nested inside `if`-branches, deferred until first call, or behind `importlib.import_module()`.

### What adapter authors need to do

**Most adapters need to do nothing.** If `setup()` only writes files, parses config, or instantiates Python objects, the smoke gate just works.

**Adapters whose `setup()` does real I/O must opt out of that I/O under smoke mode.** This applies to:

- spawning subprocesses that require valid credentials (e.g. a gateway daemon)
- making real network calls
- writing to filesystem locations that need a specific uid/gid the smoke harness can't guarantee

The contract:

```python
async def setup(self, config: AdapterConfig) -> None:
    if os.environ.get("MOLECULE_SMOKE_MODE") == "1":
        return  # skip real I/O; runtime's smoke short-circuit handles the rest
    # ... real setup ...
```

For shell entrypoints that wrap `molecule-runtime`:

```bash
if [ "${MOLECULE_SMOKE_MODE:-0}" = "1" ]; then
  exec molecule-runtime
fi
```

### What gets exercised under smoke mode

- All `/app/*.py` modules import cleanly (covered by a separate static-import smoke step)
- `adapter.setup()` runs (with the opt-out above for I/O-heavy adapters)
- `adapter.create_executor()` runs
- `executor.execute()` is invoked once against a stub `RequestContext`/`EventQueue` with `MOLECULE_SMOKE_TIMEOUT_SECS` (default 5s); a clean timeout exits 0, an import error exits non-zero

### What the gate does NOT prove

A green gate means **"imports are healthy enough that `executor.execute()` reaches its body"** — that's the regression class the gate exists to catch (lazy `from x import y` inside an `if`-branch, or `importlib.import_module()` on a path that breaks after a wheel bump).

It does **not** prove that `execute()` produces the right output for real input. The harness reports PASS in three distinct cases:

1. **Clean return** — execute() ran to completion within the timeout.
2. **Timeout** — execute() was still running when the timer fired (typical for adapters that do real I/O inside execute(): subprocess to a gateway, httpx call to an upstream LLM).
3. **Any non-import exception** — execute() raised `RuntimeError`, auth errors, validation errors, etc. The harness only fails on `ImportError`/`ModuleNotFoundError`.

The stub `RequestContext` carries a non-empty `"smoke test"` text message (so adapters relying on `extract_message_text(ctx)` returning input still work), and the harness never drains the `EventQueue` — what `execute()` writes back is ignored.

If you need correctness coverage, write a separate integration test that runs the workspace against real or mocked infrastructure — the smoke gate is a strict subset.

### Stub env the smoke harness sets

| Var | Value |
|---|---|
| `MOLECULE_SMOKE_MODE` | `1` |
| `MOLECULE_SMOKE_TIMEOUT_SECS` | `10` (CI default) |
| `WORKSPACE_ID` | `fake-smoke` |
| `PYTHONPATH` | `/app` (mirrors the platform provisioner) |
| `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` | `sk-fake-smoke-*` |

A `config.yaml` from the template repo's root is mounted at `/configs/config.yaml`.

## Core Runtime Pieces

| File | Responsibility |
|---|---|
| `main.py` | Entry point, adapter bootstrap, Agent Card registration, heartbeat startup, initial prompt execution |
| `config.py` | Parses `config.yaml` into the runtime config dataclasses |
| `adapters/` | Adapter registry and adapter implementations |
| `claude_sdk_executor.py` | `ClaudeSDKExecutor` — Claude Code runtime via `claude-agent-sdk` (replaces subprocess) |
| `executor_helpers.py` | Shared helpers for all executors: memory, delegation, heartbeat, system prompt, error sanitization |
| `a2a_executor.py` | Shared LangGraph execution bridge and current-task reporting |
| `cli_executor.py` | `CLIAgentExecutor` — subprocess executor for Codex, Ollama, custom runtimes |
| `skills/loader.py` | Parses `SKILL.md`, loads tool modules, returns loaded skill metadata |
| `skills/watcher.py` | Hot reload path for skill changes |
| `plugins.py` | Scans mounted plugins for shared rules, prompt fragments, and extra skills |
| `tools/memory.py` | Agent memory tools |
| `tools/awareness_client.py` | Awareness-backed persistence wrapper |
| `coordinator.py` | Coordinator-only delegation path for team leads |

## Skills, Plugins, And Hot Reload

The runtime combines three sources of capability:

1. **workspace-local skills** from `skills/<skill>/SKILL.md`
2. **plugin-mounted rules and shared skills** from `/plugins`
3. **built-in tools** like delegation, approval, memory, sandbox, and telemetry helpers

Hot reload matters because the runtime is designed to keep a workspace alive while its capability surface evolves:

- edit `SKILL.md`
- add/remove skill files
- update tool modules
- modify config prompt references

The watcher rescans the skill package, rebuilds the agent tool surface, and updates the Agent Card so peers and the canvas reflect the new capabilities.

## Awareness And Memory Integration

The runtime keeps the agent-facing contract stable:

- `commit_memory(content, scope)`
- `search_memory(query, scope)`

When awareness is configured:

- the tools route durable facts to the workspace's own awareness namespace
- the namespace defaults to `workspace:<workspace_id>` unless explicitly overridden

When awareness is not configured:

- the same tools fall back to the platform memory endpoints

That design lets the platform improve the backend memory boundary without forcing every agent prompt or tool signature to change.

## Coordinator Enforcement

`coordinator.py` is not a generic “smart agent” mode. It is intentionally strict:

- coordinators delegate
- coordinators synthesize
- coordinators do not quietly do the child work themselves

This matters because Molecule AI wants hierarchy to remain operationally real, not cosmetic.


## Remote Agent Registration (External Workspaces)

External workspaces run outside the platform's Docker infrastructure — on your laptop, a cloud VM, an on-prem server, or a CI/CD agent. They register via the platform API and send heartbeats to stay live on the canvas.

### How it differs from Docker workspaces

| | Docker workspace | External workspace |
|---|---|---|
| Provisioning | Platform spins up a container | You provide the machine; platform just tracks it |
| Liveness | Docker health sweep | Heartbeat TTL (90s offline threshold) |
| Registration | Automatic at container start | Manual: `POST /workspaces` + `POST /registry/register` |
| Token | Inherited from container env | Minted at registration, shown once |
| Secrets | Baked in image or env var | Pulled from platform at boot via `GET /workspaces/:id/secrets` |

### Registration flow

**1. Create the workspace:**

```bash
curl -X POST http://localhost:8080/workspaces \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-remote-agent",
    "runtime": "external",
    "external": true,
    "url": "https://my-agent.example.com/a2a",
    "parent_id": "ws-pm-123"
  }'
```

Returns `{ "id": "ws-xyz", "platform_url": "http://localhost:8080" }`.

**2. Register the agent with the platform:**

```bash
curl -X POST http://localhost:8080/registry/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "workspace_id": "ws-xyz",
    "name": "my-remote-agent",
    "description": "Runs on a cloud VM in us-east-1",
    "skills": ["research", "summarization"],
    "url": "https://my-agent.example.com/a2a"
  }'
```

The platform returns a 256-bit bearer token — save it, it is shown only once.

**3. Pull secrets at boot:**

```bash
curl http://localhost:8080/workspaces/ws-xyz/secrets \
  -H "Authorization: Bearer <your-token>"
```

Returns `{ "ANTHROPIC_API_KEY": "...", "OPENAI_API_KEY": "..." }`. No credentials baked into images or env files.

**4. Send heartbeats every 30 seconds:**

```bash
curl -X POST http://localhost:8080/registry/heartbeat \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "ws-xyz",
    "status": "online",
    "task": "analyzing Q1 sales data",
    "error_rate": 0.0
  }'
```

If the platform misses two consecutive heartbeats, the workspace shows offline on the canvas.

**5. A2A with `X-Workspace-ID` header:**

When sending A2A messages to sibling or parent workspaces, include the header so the platform can verify mutual auth:

```bash
curl -X POST http://localhost:8080/workspaces/ws-pm-123/a2a \
  -H "Authorization: Bearer <your-token>" \
  -H "X-Workspace-ID: ws-xyz" \
  -H "Content-Type: application/json" \
  -d '{"type": "status_report", "payload": {...}}'
```

### Behind NAT — Cloudflare Tunnel / ngrok

If the agent machine has no public IP, use an outbound tunnel:

```bash
# ngrok
ngrok http 8000 --url https://my-agent.ngrok.io

# Cloudflare Tunnel
cloudflared tunnel run --token <token>

# Register the tunnel URL (not localhost)
curl -X POST http://localhost:8080/registry/update-card \
  -H "Authorization: Bearer <your-token>" \
  -d '{"workspace_id": "ws-xyz", "url": "https://my-agent.ngrok.io/a2a"}'
```

The agent initiates the outbound WebSocket to the platform — no inbound ports need to be opened on the firewall.

### Revocation and re-registration

To revoke and re-register:

```bash
# Delete the workspace
curl -X DELETE http://localhost:8080/workspaces/ws-xyz \
  -H "Authorization: Bearer <admin-token>"

# Create fresh (new workspace_id, new token)
```

Re-registration with the same `workspace_id` does not issue a new token — use the token saved from first registration.

### Related docs

- Full step-by-step: [External Agent Registration Guide](../guides/external-agent-registration.md)
- Tutorial with CI/CD examples: [Register a Remote Agent](../tutorials/register-remote-agent.md)
- API reference: [Registry and Heartbeat](../api-protocol/registry-and-heartbeat.md)

## A2A And Registration

Each workspace exposes an A2A server, builds an Agent Card, and registers with the platform. The platform is used for:

- discovery
- liveness
- event fanout
- proxying browser-initiated A2A calls

But the long-term collaboration model remains direct workspace-to-workspace communication via A2A.

## Related Docs

- [Agent Runtime Adapters](./cli-runtime.md)
- [Skills](./skills.md)
- [Config Format](./config-format.md)
- [System Prompt Structure](./system-prompt-structure.md)
- [Memory Architecture](../architecture/memory.md)
