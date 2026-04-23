---
title: "Govern Your Entire AI Fleet at the System Prompt Level"
date: 2026-04-23
slug: platform-instructions-governance
description: "Platform Instructions lets org admins push global and workspace-scoped rules that are prepended to every agent's system prompt at startup — governance without a plugin."
tags: [governance, enterprise, platform, security, RBAC, compliance]
---

**Status:** Live — PR #1686 merged 2026-04-23

# Govern Your Entire AI Fleet at the System Prompt Level

Every AI agent needs guardrails. "Always cite sources." "Never touch production without approval." "Flag financial data before acting." Until today, you'd encode these rules in every prompt by hand, or build a plugin to inject them at runtime.

Platform Instructions takes a different approach: governance at the platform layer, before the agent ever starts.

Admins define rules — called Instructions — and assign them global or per-workspace scope. When a workspace starts up, the platform resolves all applicable Instructions and prepends them to the agent's system prompt. The agent experiences them as part of its native context. No middleware. No plugin. No code changes.

## How it works

```bash
# Create a workspace-scoped instruction via the API
curl -X POST https://api.moleculesai.app/workspaces/ws-abc123/instructions \
  -H "Authorization: Bearer $MOLECULE_ORG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "workspace",
    "content": "Always cite your data sources in responses. If you cannot verify information, say so explicitly.",
    "label": "citation-policy"
  }'
```

The API returns the Instruction ID immediately:

```json
{ "id": "inst-xyz789", "scope": "workspace", "label": "citation-policy", "created_at": "..." }
```

At workspace startup, the platform calls the resolve endpoint:

```bash
curl https://api.moleculesai.app/workspaces/ws-abc123/instructions/resolve \
  -H "Authorization: Bearer $MOLECULE_ORG_TOKEN"
# → { "preamble": "Always cite your data sources...", "sources": ["inst-xyz789"] }
```

That `preamble` is prepended to the agent's system prompt before the first token is generated.

## Global scope for org-wide rules

Workspace-scoped Instructions are powerful. Global-scoped Instructions go further: they apply to every workspace in your organization at startup, without needing to configure each one individually.

```bash
curl -X POST https://api.moleculesai.app/org/instructions \
  -H "Authorization: Bearer $MOLECULE_ORG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "global",
    "content": "No agent action may proceed without explicit user confirmation when the request involves: deleting data, issuing credentials, or modifying access controls.",
    "label": "critical-action-gate"
  }'
```

## Security by design

Platform Instructions are built for enterprise trust boundaries:

- **wsAuth gating** — the resolve endpoint is scoped to the authenticated workspace. There is no cross-workspace enumeration endpoint; a workspace can only read its own Instructions.
- **8KB content cap** — a CHECK constraint on the database prevents Instructions larger than 8KB, blocking token-budget denial-of-service at the platform level.
- **Audit trail** — every Instruction records who created it (`session`, `org-token`, `admin-token`), so you can trace governance changes back to the human or system that made them.
- **No runtime override** — Instructions are resolved at workspace startup and baked into the system prompt. An agent cannot self-modify its Instructions at runtime.

## Enterprise use cases

**Compliance:** "All financial data must be flagged with a [CONFIDENTIAL] prefix." Set it once globally; every agent in the org inherits it.

**Procurement controls:** "External tool calls require a cost estimate displayed to the user before execution." Enforce it at the platform layer, not in every prompt.

**Data residency reminders:** "Do not retain PII beyond the current session." Global scope, every workspace, every session.

## Ready to use

Platform Instructions are available now via the REST API. The Canvas UI support for managing Instructions is in active development — see the [Platform Instructions guide](/docs/guides/platform-instructions.md) for the full API reference.
