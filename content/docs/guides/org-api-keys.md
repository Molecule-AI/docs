---
title: "Org-Scoped API Keys"
description: "Mint, audit, and revoke named API keys for organization-level access in Molecule AI. Replace ADMIN_TOKEN with scoped credentials for scripts, agents, and CI."
tags: [API keys, security, org management, guides]
---

# Org-Scoped API Keys

Org-scoped API keys give AI agents, scripts, and integrations full organization-level access — named, audited, and revocable. They replace the shared `ADMIN_TOKEN` bootstrap credential with granular, per-use-case credentials.

## Mint a Key

### Canvas UI

1. Open **Settings → Org API Keys**
2. Click **Mint new key**
3. Enter a name (e.g., `ci-bot`, `claude-agent-prod`)
4. Copy the plaintext token — shown once only

### CLI / API

```bash
curl -X POST https://your-org.moleculesai.app/org/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "claude-agent-prod"}'
```

Response:

```json
{
  "id": "tok_01HZX3B7N8PQ9K4M5R6T",
  "name": "claude-agent-prod",
  "key": "mola_k7x9p2q4r8s1t3u5v6w0x2y3z",
  "created_by": "session:user_01HZX",
  "created_at": "2026-04-21T00:00:00Z"
}
```

**Store the `key` value immediately** — it won't be shown again.

## What a Key Can Do

A valid org API key grants everything an org admin can do:

- Create, delete, and inspect all workspaces
- Import and export full organization definitions
- Manage per-workspace secrets (your Anthropic/OpenAI keys)
- Install templates, bundles, and plugins
- Approve or reject pending workspace requests
- Configure channels (Discord, Telegram, Slack)
- Mint and revoke other org API keys

It **cannot** touch the control plane (`/cp/admin/*`) or cross into other organizations.

## List Keys

```bash
curl https://your-org.moleculesai.app/org/tokens \
  -H "Authorization: Bearer $MOLECULE_ORG_TOKEN"
```

Response:

```json
{
  "tokens": [
    {
      "id": "tok_01HZX3B7N8PQ9K4M5R6T",
      "name": "claude-agent-prod",
      "created_by": "session:user_01HZX",
      "created_at": "2026-04-21T00:00:00Z",
      "last_used_at": "2026-04-21T12:00:00Z"
    }
  ]
}
```

Note: the full `key` value is never returned after creation — only the name and metadata.

## Revoke a Key

```bash
curl -X DELETE https://your-org.moleculesai.app/org/tokens/tok_01HZX3B7N8PQ9K4M5R6T \
  -H "Authorization: Bearer $MOLECULE_ORG_TOKEN"
```

Revocation is instantaneous — the partial index on live tokens means the next request with the revoked key fails immediately, not after a background job runs.

## Rotating ADMIN_TOKEN

`ADMIN_TOKEN` remains as the break-glass credential. To rotate it:

1. Redeploy Molecule AI with a new `ADMIN_TOKEN` environment variable
2. All existing org API keys continue to work
3. Mint new org API keys from the new `ADMIN_TOKEN`

If you revoke every org API key by accident, `ADMIN_TOKEN` still grants access.

## Auditing Key Usage

Every org API key records its creation attribution:
- `session:<user_id>` — minted by a logged-in user via Canvas
- `org-token:<prefix>` — minted by another org API key
- `admin-token` — minted by `ADMIN_TOKEN`

Audit the creation event in the platform logs to determine which team member or integration created a given key.

## Scoped Roles — Coming Soon

Today, every org API key grants full org admin. Role scoping (read-only, workspace-write, admin) is planned — so you can eventually give a monitoring script only the permissions it needs.

For the full blog post with context and use cases, see [Org-Scoped API Keys](/blog/org-scoped-api-keys).
