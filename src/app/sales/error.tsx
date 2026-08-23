"use client";

import { ErrorState } from "@/components/error-state";

export default function SectionError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      error={error}
      retry={unstable_retry}
      title="This page didn’t load"
      home="/sales"
    />
  );
}
