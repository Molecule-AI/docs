---
title: Security Changelog
description: Security advisories for Molecule AI platform fixes.
---

# Security Changelog

This page documents security fixes shipped in the Molecule AI platform. Each entry describes the vulnerability, its severity, the affected code, and the remediation.

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

## 2026-04-21 — CWE-918: SSRF in MCP / A2A Proxy Endpoints

**Severity:** High (CWE-918)
**PRs:** [#1274](https://github.com/Molecule-AI/molecule-core/pull/1274), [#1302](https://github.com/Molecule-AI/molecule-core/pull/1302), [#1364](https://github.com/Molecule-AI/molecule-core/pull/1364)
**Affected:** `workspace-server/internal/handlers/mcp.go` — `isSafeURL`, `isPrivateOrMetadataIP`; `workspace-server/internal/handlers/a2a_proxy.go`

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

### User-facing summary

Platform outbound requests from workspaces (MCP tool calls, A2A proxy routing) now validate all target URLs against a comprehensive blocklist before sending. Requests to private IP ranges, cloud metadata endpoints, and loopback addresses are rejected. In SaaS deployments (`MOLECULE_DEPLOY_MODE=saas`), VPC-private IPs used for cross-EC2 workspace registration are allowed.

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
**Affected:** `workspace-server/internal/handlers/plugins_install_pipeline.go`, `workspace-server/internal/handlers/workspace_provision.go`, `docs/incidents/INCIDENT_LOG.md`

### Vulnerability

Error messages returned from platform handler functions used `err.Error()` directly in log output and API error responses. When `err` was a credentials-related error (e.g. AWS `AuthFailure`, cloud API key expiry), sensitive credential fragments could appear in logs, error responses, and the `INCIDENT_LOG.md` documentation file.

Additionally, the `INCIDENT_LOG.md` file itself contained real credential values in some historical entries.

### Fix

- Replaced direct `err.Error()` calls with structured error wrapping that strips credential-like patterns (AWS access key IDs, bearer tokens) before returning or logging.
- Credential values scrubbed from `INCIDENT_LOG.md` historical entries.
- Workspace orchestrator now exits immediately with a named error if `WORKSPACE_ID` is unset or empty, preventing nil-workspace crashes that could surface cryptic errors.

### User-facing summary

Error messages and logs no longer leak credential fragments. Platform handles missing `WORKSPACE_ID` gracefully with a clear startup error rather than a cryptic crash.

