"use client";

import { ErrorState } from "@/components/error-state";
import "./globals.css";

/**
 * The last boundary: this one catches failures in the root layout itself, which
 * means it replaces it — hence its own <html>/<body> and its own stylesheet
 * import. It cannot use the app's fonts (those are set up in the layout that
 * just failed), so it renders in the system stack and still looks deliberate.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col justify-center px-4">
        <title>Something broke — freshlog</title>
        <ErrorState
          error={error}
          retry={unstable_retry}
          title="freshlog didn’t load"
        />
      </body>
    </html>
  );
}
