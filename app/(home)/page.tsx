import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
        Molecule AI
      </h1>
      <p className="mb-8 max-w-2xl text-lg text-fd-muted-foreground">
        Build and run multi-agent organisations. Templates, plugins, channels,
        and the runtime that ties them together — documented end to end.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:opacity-90"
        >
          Read the docs
        </Link>
        <Link
          href="https://github.com/Molecule-AI/molecule-monorepo"
          className="rounded-md border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-muted"
        >
          View on GitHub
        </Link>
      </div>
    </main>
  );
}
