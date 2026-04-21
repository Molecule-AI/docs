# MemoryInspectorPanel — Working Demo

> **PR:** #1127 — `feat(canvas): rewrite MemoryInspectorPanel to match backend API`
> **What it ships:** Canvas Memory Inspector now exposes LOCAL/TEAM/GLOBAL scope tabs, namespace filtering, and per-entry delete — wired to correct `/memories` endpoint with proper field types
> **Acceptance:** working demo script + code snippets for each scenario + 60s screencast outline

---

## What This Demo Shows

The Canvas Memory Inspector is a panel in the workspace sidebar that lets you browse, create, and delete memory entries for any workspace. PR #1127 updated it to match the backend API correctly: `id`, `content`, `scope`, `namespace` fields; LOCAL / TEAM / GLOBAL scope tabs with filtering; namespace filter dropdown; per-entry delete.

**Three new user-facing capabilities:**
1. **Scope tabs** — LOCAL, TEAM, GLOBAL — with proper server-side filtering
2. **Namespace filter** — filter memories by namespace (`general`, `facts`, `procedures`, `blockers`, `reference`)
3. **Per-entry delete** — click delete on any memory entry, confirm, gone

---

## API Reference

| Method | Path | What |
|---|---|---|
| `GET` | `/workspaces/:id/memories` | List memories; `?scope=LOCAL\|TEAM\|GLOBAL`, `?namespace=<name>`, `?q=<query>` |
| `POST` | `/workspaces/:id/memories` | Write a memory entry |
| `DELETE` | `/workspaces/:id/memories/:memoryId` | Delete by ID |

**Memory entry shape:**
```json
{
  "id": "mem-uuid-xxx",
  "workspace_id": "ws-abc",
  "content": "the memory content",
  "scope": "LOCAL",          // LOCAL | TEAM | GLOBAL
  "namespace": "general",   // optional, defaults to "general"
  "created_at": "2026-04-21T00:00:00Z"
}
```

---

## Working Demo Script

### 1. List memories by scope (LOCAL / TEAM / GLOBAL)

```bash
PLATFORM="https://acme.moleculesai.app"
TOKEN="Bearer your-workspace-token"
WORKSPACE_ID="ws-abc123"

# List LOCAL scope memories
curl -s "$PLATFORM/workspaces/$WORKSPACE_ID/memories?scope=LOCAL" \
  -H "Authorization: $TOKEN" | jq '.entries'

# List TEAM scope memories (cross-workspace, same org)
curl -s "$PLATFORM/workspaces/$WORKSPACE_ID/memories?scope=TEAM" \
  -H "Authorization: $TOKEN" | jq '.entries'

# List GLOBAL scope memories (org-wide)
curl -s "$PLATFORM/workspaces/$WORKSPACE_ID/memories?scope=GLOBAL" \
  -H "Authorization: $TOKEN" | jq '.entries'
```

**Response:**
```json
{
  "entries": [
    {
      "id": "mem-uuid-xxx",
      "workspace_id": "ws-abc",
      "content": "PM agent: quarterly roadmap review scheduled for next week",
      "scope": "LOCAL",
      "namespace": "general",
      "created_at": "2026-04-21T00:00:00Z"
    }
  ],
  "count": 1
}
```

The scope tab in Canvas shows only entries matching the active scope. Switching tabs re-fetches with `?scope=<TAB>`.

---

### 2. Filter by namespace

Namespaces implement the Holaboss knowledge model: `facts`, `procedures`, `blockers`, `reference` — agents file and recall memories by category.

```bash
# Filter to 'facts' namespace only
curl -s "$PLATFORM/workspaces/$WORKSPACE_ID/memories?scope=LOCAL&namespace=facts" \
  -H "Authorization: $TOKEN" | jq '.entries'

# Filter to 'blockers' namespace
curl -s "$PLATFORM/workspaces/$WORKSPACE_ID/memories?scope=LOCAL&namespace=blockers" \
  -H "Authorization: $TOKEN" | jq '.entries'
```

**In Canvas:** Select a namespace from the dropdown — the entry list filters to that namespace.

---

### 3. Write and delete a memory entry

```bash
# Write a LOCAL memory entry
curl -s -X POST "$PLATFORM/workspaces/$WORKSPACE_ID/memories" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Data pipeline run completed successfully — 12k rows, 0 errors",
    "scope": "LOCAL",
    "namespace": "facts"
  }' | jq
```

