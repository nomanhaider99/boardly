"use client";

import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <h1 className="font-heading text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground text-sm mb-8 max-w-xs">
        An unexpected error occurred. You can try again or return to the dashboard.
      </p>
      <div className="flex gap-3">
        <button
          onClick={unstable_retry}
          className={buttonVariants({ variant: "default" })}
        >
          Try again
        </button>
        <a href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Dashboard
        </a>
      </div>
    </div>
  );
}
