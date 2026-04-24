# EC2 SSH Terminal — Zero Keys, Zero Bastion — Social Copy
**Publish day:** 2026-04-27
**Status:** APPROVED — Marketing Lead 2026-04-24
**Campaign:** Phase 34 launch run-up
**Angle:** EC2 Instance Connect terminal — frictionless EC2 shell access (Phase 30, cleared for posting)
**Source blog:** `docs/marketing/blog/2026-04-23-ec2-instance-connect-ssh.md`
**OG image:** /assets/blog/2026-04-23-ec2-ssh/og.png

---

## X / Twitter Thread (4 tweets)

---

**Tweet 1 — Hook**

Getting a shell on an EC2 workspace used to mean:

→ Distribute an SSH key pair
→ Stand up a bastion host
→ Or enroll in SSM Session Manager

We replaced all of that with one browser tab. 🧵

---

**Tweet 2 — The Old Way**

SSH key distribution becomes a rotation problem the moment a team grows past two people.

Bastions add infrastructure to maintain and an extra hop to remember.

SSM requires the agent, an instance profile, the right policies, and a region-aware endpoint.

Each approach works. None is frictionless. The gap between Docker workspaces (click, get a shell) and EC2 workspaces (file a ticket, get a key) showed up in support requests every week.

---

**Tweet 3 — How It Works Now**

Every CP-provisioned EC2 workspace now has a Terminal tab. Here's what happens in ~3 seconds:

```
Browser          Molecule Platform          AWS
  │                     │                    │
  ├── click tab ────────>│                    │
  │                     ├── gen RSA keypair   │
  │                     ├── push public key ─>│ EC2 Instance Connect
  │                     │   (60s TTL)         │
  │                     ├── open EICE tunnel─>│ EC2 Instance Connect Endpoint
  │<── WebSocket PTY ───│<──── TCP/22 ────────│──> EC2 instance
```

Ephemeral key pair. 60-second TTL. The session is live before the key expires.

No long-lived keys. No shared credentials. No `~/.ssh/authorized_keys` to audit.

---

**Tweet 4 — Why IAM > SSH**

Authorization goes through IAM — not a separate key store.

The EICE handshake appears in CloudTrail like any other IAM-authorized action. If you need to answer "who opened a shell on workspace X at time T" — the answer is there, attributed to the platform role.

Works for private-subnet EC2 instances. No internet egress required.

No setup step. No opt-in toggle. The Terminal tab just appears.

Docs: docs.molecule.ai/docs/guides/workspace-terminal

---

## LinkedIn Post (~200 words)

**Why we replaced SSH keys and bastion hosts with a browser tab.**

EC2 workspaces in Molecule AI had a friction problem. Docker workspaces came with a built-in terminal — the container runtime made PTY attachment trivial. EC2 was different. Getting a shell meant one of three standard playbooks: distribute an SSH key pair, stand up a bastion host, or enroll the instance in SSM Session Manager.

All three work. None is frictionless. SSH key distribution becomes a rotation problem at team scale. Bastions add infrastructure to maintain. SSM requires the agent, instance profile, and correct policy configuration — reasonable for a dedicated platform team, steep overhead for a developer who just needs to inspect a running workspace.

As of Phase 30, every CP-provisioned EC2 workspace has a Terminal tab. No setup. No opt-in.

Under the hood, Molecule uses AWS EC2 Instance Connect Endpoint (EICE). The platform generates a fresh RSA key pair per session, pushes the public half to the instance via the EC2 Instance Connect API (60-second TTL), and opens a proxied PTY over WebSocket. By the time the key expires, the SSH handshake is done and the session is running on the persistent connection.

Three properties that matter for enterprise operators:

1. **No long-lived keys** — each session gets one key, uses it once, discards it
2. **Private-subnet compatible** — no internet egress required, EICE routes through AWS's internal network
3. **IAM is the control plane** — every terminal session is a CloudTrail event, attributed to the platform role

Full architecture docs: docs.molecule.ai/docs/guides/workspace-terminal
