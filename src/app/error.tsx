'use client';

import { CircleAlert } from 'lucide-react';

import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Something went wrong"
      action={<Button onClick={reset}>Try again</Button>}
    >
      {error.message}
    </EmptyState>
  );
}
