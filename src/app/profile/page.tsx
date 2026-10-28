import type { Metadata } from 'next';

import { getServices } from '@/core/container';
import { PROFILE_SECTIONS } from '@/core/profile/schemas';
import { SectionEditor } from '@/features/profile/components/section-editor';
import { SingletonForm } from '@/features/profile/components/singleton-form';
import { sectionDescriptors } from '@/features/profile/descriptors';
import { PageHeader } from '@/ui/page-header';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  const profile = getServices().profiles.getProfile();

  const anchors = [
    { id: 'basics', label: 'Basics', count: undefined },
    { id: 'preferences', label: 'Job preferences', count: undefined },
    ...PROFILE_SECTIONS.map((section) => ({
      id: section,
      label: sectionDescriptors[section].title,
      count: profile.entries[section].length,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Profile"
        description="Everything about your career, in one place. It is the only source of facts the agent may put on a résumé: the more complete it is, the better the matches."
      />
      <div className="grid gap-8 xl:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Profile sections" className="hidden xl:block">
          <ul className="sticky top-10 flex flex-col gap-0.5 text-sm">
            {anchors.map((anchor) => (
              <li key={anchor.id}>
                <a
                  href={`#${anchor.id}`}
                  className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-muted hover:bg-surface-muted hover:text-text"
                >
                  {anchor.label}
                  {anchor.count !== undefined && (
                    <span className="text-xs text-subtle tabular-nums">{anchor.count}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <SingletonForm kind="basics" values={profile.basics} />
          <SingletonForm kind="preferences" values={profile.preferences} />
          {PROFILE_SECTIONS.map((section) => (
            <SectionEditor key={section} section={section} entries={profile.entries[section]} />
          ))}
        </div>
      </div>
    </>
  );
}
