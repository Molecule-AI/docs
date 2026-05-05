// /llms-full.txt — concatenated full-text export of every docs page.
// Companion to /llms.txt (manifest). An LLM agent that wants the
// whole corpus in one paste — for fine-tuning, retrieval indexing,
// or "answer questions only from this knowledge base" — fetches
// here and gets it.
//
// Each page is rendered as:
//
//   # <title>
//   <URL>
//
//   <raw .md/.mdx body>
//
//   ---
//
// So an LLM can split on the `---` boundary if it needs per-page
// chunks, or treat the whole thing as one big context.
//
// Pairs with /llms.txt (manifest) and /api/docs-raw/<slug> (per-page
// exports). Static SSG — the build pre-generates this once, no
// per-request cost.

import { source } from '@/lib/source';

export const dynamic = 'force-static';

export async function GET() {
  const pages = source.getPages();
  // Sort by URL for deterministic output — same ordering as /llms.txt.
  const sorted = [...pages].sort((a, b) => a.url.localeCompare(b.url));

  const chunks: string[] = [];
  for (const p of sorted) {
    let raw: string;
    try {
      raw = await p.data.getText('raw');
    } catch (err) {
      // A single unreadable page shouldn't break the whole corpus
      // export. Surface the failure inline so an LLM consumer can see
      // which page is missing rather than silently dropping it.
      raw = `<error: could not read source — ${err instanceof Error ? err.message : String(err)}>`;
    }
    chunks.push(`# ${p.data.title || p.url}`);
    chunks.push(p.url);
    chunks.push('');
    chunks.push(raw.trim());
    chunks.push('');
    chunks.push('---');
    chunks.push('');
  }

  return new Response(chunks.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
