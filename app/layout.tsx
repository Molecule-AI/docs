import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata = {
  title: {
    default: 'Molecule AI Documentation',
    template: '%s | Molecule AI Docs',
  },
  description:
    'Build and run multi-agent organisations on the Molecule AI platform. Templates, plugins, channels, and the runtime that ties them together.',
  metadataBase: new URL('https://doc.moleculesai.app'),
  openGraph: {
    type: 'website',
    siteName: 'Molecule AI Documentation',
    title: 'Molecule AI Documentation',
    description:
      'Build and run multi-agent organisations on the Molecule AI platform. Templates, plugins, channels, and the runtime that ties them together.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Molecule AI Documentation',
    description:
      'Build and run multi-agent organisations on the Molecule AI platform.',
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
