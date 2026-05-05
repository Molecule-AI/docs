// Notebook layout — replaces the prior `fumadocs-ui/layouts/docs`
// with the notebook variant so the docs site has a horizontal
// section-tab strip across the top, matching MiniMax / Vercel /
// Anthropic / Stripe docs patterns.
//
// Each tab points at a real page that exists in content/docs and
// detects "active" via the URL match — if you're on
// /docs/architecture/provisioner the "Run" tab highlights, etc.
// The sidebar grouping in content/docs/meta.json is what gives
// each tab a recognisable scope when the user lands on it.

import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import type { LayoutTab } from 'fumadocs-ui/layouts/shared';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';

// Each entry maps to one of the meta.json section groups so the
// horizontal strip gives users a one-click hop into the major
// areas of the docs without scrolling the sidebar. Order matches
// the home-card narrative: Build → Run → Reference → Marketplace.
const tabs: LayoutTab[] = [
  {
    title: 'Build',
    description: 'Workspaces, runtimes, plugins, channels',
    url: '/docs/quickstart',
  },
  {
    title: 'Run',
    description: 'Architecture, A2A, governance, ops',
    url: '/docs/architecture',
  },
  {
    title: 'API Reference',
    description: 'Platform endpoints, MCP server, SDKs',
    url: '/docs/api-reference',
  },
  {
    title: 'Marketplace',
    description: 'Author plugins, agents, org bundles',
    url: '/docs/marketplace',
  },
  {
    title: 'Changelog',
    description: 'Releases and breaking changes',
    url: '/docs/changelog',
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const tree = source.pageTree;
  return (
    <DocsLayout tree={tree} tabs={tabs} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
