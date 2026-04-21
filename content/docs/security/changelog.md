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
**PRs:** [#1274](https://github.com/Molecule-AI/molecule-core/pull/1274), [#1302](https://github.com/Molecule-AI/molecule-core/pull/1302)
**Affected:** `workspace-server/internal/handlers/mcp.go` — `isSafeURL`, `isPrivateOrMetadataIP`; `workspace-server/internal/handlers/a2a_proxy.go`

### Vulnerability

Workspace URL resolution and outbound HTTP calls in the MCP and A2A proxy handlers did not validate that the target address was reachable from the platform. Without validation, a malicious workspace configuration could redirect platform requests to internal infrastructure (cloud metadata services, RFC-1918 databases, link-local monitoring endpoints) or loopback interfaces.

### Fix

`isSafeURL` validates every outbound URL before making an HTTP request:

- **Scheme enforcement:** Only `http` and `https` are allowed.
- **Direct IP checks:** Loopback (`127.0.0.0/8`), unspecified (`0.0.0.0`), and link-local (`fe80::/10`) addresses are blocked.
- **Private IP range blocking** via `isPrivateOrMetadataIP`:
  - RFC-1918 private: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - CGNAT shared address space: `100.64.0.0/10`
  - Cloud metadata services: `169.254.0.0/16`
  - Documentation and test ranges: `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
- **DNS rebinding defense:** Hostnames are resolved, and each resolved IP is checked against the blocklist. DNS resolution failures block the request entirely.

URLs that fail validation return a descriptive error; requests are never sent to unsafe destinations.

### User-facing summary

Platform outbound requests from workspaces (MCP tool calls, A2A proxy routing) now validate all target URLs against a comprehensive blocklist before sending. Requests to private IP ranges, cloud metadata endpoints, and loopback addresses are rejected.