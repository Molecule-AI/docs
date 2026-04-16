import { NextResponse } from 'next/server';

// Minimal search endpoint — returns empty results. The fumadocs
// createFromSource/createSearchAPI both crash on v15.8 with "a.map
// is not a function" during static page collection. This stub keeps
// the route alive so the site builds; swap back to the fumadocs
// search API once the upstream fix lands.
export function GET() {
  return NextResponse.json([]);
}
