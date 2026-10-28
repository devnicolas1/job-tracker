'use client';

import { useRouter } from 'next/navigation';

import { ConfirmButton } from '@/ui/confirm-button';

import { deleteJobAction } from '../actions';

export function DeleteJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      size="sm"
      onConfirm={async () => {
        const result = await deleteJobAction(jobId);
        if (result.status === 'success') router.push('/jobs');
      }}
    />
  );
}
