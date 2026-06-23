"use client";

import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";

export default function BoardError({
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
    <div className="flex flex-1 flex-col items-center justify-center text-center px-4 py-20">
      <h2 className="font-heading text-xl font-bold mb-2">Failed to load board</h2>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs">
        Something went wrong loading this board. Try again or go back to the workspace.
      </p>
      <div className="flex gap-3">
        <button onClick={unstable_retry} className={buttonVariants({ variant: "default" })}>
          Try again
        </button>
        <a href=".." className={buttonVariants({ variant: "outline" })}>
          Back to workspace
        </a>
      </div>
    </div>
  );
}
