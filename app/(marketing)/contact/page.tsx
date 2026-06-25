"use client";

import type { Metadata } from "next";
import { useActionState } from "react";
import { Mail, MapPin, MessageSquare, Loader2, CheckCircle2 } from "lucide-react";
import { submitContactForm } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Metadata must be in a server component — omit here since layout handles title
// export const metadata: Metadata = { title: "Contact — Boardly" };

const contactDetails = [
  {
    icon: Mail,
    label: "Email us",
    value: "hello@boardly.app",
    href: "mailto:hello@boardly.app",
  },
  {
    icon: MessageSquare,
    label: "Response time",
    value: "Usually within 24 hours",
    href: null,
  },
  {
    icon: MapPin,
    label: "Based in",
    value: "The internet ☁️",
    href: null,
  },
];

export default function ContactPage() {
  const [state, action, pending] = useActionState(submitContactForm, null);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 text-center sm:px-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[400px] w-[700px] rounded-full bg-primary/5 blur-3xl -translate-y-1/4" />
        </div>
        <div className="relative mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            ✦ Contact
          </div>
          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Get in touch
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
            Have a question, feature request, or just want to say hi? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="border-t border-border/40 px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl grid gap-12 lg:grid-cols-2 items-start">
          {/* Left: info */}
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
                ✦ Reach out
              </div>
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">We&apos;re here to help</h2>
              <p className="text-muted-foreground leading-relaxed">
                Whether you&apos;re running into a bug, want to give feedback, or are curious about the Pro plan — send us a note and we&apos;ll get back to you promptly.
              </p>
            </div>

            <div className="space-y-4">
              {contactDetails.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    {href ? (
                      <a href={href} className="text-sm font-medium hover:text-primary transition-colors">
                        {value}
                      </a>
                    ) : (
                      <p className="text-sm font-medium">{value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div className="rounded-2xl border border-border/50 bg-card p-8">
            {state?.success ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-heading text-xl font-bold">Message sent!</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Thanks for reaching out. We&apos;ll get back to you within 24 hours.
                </p>
              </div>
            ) : (
              <form action={action} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Message</Label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    placeholder="Tell us what's on your mind…"
                    required
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                </div>

                {state?.error && (
                  <p className="text-sm text-destructive">{state.error}</p>
                )}

                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send message"
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Or email us directly at{" "}
                  <a href="mailto:hello@boardly.app" className="text-primary hover:underline">
                    hello@boardly.app
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
