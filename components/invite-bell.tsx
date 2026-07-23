"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getPendingInviteCount } from "@/app/actions/invite";
import { buttonVariants } from "@/components/ui/button";

const POLL_MS = 30_000;

// Live invite/notification badge. Polls the pending-invite count on an interval
// (no WebSockets) so an invited user sees new invites without a manual refresh.
// Polling pauses while the tab is hidden and refetches on focus to limit load.
export function InviteBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const c = await getPendingInviteCount();
        if (active) setCount(c);
      } catch {
        // transient failure — next tick will retry
      }
    }

    const id = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <Link
      href="/invites"
      className={buttonVariants({ variant: "ghost", size: "icon" }) + " relative"}
      aria-label={count > 0 ? `Invites (${count} pending)` : "Invites"}
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
