import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Star,
  MoveRight,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";

// ─── Data ──────────────────────────────────────────────────────────────────────

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
      "Organise tasks across lists with smooth drag-and-drop. Reorder cards and lists in seconds — no friction.",
    visual: <KanbanVisual />,
  },
  {
    icon: Users,
    title: "Team workspaces",
    description:
      "Invite teammates by email, assign roles, and collaborate on shared projects without stepping on each other.",
    visual: <TeamVisual />,
  },
  {
    icon: MessageSquare,
    title: "Card comments",
    description:
      "Keep all discussion in context. Comment on any card, mention teammates, and attach files without leaving the board.",
    visual: <CommentsVisual />,
  },
  {
    icon: Sparkles,
    title: "AI board agent",
    description:
      "Ask the agent to move cards, post comments, or search the web — all from a chat panel right on the board.",
    visual: <AgentVisual />,
  },
];

const testimonials = [
  {
    quote: "Boardly replaced three tools we were using. Our team ships faster now because everything lives in one place.",
    name: "Sarah Chen",
    role: "Product Manager, Acme Corp",
    initials: "SC",
    color: "bg-violet-500",
  },
  {
    quote: "The drag-and-drop is butter smooth and the workspace permissions actually make sense. Rare combination.",
    name: "James Okafor",
    role: "Engineering Lead, Fluxio",
    initials: "JO",
    color: "bg-blue-500",
  },
  {
    quote: "Switched from a much more expensive tool and haven't looked back. The AI agent alone saves us hours a week.",
    name: "Priya Nair",
    role: "Head of Operations, Stackbase",
    initials: "PN",
    color: "bg-primary",
  },
];

// ─── Small visual components for feature cards ─────────────────────────────────

function KanbanVisual() {
  return (
    <div className="flex gap-2 mt-4 pointer-events-none select-none">
      {["To Do", "In Progress", "Done"].map((col, i) => (
        <div key={col} className="flex-1 rounded-lg bg-muted/50 p-2 space-y-1.5">
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">{col}</div>
          {[...Array(i === 1 ? 1 : 2)].map((_, j) => (
            <div key={j} className={`h-5 rounded bg-border/70 ${i === 1 && j === 0 ? "border border-primary/40 bg-primary/5" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function TeamVisual() {
  const colors = ["bg-violet-500", "bg-blue-500", "bg-primary", "bg-orange-500"];
  const initials = ["SC", "JO", "PN", "AR"];
  return (
    <div className="flex items-center gap-3 mt-4 pointer-events-none select-none">
      <div className="flex -space-x-2">
        {colors.map((c, i) => (
          <div key={i} className={`h-8 w-8 rounded-full ${c} border-2 border-card flex items-center justify-center text-[9px] font-bold text-white`}>
            {initials[i]}
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">4 members active</div>
    </div>
  );
}

function CommentsVisual() {
  return (
    <div className="space-y-2 mt-4 pointer-events-none select-none">
      {[
        { color: "bg-violet-500", text: "Looks good, approving!", align: "items-start" },
        { color: "bg-primary", text: "Can we ship Friday?", align: "items-end" },
      ].map(({ color, text, align }, i) => (
        <div key={i} className={`flex ${align} gap-2`}>
          <div className={`h-5 w-5 rounded-full ${color} shrink-0 ${align === "items-end" ? "order-last" : ""}`} />
          <div className="rounded-xl bg-muted/60 px-3 py-1.5 text-[10px] text-muted-foreground max-w-[80%]">{text}</div>
        </div>
      ))}
    </div>
  );
}

function AgentVisual() {
  return (
    <div className="space-y-2 mt-4 pointer-events-none select-none">
      <div className="flex items-end gap-2">
        <div className="h-5 w-5 rounded-full bg-primary shrink-0" />
        <div className="rounded-xl bg-muted/60 px-3 py-1.5 text-[10px] text-muted-foreground">Move the auth card to Done</div>
      </div>
      <div className="flex items-end gap-2 justify-end">
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] text-primary">
          ✓ Moved &quot;Build auth flow&quot; → Done
        </div>
        <div className="h-5 w-5 rounded-full bg-muted shrink-0 flex items-center justify-center">
          <Sparkles className="h-2.5 w-2.5 text-primary" />
        </div>
      </div>
    </div>
  );
}

// ─── Board preview ─────────────────────────────────────────────────────────────

function BoardPreview() {
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_20px_80px_-12px_rgba(0,0,0,0.4)] dark:shadow-[0_20px_80px_-12px_rgba(0,0,0,0.7)] overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
          </div>
          <div className="ml-3 flex-1 max-w-xs rounded-md bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
            boardly.app/board/q3-launch
          </div>
        </div>

        {/* Board content */}
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
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.labelColor}`}>
                    {card.label}
                  </span>
                  <p className="text-xs font-medium leading-snug">{card.title}</p>
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-4 w-4 rounded-full bg-muted border border-border" />
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-lg border border-dashed border-border/40 p-2 text-center">
                <span className="text-[10px] text-muted-foreground">+ Add card</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating chips */}
      <div className="absolute -top-4 -right-6 hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        <span>6 tasks shipped this week</span>
      </div>

      <div className="absolute -bottom-4 -left-6 hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg text-xs font-medium">
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
        <section className="relative overflow-hidden px-4 pb-24 pt-24 sm:pt-32 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center">
            <div className="h-[600px] w-[900px] rounded-full bg-primary/6 blur-3xl -translate-y-1/4" />
          </div>

          <div className="relative mx-auto max-w-3xl space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              <span className="text-primary">✦</span>
              Manage Boards Effortlessly
            </div>

            <h1 className="font-heading text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              Organize your work,
              <br />
              <span className="text-primary">ship what matters.</span>
            </h1>

            <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
              Boards, lists, and cards for teams of any size. Drag tasks across stages,
              collaborate in context, and let your AI agent handle the busywork.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className={buttonVariants({ size: "lg", className: "gap-2 px-7" })}
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#preview"
                className={buttonVariants({ variant: "outline", size: "lg", className: "gap-2" })}
              >
                See how it works
                <MoveRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              No credit card required · Cancel anytime
            </p>
          </div>
        </section>

        {/* ── Product preview ── */}
        <section id="preview" className="px-4 sm:px-10 pb-32">
          <BoardPreview />
        </section>

        {/* ── Why Choose Boardly ── */}
        <section className="border-t border-border/40 bg-muted/20 px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-6xl space-y-14">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
                ✦ Why Choose Boardly
              </div>
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">
                Everything your team needs
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Built for speed and simplicity. No bloat, no steep learning curve — just the tools that matter.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, description, visual }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/50 bg-card p-6 space-y-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                  {visual}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-6xl space-y-14">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
                ✦ What teams say
              </div>
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">
                Trusted by teams that ship
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {testimonials.map(({ quote, name, role, initials, color }) => (
                <div
                  key={name}
                  className="rounded-2xl border border-border/50 bg-card p-6 space-y-5 flex flex-col"
                >
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full ${color} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA band ── */}
        <section className="border-t border-border/40 bg-muted/20 px-4 py-24 text-center">
          <div className="mx-auto max-w-2xl space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              ✦ Get started today
            </div>
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Ready to ship faster?
            </h2>
            <p className="text-muted-foreground">
              Create your workspace in seconds and invite your team. Free, forever.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className={buttonVariants({ size: "lg", className: "gap-2 px-7" })}
              >
                Create free account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                Talk to us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
