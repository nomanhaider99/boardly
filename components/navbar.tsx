import Link from "next/link";
import { Bell } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getPendingInviteCount } from "@/app/actions/invite";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export async function Navbar() {
  const session = await getSession();
  const pendingCount = session ? await getPendingInviteCount() : 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-heading text-xl font-bold text-primary">
          Boardly
        </Link>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              {/* Invite bell */}
              <Link
                href="/invites"
                className={buttonVariants({ variant: "ghost", size: "icon" }) + " relative"}
                aria-label="Invites"
              >
                <Bell className="h-4 w-4" />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Get started
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
