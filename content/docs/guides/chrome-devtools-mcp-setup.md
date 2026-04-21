---
title: "Chrome DevTools MCP Server Setup"
description: "Connect a Chrome DevTools MCP server to Molecule AI for browser automation in AI agents."
tags: [MCP, browser-automation, guides]
---

# Chrome DevTools MCP Server Setup

Chrome DevTools Protocol (CDP) gives AI agents a real browser — navigate, query, screenshot, and interact with any web page using MCP tool calls.

## Prerequisites

- Google Chrome (desktop) or Chromium
- A Molecule AI workspace

## Start Chrome with Remote Debugging

Chrome exposes CDP over a WebSocket at a configurable port. Start Chrome with remote debugging enabled:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

# Windows
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\tmp\\chrome-debug"
```

To run headless (no visible window):

```bash
google-chrome \
  --headless \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-headless
```

**Note:** Ensure no other Chrome instance is already using port 9222.

## Connect via Workspace Config

In Canvas: **Workspace → Config → MCP Servers → Add browser MCP server**.

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

Replace `http://localhost:9223/mcp` with your MCP server URL — for example, a Cloudflare Workers-deployed CDP bridge, or the Chrome DevTools MCP bridge from the [Chrome DevTools MCP blog post](/blog/chrome-devtools-mcp).

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `dom_query` | Query DOM elements via CSS selector |
| `page_screenshot` | Capture a screenshot (PNG) |
| `dom_evaluate` | Execute JavaScript in the page context |

Agents access these tools the same way as any other MCP tool — typed, session-aware, and registered at the workspace level.

## Troubleshooting

**Port 9222 in use:** Find and kill the process with `lsof -i :9222` (macOS/Linux) or `netstat -ano | findstr :9222` (Windows).

**Chrome closes immediately:** Run with `--user-data-dir=/tmp/chrome-debug` to isolate the debugging session from your normal browser profile.

**WebSocket connection refused:** Ensure the MCP server URL is reachable from your Molecule AI deployment.

For full browser automation examples, see the [Chrome DevTools MCP blog post](/blog/chrome-devtools-mcp).
