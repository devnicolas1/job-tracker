import { SearchX } from 'lucide-react';
import Link from 'next/link';

import { buttonClasses } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Not found"
      action={
        <Link href="/jobs" className={buttonClasses()}>
          Back to jobs
        </Link>
      }
    >
      This page does not exist, or the item was deleted.
    </EmptyState>
  );
}
