# Org-Scoped API Keys: Enterprise Key Management for Multi-Agent Teams

**Published:** April 20, 2026 | **Author:** Molecule AI Marketing

---

When your engineering team scales from two agents to twenty, the last thing you want is a single `ADMIN_TOKEN` hardcoded in your environment. It's a single point of failure, impossible to rotate without downtime, and impossible to audit. Today's launch changes that.

We're rolling out **org-scoped API keys** — named, revocable, audit-trail-enabled tokens that live at the organization level and can reach any workspace in your org without breaking the security model.

## What Are Org-Scoped API Keys?

Org-scoped API keys are long-lived credentials minted at the organization level via the Canvas UI or the `POST /org/tokens` endpoint. Each key has:

- A **display name** you choose at creation time (e.g., `ci-deploy-bot`, `devops-rev-proxy`)
- A **sha256 hash** stored server-side — the plaintext is shown once and never again
- A **prefix** (first 8 characters) visible in listings so you can identify keys without exposing secrets
- A **created-by** field that tracks provenance in the audit trail
- **Immediate revocation** — drop a key and it stops being accepted on the very next request

The keys work across all workspaces in your org — not just admin-surface endpoints, but also per-workspace sub-routes like `/workspaces/:id/channels` and `/workspaces/:id/tokens`.

## Why Enterprise Teams Need Org-Level Key Management

### The `ADMIN_TOKEN` problem

A single env-var token works for prototypes. For production multi-agent systems it creates three compounding risks:

1. **Rotation requires downtime.** You can't rotate a token used by ten agents simultaneously. You rotate, or you don't — and both choices are bad.
2. **No attribution.** When something calls your API, you have no idea which agent or integration is responsible.
3. **No compartmentalization.** One compromised token compromises everything.

### What org-scoped keys give you

| Capability | `ADMIN_TOKEN` | Org-Scoped Keys |
|---|---|---|
| Rotate without downtime | ❌ | ✅ (one key revokes, another takes over) |
| Identify caller per request | ❌ | ✅ (audit prefix in every log line) |
| Revoke a single integration | ❌ | ✅ (per-key revocation) |
| Assign to workspace subroutes | ❌ | ✅ |
| Audit trail with attribution | Partial | ✅ (`created_by` + prefix in logs) |

## Audit Trail and Rate-Limit Controls

Every request authenticated with an org API key carries the key's prefix in the audit log, making it straightforward to trace calls back to a specific integration. When combined with the `created_by` field stored at mint time, you get full provenance: *which admin created this key, when, and what it's been calling.*

Rate-limit controls for org tokens are planned as a near-term follow-on (see roadmap, P3). For now, the token hierarchy is:

- **Lazy bootstrap** (Tier 0) — only active when there are zero org tokens and no `ADMIN_TOKEN` at all
- **WorkOS session** (Tier 1) — verified user sessions
- **Org API tokens** (Tier 2a) — new org-scoped keys (primary path for service integrations)
- **`ADMIN_TOKEN` env var** (Tier 2b) — break-glass for operators, CLI tooling
- **Workspace tokens** (Tier 3) — deprecated per-workspace tokens

## How to Get Started

### Mint a key via API

```bash
curl -X POST https://your-deployment.molecule.ai/org/tokens \
  -H "Authorization: Bearer <your-admin-session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ci-deploy-bot",
    "description": "GitHub Actions deploy pipeline"
  }'
```

Response (plaintext shown once — store it securely):

```json
{
  "id": "tok_01HXYZ...",
  "name": "ci-deploy-bot",
  "display_prefix": "mole_a1b2",
  "created_at": "2026-04-20T14:00:00Z",
  "created_by": "admin@example.com"
}
```

### List and revoke keys

```bash
# List all active keys (prefix-only, no plaintext)
curl https://your-deployment.molecule.ai/org/tokens \
  -H "Authorization: Bearer <your-admin-session-token>"

# Revoke a key immediately
curl -X DELETE https://your-deployment.molecule.ai/org/tokens/tok_01HXYZ... \
  -H "Authorization: Bearer <your-admin-session-token>"
```

### Use in a workspace sub-route

```bash
# Token hits workspace sub-route via org auth
curl https://your-deployment.molecule.ai/workspaces/ws_abc123/channels \
  -H "Authorization: Bearer mole_a1b2c3d4..."
```

## Competitive Note: Hermes v0.10.0 Tool Gateway

Hermes v0.10.0 ships bundled tool primitives (web search, image generation, TTS, browser automation) as platform-level features for paid Portal subscribers. This positions Hermes as "batteries included" for single-user AI. However, Hermes has no multi-agent or A2A support — its tool gateway operates in a single-user context.

Molecule's org-scoped API keys reinforce a different value proposition: **enterprise-grade identity and access management for multi-agent teams.** The skills architecture offers greater composability than Hermes' bundled approach, and org tokens now give teams the access-control primitives needed to deploy that composability safely in production.

Hermes' bundled tools are a valid competitive concern at the feature-surface level. Org-scoped API keys address a deeper need — the same teams comparing bundled-vs-skills architectures need first-class auth and audit before they're comfortable shipping to production. This launch moves Molecule closer to that confidence threshold.

---

## TTS Announcement Clip (45 seconds)

*[Suggested script for TTS / social audio: read at ~150 words/min]*

> **Clip script:**
>
> "Molecule AI is shipping org-scoped API keys — enterprise-grade credentials for multi-agent teams. Mint named, revocable tokens from the Canvas UI or REST API. No more single ADMIN_TOKEN across your whole deployment. Each key gets a display prefix for audit attribution, a created-by trace, and immediate revocation. Tokens work across every workspace in your org — including sub-routes, not just admin endpoints. Rotate keys without downtime. Identify which integration called what, every time. Get started in under five minutes: POST to slash-org-slash-tokens, store the plaintext once, and you're live. Org-scoped API keys are available now on all production deployments. Head to the docs or open Canvas to mint your first key."

---

*Attach comments to issue #1114 for review. Labels: `area:content-marketer`, `marketing`, `ready-for-review`.*