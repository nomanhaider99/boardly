import type { Metadata } from "next";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Sparkles,
  ArrowRight,
  GripVertical,
  AtSign,
  Paperclip,
  Shield,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features — Boardly",
  description: "Everything your team needs to organise work and ship faster.",
};

const sections = [
  {
    icon: LayoutDashboard,
    badge: "Boards & Lists",
    title: "Drag-and-drop that actually feels good",
    description:
      "Move cards between lists with smooth drag-and-drop, reorder lists on a board, and watch changes sync in real time for everyone on the board. No page refreshes, no lost context.",
    highlights: [
      { icon: GripVertical, text: "Smooth card and list reordering" },
      { icon: Shield, text: "Optimistic updates with conflict resolution" },
      { icon: LayoutDashboard, text: "Unlimited boards per workspace" },
    ],
    visual: <KanbanDetailVisual />,
    flip: false,
  },
  {
    icon: Users,
    badge: "Workspaces & Roles",
    title: "Collaborate without stepping on each other",
    description:
      "Invite teammates by email, assign them as Members or Admins, and manage workspace settings in one place. Role-based permissions mean the right people can change the right things.",
    highlights: [
      { icon: Users, text: "Role-based access: Admin and Member" },
      { icon: AtSign, text: "Email invitations with expiry" },
      { icon: Shield, text: "Per-workspace privacy settings" },
    ],
    visual: <TeamDetailVisual />,
    flip: true,
  },
  {
    icon: MessageSquare,
    badge: "Comments & Attachments",
    title: "All discussion lives on the card",
    description:
      "Comment on any card, mention teammates with @, and attach files directly — images, documents, anything. No more hunting through Slack to find what was decided about a task.",
    highlights: [
      { icon: MessageSquare, text: "Threaded comments on every card" },
      { icon: AtSign, text: "@mention teammates with notifications" },
      { icon: Paperclip, text: "File attachments on any card" },
    ],
    visual: <CommentsDetailVisual />,
    flip: false,
  },
  {
    icon: Sparkles,
    badge: "AI Board Agent",
    title: "Ask the agent to do the busywork",
    description:
      "Each board has an AI agent you can chat with. Move cards, post comments, and search the web — all from a chat panel right on the board. Switchable between Gemini and Claude models.",
    highlights: [
      { icon: Sparkles, text: "Natural language board actions" },
      { icon: LayoutDashboard, text: "Move cards and post comments on your behalf" },
      { icon: Shield, text: "Acts as you — respects your board permissions" },
    ],
    visual: <AgentDetailVisual />,
    flip: true,
  },
];

