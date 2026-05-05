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

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc ?? []} full={page.data.full}>
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
