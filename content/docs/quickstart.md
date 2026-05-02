---
title: "Quickstart: Deploy Your First AI Agent"
description: "Get a Molecule AI workspace running in under 5 minutes. Deploy an agent, connect a channel, and send your first task."
tags: [quickstart, getting-started]
---

# Quickstart: Deploy Your First AI Agent

Get a Molecule AI workspace running in under five minutes.

## 1. Install Molecule AI

```bash
git clone https://github.com/Molecule-AI/molecule-monorepo.git
cd molecule-monorepo
docker compose up -d
```

Or use the hosted version at your-platform.molecule.ai.

## 2. Create a Workspace

In Canvas: **Workspaces → New Workspace**. Give it a name and connect your first channel.

Or via API:

```bash
curl -X POST https://your-platform.molecule.ai/workspaces \
  -H "Authorization: Bearer ${YOUR_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-first-agent",
    "description": "Competitive research assistant"
  }'
```

## 3. Configure an MCP Server

For browser automation or custom tool integrations, add an MCP server via Canvas: **Workspace → Config → MCP Servers → Add**.

Or via API:

```bash
curl -X PATCH https://your-platform.molecule.ai/workspaces/${WORKSPACE_ID}/config \
  -H "Authorization: Bearer ${WORKSPACE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mcp_servers": {
      "browser": {
        "type": "streamable_http",
        "url": "http://localhost:9223/mcp"
      }
    }
  }'
```

## 4. Connect a Channel

Connect Discord, Telegram, or Slack via the **Channels** tab in Canvas. Paste a webhook URL or bot token — your agent is now accessible from your team's existing communication tools.

## 5. Send Your First Task

```bash
curl -X POST https://your-platform.molecule.ai/workspaces/${WORKSPACE_ID}/tasks \
  -H "Authorization: Bearer ${WORKSPACE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Summarize the last 24 hours of deployment events"
  }'
```

Or type `/ask what's our deployment status?` in your connected Discord channel.

## What's Next

- [Connect MCP servers for browser automation](/docs/guides/chrome-devtools-mcp-setup)
- [Configure org-scoped API keys for team access](/blog/org-api-keys)
- [Review the REST API reference](/docs/guides/org-api-keys)
- [Browse all guides](/docs/guides)

Explore the [GitHub repo](https://github.com/Molecule-AI/molecule-monorepo) for self-hosting options, or visit [moleculesai.app](https://moleculesai.app) for the hosted platform.
