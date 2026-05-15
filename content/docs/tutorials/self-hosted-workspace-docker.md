---
title: Self-Hosted Workspace Deployment with Docker
---

# Self-Hosted Workspace Deployment with Docker

This guide covers running a Molecule AI workspace agent as a Docker container on a self-hosted server or VM. It covers the Docker image, required environment variables, the built-in healthcheck, graceful shutdown, and Kubernetes deployment considerations.

> **Prerequisites:** A running Molecule AI control plane (self-hosted or SaaS), an `ADMIN_TOKEN` or org-scoped API key with admin scope, and Docker 20.10+ on the host.

## How the workspace container works

The Molecule AI workspace Dockerfile includes:

- A `HEALTHCHECK` directive that probes the agent card endpoint every 30 seconds
- A uvicorn server on port 8000 (configurable via `PORT`)
- Support for `stop_event` graceful shutdown via SIGTERM

```
┌─────────────────────────────────────────────┐
│  Docker host (your VM / bare metal)         │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  workspace container                 │   │
│  │                                     │   │
│  │  uvicorn (port 8000)                │   │
│  │    └─ /agent/card  ← HEALTHCHECK    │   │
│  │                                     │   │
│  │  run_heartbeat_loop(stop_event)     │   │
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

Save the returned `WORKSPACE_ID` and bearer token from the next step.

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
| `MOLECULE_API_URL` | `http://localhost:8080` | Platform API URL. From Docker on Linux/macOS, use `http://host.docker.internal:8080` to reach the host machine. |
| `MOLECULE_API_KEY` | — | Bearer token obtained during agent registration |
| `WORKSPACE_ID` | — | Workspace ID from Step 1 |
| `PORT` | `8000` | Agent server port (matches HEALTHCHECK) |
| `AGENT_CARD_URL` | `http://localhost:${PORT}/agent/card` | Advertised agent card URL (must be reachable from the platform) |

## Step 4: Run the container

### Docker (standalone)

```bash
docker run -d \
  --name molecule-workspace \
  -p 8000:8000 \
  -e MOLECULE_API_URL="http://host.docker.internal:8080" \
  -e MOLECULE_API_KEY="your-agent-bearer-token" \
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
curl -s http://localhost:8000/agent/card | python3 -m json.tool
```

### Docker Compose

```yaml
services:
  molecule-workspace:
    image: "${REGISTRY_PREFIX}.dkr.ecr.us-east-1.amazonaws.com/molecule-workspace:latest"
    ports:
      - "8000:8000"
    environment:
      MOLECULE_API_URL: "http://host.docker.internal:8080"
      MOLECULE_API_KEY: "your-agent-bearer-token"
      WORKSPACE_ID: "your-workspace-id"
      PORT: "8000"
    # Linux hosts: add host.docker.internal resolution
    # extra_hosts:
    #   - "host.docker.internal:host-gateway"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/agent/card"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

## Step 5: Graceful shutdown

The workspace agent supports graceful shutdown via a `stop_event: threading.Event`. When the container receives SIGTERM (e.g. from `docker stop`), the heartbeat loop exits cleanly with return value `"stopped"` instead of hanging.

To enable SIGTERM handling in your agent code:

```python
import signal, threading
from molecule_agent import RemoteAgentClient

client = RemoteAgentClient(
    molecule_api_url=os.environ["MOLECULE_API_URL"],
    api_key=os.environ["MOLECULE_API_KEY"],
    workspace_id=os.environ["WORKSPACE_ID"],
)

stop_event = threading.Event()

def sigterm_handler(signum, frame):
    print("Received SIGTERM, initiating graceful shutdown...")
    stop_event.set()

signal.signal(signal.SIGTERM, sigterm_handler)

# run_heartbeat_loop exits with return value "stopped" when stop_event is set
result = client.run_heartbeat_loop(stop_event=stop_event)
print(f"Heartbeat loop stopped: {result}")
```

Without explicit SIGTERM handling, the container will be killed after the Docker default 10-second timeout. The healthcheck ensures orchestrators can detect an unhealthy container before the SIGTERM timeout.

## Kubernetes deployment

For Kubernetes deployments, use the native liveness/readiness probe configuration instead of the Docker HEALTHCHECK:

```yaml
ports:
  - name: http
    containerPort: 8000
livenessProbe:
  httpGet:
    path: /agent/card
    port: http
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /agent/card
    port: http
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
terminationGracePeriodSeconds: 120
```

> **Note:** `terminationGracePeriodSeconds` must exceed the liveness probe failure window (3 × 30s = 90s) so that Kubernetes sends SIGTERM and allows graceful shutdown before the pod is killed. The 120s value here gives a 30s buffer beyond the 90s threshold.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Container shows `unhealthy` after startup | Platform unreachable from container | Verify `MOLECULE_API_URL` uses `host.docker.internal` (Docker) or the correct host IP |
| `curl: (7) Failed to connect` on healthcheck | Container not fully started | Wait up to 30s; increase `start_period` |
| Agent not appearing on canvas | Wrong `WORKSPACE_ID` or expired token | Re-run registration; check platform logs |
| `host.docker.internal` not resolved | Linux host without the Docker flag | Use `--add-host=host.docker.internal:host-gateway` or the host's LAN IP |
