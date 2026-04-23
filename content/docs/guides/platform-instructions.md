---
title: "Platform Instructions"
description: "Enforce system-prompt rules at the platform level — global org-wide rules and workspace-scoped rules injected at agent startup. Governance before the first turn, not after an incident."
tags: [governance, security, platform-engineering, enterprise, system-prompt, policy]
---

# Platform Instructions

Platform Instructions let workspace admins enforce behavioral rules at the system prompt level — injected before the first agent turn, not applied after an incident. Rules are stored in the platform database and resolved at workspace boot via the `GET /workspaces/:id/instructions/resolve` endpoint.

> **Enterprise plans only.** Platform Instructions are available on Enterprise plans. Contact your account team to enable them.

## How it works

When a workspace boots (or refreshes its instructions), it calls:

```
GET /workspaces/:id/instructions/resolve
Authorization: Bearer <workspace-token>
```

The platform returns a merged instruction string:

```json
{
  "workspace_id": "ws_01hx3k...",
  "instructions": "# Platform-Wide Rules\n\n## Security\n\nAlways confirm destructive operations with the user before executing...\n\n## Role-Specific Rules\n\n### Onboarding helper\n\nYou are helping new users set up their first workspace..."
}
```

This string is prepended to the agent's system prompt as `# Platform Instructions` — the first section, before all other content. Because it goes first, it has highest precedence. Agents receive these instructions at boot and on every periodic refresh; they cannot be overridden by the agent's own prompt.

## Types of instructions

| Scope | Description | Use case |
|---|---|---|
| `global` | Applies to every workspace in the org | Security policy, compliance rules, brand voice |
| `workspace` | Applies to one specific workspace | Per-project rules, team-specific behavior, onboarding |

Instructions are merged at resolve time: global rules are applied first, workspace rules second. Within each scope, rules are ordered by `priority` (higher first).

The `team` scope is reserved in the schema but not yet implemented.

## Create a global instruction

### Via the platform API

```bash
curl -X POST https://your-tenant.moleculesai.app/admin/instructions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "global",
    "title": "Security policy",
    "content": "Always confirm destructive operations (delete, revoke, terminate) with the user before executing. Never execute destructive commands without explicit approval.",
    "priority": 100
  }'
```

### Response

```json
{
  "id": "instr_abc123",
  "scope": "global",
  "title": "Security policy",
  "content": "...",
  "priority": 100,
  "enabled": true,
  "created_at": "2026-04-30T12:00:00Z"
}
```

## Create a workspace-scoped instruction

```bash
curl -X POST https://your-tenant.moleculesai.app/admin/instructions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "workspace",
    "scope_target": "ws_01hx3k...",
    "title": "Onboarding helper",
    "content": "You are helping a new user set up their first Molecule AI workspace. Keep explanations concise. Offer to walk through the Canvas UI tour after setup.",
    "priority": 50
  }'
```

`scope_target` accepts a workspace ID. When resolved for that workspace, the response includes both global rules and this workspace-specific rule.

## List all instructions

```bash
# Global instructions only
curl -s "https://your-tenant.moleculesai.app/admin/instructions?scope=global" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Instructions for a specific workspace (global + workspace)
curl -s "https://your-tenant.moleculesai.app/admin/instructions?workspace_id=ws_01hx3k..." \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

## Resolve instructions for a workspace

```bash
curl -s "https://your-tenant.moleculesai.app/workspaces/ws_01hx3k.../instructions/resolve" \
  -H "Authorization: Bearer $WORKSPACE_TOKEN" | jq .
```

The `Authorization` header here uses the **workspace's own token** (from `POST /registry/register` or `POST /workspaces/:id/tokens`). The resolve endpoint is gated by `WorkspaceAuth` — a workspace can only resolve its own instructions.

## Update an instruction

```bash
curl -X PUT https://your-tenant.moleculesai.app/admin/instructions/instr_abc123 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated rule — new wording",
    "priority": 80
  }'
```

The workspace picks up the change on its next instruction refresh (periodic, not immediate).

## Delete an instruction

```bash
curl -X DELETE https://your-tenant.moleculesai.app/admin/instructions/instr_abc123 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Returns `404` if the instruction does not exist.

## Content limits

Instruction content is capped at **8,192 characters** per rule. This prevents a single oversized rule from consuming the entire system prompt token budget. The cap is enforced at creation and update time — requests with content exceeding the limit receive a `400 Bad Request`.

For longer policy documents, consider:
- Splitting into multiple rules with lower priority
- Linking to external policy documents in the rule content
- Using the rule as a summary with a reference to the full policy

## Security properties

**Agents cannot override Platform Instructions** — the instruction string is prepended to the system prompt at the platform layer, before the agent runtime processes it. An agent cannot edit, delete, or suppress its own Platform Instructions.

**Workspace-scoped rules are private** — a workspace can only resolve its own instructions. It cannot enumerate other workspaces' instructions, even if it knows their IDs.

**Content is org-scoped** — instructions live at the org level (global scope) or workspace level. There is no cross-org visibility.

## Relationship with Tool Trace

Platform Instructions enforce rules **before** the agent runs. Tool Trace records what the agent **actually did**. Together they provide a complete governance loop:

1. **Platform Instructions** — set expectations at startup (what the agent should and should not do)
2. **Tool Trace** — verify compliance at runtime (what the agent actually did)

If Tool Trace shows an agent calling tools that Platform Instructions explicitly prohibit, that's a compliance incident — not a configuration issue.

## Related

- [Tool Trace](/docs/guides/tool-trace) — Verify what agents actually did, not just what they said they would do
- [Org-Scoped API Keys](/docs/guides/org-api-keys) — Attribute tool calls to specific org credentials for billing and audit
- [A2A Protocol](/docs/api-protocol/a2a-protocol) — How agents communicate and how Tool Trace travels in A2A responses