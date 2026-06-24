import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { ProfileBasicInfo } from "@/components/profile-basic-info";
import { ProfilePassword } from "@/components/profile-password";
import { Profile2FA } from "@/components/profile-2fa";

export const metadata = { title: "Profile — Boardly" };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [user] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="mt-4 text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account settings and security.</p>
        </div>

        <div className="space-y-4">
          <ProfileBasicInfo
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            avatarUrl={user.avatarUrl}
          />
          <ProfilePassword />
          <Profile2FA twoFactorEnabled={user.twoFactorEnabled} />
        </div>
      </div>
    </div>
  );
}
