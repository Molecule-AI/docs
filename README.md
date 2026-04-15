# Molecule AI Documentation

The customer-facing documentation site for Molecule AI, deployed at
[doc.moleculesai.app](https://doc.moleculesai.app).

Built with **[Fumadocs](https://fumadocs.dev)** + Next.js 15 (App Router) +
Tailwind v4 + MDX.

## Why Fumadocs

- **Open source** (MIT) — we self-host on our own domain, no vendor lock-in
- **Next.js 15 native** — matches the canvas stack already in the platform monorepo
- **Flexible** — can grow into custom doc components for our agent canvas
  flows, embedded mini-canvases in docs, etc.
- **Modern aesthetic** — Shiki code highlighting, full-text search, dark
  mode, all out of the box

## Local development

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Adding pages

1. Create a new `.mdx` file under `content/docs/`.
2. Add an entry to `content/docs/meta.json` to control sidebar ordering.
3. Frontmatter: `title` and `description` are required.

```mdx
---
title: My new page
description: One-line summary used in nav + meta tags.
---

Content goes here.
```

## Repository layout

```
.
├── app/                    # Next.js App Router routes
│   ├── (home)/             # marketing landing
│   ├── docs/[[...slug]]/   # docs dynamic route
│   ├── api/search/         # built-in full-text search
│   ├── layout.tsx          # root layout + RootProvider
│   └── layout.config.tsx   # nav links shared by home + docs
├── content/docs/           # MDX source — the actual documentation
│   ├── meta.json           # sidebar order
│   ├── index.mdx           # docs landing
│   └── *.mdx               # one file per page
├── lib/source.ts           # Fumadocs loader bound to the MDX source
├── mdx-components.tsx      # default + custom MDX renderers
├── source.config.ts        # MDX compile config (remark/rehype plugins)
├── next.config.mjs         # Next config wrapped with createMDX
├── postcss.config.mjs      # Tailwind v4 postcss plugin
└── package.json
```

## Who maintains this

The **Documentation Specialist** agent in our `molecule-dev` org template
owns this repo end-to-end. It runs on a schedule, watches PRs landing in the
[platform monorepo](https://github.com/Molecule-AI/molecule-monorepo), and
opens docs PRs here whenever:

- A new public API endpoint lands
- A new template / plugin / channel is added
- A user-facing concept changes
- An ecosystem-watch entry needs publishing

Manual edits welcome. The agent picks up changes on its next cron tick.

## Deployment

This site is deployed to `doc.moleculesai.app` via Vercel (TBD — once the
domain is configured). PRs to `main` ship to preview URLs automatically.

## Contributing

Open a PR. The Documentation Specialist + a human reviewer will look at it
within one cron tick (currently daily).
