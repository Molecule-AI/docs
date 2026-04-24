# Org-Scoped API Keys — CI/CD Angle — Social Copy
**Publish day:** 2026-04-25
**Status:** APPROVED — Marketing Lead 2026-04-24
**Campaign:** Phase 34 launch run-up
**Angle:** CI/CD workspace automation with org-scoped keys
**OG image:** /assets/blog/2026-04-25-org-scoped-api-keys-og.png

---

## X / Twitter Thread (4 tweets)

---

**Tweet 1 — Hook**

Your CI pipeline is probably using a shared `ADMIN_TOKEN` to spin up agent workspaces.

That's a shared secret, shared state, and a rotation problem waiting to happen.

Here's the pattern that fixes it. 🧵

---

**Tweet 2 — The Pattern**

Org-scoped API keys give you workspace lifecycle automation without the shared secret risk:

```bash
# Mint a named key for your CI system
curl -X POST https://your-org.moleculesai.app/org/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "ci-pipeline"}'

# Use it to create a workspace per PR
curl -X POST https://your-org.moleculesai.app/workspaces \
  -H "Authorization: Bearer $CI_ORG_TOKEN" \
  -d '{"name": "pr-1234-integration-test"}'

# Tear it down when the run finishes
curl -X DELETE https://your-org.moleculesai.app/workspaces/$WS_ID \
  -H "Authorization: Bearer $CI_ORG_TOKEN"
```

Named key. Full audit trail. Revoke it without touching any other integration.

---

**Tweet 3 — Why This Beats ADMIN_TOKEN in CI**

Three failure modes org-scoped keys eliminate in CI pipelines:

1. **Token leak in logs** — if `CI_ORG_TOKEN` leaks, you revoke that key alone. Not every integration.
2. **Key rotation downtime** — revoke + re-mint in two API calls. No pipeline coordination needed.
3. **Attribution gaps** — every workspace creation, modification, and deletion is attributed to `ci-pipeline` in the audit log. No more mystery calls.

One key per CI system. Every action traceable.

---

**Tweet 4 — CTA + Bridge**

Org API keys are live now — Settings → Org API Keys in Canvas, or `POST /org/tokens` via API.

And if you need workspace isolation at the org level — a fresh org per PR instead of a fresh workspace — that's Partner API Keys (`mol_pk_*`). GA April 30.

Docs: docs.molecule.ai/docs/guides/org-api-keys

---

## LinkedIn Post (~200 words)

**The right way to wire Molecule AI into your CI/CD pipeline.**

If your integration tests or agent workflows run inside Molecule AI workspaces, there's a good chance your pipeline is using a shared `ADMIN_TOKEN` to create and tear them down. That credential works — but it comes with three structural problems.

First, if it leaks in a log file (and CI logs are not airtight), you're rotating every integration simultaneously. Second, there's no attribution: when you audit what your pipeline did, you see `ADMIN_TOKEN`, not `ci-pipeline`. Third, rotation requires downtime coordination — every system that holds the token needs to be updated together.

**The fix is one named org-scoped API key for your CI system.**

Mint `ci-pipeline` from Settings → Org API Keys (or `POST /org/tokens`). Give your pipeline that key instead of `ADMIN_TOKEN`. Now:

- If it leaks, you revoke one key. Nothing else is affected.
- Every workspace lifecycle action (`POST /workspaces`, `DELETE /workspaces/:id`) shows `ci-pipeline` in the audit log.
- Rotation is two API calls: revoke the old key, mint a new one, update your secret manager.

Workspace-per-PR with clean teardown is the pattern. The org-scoped key is the credential that makes it safe.

**April 30 addition:** Partner API Keys (`mol_pk_*`) extend this to org-level isolation — a fresh org per pipeline run, not just a fresh workspace. If your test environment needs that level of isolation, that's coming in five days.

Full org API key guide: docs.molecule.ai/docs/guides/org-api-keys
