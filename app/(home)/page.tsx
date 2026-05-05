import Link from 'next/link';

// Three quick-start lanes, rendered as vivid colored cards instead of
// thin-border text blocks. Each card pairs a brand-colored "art" panel
// with title + body below, mirroring the layout pattern that other
// platform docs (MiniMax, Anthropic, Vercel) use to make the home page
// scannable in a single glance instead of a wall-of-text.
//
// Colors reuse the three accent dots already on the page (kicker dot
// #c0532b, hero accent #3b5bdb, statusbar dot #2f7a4d) so we're not
// inventing brand surface here — just exposing it at card scale.
const lanes = [
  {
    kicker: '01',
    title: 'Build a workspace',
    artLabel: 'Workspace',
    artTagline: 'Runtime + tools + memory',
    body: 'Pick a runtime template (Claude Code, LangGraph, CrewAI, Hermes, codex, openclaw, …), wire your tools, and ship.',
    // /docs/workspace doesn't exist as a slug; /docs/quickstart is
    // the actual "first agent deployed" guide a builder lands on.
    href: '/docs/quickstart',
    cta: 'Quickstart guide',
    // Deep blue → cyan gradient. Pairs with the hero "AI agent organizations"
    // accent + the canvas chat-bubble blue, so a builder lands on something
    // tonally familiar.
    gradient: 'from-[#1e3a8a] via-[#2950c9] to-[#3b82f6]',
  },
  {
    kicker: '02',
    title: 'Run an organisation',
    artLabel: 'Platform',
    artTagline: 'A2A · memory · governance',
    body: 'Topology, A2A delegation, three-tier memory, governance — the platform layer that ties multi-agent teams together.',
    // /docs/platform doesn't exist as a slug; /docs/architecture is
    // the platform-layer topology + governance overview.
    href: '/docs/architecture',
    cta: 'Architecture overview',
    // Warm amber → orange. Same family as the kicker dot (#c0532b) and
    // the warm-paper canvas theme — operators reading platform docs are
    // typically the same people who configure the canvas.
    gradient: 'from-[#7c2d12] via-[#c0532b] to-[#f59e0b]',
  },
  {
    kicker: '03',
    title: 'Publish to the Marketplace',
    artLabel: 'Marketplace',
    artTagline: '80% rev share · signed manifests',
    body: 'Plugins, agents, and org bundles ship as signed manifests. Authors keep 80%, paid via Stripe Connect.',
    href: '/docs/marketplace',
    cta: 'Author guide',
    // Forest green → emerald. Picks up the statusbar's "All systems"
    // green so the marketplace lane reads as the "shipped, healthy"
    // path — and visually distinct from build (cool blue) and run
    // (warm orange).
    gradient: 'from-[#14532d] via-[#2f7a4d] to-[#10b981]',
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

      {/* Three lanes — vivid card grid (was thin-border text blocks). */}
      <section className="px-6 pb-24 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {lanes.map((lane) => (
            <Link
              key={lane.kicker}
              href={lane.href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-fd-border bg-fd-card transition hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Art panel — brand-gradient with the section name in big
                  white type. Aspect ratio matches MiniMax / Vercel /
                  Anthropic card layouts so the home page feels visually
                  consistent with peer platform docs. */}
              <div
                className={`relative aspect-[4/3] bg-gradient-to-br ${lane.gradient} p-6 flex flex-col justify-between text-white`}
              >
                {/* Subtle dot-grid overlay so the gradient doesn't look
                    too flat. opacity-[0.07] keeps it under the title. */}
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, currentColor 1px, transparent 1px)',
                    backgroundSize: '12px 12px',
                  }}
                  aria-hidden="true"
                />
                <div className="relative text-[11px] font-mono uppercase tracking-[0.12em] opacity-80">
                  {lane.kicker} · {lane.artLabel}
                </div>
                <div className="relative">
                  <div className="text-3xl sm:text-4xl font-semibold leading-[1.05] mb-1.5">
                    {lane.title}
                  </div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.08em] opacity-80">
                    {lane.artTagline}
                  </div>
                </div>
              </div>

              {/* Content panel */}
              <div className="flex flex-1 flex-col justify-between p-5">
                <p className="text-sm text-fd-muted-foreground leading-relaxed mb-4">
                  {lane.body}
                </p>
                <div className="text-xs font-mono text-fd-foreground group-hover:text-[#3b5bdb] transition">
                  {lane.cta} →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
