# Tool Trace — See What Your Agent Actually Did — Social Copy
**Publish day:** 2026-04-28
**Status:** APPROVED — Marketing Lead 2026-04-24
**Campaign:** Phase 34 launch run-up
**Angle:** Tool Trace — built-in A2A execution tracing, no SDK, no sidecar (Phase 34, live now)
**Source blog:** `docs/marketing/blog/2026-04-23-tool-trace-observability.md`
**Source PR:** #1686

---

## X / Twitter Thread (4 tweets)

---

**Tweet 1 — Hook**

Your AI agent just made a mistake.

You asked it to explain itself.
It can't — not accurately.

Here's the fix: `tool_trace`. 🧵

---

**Tweet 2 — The Problem**

Before Tool Trace, debugging an agent meant:

→ Reading the output and inferring what tools ran
→ Adding your own logging and instrumentation
→ Checking vendor dashboards that don't know your A2A topology

Every debugging session was a reconstruction exercise. You got the conclusion. Not the evidence.

---

**Tweet 3 — The Solution**

Every A2A response from Molecule AI now includes `tool_trace` in `Message.metadata`:

```json
{
  "metadata": {
    "tool_trace": [
      {
        "tool_name": "mcp-code-search",
        "input": { "query": "org-scoped API keys creation flow" },
        "output_preview": "found 3 files in 0.12s"
      },
      {
        "tool_name": "mcp-file-read",
        "input": { "path": "docs/api-keys.md" },
        "output_preview": "...64 lines, 2 code blocks..."
      }
    ]
  }
}
```

No config. No SDK change. It's there by default on every response.

---

**Tweet 4 — The Details + CTA**

Parallel tool calls handled with `run_id` pairing — each start event links to its end event so you can reconstruct the full execution tree when calls overlap in time.

Trace data persists to `activity_logs.tool_trace` (JSONB) — queryable via the standard activity log API.

Post-incident review. Cost attribution. Compliance auditing. Native — not a third-party integration.

→ https://docs.molecule.ai/docs/guides/observability

---

## LinkedIn Post (~250 words)

**What your AI agent actually did — now visible by default**

Every debugging session for an AI agent follows the same pattern: reconstruct what happened from the outputs. Which tools ran? What did they return? Which call came first? Without instrumentation, the answer is: you don't know.

Tool Trace ends the guesswork.

Every A2A response from Molecule AI now includes a `tool_trace` array in `Message.metadata` — a structured log of every tool call your agent made, the exact arguments it used, and a capped output preview. No SDK changes. No sidecar. No sampling. It's there by default on every response.

For parallel tool calls, each invocation carries a `run_id` that links the start event to the end event. When an agent calls five tools concurrently, you get the full execution tree — not just a flat list ordered by completion time.

Trace data is persisted to `activity_logs.tool_trace` as a JSONB column, accessible via the standard activity log query API. Post-incident review, cost attribution, compliance auditing, SLA verification — all of this is now native to the platform, not a third-party integration you maintain separately.

Four production use cases this unlocks:
- **Post-incident review** — replay exactly which tool returned bad data and which call chain led to the wrong answer
- **Cost attribution** — see which tool calls drove token consumption across a run
- **Compliance auditing** — prove what actions an agent took before it touched a sensitive resource
- **SLA verification** — confirm the right tools ran in the right order for regulated workflows

Tool Trace is live on all Molecule AI workspaces now.

→ https://docs.molecule.ai/docs/guides/observability

#AIagents #Observability #MLOps #EnterpriseAI #MoleculeAI
