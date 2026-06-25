"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";
import {
  Bot,
  Send,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  MessageSquare,
  MoveRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PROVIDER_CONFIG, type ModelProvider } from "@/lib/ai-provider";

type Props = {
  boardId: string;
  currentUserName: string;
  modelProvider: ModelProvider;
  onProviderChange: (p: ModelProvider) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ── Tool result cards ─────────────────────────────────────────────────────────

type ToolResult = Record<string, unknown>;

function ToolActionCard({ name, result }: { name: string; result: ToolResult }) {
  const ok = result.success === true;

  if (!ok) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>{String(result.error ?? "Tool failed.")}</span>
      </div>
    );
  }

  if (name === "addComment") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold text-primary">Comment posted</span>
          {" on "}
          <span className="font-medium">&ldquo;{String(result.cardTitle ?? "")}&rdquo;</span>
        </span>
      </div>
    );
  }

  if (name === "moveCard") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span className="flex flex-wrap items-center gap-x-1">
          <span className="font-semibold">Moved</span>
          <span className="font-medium">&ldquo;{String(result.cardTitle ?? "")}&rdquo;</span>
          <span className="text-muted-foreground">
            {String(result.fromList ?? "")}
          </span>
          <MoveRight className="h-3 w-3 text-muted-foreground" />
          <span className="font-semibold text-primary">{String(result.toList ?? "")}</span>
        </span>
      </div>
    );
  }

  if (name === "webSearch") {
    const results = result.results as { title: string; url: string }[] | undefined;
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <Search className="h-3 w-3" />
          <span>Web results for &ldquo;{String(result.query ?? "")}&rdquo;</span>
        </div>
        <div className="space-y-1">
          {results?.slice(0, 4).map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-primary hover:underline leading-snug"
            >
              {r.title}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      {name} completed
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AgentPanel({
  boardId,
  currentUserName,
  modelProvider,
  onProviderChange,
  open,
  onOpenChange,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, setInput, handleSubmit, isLoading, error } =
    useChat({
      api: `/api/agent/${boardId}`,
      body: { modelProvider },
    });

  // Scroll to bottom when messages arrive and panel is open
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const providers: ModelProvider[] = ["mistral", "claude", "gemini"];
  const hasMessages = messages.length > 0;
  const unread = !open && hasMessages && messages[messages.length - 1]?.role === "assistant";

  return (
    <>
      {/* ── Floating trigger ── */}
      <button
        onClick={() => onOpenChange(!open)}
        aria-label={open ? "Close agent panel" : "Open agent panel"}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-all duration-300",
          "hover:bg-primary/90 hover:scale-105 hover:shadow-[0_0_24px_rgba(34,197,94,0.35)]",
          open
            ? "opacity-0 scale-90 pointer-events-none"
            : "opacity-100 scale-100 pointer-events-auto"
        )}
      >
        <Bot className="h-4 w-4" />
        Ask Agent
        {/* Unread dot */}
        {unread && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-white border-2 border-primary" />
        )}
      </button>

      {/* ── Chat panel ── */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex w-[360px] flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden",
          "transition-all duration-300 ease-out",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-5 pointer-events-none"
        )}
        style={{ maxHeight: "min(560px, calc(100vh - 5rem))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold">Board Agent</span>
          </div>

          {/* Model switcher */}
          <div className="flex items-center gap-1 rounded-full border border-border/50 bg-background/60 p-0.5">
            {providers.map((p) => (
              <button
                key={p}
                onClick={() => onProviderChange(p)}
                title={PROVIDER_CONFIG[p].label}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150",
                  modelProvider === p
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "gemini" ? "Gemini" : p === "claude" ? "Claude" : "Mistral"}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close agent panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Active model + acting-as identity sub-header */}
        <div className="border-b border-border/20 bg-muted/10 px-4 py-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground leading-tight flex flex-wrap gap-x-1.5 items-center">
            <span>
              Acting as{" "}
              <span className="font-medium text-foreground">{currentUserName}</span>
            </span>
            <span className="text-border">·</span>
            <span>
              <span className="font-medium text-primary">
                {PROVIDER_CONFIG[modelProvider].label}
              </span>
            </span>
            <span className="text-border">·</span>
            <span>Esc to close</span>
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Board Agent ready</p>
                <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                  Move cards, post comments, search the web, or ask anything about this board.
                </p>
              </div>
              <div className="flex flex-col gap-1.5 w-full max-w-[230px]">
                {[
                  "Move the design card to Done",
                  "Comment on the auth card",
                  "Search for Kanban best practices",
                ].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => setInput(hint)}
                    className="rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className="space-y-2">
              {m.content && (
                <div
                  className={cn(
                    "flex gap-2",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {m.role === "assistant" && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm max-w-[270px] leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              )}

              {/* Tool invocations */}
              {m.toolInvocations?.map((inv) =>
                inv.state === "result" ? (
                  <ToolActionCard
                    key={inv.toolCallId}
                    name={inv.toolName}
                    result={inv.result as ToolResult}
                  />
                ) : (
                  <div
                    key={inv.toolCallId}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running {inv.toolName}…
                  </div>
                )
              )}
            </div>
          ))}

          {/* Streaming indicator (only while no tool is in-flight) */}
          {isLoading &&
            !messages[messages.length - 1]?.toolInvocations?.some(
              (i) => i.state !== "result"
            ) && (
              <div className="flex gap-2 justify-start">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error.message}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-border/40 bg-muted/10 p-3 shrink-0"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask or instruct…"
            disabled={isLoading}
            className="flex-1 text-sm bg-background"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </>
  );
}
