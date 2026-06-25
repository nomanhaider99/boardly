import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Target, Zap, Shield, Heart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About — Boardly",
  description: "What Boardly is, who it's for, and why we built it.",
};

const values = [
  {
    icon: Zap,
    title: "Speed over ceremony",
    description:
      "Every click saved matters. We obsess over the path between an idea and a shipped task.",
  },
  {
    icon: Target,
    title: "Focused, not bloated",
    description:
      "We add features when they solve a real problem, not to hit a feature checklist. Less is more.",
  },
  {
    icon: Shield,
    title: "Your data, your control",
    description:
      "No selling your data, no dark patterns. Boardly earns its place by being genuinely useful.",
  },
  {
    icon: Heart,
    title: "Built for humans",
    description:
      "Every design decision starts with how it feels to use, not how it looks in a screenshot.",
  },
];

const audience = [
  {
    who: "Startups",
    description: "Move fast without tripping over process. Boardly gives you just enough structure.",
    emoji: "🚀",
  },
  {
    who: "Indie teams & freelancers",
    description: "One tool for client projects, personal work, and everything in between.",
    emoji: "🧑‍💻",
  },
  {
    who: "Agencies",
    description: "Separate workspaces per client, shared team — clean boundaries by default.",
    emoji: "🏢",
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 text-center sm:px-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[400px] w-[700px] rounded-full bg-primary/5 blur-3xl -translate-y-1/4" />
        </div>
        <div className="relative mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            ✦ About Boardly
          </div>
          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Project management
            <br />
            <span className="text-primary">that gets out of the way.</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
            Boardly started as a frustration with existing tools that were either too simple or
            buried the things you actually needed under layers of settings.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="border-t border-border/40 bg-muted/20 px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            ✦ Our mission
          </div>
          <blockquote className="font-heading text-2xl font-bold sm:text-3xl leading-snug">
            &ldquo;Make project management feel less like work — and more like getting things done.&rdquo;
          </blockquote>
          <div className="space-y-4 text-muted-foreground leading-relaxed max-w-2xl">
            <p>
              We built Boardly because most team tools make a trade-off: either they&apos;re too lightweight to handle real projects, or they&apos;re so feature-rich that your team needs a week of onboarding before they can use them.
            </p>
            <p>
              Boardly sits in the middle — opinionated enough to give you a clear structure, flexible enough to bend to how your team actually works. Drag-and-drop boards, real-time sync, role-based access, card comments, and now an AI agent that takes actions on your behalf.
            </p>
            <p>
              We don&apos;t believe in charging for features that should be standard. The free tier is generous on purpose.
            </p>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              ✦ Who it&apos;s for
            </div>
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">Built for teams that ship</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {audience.map(({ who, description, emoji }) => (
              <div key={who} className="rounded-2xl border border-border/50 bg-card p-6 space-y-3">
                <span className="text-3xl">{emoji}</span>
                <h3 className="font-heading font-semibold text-lg">{who}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-border/40 bg-muted/20 px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              ✦ What we believe
            </div>
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">Our values</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {values.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-border/50 bg-card p-6 flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 text-center">
        <div className="mx-auto max-w-2xl space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            ✦ Join us
          </div>
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">Give it a try</h2>
          <p className="text-muted-foreground">Free forever. No credit card. Takes 30 seconds to set up.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up" className={buttonVariants({ size: "lg", className: "gap-2 px-7" })}>
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
