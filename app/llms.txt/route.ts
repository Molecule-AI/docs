// /llms.txt — LLM-friendly docs manifest. Standard convention (Vercel,
// Anthropic, Stripe, et al.) that lets an LLM agent crawl a site's
// docs efficiently: title + description + URL per page, plain text,
// no HTML/JS. Pairs with the per-page .md exports at /api/docs-raw/*
// (PR #130) — the manifest tells the LLM what's available; the .md
// exports give it the body.
//
// Format follows https://llmstxt.org/ — a minimal markdown spec:
//
//   # <Site name>
//   > <One-line description>
//
//   ## Section
//   - [Title](URL): description
//
// fumadocs' `source.getPages()` returns the full doc tree; we group
// by the first slug segment so the manifest reads as
// "Architecture / Workspace / API Reference / ..." rather than a
// flat 100-line dump.

import { source } from '@/lib/source';

export const dynamic = 'force-static';

const SITE_TITLE = 'Molecule AI Documentation';
const SITE_TAGLINE =
  'The operating system for AI agent organizations. Templates, plugins, channels, runtimes, governance — documented end to end.';

export function GET() {
  const pages = source.getPages();

  // Group pages by first slug segment. Pages at the docs root (slug
  // length 0 or 1) go in an "Overview" bucket so they're not lost.
  const buckets = new Map<string, typeof pages>();
  for (const p of pages) {
    const top = (p.slugs ?? [])[0] ?? '_overview';
    if (!buckets.has(top)) buckets.set(top, []);
    buckets.get(top)!.push(p);
  }

  // Sort sections alphabetically, with _overview surfaced first.
  const orderedSections = [...buckets.keys()].sort((a, b) => {
    if (a === '_overview') return -1;
    if (b === '_overview') return 1;
    return a.localeCompare(b);
  });

  const lines: string[] = [];
  lines.push(`# ${SITE_TITLE}`);
  lines.push('');
  lines.push(`> ${SITE_TAGLINE}`);
  lines.push('');

  for (const section of orderedSections) {
    const sectionPages = buckets.get(section)!;
    // Section header — title-case the slug, replace hyphens with spaces.
    const heading =
      section === '_overview'
        ? 'Overview'
        : section
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    lines.push(`## ${heading}`);
    lines.push('');
    // Sort pages within a section by their URL for deterministic output.
    sectionPages.sort((a, b) => a.url.localeCompare(b.url));
    for (const p of sectionPages) {
      const title = p.data.title || p.url;
      const desc = p.data.description ? `: ${p.data.description}` : '';
      lines.push(`- [${title}](${p.url}.md)${desc}`);
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
