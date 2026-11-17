// app/error.tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>

      <p>Please try again.</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