function KanbanDetailVisual() {
  const cols = [
    { name: "Backlog", count: 3, accent: "text-muted-foreground" },
    { name: "In Progress", count: 2, accent: "text-yellow-400", highlight: true },
    { name: "Done", count: 4, accent: "text-primary" },
  ];
  return (
    <div className="rounded-xl border border-border/50 bg-background p-4 space-y-3 pointer-events-none select-none">
      <div className="flex gap-3">
        {cols.map((col) => (
          <div key={col.name} className={`flex-1 rounded-lg p-2.5 space-y-2 ${col.highlight ? "bg-yellow-500/5 border border-yellow-500/20" : "bg-muted/30"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${col.accent}`}>{col.name}</span>
              <span className="text-[10px] text-muted-foreground">{col.count}</span>
            </div>
            {[...Array(col.count > 2 ? 2 : col.count)].map((_, i) => (
              <div key={i} className={`h-8 rounded-md border ${col.highlight && i === 0 ? "border-yellow-500/30 bg-yellow-500/10" : "border-border/50 bg-card"}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-primary">
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        3 members viewing this board
      </div>
    </div>
  );
}

function TeamDetailVisual() {
  const members = [
    { name: "Sarah Chen", role: "Admin", color: "bg-violet-500", initials: "SC" },
    { name: "James Okafor", role: "Member", color: "bg-blue-500", initials: "JO" },
    { name: "Priya Nair", role: "Member", color: "bg-primary", initials: "PN" },
  ];
  return (
    <div className="rounded-xl border border-border/50 bg-background p-4 space-y-3 pointer-events-none select-none">
      {members.map((m) => (
        <div key={m.name} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full ${m.color} flex items-center justify-center text-[10px] font-bold text-white`}>
              {m.initials}
            </div>
            <span className="text-xs font-medium">{m.name}</span>
          </div>
          <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${m.role === "Admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {m.role}
          </span>
        </div>
      ))}
      <div className="rounded-lg border border-dashed border-primary/30 px-3 py-2 text-center text-[10px] text-primary">
        + Invite a teammate
      </div>
    </div>
  );
}

function CommentsDetailVisual() {
  return (
    <div className="rounded-xl border border-border/50 bg-background p-4 space-y-3 pointer-events-none select-none">
      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[10px] font-semibold text-primary">Design</span>
        </div>
        <p className="text-xs font-medium">Finalize onboarding flow</p>
      </div>
      <div className="space-y-2.5">
        {[
          { color: "bg-violet-500", text: "Looks good — approved to move forward.", name: "SC" },
          { color: "bg-blue-500", text: "@SC thanks! Moving to In Progress now.", name: "JO" },
        ].map((c, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className={`h-5 w-5 rounded-full ${c.color} flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5`}>
              {c.name}
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-1.5 text-[10px] text-muted-foreground">{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentDetailVisual() {
  return (
    <div className="rounded-xl border border-border/50 bg-background p-4 space-y-3 pointer-events-none select-none">
      <div className="flex items-center gap-2 border-b border-border/40 pb-3">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <span className="text-xs font-semibold">Board Agent</span>
        <span className="ml-auto text-[9px] rounded-full bg-primary/10 text-primary px-2 py-0.5">Gemini 2.0</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="h-5 w-5 rounded-full bg-blue-500 shrink-0 flex items-center justify-center text-[8px] text-white font-bold">JO</div>
          <div className="rounded-xl bg-muted/60 px-3 py-1.5 text-[10px] text-muted-foreground">Move &quot;Finalize onboarding&quot; to Done</div>
        </div>
        <div className="flex items-end gap-2 justify-end">
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] text-primary">
            ✓ Moved to &quot;Done&quot;
          </div>
          <div className="h-5 w-5 rounded-full bg-primary/10 shrink-0 flex items-center justify-center">
            <Sparkles className="h-2.5 w-2.5 text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <div className="space-y-0">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 text-center sm:px-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[400px] w-[700px] rounded-full bg-primary/5 blur-3xl -translate-y-1/4" />
        </div>
        <div className="relative mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            ✦ Features
          </div>
          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Everything you need
            <br />
            <span className="text-primary">to ship faster.</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
            No bloat, no steep learning curve. Just the tools your team actually needs.
          </p>
        </div>
      </section>

      {/* Feature sections */}
      <div className="divide-y divide-border/40">
        {sections.map(({ icon: Icon, badge, title, description, highlights, visual, flip }) => (
          <section key={badge} className="px-4 py-20 sm:px-8">
            <div className={`mx-auto max-w-6xl flex flex-col gap-12 ${flip ? "lg:flex-row-reverse" : "lg:flex-row"} items-center`}>
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  <Icon className="h-3 w-3" />
                  {badge}
                </div>
                <h2 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h2>
                <p className="text-muted-foreground leading-relaxed">{description}</p>
                <ul className="space-y-3">
                  {highlights.map(({ icon: HIcon, text }) => (
                    <li key={text} className="flex items-center gap-3 text-sm">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <HIcon className="h-3.5 w-3.5" />
                      </div>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 w-full max-w-md">{visual}</div>
            </div>
          </section>
        ))}
      </div>

      {/* CTA */}
      <section className="border-t border-border/40 bg-muted/20 px-4 py-24 text-center">
        <div className="mx-auto max-w-2xl space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            ✦ Get started today
          </div>
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">Ready to try it?</h2>
          <p className="text-muted-foreground">Create your workspace in seconds. No credit card required.</p>
          <Link href="/sign-up" className={buttonVariants({ size: "lg", className: "gap-2 px-7" })}>
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
