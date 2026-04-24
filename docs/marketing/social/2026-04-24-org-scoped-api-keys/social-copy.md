# Org-Scoped API Keys — Phase 34 Warm-Up — Social Copy
**Publish day:** 2026-04-24
**Status:** APPROVED — Marketing Lead 2026-04-24
**Campaign:** Phase 34 launch run-up
**Angle:** Org-Scoped Keys live (Phase 30 recap) — warm-up for Partner API Keys GA Apr 30

---

## X / Twitter Thread (4 tweets)

---

**Tweet 1 — Hook**

Your AI agents shouldn't be running on `ADMIN_TOKEN`.

Here's the key model that replaces it — and what it unlocks for Phase 34 next week. 🧵

---

**Tweet 2 — The Problem**

`ADMIN_TOKEN` is a shared secret. No name. No revocation granularity. No way to know which agent used it when something goes wrong.

One leaked token and your entire org is exposed — and rotation requires coordinating downtime across every integration at once.

Org-scoped API keys solve this.

---

**Tweet 3 — The Solution**

With org-scoped API keys you get one key per integration:

→ Named (`ci-agent-prod`, `claude-agent-prod`, `zapier-sync`)
→ Audited — every call is attributed to the key that made it
→ Instantly revocable — 401 on the next request, no propagation delay
→ Isolated — revoking one key doesn't touch any other integration

```bash
curl -X POST https://your-org.moleculesai.app/org/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "claude-agent-prod"}'
```

Mint in the Canvas UI or via API. Store the plaintext token once — it won't be shown again.

---

**Tweet 4 — Bridge to Phase 34**

Org-scoped keys are live now (Settings → Org API Keys).

Next week: we extend the same model across orgs.

Partner API Keys (`mol_pk_*`) let you provision a full Molecule AI org per customer via a single API call — no browser session, no UI fragility.

April 30. 👀

---

## LinkedIn Post (~180 words)

**Why your AI agents shouldn't be running on ADMIN_TOKEN — and what to use instead.**

Every Molecule AI org ships with one bootstrap credential: `ADMIN_TOKEN`. It works, but it comes with a structural problem: it's a shared secret with no name, no revocation granularity, and no attribution when something unexpected happens.

Org-scoped API keys — live since Phase 30 — replace it.

The model is straightforward: mint one named key per integration (`ci-agent-prod`, `claude-agent-prod`, `monitoring-bot`). Each key has a full audit trail. Each key is instantly revocable without touching any other integration. If a key leaks, you cut it off before the next request completes.

For AI agents specifically, this matters more than it does for static integrations. Agents are dynamic, they persist for weeks or months, and their behavior is emergent — you can't always predict what endpoints they'll call in production. A named, revocable key is the containment layer when something goes sideways.

**What's next:** Next week we extend this model across org boundaries. Partner API Keys (`mol_pk_*`) go GA April 30 — programmatic org provisioning for platform builders and CI/CD automation. More on that this week.

Settings → Org API Keys to get started today.
