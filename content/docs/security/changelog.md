---
title: Security Changelog
description: Security advisories for Molecule AI platform fixes.
---

# Security Changelog

This page documents security fixes shipped in the Molecule AI platform. Each entry describes the vulnerability, its severity, the affected code, and the remediation.

---

## 2026-04-21 — CWE-78: Scope Refinement in `deleteViaEphemeral`

**Severity:** High (CWE-78)
**PRs:** [#1310](https://github.com/Molecule-AI/molecule-core/pull/1310) (original fix), [#1328](https://github.com/Molecule-AI/molecule-core/pull/1328) (scope refinement)
**Affected:** `workspace-server/internal/handlers/container_files.go` — `TemplatesHandler.deleteViaEphemeral`

### Vulnerability

The original fix (PR #1310) switched `deleteViaEphemeral` from shell-form string interpolation to exec-form argument passing, blocking shell metacharacter injection. However, the scoped `rm` command used `rm -rf /configs/ <scope>` where `<scope>` was derived from user-supplied input — a path traversal risk within the already-validated path. A malicious caller could potentially delete files outside the intended scope.

### Fix

Commit `64ccf8e` removes the user-supplied scope argument entirely from the `rm` command. The delete operation now targets only the exact path provided by the caller, with no additional path components. The handler-level `validateRelPath` guard (`filepath.Clean` + `filepath.IsAbs` + `strings.Contains("..")`) remains as a secondary layer.

### User-facing summary

Workspace file deletion operations now use safe argument-passing with no user-supplied scope. Attempts to manipulate the delete scope are rejected at the handler entry point.

---

## 2026-04-21 — F1085: Credential Scrub Before Workspace Memory Seeding

**Severity:** High (credential exposure)
**PRs:** [#1203](https://github.com/Molecule-AI/molecule-core/pull/1203), [#1206](https://github.com/Molecule-AI/molecule-core/pull/1206)
**Affected:** `workspace-server/internal/handlers/workspace_provision.go` — `seedInitialMemories`

### Vulnerability

`seedInitialMemories()` was inserting template and configuration memories directly into the workspace's `agent_memories` table without scrubbing credential-like patterns. A workspace provisioned from a template containing API keys, bearer tokens, or other secrets would store those secrets in plain text, accessible to any agent prompt or memory retrieval within that workspace.

### Fix

`redactSecrets(workspaceID, content)` is now called on the truncated memory content before the `agent_memories` INSERT. The redaction strips patterns matching common credential formats (AWS access key IDs, bearer tokens, generic API keys) before storage. The same `redactSecrets` function is used consistently across the plugin install pipeline and workspace provision paths.

### User-facing summary

Workspace memories seeded from templates no longer store credential-like values in plain text. API keys, bearer tokens, and other secrets are scrubbed from provisioned workspace memories before insertion.

---

## 2026-04-20 — CWE-22: Path Traversal in `copyFilesToContainer`

**Severity:** High (CWE-22)
**PRs:** [#1271](https://github.com/Molecule-AI/molecule-core/pull/1271), [#1270](https://github.com/Molecule-AI/molecule-core/pull/1270), [#1267](https://github.com/Molecule-AI/molecule-core/pull/1267)
**Affected:** `workspace-server/internal/handlers/container_files.go` — `TemplatesHandler.copyFilesToContainer`

### Vulnerability

`copyFilesToContainer` accepted raw map keys as tar header names without validation. A malicious caller could embed `../` sequences in a filename key to write files outside the intended volume mount, potentially overwriting system files or configuration outside the workspace's allocated storage.

### Fix

Two-layer defense:

1. **Handler-level guard** (`validateRelPath` in `templates.go`): `filepath.Clean` + `filepath.IsAbs` + `strings.Contains("..")` check blocks traversal at HTTP entry point before any container interaction.
2. **Archive boundary guard** (in `copyFilesToContainer`): Validates each filename with `filepath.Clean` + `filepath.IsAbs` + `strings.HasPrefix(clean, "..")` before writing the tar header. The validated `archiveName` is constructed as `filepath.Join(destPath, name)`, guaranteeing the header path is always inside the `/configs` volume mount.

Both layers must remain in sync — removing either layer re-opens the vulnerability.

### User-facing summary

File writes to workspace containers now validate all paths before writing to the tar archive. Attempts to write outside the allocated workspace volume are rejected with `400 Bad Request`.

---

## 2026-04-20 — CWE-78: Shell Injection in `deleteViaEphemeral`

**Severity:** High (CWE-78)
**PR:** [#1310](https://github.com/Molecule-AI/molecule-core/pull/1310)
**Affected:** `workspace-server/internal/handlers/container_files.go` — `TemplatesHandler.deleteViaEphemeral`

### Vulnerability

`deleteViaEphemeral` interpolated `filePath` directly into a shell command string using bash's string-concatenation syntax:

```go
cmd := exec.Command("sh", "-c", "rm -rf /configs/"+filePath) // UNSAFE — path becomes shell code
```

A path containing shell metacharacters (e.g., `foo; cat /etc/passwd`) could execute arbitrary commands in the ephemeral Alpine container, potentially escaping the intended delete operation.

### Fix

Replaced the shell-form `exec.Command` with the **exec-form argument array** so the path is passed as a plain argument, never interpreted as shell code:

```go
cmd := exec.Command("rm", "-rf", "/configs", filePath) // SAFE — path is argument only
```

The `validateRelPath` handler-level guard (`filepath.Clean` + `filepath.IsAbs` + `strings.Contains("..")`) is preserved as an additional layer.

### User-facing summary

Workspace file deletion operations now use safe argument-passing and validate all paths before execution. Shell metacharacters in delete paths are treated as literal filenames and never interpreted as commands.

---

## 2026-04-21 — CWE-918: SSRF in MCP / A2A Proxy Endpoints (Updated: Regression Fix)

**Severity:** High (CWE-918)
**Original PRs:** [#1274](https://github.com/Molecule-AI/molecule-core/pull/1274), [#1302](https://github.com/Molecule-AI/molecule-core/pull/1302)
**Regression Fix PR:** [#1430](https://github.com/Molecule-AI/molecule-core/pull/1430)
**Regression introduced by:** [#1363](https://github.com/Molecule-AI/molecule-core/pull/1363)
**Affected:** `workspace-server/internal/handlers/mcp.go` — `isSafeURL`, `isPrivateOrMetadataIP`; `workspace-server/internal/handlers/a2a_proxy.go`; `workspace-server/internal/handlers/a2a_proxy_helpers.go`

### Vulnerability

Workspace URL resolution and outbound HTTP calls in the MCP and A2A proxy handlers did not validate that the target address was reachable from the platform. Without validation, a malicious workspace configuration could redirect platform requests to internal infrastructure (cloud metadata services, RFC-1918 databases, link-local monitoring endpoints) or loopback interfaces.

Additionally, `isPrivateOrMetadataIP` returned `false` for all non-IPv4 inputs, meaning registered IPv6 URLs (`[::1]`, `[fe80::…]`) bypassed the SSRF gate entirely.

### Fix

`isSafeURL` validates every outbound URL before making an HTTP request:

- **Scheme enforcement:** Only `http` and `https` are allowed.
- **Direct IP checks:** Loopback (`127.0.0.0/8`), unspecified (`0.0.0.0`), link-local (`fe80::/10`), and IPv6-mapped loopback addresses are blocked.
- **Private IP range blocking** via `isPrivateOrMetadataIP`:
  - Cloud metadata and reserved ranges (always blocked): `169.254.0.0/16`, `100.64.0.0/10`, `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
  - RFC-1918 private and IPv6 ULA (`fc00::/7`): blocked in self-hosted mode; **allowed in SaaS mode** (see below)
- **DNS rebinding defense:** Hostnames are resolved, and each resolved IP is checked against the blocklist. DNS resolution failures block the request entirely.

**SaaS-mode exception:** Set `MOLECULE_DEPLOY_MODE=saas` (or leave `MOLECULE_ORG_ID` set) to allow VPC-private IPs (RFC-1918, IPv6 ULA) in workspace registration URLs. Required for cross-EC2 SaaS deployments where workspaces register with their VPC-private IPs (e.g. `172.31.x.x` on AWS default VPCs). Cloud metadata, loopback, and link-local stay blocked unconditionally in both modes.

### SaaS Mode Gating

In **SaaS mode** (`saasMode()` returns true), cross-EC2 traffic to RFC-1918 addresses is **allowed** to support legitimate cross-tenant infrastructure. Cloud metadata endpoints (`169.254.0.0/16`), link-local (`fe80::/10`), and loopback (`::1`) are **always blocked** in both SaaS and self-hosted modes.

| IP range | Self-hosted | SaaS (`saasMode()`) |
|---|---|---|
| Cloud metadata (`169.254/16`), link-local (`fe80::/10`), loopback (`::1`) | ❌ blocked | ❌ blocked |
| RFC-1918 (`10/8`, `172.16/12`, `192.168/16`) + IPv6 ULA (`fc00::/7`) | ❌ blocked | ✅ allowed |
| IPv6 addresses | ✅ checked | ✅ checked |

### Regression (2026-04-21)

PR [#1363](https://github.com/Molecule-AI/molecule-core/pull/1363) (handler refactor) moved `isPrivateOrMetadataIP` into `a2a_proxy_helpers.go` but kept a **pre-SaaS version** that unconditionally blocked RFC-1918 addresses, breaking cross-EC2 communication in SaaS. The old version also **returned `false` for all IPv6 inputs**, fully bypassing SSRF protection for IPv6 targets.

PR [#1430](https://github.com/Molecule-AI/molecule-core/pull/1430) restores the correct SaaS-gated logic and adds proper IPv6 coverage to the A2A proxy path.

### User-facing summary

Platform outbound requests from workspaces (MCP tool calls, A2A proxy routing) validate all target URLs against a deployment-mode-aware blocklist. In self-hosted deployments, private IP ranges and cloud metadata endpoints are rejected. In SaaS mode, cross-EC2 communication is permitted while cloud metadata and loopback remain blocked, and IPv6 addresses are fully covered. Requests to unsafe destinations return a descriptive error and are never sent.

---

## 2026-04-21 — Audit Ledger HMAC Chain Guard

**Severity:** Low (denial-of-service / data integrity)
**PRs:** [#1339](https://github.com/Molecule-AI/molecule-core/pull/1339), [#1352](https://github.com/Molecule-AI/molecule-core/pull/1352), [#1354](https://github.com/Molecule-AI/molecule-core/pull/1354) (backport to `main`)
**Affected:** `workspace-server/internal/handlers/audit.go`

### Vulnerability

`verifyAuditChain` called `hex.Decode` on HMAC values without checking the slice length first. Entries with fewer than 32 bytes would panic at runtime, causing a goroutine crash and returning a 500 error for any audit chain verification request.

### Fix

Added a length check before `hex.Decode`:

```go
if len(hmacHex) < 64 { // 32 bytes = 64 hex chars
    return false, fmt.Errorf("HMAC value too short")
}
```

### User-facing summary

Audit chain verification now handles short or malformed HMAC values gracefully, returning `chain_valid: false` instead of a server error.

---

## 2026-04-21 — Credential Scrub: `err.Error()` Leak Prevention

**Severity:** Medium (information disclosure)
**PRs:** [#1282](https://github.com/Molecule-AI/molecule-core/pull/1282), [#1355](https://github.com/Molecule-AI/molecule-core/pull/1355), [#1359](https://github.com/Molecule-AI/molecule-core/pull/1359)
**Affected:** `workspace-server/internal/handlers/plugins_install_pipeline.go`, `workspace-server/internal/handlers/workspace_provision.go`, `content/docs/incidents/INCIDENT_LOG.md`

### Vulnerability

Error messages returned from platform handler functions used `err.Error()` directly in log output and API error responses. When `err` was a credentials-related error (e.g. AWS `AuthFailure`, cloud API key expiry), sensitive credential fragments could appear in logs, error responses, and the `INCIDENT_LOG.md` documentation file.

Additionally, the `INCIDENT_LOG.md` file itself contained real credential values in some historical entries.

### Fix

- Replaced direct `err.Error()` calls with structured error wrapping that strips credential-like patterns (AWS access key IDs, bearer tokens) before returning or logging.
- Credential values scrubbed from `INCIDENT_LOG.md` historical entries.
- Workspace orchestrator now exits immediately with a named error if `WORKSPACE_ID` is unset or empty, preventing nil-workspace crashes that could surface cryptic errors.

### User-facing summary

Error messages and logs no longer leak credential fragments. Platform handles missing `WORKSPACE_ID` gracefully with a clear startup error rather than a cryptic crash.
