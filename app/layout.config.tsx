import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// Molecule logo — the same triangle-of-nodes mark used on moleculesai.app.
// Inlined as a JSX element so fumadocs renders it in the topbar without a
// separate asset request.
const MoleculeLogo = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 28 28"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="14" cy="6" r="2.5" fill="currentColor" />
    <circle cx="6" cy="20" r="2.5" fill="currentColor" />
    <circle cx="22" cy="20" r="2.5" fill="currentColor" />
    <circle
      cx="14"
      cy="14"
      r="1.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <line x1="14" y1="8.5" x2="14" y2="12.6" stroke="currentColor" strokeWidth="1.2" />
    <line x1="8" y1="18.5" x2="12.7" y2="14.8" stroke="currentColor" strokeWidth="1.2" />
    <line x1="20" y1="18.5" x2="15.3" y2="14.8" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="flex items-center gap-2 font-semibold tracking-tight">
        {MoleculeLogo}
        <span>Molecule AI</span>
        <span className="text-xs uppercase tracking-[0.08em] text-fd-muted-foreground font-mono">
          Docs
        </span>
      </span>
    ),
    url: 'https://doc.moleculesai.app',
  },
  links: [
    { text: 'Platform', url: 'https://app.moleculesai.app', external: true },
    { text: 'Marketplace', url: 'https://market.moleculesai.app', external: true },
    { text: 'Landing', url: 'https://www.moleculesai.app', external: true },
  ],
  githubUrl: 'https://github.com/Molecule-AI',
};
