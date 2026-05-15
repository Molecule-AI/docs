---
title: Self-Hosted Workspace Deployment with Docker
---

# Self-Hosted Workspace Deployment with Docker

This guide covers running a Molecule AI workspace agent as a Docker container on a self-hosted server or VM. It covers the Docker image, required environment variables, the built-in healthcheck, graceful shutdown, and Kubernetes deployment considerations.

> **Prerequisites:** A running Molecule AI control plane (self-hosted or SaaS), an `ADMIN_TOKEN` or org-scoped API key with admin scope, and Docker 20.10+ on the host.

## How the workspace container works

The Molecule AI workspace Dockerfile includes:

- A uvicorn server on port 8000 (configurable via `PORT`)
- A healthcheck endpoint at `/.well-known/agent-card.json` (used by Docker and Kubernetes probes)
- Graceful SIGTERM handling via uvicorn — the heartbeat loop and adapter tasks shut down cleanly

```
┌─────────────────────────────────────────────┐
│  Docker host (your VM / bare metal)         │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  workspace container                 │   │
│  │                                     │   │
│  │  uvicorn (port 8000)                │   │
│  │    └─ /.well-known/agent-card.json  ← HEALTHCHECK │   │
│  │                                     │   │
│  │  heartbeat loop + A2A agent            │   │
│  └──────────────┬──────────────────────┘   │
│                 │                              │
│  host.docker.internal:8080                    │
│                 │                              │
│                 ▼                              │
│  ┌─────────────────────────────────────┐   │
│  │  Molecule AI control plane          │   │
│  │  (platform on port 8080)            │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Step 1: Create an external workspace

First register the workspace as an external (self-managed) agent on the platform.

```bash
ADMIN_TOKEN="your-admin-token"
PLATFORM_URL="https://platform.moleculesai.app"   # or http://localhost:8080 for local dev
WORKSPACE=$(curl -s -X POST "${PLATFORM_URL}/workspaces" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "self-hosted-agent", "runtime": "external"}')

WORKSPACE_ID=$(echo "$WORKSPACE" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "Workspace ID: $WORKSPACE_ID"
```

Save the returned `WORKSPACE_ID`. The workspace agent obtains its bearer token automatically during its first registration with the platform.

## Step 2: Pull the workspace image

The workspace image is published to the Molecule AI ECR registry. Contact your platform administrator for the registry prefix and credentials, then log in:

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin "${REGISTRY_PREFIX}.dkr.ecr.us-east-1.amazonaws.com"

docker pull "${REGISTRY_PREFIX}.dkr.ecr.us-east-1.amazonaws.com/molecule-workspace:latest"
```

## Step 3: Configure environment variables

| Variable | Default | Description |
|---|---|---|
| `PLATFORM_URL` | `http://localhost:8080` | Platform API URL. Inside a Docker container, use `http://host.docker.internal:8080` to reach the platform on the host machine. |
| `WORKSPACE_ID` | — | Workspace ID from Step 1 (required; no default) |
| `PORT` | `8000` | Agent server port. Must match `containerPort` in Kubernetes and the port mapped with `-p` in Docker. |

## Step 4: Run the container

### Docker (standalone)

```bash
docker run -d \
  --name molecule-workspace \
  -p 8000:8000 \
  -e PLATFORM_URL="http://host.docker.internal:8080" \
  -e WORKSPACE_ID="your-workspace-id" \
  -e PORT=8000 \
  "${REGISTRY_PREFIX}.dkr.ecr.us-east-1.amazonaws.com/molecule-workspace:latest"
```

> **Note for Linux hosts:** Docker does not include `host.docker.internal` by default. On Linux, either add `--add-host=host.docker.internal:host-gateway` to the `docker run` command, or use the host machine's IP address directly (e.g. `http://192.168.1.100:8080`).

### Verify the healthcheck

```bash
# Wait for the container to become healthy (up to ~2 minutes)
docker inspect --format='{{.State.Health.Status}}' molecule-workspace

# Expected output: healthy
# Once healthy, the agent card is reachable:
curl -s http://localhost:8000/.well-known/agent-card.json | python3 -m json.tool
```

### Docker Compose

```yaml
services:
  molecule-workspace:
    image: "${REGISTRY_PREFIX}.dkr.ecr.us-east-1.amazonaws.com/molecule-workspace:latest"
    ports:
      - "8000:8000"
    environment:
      PLATFORM_URL: "http://host.docker.internal:8080"
      WORKSPACE_ID: "your-workspace-id"
      PORT: "8000"
    # Linux hosts: add host.docker.internal resolution
    # extra_hosts:
    #   - "host.docker.internal:host-gateway"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/.well-known/agent-card.json"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

## Step 5: Graceful shutdown

When the container receives SIGTERM (e.g. from `docker stop` or Kubernetes pod deletion), the workspace's uvicorn server initiates graceful shutdown: the heartbeat loop stops, active A2A tasks are given a grace period to complete, and any snapshotable state is persisted before the process exits.

To integrate the heartbeat loop into custom agent code:

```python
import asyncio
import os, signal
from heartbeat import HeartbeatLoop

# SIGTERM is handled by the Docker runtime, which sends the signal to the
# workspace process. The workspace (via uvicorn) initiates graceful shutdown:
# the heartbeat loop is stopped, any active adapter tasks are cancelled, and
# in-flight A2A requests are given a grace period to complete.
#
# For custom integration with the heartbeat loop directly:
async def main():
    heartbeat = HeartbeatLoop(
        platform_url=os.environ["PLATFORM_URL"],
        workspace_id=os.environ["WORKSPACE_ID"],
    )
    heartbeat.start()
    try:
        await asyncio.Event().wait()  # keep running
    finally:
        await heartbeat.stop()
        print("Heartbeat loop stopped.")
```

The Docker `stop` command sends SIGTERM and waits up to 10 seconds by default before sending SIGKILL. The healthcheck ensures orchestrators detect an unhealthy container before the SIGTERM timeout.

## Kubernetes deployment

For Kubernetes deployments, use the native liveness/readiness probe configuration instead of the Docker HEALTHCHECK:

```yaml
ports:
  - name: http
    containerPort: 8000
livenessProbe:
  httpGet:
    path: /.well-known/agent-card.json
    port: http
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /.well-known/agent-card.json
    port: http
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
terminationGracePeriodSeconds: 120
```

> **Note:** The Kubernetes `terminationGracePeriodSeconds` should exceed the liveness probe failure threshold so that the probe can register a failure before the pod is killed. With `periodSeconds: 30` and `failureThreshold: 3`, the probe does not register a failure until approximately 120–150s after the container becomes unhealthy. Set `terminationGracePeriodSeconds: 120` or higher.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Container shows `unhealthy` after startup | Platform unreachable from container | Verify `PLATFORM_URL` uses `host.docker.internal` (Docker) or the correct host IP |
| `curl: (7) Failed to connect` on healthcheck | Container not fully started | Wait up to 30s; increase `start_period` |
| Agent not appearing on canvas | Wrong `WORKSPACE_ID` or expired token | Re-run registration; check platform logs |
| `host.docker.internal` not resolved | Linux host without the Docker flag | Use `--add-host=host.docker.internal:host-gateway` or the host's LAN IP |
