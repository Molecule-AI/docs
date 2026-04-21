---
title: "Give Your AI Agents Org-Admin Access with Org-Scoped API Keys"
date: 2026-04-21
slug: org-scoped-api-keys
description: "Named, revocable, audited API keys that give AI agents and scripts full organization-level access — without a browser session. Mint from the canvas UI or CLI."
tags: [API keys, security, AI agents, org management, tutorial]
---

# Give Your AI Agents Org-Admin Access with Org-Scoped API Keys

Every Molecule AI organization has one bootstrap credential: `ADMIN_TOKEN`. It's a shared secret stored in AWS Secrets Manager, rotates only on redeploy, and can't be revoked without breaking every integration that depends on it.

Org-scoped API keys replace it.

Starting today, any org admin can mint a named API key — from the canvas UI or the CLI — give it a label like `ci-bot` or `claude-agent-prod`, and hand it to whatever needs org-level access. Revoke it the moment something looks wrong. Mint a replacement. Done.

No more shared secrets. No more ops intervention to rotate a key. No more wondering which integration is using which credential.

## What makes these different

Traditional API keys are static strings with no name and no history. Org API keys are:

- **Named** — every key has a label so you know which integration holds it
- **Audited** — every key records who created it (`session`, `org-token:<prefix>`, `admin-token`)
- **Revocable instantly** — one click and the next request with that key gets 401
- **Multi-key** — give each integration its own key so a compromise is scoped to one use case

```bash
# Mint a key from the CLI
curl -X POST https://your-org.moleculesai.app/org/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "claude-agent-prod"}'
```

The response returns the plaintext token once. Store it in your secret manager — it won't be shown again.

## What a key can do

A valid org API key unlocks everything an org admin can do:

- Create, delete, and inspect all workspaces
- Import and export full organization definitions
- Manage per-workspace secrets (your Anthropic/OpenAI keys)
- Install templates, bundles, and plugins
- Approve or reject pending workspace requests
- Configure channels (Slack, Discord, and more)
- Mint and revoke other org API keys

It cannot touch the control plane (`/cp/admin/*`) or cross into other organizations.

## Rotating safely

If a key leaks, revoke it immediately:

```bash
curl -X DELETE https://your-org.moleculesai.app/org/tokens/:id \
  -H "Authorization: Bearer $MOLECULE_ORG_TOKEN"
```

Revocation is instantaneous — the partial index on live tokens means the next request fails in microseconds, not after a background job runs.

If you revoke every key by accident, `ADMIN_TOKEN` is still there as the break-glass credential. You'll need to redeploy to rotate it, but access is never locked out.

## Scoped roles — coming soon

Today, every org API key grants full org admin. Role scoping (read-only, workspace-write, admin) is planned — so you'll eventually be able to give a monitoring script only the permissions it needs.

---

Ready to replace your `ADMIN_TOKEN`? Open **Settings → Org API Keys** in the canvas UI to mint your first key, or check `docs/guides/org-api-keys.md` for the full API reference.