**Response:**
```json
{
  "id": "mem-abc-456",
  "workspace_id": "ws-abc",
  "content": "Data pipeline run completed successfully — 12k rows, 0 errors",
  "scope": "LOCAL",
  "namespace": "facts",
  "created_at": "2026-04-21T00:01:00Z"
}
```

Now delete it:

```bash
# Delete the memory entry by ID
MEMORY_ID="mem-abc-456"

curl -s -X DELETE \
  "$PLATFORM/workspaces/$WORKSPACE_ID/memories/$MEMORY_ID" \
  -H "Authorization: $TOKEN" | jq
```

**Response:**
```json
{
  "status": "deleted"
}
```

Confirm it's gone:

```bash
curl -s "$PLATFORM/workspaces/$WORKSPACE_ID/memories?scope=LOCAL" \
  -H "Authorization: $TOKEN" | jq '.entries | map(select(.id == "mem-abc-456"))'
# Output: []
```

---

### 4. Semantic search (when pgvector is deployed)

```bash
# Search LOCAL memories for "quarterly roadmap"
curl -s "$PLATFORM/workspaces/$WORKSPACE_ID/memories?scope=LOCAL&q=quarterly%20roadmap" \
  -H "Authorization: $TOKEN" | jq '.entries[0] | {content, similarity_score}'
```

**Response:**
```json
{
  "content": "PM agent: quarterly roadmap review scheduled for next week",
  "similarity_score": 0.87
}
```

Results are ranked by semantic similarity. The Canvas panel shows the score as a badge on matching entries.

---

## Screencast Outline (1 min)

**0:00–0:10** Canvas: open the Memory Inspector panel in the workspace sidebar. Show the LOCAL / TEAM / GLOBAL scope tabs at the top.

**0:10–0:20** Terminal: `GET /workspaces/:id/memories?scope=LOCAL` — response shows three entries with different scopes. Switch tabs in Canvas — each tab shows only matching entries.

**0:20–0:35** Canvas: select a namespace from the dropdown. Terminal: filter by namespace with `?namespace=facts`. Show only the filtered entries. Write a new memory entry via `POST /memories` — entry appears in the panel.

**0:35–0:50** Canvas: click delete on a memory entry. Confirm dialog fires. Terminal: `DELETE /workspaces/:id/memories/:id` — returns `{"status": "deleted"}`. Canvas shows the entry removed immediately.

**0:50–1:00** Narration: *"The Memory Inspector in Canvas — scope tabs, namespace filter, per-entry delete. Every entry scoped: LOCAL, TEAM, or GLOBAL. Searchable, filterable, deletable. Memory that travels with the agent, visible in the canvas."*

---

## TTS Narration Script (30s)

> The Memory Inspector in Canvas lets you browse, create, and delete memory entries for any workspace — scoped by LOCAL, TEAM, or GLOBAL. Switch tabs to filter by scope. Pick a namespace to narrow further. Click delete on any entry and it's gone. Semantic search finds memories by meaning, not keyword. Memory that travels with the agent, visible right in the canvas.

---

## Key Visual

The scope tabs at the top of the Memory Inspector panel:

```
┌─────────────────────────────────┐
│  LOCAL  │  TEAM  │  GLOBAL     │  ← scope tabs
├─────────────────────────────────┤
│ Namespace: [general ▾]           │  ← namespace dropdown
├─────────────────────────────────┤
│ ● mem-abc  12:34  GENERAL       │
│            "org billing policy: │  ← memory entry
│             quarterly review"   │
│                            [✕]  │  ← delete button
└─────────────────────────────────┘
```

Use a pre-recorded screenshot or a mockup of the panel. Capture with the panel open showing at least one entry with the delete button visible.

---

## Code Reference

| File | What |
|---|---|
| `canvas/src/components/MemoryInspectorPanel.tsx` | Canvas UI: scope tabs, namespace filter, delete |
| `workspace-server/internal/handlers/memories.go` | Backend: Commit, Search, Delete |
| `canvas/src/components/__tests__/MemoryInspectorPanel.test.tsx` | 27 vitest tests covering all scenarios |

**Source:** `canvas/src/components/MemoryInspectorPanel.tsx` (molecule-core#1127)
