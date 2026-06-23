import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { buttonVariants } from "@/components/ui/button";

// ─── Static mock board data ───────────────────────────────────────────────────
const mockLists = [
  {
    title: "To Do",
    color: "text-muted-foreground",
    cards: [
      { title: "Design system audit", label: "Design", labelColor: "bg-violet-500/20 text-violet-400" },
      { title: "Write onboarding copy", label: "Content", labelColor: "bg-blue-500/20 text-blue-400" },
    ],
  },
  {
    title: "In Progress",
    color: "text-yellow-400",
    cards: [
      { title: "Build auth flow", label: "Dev", labelColor: "bg-orange-500/20 text-orange-400" },
      { title: "Set up CI/CD pipeline", label: "Ops", labelColor: "bg-red-500/20 text-red-400" },
    ],
  },
  {
    title: "Done",
    color: "text-primary",
    cards: [
      { title: "Project kickoff meeting", label: "Planning", labelColor: "bg-primary/20 text-primary" },
      { title: "Define MVP scope", label: "Planning", labelColor: "bg-primary/20 text-primary" },
    ],
  },
];

const features = [
  {
    icon: LayoutDashboard,
    title: "Drag-and-drop boards",
    description:
      "Organise tasks across lists with smooth drag-and-drop. Reorder cards and lists in seconds.",
  },
  {
    icon: Users,
    title: "Team workspaces",
    description:
      "Invite teammates by email, assign roles, and collaborate on projects in a shared workspace.",
  },
  {
    icon: MessageSquare,
    title: "Card comments",
    description:
      "Keep all discussion in context. Comment on any card and attach files without leaving the board.",
  },
];

// ─── Subcomponents ─────────────────────────────────────────────────────────────
function BoardPreview() {
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Main board */}
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden">
        {/* Board header bar */}
        <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
          </div>
          <span className="ml-2 text-xs font-medium text-muted-foreground">
            Boardly — Q3 Launch
          </span>
        </div>

        {/* Lists */}
        <div className="flex gap-3 overflow-x-auto p-4">
          {mockLists.map((list) => (
            <div
              key={list.title}
              className="w-52 shrink-0 rounded-xl bg-background/60 border border-border/40 p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between px-1">
                <span className={`text-xs font-semibold uppercase tracking-wide ${list.color}`}>
                  {list.title}
                </span>
                <span className="text-xs text-muted-foreground">{list.cards.length}</span>
              </div>

              {list.cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg bg-card border border-border/50 p-2.5 space-y-2 shadow-sm"
                >
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.labelColor}`}
                  >
                    {card.label}
                  </span>
                  <p className="text-xs font-medium leading-snug">{card.title}</p>
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="h-4 w-4 rounded-full bg-muted border border-border"
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Add card placeholder */}
              <div className="rounded-lg border border-dashed border-border/40 p-2 text-center">
                <span className="text-[10px] text-muted-foreground">+ Add card</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating stat chips */}
      <div className="absolute -top-4 -right-4 hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        <span>6 tasks this week</span>
      </div>

      <div className="absolute -bottom-4 -left-4 hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg text-xs font-medium">
        <div className="flex -space-x-1">
          {["bg-violet-400", "bg-blue-400", "bg-primary"].map((c, i) => (
            <div key={i} className={`h-5 w-5 rounded-full border-2 border-card ${c}`} />
          ))}
        </div>
        <span>Team of 3 active</span>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-4 pb-20 pt-20 sm:pt-28 text-center">
          {/* Subtle radial glow behind hero */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-start justify-center"
          >
            <div className="h-[500px] w-[800px] rounded-full bg-primary/5 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Now in open beta — free to use
            </div>

            <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Project management
              <br />
              <span className="text-primary">that moves with you.</span>
            </h1>

            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              Boards, lists, and cards for teams of any size. Drag tasks across stages,
              leave comments, attach files — all in one place.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className={buttonVariants({ size: "lg", className: "gap-2 px-6" })}
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                Sign in
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </section>

        {/* ── Product preview ── */}
        <section className="px-4 sm:px-8 pb-24">
          <BoardPreview />
        </section>

        {/* ── Features ── */}
        <section className="border-t border-border/40 bg-card/30 px-4 py-20 sm:px-8">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="text-center space-y-3">
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">
                Everything your team needs
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Built for speed and simplicity. No bloat, no steep learning curve.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/50 bg-background p-6 space-y-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA strip ── */}
        <section className="px-4 py-20 text-center">
          <div className="mx-auto max-w-2xl space-y-6">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Ready to ship faster?
            </h2>
            <p className="text-muted-foreground">
              Create your workspace in seconds and invite your team.
            </p>
            <Link
              href="/sign-up"
              className={buttonVariants({ size: "lg", className: "gap-2 px-8" })}
            >
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-heading font-bold text-primary">Boardly</span>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Boardly. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/sign-in" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-foreground transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
