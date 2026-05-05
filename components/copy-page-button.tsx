'use client';

// CopyPageButton — fetches the current docs page's raw markdown via
// the /raw route handler and copies it to the clipboard. Pattern
// matches MiniMax / Vercel / Anthropic docs: a "Copy page" button
// next to the H1 that hands the source to an LLM in one click,
// instead of asking the user to scrape the rendered HTML.
//
// The button sits at the top of the docs page so it's where the
// user's eye lands when they open the doc to share. It's small +
// quiet by default; turns green on success so the user has feedback
// without a toast layer dependency.

import { useState } from 'react';
import { usePathname } from 'next/navigation';

type State = 'idle' | 'copying' | 'copied' | 'error';

export function CopyPageButton() {
  const pathname = usePathname();
  const [state, setState] = useState<State>('idle');

  // The raw route lives at /api/docs-raw/<same-slug>. It's NOT a
  // sibling of the page (Next.js forbids nesting under an optional
  // catch-all), so we map /docs/foo/bar → /api/docs-raw/foo/bar.
  //
  // Don't pre-fetch on mount: most users won't click (LLM-handoff is
  // a power-user flow), and pre-fetching every page on every visit
  // would bloat traffic. Fetch on click, copy on success.
  async function copy() {
    if (state === 'copying') return;
    setState('copying');
    try {
      const rawUrl = pathname.startsWith('/docs/')
        ? `/api/docs-raw/${pathname.slice('/docs/'.length)}`
        : pathname; // graceful no-op on unexpected paths
      const res = await fetch(rawUrl, {
        // Use the route's own cache headers (must-revalidate). The
        // browser will satisfy from disk cache when fresh — no
        // double-roundtrip on rapid re-clicks.
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setState('copied');
      // Snap back to idle after 2s so the button doesn't stay
      // green forever — matches the visual cadence of toast notices.
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      console.warn('CopyPageButton: copy failed', err);
      setState('error');
      setTimeout(() => setState('idle'), 2500);
    }
  }

  const label =
    state === 'copied' ? 'Copied' :
    state === 'error' ? 'Failed' :
    state === 'copying' ? 'Copying…' :
    'Copy page';

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy this page's markdown source for LLM context"
      className={
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ' +
        (state === 'copied'
          ? 'border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
          : state === 'error'
          ? 'border-red-500/50 text-red-600 bg-red-50 dark:bg-red-950/30'
          : 'border-fd-border text-fd-muted-foreground hover:text-fd-foreground hover:border-fd-foreground')
      }
    >
      {/* Tiny clipboard icon (inline SVG, no asset request). Switches
          to a checkmark on success for at-a-glance state feedback. */}
      {state === 'copied' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
