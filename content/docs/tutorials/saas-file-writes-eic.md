# SaaS File Writes via EC2 Instance Connect

When your workspace runs on a Molecule AI SaaS EC2 (not a Docker container), the Files API routes writes through **AWS EC2 Instance Connect (EIC)** — the same SSH-backed channel that powers the Terminal tab. This demo shows the end-to-end flow, the three routing decisions the handler makes, and how to verify the write succeeded.

## Prerequisites

- A Molecule AI SaaS workspace (EC2-backed — check `instance_id` in the workspace record)
- `curl` + `jq`
- AWS credentials with `ec2-instance-connect:SendSSHPublicKey` permission (usually handled by Molecule's runtime IAM role; you don't need to configure this yourself)

## How the routing works

`PUT /workspaces/:id/files/*path` checks `workspaces.instance_id` before choosing a write path:

| `instance_id` | Write path |
|---|---|
| empty (self-hosted) | Docker `cp` into running container, then offline ephemeral-container fallback |
| set (SaaS) | EIC: SSH-backed write via `aws ec2-instance-connect` |

```
Caller → PUT /workspaces/:id/files/config.yaml
                │
                ├─ Docker path (container running)
                │     copyFilesToContainer()
                │
                ├─ Docker path (container offline)
                │     writeViaEphemeral() → tar → docker run --rm -v …
                │
                └─ SaaS path (EC2 workspace)
                      writeFileViaEIC()
                      ├── ssh-keygen ed25519 (temp keypair)
                      ├── aws ec2-instance-connect send-ssh-public-key (60s window)
                      ├── aws ec2-instance-connect open-tunnel (local port → :22)
                      └── ssh ubuntu@127.0.0.1 -p LOCAL_PORT "install -D -m 0644 /dev/stdin ABS_PATH"
```

## 1 — List existing files

```bash
export WS_ID=<your-workspace-id>
export API_BASE=https://your-tenant.moleculesai.app   # or localhost:8080 for self-hosted

# List files under /configs (the default root)
curl -s "$API_BASE/workspaces/$WS_ID/files" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Sample response (SaaS / EC2 workspace):**
```json
[
  { "path": "config.yaml", "size": 412, "dir": false },
  { "path": "skills",     "size":   0, "dir": true  }
]
```

## 2 — Write a single file

```bash
curl -s -X PUT "$API_BASE/workspaces/$WS_ID/files/my-agent-prompt.md" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "# Agent Prompt\n\nYou are a careful code reviewer."}' | jq .
```

**Sample response:**
```json
{ "status": "saved", "path": "my-agent-prompt.md" }
```

### What happened under the hood

1. Handler looked up `instance_id` → not empty → routed to `writeFileViaEIC()`
2. Ephemeral `ed25519` keypair generated in `/tmp/molecule-filewrite-*/`
3. Public key pushed via `aws ec2-instance-connect send-ssh-public-key` (valid 60 s)
4. TLS tunnel opened on a local free port → workspace EC2 port 22
5. `ssh install -D -m 0644 /dev/stdin /home/ubuntu/.hermes/my-agent-prompt.md` executed
6. Keydir wiped on function return

## 3 — Bulk replace (multiple files at once)

```bash
curl -s -X PUT "$API_BASE/workspaces/$WS_ID/files" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "files": {
      "config.yaml": "name: my-agent\nversion: 1.0.0\ntier: 1\nmodel: anthropic:claude-sonnet-4-20250514\nskills: []\n",
      "rules.md":    "# Workspace Rules\n\nNo deletions without approval.",
      "system-prompt.md": "# System Prompt\n\nYou are a helpful coding assistant."
    }
  }' | jq .
```

**Sample response:**
```json
{
  "status":    "replaced",
  "workspace": "a8af9d79-...",
  "files":     3,
  "source":    "ec2-ssh"
}
```

> **Bulk-write latency:** Each file opens its own EIC tunnel (~3 s/file). For 10+ files consider writing a tar archive and extracting it in a single SSH session (follow-up tracked in the source PR).

## 4 — Verify the write landed on the EC2

```bash
# Read back via the Files API
curl -s "$API_BASE/workspaces/$WS_ID/files/my-agent-prompt.md" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Confirm the absolute path on the EC2
# hermes runtime  → /home/ubuntu/.hermes/<relPath>
# langgraph       → /opt/configs/<relPath>
# external/unknown→ /opt/configs/<relPath>
```

## Key security properties

| Property | How it's enforced |
|---|---|
| Path traversal blocked | `filepath.Clean(relPath)` + `..` prefix check; absolute paths rejected before any handler call |
| No shell injection | Remote command uses `install` (not `sh -c`); `absPath` built from a closed map + `Clean()` only |
| Ephemeral credentials | ed25519 keypair lives in `tmpdir` ≤ 30 s, wiped by `defer RemoveAll` |
| EIC 60 s key window | AWS drops the temporary authorized key after 60 s regardless |
| OS user locked | Reads from `WORKSPACE_EC2_OS_USER` env var (default `ubuntu`); no other user configurable |

## Error cases

### 500 `failed to write file: workspace has no instance_id`

The workspace record has no `instance_id`, meaning it is a self-hosted Docker workspace. For these, ensure the container is running or use the ephemeral-container fallback. This error only occurs on SaaS when `instance_id` is unexpectedly null.

### 500 `path traversal blocked`

`relPath` contained `..` or was an absolute path. Rejecting at the API boundary before any file operation.

### Timeout (30 s)

Key push + tunnel + write took longer than 30 s. Common causes: slow AWS EIC in the region, high SSH load on the target instance. Retry the request.

## Source PR

PR [#1702](https://github.com/Molecule-AI/molecule-core/pull/1702) — `feat(files-api): SSH-backed write for SaaS workspaces (fixes 500 docker not available)`

Key files in `molecule-core`:
- `workspace-server/internal/handlers/template_files_eic.go` — EIC write logic
- `workspace-server/internal/handlers/template_import.go` — `ReplaceFiles` SaaS routing
- `workspace-server/internal/handlers/templates.go` — `WriteFile` Docker → EIC routing
