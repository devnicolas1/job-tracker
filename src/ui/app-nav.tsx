'use client';

import { Briefcase, FileText, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

const ITEMS: readonly {
  href: '/jobs' | '/profile' | '/resumes';
  label: string;
  icon: LucideIcon;
}[] = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/profile', label: 'Profile', icon: UserRound },
  { href: '/resumes', label: 'Résumés', icon: FileText },
];

export function AppNav({ newJobs }: { newJobs: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex gap-1 md:flex-col">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors',
              active
                ? 'bg-surface text-text shadow-xs ring-1 ring-border'
                : 'text-muted hover:bg-surface-muted hover:text-text',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {href === '/jobs' && newJobs > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] leading-5 font-semibold text-accent-contrast tabular-nums">
                {newJobs}
                <span className="sr-only"> new</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
