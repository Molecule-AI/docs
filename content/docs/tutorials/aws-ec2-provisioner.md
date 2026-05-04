---
title: "Provisioning Workspaces on AWS EC2 (production SaaS provisioner)"
description: "How the molecule-controlplane EC2 provisioner turns POST /cp/orgs and POST /workspaces calls into running tenant + workspace EC2 instances — env vars, lifecycle, tier sizing, and the migration off Fly Machines."
---

# Provisioning Workspaces on AWS EC2 (production SaaS provisioner)

As of April 2026, Molecule AI's SaaS control plane provisions both **tenants**
(per-org platform VMs) and **workspaces** (per-agent inference VMs) on
AWS EC2 instances. The provisioner lives at
[`molecule-controlplane/internal/provisioner/ec2.go`](https://github.com/Molecule-AI/molecule-controlplane/blob/main/internal/provisioner/ec2.go)
and is auto-wired by [`cmd/server/main.go`](https://github.com/Molecule-AI/molecule-controlplane/blob/main/cmd/server/main.go)
whenever AWS credentials are present in the control-plane environment. The
platform manages workspace lifecycle, auth, and routing; AWS manages the
underlying EC2, security groups, and network plumbing.

This tutorial documents what env vars the provisioner reads, what AWS
actions it performs on a `POST /workspaces`, and how to operate it. It is
the replacement for the deprecated [Fly Machines provisioner](./fly-machines-provisioner.md)
tutorial.

> **Audience:** operators running a self-hosted Molecule AI control plane
> against their own AWS account, and contributors debugging the
> production CP. End-users of `*.moleculesai.app` do not need any of
> this — provisioning happens transparently when you create an org or
> workspace in the canvas.

## When EC2 is the active provisioner

`cmd/server/main.go` switches on whether `AWS_ACCESS_KEY_ID` is set in the
process environment. If yes, it constructs an `*provisioner.EC2` from the
config below and registers it as the tenant provisioner. There is **no**
`CONTAINER_BACKEND=ec2` switch — the dispatcher key is presence of AWS
credentials. (The legacy `flyio` backend still has dead code in the tree
but is no longer wired in `main.go`.)

A typical Railway-hosted control plane log line on boot:

```
provisioner: EC2 (region=us-east-2, ami=ami-0ea3c35c5c3284d82)
tenant provisioner: EC2 ✓
```

If `AWS_ACCESS_KEY_ID` is unset, you'll see `provisioner: disabled`
instead — useful for local dev where you want orgs CRUD to work without
AWS access.

## Environment variables

The full list of env vars `cmd/server/main.go` passes into
`provisioner.EC2Config`. Anything not listed here is unused by the
provisioner.

### Required for any EC2 provisioning

| Var | Default | Purpose |
|-----|---------|---------|
| `AWS_ACCESS_KEY_ID` | — | Toggle: presence enables EC2 wiring at all |
| `AWS_SECRET_ACCESS_KEY` | — | Standard AWS SDK credential pair |
| `AWS_REGION` | `us-east-1` | Region for tenant + workspace launches |
| `EC2_AMI` | `ami-0ea3c35c5c3284d82` (Ubuntu 22.04 us-east-2) | Default AMI when no `thin_ami_pins` row matches |
| `EC2_VPC_ID` | — | VPC for per-tenant SG creation; falls back to `EC2_SECURITY_GROUP` if unset |
| `EC2_SUBNET_ID` | — | Subnet for `RunInstances` |
| `SECRETS_ENCRYPTION_KEY` | — | KMS-envelope DEK for tenant secret-at-rest; provisioner stays disabled until set |

### Required for production (#44 secure bootstrap)

| Var | Purpose |
|-----|---------|
| `EC2_TENANT_IAM_PROFILE` | Instance profile attached to every tenant EC2 so it can fetch its bootstrap bundle from Secrets Manager at boot. Without this set, `Provision` returns the error `"Secrets Manager + IAM instance profile are required (#113 — plaintext user-data path removed)"`. |
| `PROVISION_SHARED_SECRET` | Shared HMAC-secret stored alongside the tenant bootstrap bundle so workspace-server can authenticate inbound `/cp/...` callbacks |
| `CP_ADMIN_API_TOKEN` | Token the tenant uses to call admin endpoints back on the control plane |
| `CP_BASE_URL` | URL the tenant boot script uses to reach the control plane (typically `https://api.moleculesai.app`) |

### Required for the canvas Terminal tab

| Var | Purpose |
|-----|---------|
| `EIC_ENDPOINT_SG_ID` | Security-group ID of the region's [EC2 Instance Connect endpoint](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-endpoint.html). The provisioner adds a `tcp/22` ingress rule to every per-tenant + per-workspace SG sourced from this SG, so the canvas Terminal can EIC-tunnel into the box for diagnostic ssh. Empty leaves the canvas Terminal broken with `failed to open EIC tunnel`. Discover with `aws ec2 describe-instance-connect-endpoints --region <region>`. |

### Cloudflare integration (per-tenant subdomains)

| Var | Purpose |
|-----|---------|
| `CLOUDFLARE_API_TOKEN` | Enables CF DNS client; provisioner creates the per-tenant `<slug>.<APP_DOMAIN>` CNAME |
| `CLOUDFLARE_ACCOUNT_ID` | Enables CF Tunnel client (preferred over Worker + wildcard DNS) |
| `CLOUDFLARE_ZONE_ID` | DNS zone the tenant CNAMEs are written under |
| `APP_DOMAIN` | Default `moleculesai.app`; tenant FQDN becomes `<slug>.<APP_DOMAIN>` |

### Optional — runtime images, tier image, backups, canary, multi-env

| Var | Purpose |
|-----|---------|
| `MOLECULE_ENV` | `dev` / `staging` / `prod`; stamped on every EC2 tag and scopes the orphan-report's AWS lister so envs don't false-positive each other |
| `EC2_INSTANCE_TYPE` | Default `t3.small` for tenant VMs (workspaces use the per-tier table below) |
| `EC2_SECURITY_GROUP` | Fallback shared SG when `EC2_VPC_ID` is unset; production should leave this empty |
| `EC2_KEY_NAME` | Optional EC2 KeyPair name for emergency console SSH |
| `TENANT_IMAGE` | OCI ref for the tenant platform image (e.g. `ghcr.io/molecule-ai/platform-tenant:staging-<sha>`) |
| `CANARY_TENANT_IMAGE` | Override `TENANT_IMAGE` for orgs flagged `is_canary=true` |
| `CANARY_ROLE_ARN`, `CANARY_REGION`, `CANARY_VPC_ID`, `CANARY_SUBNET_ID` | Second-AWS-account target for canary tenant launches; all four required together |
| `TENANT_BACKUP_S3_PREFIX` | Empty disables nightly `pg_dump`; set `s3://bucket/path` to enable |
| `TENANT_BACKUP_REPORT_URL` | Defaults to `${CP_BASE_URL}/cp/tenants/backup-report` |
| `GHCR_PULL_TOKEN` | GHCR pull token written into the tenant bootstrap bundle (private images only) |

For the always-current set, grep
[`cmd/server/main.go` lines 86–158](https://github.com/Molecule-AI/molecule-controlplane/blob/main/cmd/server/main.go#L86-L158)
for `os.Getenv` calls inside the `provisioner.NewEC2` block.

## What happens on `POST /cp/orgs` (tenant provision)

`OrgsHandler.Create` calls into `(*EC2).Provision(ctx, cfg)`. Roughly:

1. **Cloudflare cleanup** — `cleanupStaleSlugArtifacts` scrubs any
   leftover tunnel/DNS rows from a previously-purged org with the same
   slug, so the slug is reusable.
2. **Cloudflare Tunnel + DNS** — `CreateTunnel` → `CreateTunnelDNS`
   (writes `<slug>.<APP_DOMAIN>` → `<tunnel-id>.cfargotunnel.com`) →
   `ConfigureTunnelIngress` (registers the hostname on the tunnel's
   remote config so CF's edge knows to forward). DNS or ingress
   failures roll back the tunnel and abort the provision — fail-fast
   behavior added 2026-04-26 after a six-hour outage in which
   unreachable tenants timed out at 600–900s instead of surfacing the
   real CF API problem.
3. **Bootstrap secrets to AWS Secrets Manager** — the provisioner
   generates a per-tenant DB password + admin token, packages them with
   the GHCR pull token, tunnel token, encryption key, and shared
   secret, and `PutSecret`s them at `awsapi.TenantSecretName(orgID)`.
   The tenant fetches this bundle at boot via its instance profile —
   no plaintext secrets in user-data (see #113).
4. **Per-tenant SG creation** — `createPerTenantSG` calls
   `CreateSecurityGroup` with the resolved VPC, the per-org name, and
   the ingress rules from `tenantIngressRules(vpcCidr, EICEndpointSGID)`.
   The SG ingress always includes the canvas-terminal EIC `tcp/22`
   rule sourced from the EIC endpoint's own SG (UserIdGroupPairs, not
   `0.0.0.0/0` — only AWS EIC's endpoint can use it).
5. **`RunInstances`** — `awsClient.RunInstance(ctx, awsapi.LaunchConfig{...})`
   launches with `InstanceType = TenantInstanceType` (default
   `t3.small`), the resolved AMI, IAM instance profile, base64-encoded
   user-data, and tags `OrgID` / `OrgSlug` / `Role=tenant` / `TunnelID`
   / `SGID`. Volume size is 30 GB.
6. **Audit row** — every CF, SG, Secrets Manager, and EC2 lifecycle
   event is recorded in the `tenant_resources` audit table (#2343)
   so the orphan reconciler can diff claims vs live state.

`Provision` returns a `*Result` whose fields (`FlyMachineID`, `FlyRegion`,
`AdminToken`) are still named after Fly. The EC2 provisioner fake-fills
them with EC2 equivalents (`InstanceID`, `AWSRegion`); a column-rename
migration is on the controlplane backlog.

## What happens on `POST /workspaces` (workspace provision)

`workspace-server`'s `POST /workspaces` reaches the control plane via
`/cp/workspaces/provision`, which calls
`(*EC2).ProvisionWorkspace(ctx, workspaceID, runtime, orgID, tier, platformURL, env)`:

1. **Resolve tier resources** — `workspaceTierResources(tier)` returns
   `(instanceType, volumeSize)` per the table below. Hermes runtime
   floors `volumeSize` to 50 GB regardless of tier (uv + Python venv +
   Node.js gateway pegs disk at 18–25 GB during install).
2. **Resolve AMI** — `resolveWorkspaceAMI` looks up `thin_ami_pins`
   for the runtime + region. A pin row means the AMI is pre-baked
   (per `packer/scripts/install-base.sh`) and user-data can skip
   apt-update + the Python/Node installs (60–140 s saved per
   provision, RFC #388). Fallback to the static `WorkspaceAMI`.
3. **Resolve runtime image** — `resolveRuntimeImage` looks up
   `runtime_image_pins` and emits the containerized user-data path
   (docker pull + run) when present. Independent of the AMI gate
   above; the new path also installs Docker if missing on a thin/stock
   AMI.
4. **Per-workspace SG creation** — same `createPerTenantSG` call with
   `namePrefix="workspace"`. Workspace SGs get
   `workspaceIngressRules(EICEndpointSGID)` — currently the EIC
   `tcp/22` rule and nothing else (workspaces sit behind the
   Cloudflare Tunnel for HTTP).
5. **`RunInstance`** — launches with `wsShort = workspaceID[:12]`
   prefixed name, the resolved instance type + volume + AMI +
   user-data, and tags `WorkspaceID` / `Runtime` / `Role=workspace`
   / `SGID` / `OrgID`. The `OrgID` tag is what lets
   `DeprovisionInstance` cascade-terminate workspace EC2s when their
   tenant is deleted (incident 2026-04-23: ~27 orphaned workspace
   EC2s pinned staging at the 64 vCPU limit before the tag was
   added).
6. **Audit row** — `tenant_resources` `KindEC2Instance` `StateCreated`
   with role / runtime / tier / workspace metadata.

The boot script registers the workspace agent with the platform via
`/workspaces/:id/register`, the platform issues an A2A auth token, and
the agent comes up ready for `message/send` calls.

## Tier-based resource sizing

`workspaceTierResources` is the single source of truth. As of writing,
all tiers below T4 are clamped up to T4 (the SaaS floor) and tiers
above T4 are also clamped down to T4 (today's max):

| Tier | Instance type | Volume | Effective use |
|------|---------------|--------|---------------|
| T1 / T2 | clamped to T4 | clamped to T4 | not in production |
| T3 | `t3.medium` | 40 GB | reserved (clamped today) |
| T4 | `t3.large` | 80 GB | all production workspaces |

If you set a tier outside `[3, 4]` the clamp lifts it to T4 — a cheap
mis-provision rather than a fall-through to the unset `t3.small`
default. The clamp was added in PR #434 follow-up after `tier=5`
silently yielded `t3.small`.

Hermes overrides volume to 50 GB minimum regardless of tier.

## Lifecycle — stop, restart, redeploy, teardown

| Operation | Mechanism |
|-----------|-----------|
| **Stop / start a tenant** | `POST /cp/admin/tenants/:slug/{stop,start}` → `(*EC2).Stop` / `Start` via the EC2 API (no termination) |
| **Redeploy a tenant** (in-place new image) | `POST /cp/admin/tenants/:slug/redeploy` → SSM Run Command pulls the latest `TENANT_IMAGE` and recreates the platform container; never reboots EC2 |
| **Refresh workspace template images** | `POST /cp/admin/tenants/:slug/workspaces/redeploy` (single-tenant) or `POST /cp/admin/tenants/workspaces/redeploy-fleet` (canary-batched fleet); HTTP-only, no SSM |
| **Delete a workspace** | platform `DELETE /workspaces/:id` → CP `DeprovisionInstance(workspaceInstanceID, ...)` terminates the EC2 + cleans DNS + SG |
| **Delete a tenant (Art. 17 cascade)** | `DELETE /cp/orgs/:slug` → cascade-terminates all workspace EC2s tagged with this `OrgID`, then terminates the tenant EC2, then deletes the SG, Secrets Manager bundle, CF tunnel + CNAME |
| **Orphan recovery** | `tenant_resources` audit table + 30-min reconciler that diffs claims vs live AWS state and exposes orphan counts via `/cp/admin/stats` |

`DeprovisionInstance` polls termination under its own deadline so a
stuck shutdown surfaces as a deprovision failure (and the caller's
retry replays the cascade) instead of becoming a silent leak (#263).

## Why EC2 (vs Fly Machines)

The control plane has migrated infrastructure twice in April 2026 — both
documented in the
[molecule-controlplane README "Migration history"](https://github.com/Molecule-AI/molecule-controlplane#migration-history):

- **Apr 2026 — CP host:** Fly (`molecule-cp.fly.dev`) → Railway
  (`api.moleculesai.app`).
- **Apr 2026 — tenant + workspace compute:** Fly Machines → AWS EC2
  with SSM Run Command for redeploy.

The drivers were production needs Fly couldn't easily meet:

- **Region + data-residency control.** EU customers required
  EU-resident tenant data; AWS regional pinning per tenant is
  straightforward, Fly's region routing is per-app and harder to
  guarantee per-tenant.
- **AWS-native auth chain for the canvas Terminal.** EC2 Instance
  Connect lets the platform open SSH tunnels to a tenant box via
  short-lived (60 s) IAM-signed public keys — no shared SSH keys,
  no inbound `0.0.0.0/0` rules. The same path powers the Files API
  EIC writes (see [SaaS file writes via EC2 Instance Connect](./saas-file-writes-eic.md)).
- **Secrets Manager + IAM instance profiles** for tenant bootstrap
  secrets (#113 removed the plaintext user-data path).
- **Cloudflare Tunnels** instead of public IPs — no inbound exposure
  on tenant EC2s; CF edge is the only ingress.
- **`tenant_resources` audit table + reconciler** for cascade-cleanup
  guarantees that Fly's flat machine list couldn't enforce.

Old `internal/flyapi/` and `internal/provisioner/fly.go` files remain
in the controlplane tree as legacy code awaiting cleanup; they are not
wired in `cmd/server/main.go`.

## Operating notes

- **Schema names still say "fly".** The `org_instances` columns
  `fly_app` / `fly_machine_id` / `fly_region` are fake-filled with EC2
  equivalents; a rename migration is on the controlplane backlog
  (`PLAN.md`).
- **`SECRETS_ENCRYPTION_KEY` gates the whole provisioner.** The crypto
  envelope is required even when only AWS creds are present; without
  it, `tenant provisioner: DISABLED` is logged and `POST /cp/orgs`
  accepts the row but never spins a tenant.
- **Per-tenant SG creation needs `EC2_VPC_ID`.** If you only set
  `EC2_SECURITY_GROUP` (the legacy shared-SG fallback), every tenant
  shares one SG — caught the bug in PR #434 review. Production must
  set `EC2_VPC_ID`.
- **`EIC_ENDPOINT_SG_ID` is silently load-bearing.** If unset, the
  canvas Terminal hangs with `failed to open EIC tunnel` and the
  Files API EIC write path returns 500 — the EC2 boots fine, the
  symptom only shows when an operator opens the canvas Terminal tab.

## References

- [`molecule-controlplane/internal/provisioner/ec2.go`](https://github.com/Molecule-AI/molecule-controlplane/blob/main/internal/provisioner/ec2.go) — provisioner source
- [`molecule-controlplane/cmd/server/main.go`](https://github.com/Molecule-AI/molecule-controlplane/blob/main/cmd/server/main.go) — env-var wiring
- [`molecule-controlplane` README "Migration history"](https://github.com/Molecule-AI/molecule-controlplane#migration-history) — canonical record
- [AWS EC2 Instance Connect endpoints](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-endpoint.html)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [SaaS file writes via EC2 Instance Connect](./saas-file-writes-eic.md) — EIC is also the Files API write channel
- [Fly Machines provisioner (DEPRECATED)](./fly-machines-provisioner.md) — previous backend, retained for migration history
