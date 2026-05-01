import Link from 'next/link';

// Three quick-start lanes — keeps the home page from being a wall of text
// and lets builders, operators, and integrators each find their entry
// point in one click.
const lanes = [
  {
    kicker: '01',
    title: 'Build a workspace',
    body: 'Pick a runtime template (Claude Code, LangGraph, CrewAI, Hermes, …), wire your tools, and ship.',
    href: '/docs/workspace',
    cta: 'Workspace guide →',
  },
  {
    kicker: '02',
    title: 'Run an organisation',
    body: 'Topology, A2A, three-tier memory, governance — the platform layer that ties multi-agent teams together.',
    href: '/docs/platform',
    cta: 'Platform reference →',
  },
  {
    kicker: '03',
    title: 'Publish to the Marketplace',
    body: 'Plugins, agents, and org bundles ship as signed manifests. Authors keep 80%, paid via Stripe Connect.',
    href: '/docs/marketplace',
    cta: 'Author guide →',
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Statusbar — mirrors the landing's "All systems · status.* · phase" strip */}
      <div className="border-b border-fd-border bg-fd-muted px-6 py-1.5 text-[11px] font-mono text-fd-muted-foreground flex flex-wrap justify-between gap-4">
        <span>
          <span className="inline-block size-1.5 rounded-full bg-[#2f7a4d] align-middle mr-1.5" />
          All systems · status.moleculesai.app
        </span>
        <span>Phase 33 shipped · Phase 35 Marketplace public beta</span>
      </div>

      {/* Hero */}
      <section className="px-6 py-20 sm:py-28 max-w-6xl mx-auto w-full">
        <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-fd-muted-foreground mb-4 flex items-center gap-2">
          <span className="inline-block size-1.5 rounded-full bg-[#c0532b]" />
          Documentation
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05] mb-5 max-w-3xl">
          The operating system for{' '}
          <span className="text-[#3b5bdb]">AI agent organizations.</span>
        </h1>
        <p className="text-lg text-fd-muted-foreground max-w-2xl leading-relaxed mb-8">
          Build and run multi-agent organisations the way you'd staff a company.
          Templates, plugins, channels, runtimes, governance — documented end
          to end.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/docs"
            className="rounded-md bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition hover:opacity-90"
          >
            Read the docs
          </Link>
          <Link
            href="https://github.com/Molecule-AI"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-fd-border px-5 py-2.5 text-sm font-medium transition hover:bg-fd-muted"
          >
            View on GitHub
          </Link>
        </div>
      </section>

      {/* Three lanes */}
      <section className="px-6 pb-24 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lanes.map((lane) => (
            <Link
              key={lane.kicker}
              href={lane.href}
              className="group rounded-lg border border-fd-border bg-fd-card p-6 transition hover:border-fd-foreground hover:-translate-y-0.5"
            >
              <div className="text-[11px] font-mono text-[#3b5bdb] mb-3 tracking-[0.08em]">
                {lane.kicker}
              </div>
              <h3 className="text-base font-semibold mb-2">{lane.title}</h3>
              <p className="text-sm text-fd-muted-foreground leading-relaxed mb-4">
                {lane.body}
              </p>
              <div className="text-xs font-mono text-fd-foreground group-hover:text-[#3b5bdb] transition">
                {lane.cta}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
