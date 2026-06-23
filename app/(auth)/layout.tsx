import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const steps = [
  { n: 1, label: "Create your account" },
  { n: 2, label: "Set up your workspace" },
  { n: 3, label: "Invite your team" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left branded panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-card border-r border-border p-10">
        <Link href="/" className="font-heading text-2xl font-bold text-primary">
          Boardly
        </Link>

        <div className="space-y-8">
          <div>
            <h2 className="font-heading text-3xl font-bold leading-tight mb-3">
              Manage projects
              <br />
              <span className="text-primary">at any scale.</span>
            </h2>
            <p className="text-muted-foreground">
              Boards, lists, and cards — everything your team needs to ship faster.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map(({ n, label }) => (
              <div key={n} className="flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary font-heading font-bold text-sm">
                  {n}
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Boardly. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between items-center p-4 lg:p-6">
          <Link
            href="/"
            className="font-heading text-xl font-bold text-primary lg:hidden"
          >
            Boardly
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
