import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata = {
  title: {
    default: 'Molecule AI Documentation',
    template: '%s | Molecule AI Docs',
  },
  description:
    'Build and run multi-agent organisations on the Molecule AI platform. Templates, plugins, channels, and the runtime that ties them together.',
  metadataBase: new URL('https://doc.moleculesai.app'),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen font-sans">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
