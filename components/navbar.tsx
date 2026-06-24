import Link from "next/link";
import Image from "next/image";
import { Bell } from "lucide-react";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getPendingInviteCount } from "@/app/actions/invite";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export async function Navbar() {
  const session = await getSession();
  const pendingCount = session ? await getPendingInviteCount() : 0;

  let userProfile: { firstName: string; lastName: string; avatarUrl: string | null } | null = null;
  if (session) {
    const [u] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    userProfile = u ?? null;
  }

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

              {/* Profile avatar */}
              <Link
                href="/profile"
                aria-label="Profile"
                className="h-8 w-8 rounded-full overflow-hidden shrink-0 ring-2 ring-border hover:ring-primary transition-all"
              >
                {userProfile?.avatarUrl ? (
                  <Image
                    src={userProfile.avatarUrl}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="h-full w-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {userProfile
                      ? `${userProfile.firstName[0] ?? ""}${userProfile.lastName[0] ?? ""}`.toUpperCase()
                      : "?"}
                  </span>
                )}
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
