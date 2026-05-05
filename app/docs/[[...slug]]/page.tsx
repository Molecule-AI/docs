import { execSync } from 'node:child_process';
import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';
import { CopyPageButton } from '@/components/copy-page-button';

export const dynamic = 'force-static';

// Build-time cache. SSG renders 104+ pages and each call to `git log`
// adds ~30ms — without the cache that's 3+ seconds added to every build,
// 99% of which is redundant when N pages share the same recent commit.
// Per-build cache (Map lives across calls within the same Node process)
// trims that to a single git-log per unique file.
const lastUpdateCache = new Map<string, number | null>();

function getLastUpdate(filePath: string): number | null {
  if (lastUpdateCache.has(filePath)) return lastUpdateCache.get(filePath) ?? null;
  let result: number | null = null;
  try {
    // `git log -1 --format=%cI -- <path>` prints the committer-date of
    // the most recent commit touching <path>, ISO 8601. Falls back to
    // null on any failure (build without .git, file outside the repo,
    // etc.) — we'd rather hide the "Last updated" line than crash the
    // page build.
    const iso = execSync(`git log -1 --format=%cI -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (iso) {
      const t = Date.parse(iso);
      if (!Number.isNaN(t)) result = t;
    }
  } catch {
    // ignore — fallthrough to null
  }
  lastUpdateCache.set(filePath, result);
  return result;
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  // page.path is the relative path under content/, e.g. "docs/architecture.mdx".
  // Resolve to a repo-rooted path so git-log can find it from any cwd.
  const sourcePath = `content/${page.path}`;
  const lastUpdateMs = getLastUpdate(sourcePath);

  return (
    <DocsPage
      toc={page.data.toc ?? []}
      full={page.data.full}
      lastUpdate={lastUpdateMs ?? undefined}
      editOnGithub={{
        owner: 'Molecule-AI',
        repo: 'docs',
        sha: 'main',
        // EditOnGitHub builds the URL as
        // github.com/<owner>/<repo>/blob/<sha>/<path>
        // — `path` here is content-relative, NOT site-relative.
        path: sourcePath,
      }}
    >
      {/* Title row with Copy-page button — right-aligned. Mirrors the
          MiniMax / Vercel / Anthropic docs header: title + description
          on the left, "Copy page" affordance on the right so power
          users can hand the source to an LLM in one click. */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <DocsTitle>{page.data.title}</DocsTitle>
        <div className="mt-2 shrink-0">
          <CopyPageButton />
        </div>
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
