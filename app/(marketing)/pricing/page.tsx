"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus, ArrowRight, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const freeFeatures = [
  "3 workspaces",
  "Unlimited boards per workspace",
  "Up to 10 members per workspace",
  "Card comments & file attachments",
  "Email invitations",
  "AI board agent (20 messages / day)",
  "Light & dark mode",
];

const proFeatures = [
  "Unlimited workspaces",
  "Unlimited boards per workspace",
  "Unlimited members",
  "Card comments & file attachments",
  "Email invitations + custom roles",
  "AI board agent (unlimited)",
  "Light & dark mode",
  "Priority support",
  "Custom board backgrounds",
  "Activity audit log",
];

const comparisonRows = [
  { label: "Workspaces", free: "3", pro: "Unlimited" },
  { label: "Boards", free: "Unlimited", pro: "Unlimited" },
  { label: "Members per workspace", free: "10", pro: "Unlimited" },
  { label: "File attachments", free: true, pro: true },
  { label: "Card comments & @mentions", free: true, pro: true },
  { label: "AI board agent", free: "20 msg / day", pro: "Unlimited" },
  { label: "Priority support", free: false, pro: true },
  { label: "Custom board backgrounds", free: false, pro: true },
  { label: "Activity audit log", free: false, pro: true },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const proMonthly = 8;
  const proAnnual = 6;
  const price = annual ? proAnnual : proMonthly;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 text-center sm:px-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[400px] w-[700px] rounded-full bg-primary/5 blur-3xl -translate-y-1/4" />
        </div>
        <div className="relative mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            ✦ Pricing
          </div>
          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
            Start free and grow into it. No surprise charges, no feature-gating the basics.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 rounded-full border border-border/50 bg-muted/30 p-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                !annual ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                annual ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Annual
              <span className="ml-2 text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-semibold">
                Save 25%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Tier cards */}
      <section className="px-4 sm:px-8 pb-20">
        <div className="mx-auto max-w-4xl grid gap-6 sm:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl border border-border/50 bg-card p-8 space-y-7 flex flex-col">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Free</p>
              <div className="flex items-end gap-1">
                <span className="font-heading text-4xl font-extrabold">$0</span>
                <span className="text-muted-foreground pb-1">/ month</span>
              </div>
              <p className="text-sm text-muted-foreground">Forever free. No credit card needed.</p>
            </div>
            <ul className="space-y-3 flex-1">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-primary/40 bg-card p-8 space-y-7 flex flex-col relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute top-0 right-0 h-48 w-48 rounded-full bg-primary/5 blur-2xl translate-x-1/4 -translate-y-1/4" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary uppercase tracking-wide">Pro</p>
                <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-primary/10 text-primary px-2.5 py-1 font-semibold">
                  <Zap className="h-2.5 w-2.5" />
                  Coming soon
                </span>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-heading text-4xl font-extrabold">${price}</span>
                <span className="text-muted-foreground pb-1">/ month {annual && <span className="text-xs">(billed annually)</span>}</span>
              </div>
              <p className="text-sm text-muted-foreground">Everything in Free, plus power features for growing teams.</p>
            </div>
            <ul className="space-y-3 flex-1">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/contact" className={buttonVariants({ size: "lg", className: "w-full gap-2" })}>
              Join the waitlist
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-t border-border/40 bg-muted/20 px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              ✦ Compare plans
            </div>
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">Feature breakdown</h2>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-3 border-b border-border/40 bg-muted/20 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Feature</span>
              <span className="text-center">Free</span>
              <span className="text-center text-primary">Pro</span>
            </div>
            {comparisonRows.map((row, i) => (
              <div
                key={row.label}
                className={cn("grid grid-cols-3 px-6 py-3.5 text-sm items-center", i % 2 === 0 ? "" : "bg-muted/10")}
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="text-center">
                  {typeof row.free === "boolean" ? (
                    row.free ? <Check className="h-4 w-4 text-primary mx-auto" /> : <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                  ) : (
                    <span className="text-xs font-medium">{row.free}</span>
                  )}
                </span>
                <span className="text-center">
                  {typeof row.pro === "boolean" ? (
                    row.pro ? <Check className="h-4 w-4 text-primary mx-auto" /> : <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                  ) : (
                    <span className="text-xs font-medium text-primary">{row.pro}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 text-center">
        <div className="mx-auto max-w-2xl space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            ✦ Get started today
          </div>
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">Start free, upgrade when you&apos;re ready</h2>
          <p className="text-muted-foreground">No lock-in. Move at your own pace.</p>
          <Link href="/sign-up" className={buttonVariants({ size: "lg", className: "gap-2 px-7" })}>
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
