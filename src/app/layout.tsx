import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { getServices } from '@/core/container';
import { AppNav } from '@/ui/app-nav';

import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Job Tracker', template: '%s · Job Tracker' },
  description: 'Career database, résumé vault and AI-curated job pipeline.',
};

// Every page reads the local database, which the MCP server may change at any time.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  const newJobs = getServices().jobs.countByStatus().new;

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only rounded-md bg-accent px-3 py-2 text-accent-contrast focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        <div className="mx-auto flex min-h-dvh max-w-7xl flex-col md:flex-row">
          <aside className="sticky top-0 z-20 border-b border-border bg-canvas/90 px-4 py-3 backdrop-blur md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0 md:bg-canvas md:px-4 md:py-6">
            <div className="flex items-center gap-4 md:flex-col md:items-stretch md:gap-6">
              <div className="flex items-center gap-2 px-1 md:px-3">
                <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-contrast">
                  <Sparkles className="size-4" aria-hidden />
                </span>
                <span className="hidden font-semibold tracking-tight sm:inline">Job Tracker</span>
              </div>
              <AppNav newJobs={newJobs} />
            </div>
          </aside>
          <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
