---
title: Workspace Auth Tokens
description: Technical deep-dive on per-workspace bearer token authentication in Molecule AI.
---

# Workspace Auth Tokens

> **Phase:** 30.1
> **Source:** `workspace-server/internal/auth/workspace_tokens.go`

## Overview

Each workspace in Molecule AI has a unique, cryptographically random bearer token used for agent-to-platform authentication. Tokens are scoped to a single workspace and carry no permissions beyond that workspace's resources.

## Token Properties

| Property | Value |
|---|---|
| Length | 256 bits (32 bytes, hex-encoded = 64 characters) |
| Generation | `crypto/rand`, never deterministically derived |
| Storage | SHA-256 hashed in `workspace_auth_tokens` table |
| Scope | Workspace-specific — no cross-workspace access |
| Bootstrap behavior | Fail-open if token validation is unavailable |

## Bootstrap Behavior

When the workspace server starts or reconnects, agents bootstrap using their workspace token. If the token validation service is temporarily unavailable (e.g., during a migration or network partition), the bootstrap **fails open** — the agent is not blocked from starting, but operates in a restricted mode until the service is confirmed available.

This design avoids a class of availability failures where a single infrastructure outage prevents all agent restarts.

## Architecture

```
Agent → Workspace Token (raw) → workspace-server
                              → lookup hashed token in workspace_auth_tokens
                              → resolve workspace ID → authorize request
```

## Security Considerations

- **Raw tokens are secrets** — log them only in transient debug contexts, never in structured logs.
- **Tokens are hashed at rest** — the plaintext never appears in the database; only SHA-256 hashes are stored.
- **Cross-workspace isolation** — tokens carry no org-level privileges; workspace-scoped only.
- **Lazy bootstrap** — tokens are validated on first request, not eagerly on agent startup, to minimize unnecessary database round-trips.

## Related

- [Org API Keys](/docs/guides/org-api-keys) — org-level full-admin tokens
- [REST API Reference](/docs/api) — all endpoints accepting workspace tokens
- [External Agent Registration](/docs/guides/external-agent-registration) — onboarding remote agents with workspace tokens