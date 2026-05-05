// Raw markdown export route — returns the source of any docs page as
// `text/markdown` so the in-page "Copy page" button can hand the
// content straight to an LLM without dragging through the rendered
// HTML. Standard pattern used by MiniMax, Vercel, Anthropic docs.
//
// Path: /api/docs-raw/<same-slug-as-the-doc-page>. Lives outside
// /docs/[[...slug]]/ because Next.js requires optional-catch-all
// segments to be terminal — can't nest /raw under them. The Copy
// button computes the URL from the current pathname.
//
// Layered behind the same source loader the renderer uses, so a 404
// in the markdown render is also a 404 here. fumadocs-mdx exposes
// `getText('raw')` on each page entry which reads the original
// .md / .mdx file off disk at request time.

import { source } from '@/lib/source';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  // `getText('raw')` returns the original file contents, including
  // frontmatter. That's what an LLM wants — title + description +
  // body in one paste, with the same precedence the live page uses.
  const raw = await page.data.getText('raw');

  return new Response(raw, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // Fumadocs page-level cache-control mirrors the static .md
      // shape; revalidate alongside the rest of the static build.
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
