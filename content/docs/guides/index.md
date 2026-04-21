# Guides

Step-by-step guides for common Molecule AI integrations and configurations.

## Getting Started

- [Quickstart](/docs/quickstart) — Deploy your first AI agent in under 5 minutes.

## Remote Agents

- [External Agent Registration](/docs/guides/external-agent-registration) — Register agents running outside the platform Docker network (on laptops, cloud VMs, edge devices) as first-class workspaces with per-workspace bearer tokens.
- [Remote Workspaces FAQ](/docs/guides/remote-workspaces-faq) — Common customer and sales-engineer questions about running agents outside the platform's Docker network.
- [Token Management API](/docs/guides/token-management) — Mint, list, and revoke per-workspace bearer tokens for remote agents.

## Integrations

- [MCP Server Setup](/docs/guides/mcp-server-setup) — Connect Claude Code, Cursor, or any MCP-compatible tool to Molecule AI. Full 87-tool reference for workspace management, agents, secrets, memory, schedules, channels, plugins, and more.
- [Chrome DevTools MCP Server Setup](/docs/guides/chrome-devtools-mcp-setup) — Connect a Chrome DevTools MCP server to Molecule AI for browser automation in AI agents.

## Authentication

- [Org-Scoped API Keys](/docs/guides/org-api-keys) — Mint, audit, and revoke named API keys for organization-level access. Replace `ADMIN_TOKEN` with scoped credentials for scripts, agents, and CI.
- [Workspace Auth Tokens](/docs/architecture/workspace-auth-tokens) — Technical deep-dive on per-workspace bearer token authentication (Phase 30.1).