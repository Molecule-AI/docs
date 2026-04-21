# Org-Scoped API Keys — Interactive Demo Script
**Source:** PR #1105 | **Acceptance:** Working demo + repo link + 1-min screencast

---

## What This Demo Shows

1. Mint a named org API key from the CLI
2. Use the key to list workspaces via curl
3. Revoke the key and confirm 401

**Time:** ~60 seconds | **Language:** Bash + Python | **Prereqs:** `ADMIN_TOKEN` or existing org token

---

## Demo Script

### Step 1: Mint a Named Key

```bash
curl -X POST https://your-deployment.molecule.ai/org/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "demo-agent"}'
```

Save the returned `key` value — it is shown once only.

---

### Step 2: Use the Key to List Workspaces

```bash
curl https://your-deployment.molecule.ai/workspaces \
  -H "Authorization: Bearer $KEY_FROM_STEP_1"
```

You should see a JSON array of workspace objects. The key works across all workspaces in your org.

---

### Step 3: Revoke and Confirm 401

```bash
# Get the token ID from step 1 response
curl -X DELETE https://your-deployment.molecule.ai/org/tokens/:id \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```bash
# Confirm the key is rejected immediately
curl https://your-deployment.molecule.ai/workspaces \
  -H "Authorization: Bearer $KEY_FROM_STEP_1"
# Expected: 401 Unauthorized
```

---

## Screencast Notes

- Start screen recording
- Run step 1 — highlight the `name` field in the curl command
- Run step 2 — show the JSON response with workspace names
- Run step 3 — first DELETE (revoke), then 401 response to confirm revocation is instantaneous

**Do not include the plaintext key value in the recording.** Use a throwaway key for the demo.

---

*Attach to issue #1114 for DevRel review. Labels: `area:content-marketer`, `marketing`, `ready-for-review`.*
