// Search route — wires the docs content tree into fumadocs' built-in
// Orama search index. The previous stub at this path returned an empty
// array because of a v15.8 fumadocs bug that crashed page collection
// with `a.map is not a function`. We're on fumadocs-core ^16.7 now;
// `createFromSource` works against our existing loader without any
// extra static-collection step, so the stub can go.

import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

// One-line restoration: createFromSource produces { GET } that the
// search bar (fumadocs-ui's `useDocsSearch` hook) hits at /api/search.
// No options needed — defaults index title + content of every page in
// the source tree.
export const { GET } = createFromSource(source);
