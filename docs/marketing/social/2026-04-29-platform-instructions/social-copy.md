# Platform Instructions — Governance Before the Agent Runs — Social Copy
**Publish day:** 2026-04-29
**Status:** APPROVED — Marketing Lead 2026-04-24
**Campaign:** Phase 34 launch run-up
**Angle:** Platform Instructions — pre-execution governance, global + workspace-scoped (Phase 34, live now)
**Source blog:** `docs/marketing/blog/2026-04-23-platform-instructions-governance.md`
**Source PR:** #1686

---

## X / Twitter Thread (4 tweets)

---

**Tweet 1 — Hook**

Every AI agent needs guardrails.

"Never touch production without approval."
"Always cite your data sources."
"Flag financial data before acting."

Until now you'd encode these in every prompt by hand.

Platform Instructions is a better approach. 🧵

---

**Tweet 2 — The Old Way**

Prompt-level governance has one failure mode: every new workspace means another copy of the rules.

Update the rule in one place — every other workspace is now out of date.

One missing instruction in one agent's prompt.
That's your compliance gap.

---

**Tweet 3 — How It Works**

Platform Instructions are resolved at workspace startup and prepended to the system prompt before the first token is generated.

```bash
# Set an org-wide rule — applies to every workspace at startup
curl -X POST https://api.moleculesai.app/org/instructions \
  -H "Authorization: Bearer $MOLECULE_ORG_TOKEN" \
  -d '{
    "scope": "global",
    "content": "No agent action may proceed without explicit user confirmation when the request involves: deleting data, issuing credentials, or modifying access controls.",
    "label": "critical-action-gate"
  }'
```

Two scopes:
→ `global` — every workspace in the org, every session
→ `workspace` — targeted rules for specific workspaces

---

**Tweet 4 — Security Properties + CTA**

Built for enterprise trust boundaries:

→ wsAuth gating on the resolve endpoint — no cross-workspace enumeration
→ 8KB content cap at the database level — blocks token-budget DoS
→ Full audit trail — every Instruction records the session or token that created it
→ No runtime override — agents cannot self-modify their Instructions

Governance before the agent starts. Not after the incident.

→ https://docs.molecule.ai/docs/guides/platform-instructions

---

## LinkedIn Post (~280 words)

**Governance before the agent runs — not after the incident**

The standard approach to AI agent governance works like this: something goes wrong, you add a rule to the prompt. Repeat. Slowly the system prompt becomes a long list of compensating controls — each one a record of a prior mistake.

Platform Instructions takes a different approach.

Admins define Instructions — governance rules — and assign them `global` (org-wide) or `workspace` scope. When a workspace starts, the platform resolves all applicable Instructions and prepends them to the agent's system prompt before the first token is generated. The agent experiences them as part of its native context.

Two properties that make this enterprise-grade:

**Centralized management** — change a global Instruction once, and every workspace in the org picks it up on next startup. No prompt archaeology. No "which workspaces are missing this rule?" audits. The policy lives in one place and enforces everywhere.

**No runtime override** — Instructions are resolved at startup and baked in. An agent cannot self-modify its Instructions at runtime. The governance layer is outside the agent's control surface entirely.

The security posture is tight: wsAuth gating on the resolve endpoint (no cross-workspace enumeration), an 8KB content cap at the database level to block token-budget denial-of-service, and a full audit trail — every Instruction records the session or API token that created it.

Enterprise use cases this covers in one API call:
- "All financial data must be flagged with a [CONFIDENTIAL] prefix" — set globally, inherits everywhere
- "External tool calls require a cost estimate before execution" — platform-enforced, not prompt-enforced
- "Do not retain PII beyond the current session" — every workspace, every session

Platform Instructions is available now via the REST API. Canvas UI management is in active development.

→ https://docs.molecule.ai/docs/guides/platform-instructions

#AIagents #EnterpriseAI #Governance #Security #MoleculeAI
