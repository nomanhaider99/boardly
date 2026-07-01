"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Deterministic avatar color from userId
const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-orange-500",
];
function avatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

interface Props {
  boardId: string;
  currentUserId: string;
}

export function ChatPanel({ boardId, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const latestCreatedAt = useRef<string | null>(null);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  // Track the newest message timestamp
  useEffect(() => {
    if (messages.length > 0) {
      latestCreatedAt.current = messages[messages.length - 1].createdAt;
    }
  }, [messages]);

  // Initial load
  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/${boardId}/chat`);
      if (!res.ok) return;
      const data: { messages: ChatMessage[] } = await res.json();
      setMessages(data.messages);
      setLoaded(true);
    } catch {
      // ignore
    }
  }, [boardId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    const poll = async () => {
      if (!latestCreatedAt.current) return;
      try {
        const res = await fetch(
          `/api/board/${boardId}/chat?since=${encodeURIComponent(latestCreatedAt.current)}`
        );
        if (!res.ok) return;
        const data: { messages: ChatMessage[] } = await res.json();
        if (data.messages.length === 0) return;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = data.messages.filter((m) => !existingIds.has(m.id));
          if (fresh.length === 0) return prev;

          if (!openRef.current) {
            setUnreadCount((c) => c + fresh.filter((m) => m.userId !== currentUserId).length);
          }
          return [...prev, ...fresh];
        });
      } catch {
        // ignore
      }
    };

    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [boardId, currentUserId]);

  // Auto-scroll when panel is open and messages change
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, open]);

  // Focus input and reset unread on open
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && openRef.current) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function sendMessage() {
    const body = input.trim();
    if (!body || sending) return;

    setSending(true);
    setInput("");

    try {
      const res = await fetch(`/api/board/${boardId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        setInput(body);
        return;
      }
      const data: { message: ChatMessage } = await res.json();
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    } catch {
      setInput(body);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Group consecutive messages from same sender
  type Group = { userId: string; firstName: string; lastName: string; avatarUrl: string | null; messages: ChatMessage[] };
  const groups: Group[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.userId === msg.userId) {
      last.messages.push(msg);
    } else {
      groups.push({
        userId: msg.userId,
        firstName: msg.firstName,
        lastName: msg.lastName,
        avatarUrl: msg.avatarUrl,
        messages: [msg],
      });
    }
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open board chat"}
        className={cn(
          "fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-lg transition-all duration-300",
          "hover:bg-muted hover:scale-105 hover:shadow-xl",
          open
            ? "opacity-0 scale-90 pointer-events-none"
            : "opacity-100 scale-100 pointer-events-auto"
        )}
      >
        <MessageSquare className="h-4 w-4 text-primary" />
        <span>Board Chat</span>
        {unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-6 left-6 z-50 flex w-[360px] flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden",
          "transition-all duration-300 ease-out",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
        style={{ maxHeight: "min(580px, calc(100vh - 5rem))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Board Chat</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {messages.length > 0
                  ? `${messages.length} message${messages.length === 1 ? "" : "s"}`
                  : "Be the first to say something"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 scroll-smooth">
          {!loaded && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {loaded && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Start the conversation with your team.
                </p>
              </div>
            </div>
          )}

          {groups.map((group, gi) => {
            const isMe = group.userId === currentUserId;
            const color = avatarColor(group.userId);
            return (
              <div
                key={`${group.userId}-${group.messages[0].id}`}
                className={cn("flex gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}
              >
                {/* Avatar — only shown for others */}
                {!isMe && (
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white mt-0.5",
                      color
                    )}
                  >
                    {initials(group.firstName, group.lastName)}
                  </div>
                )}

                <div className={cn("flex flex-col gap-1 max-w-[240px]", isMe && "items-end")}>
                  {/* Sender name + timestamp of first message */}
                  {!isMe && (
                    <span className="text-[11px] font-semibold text-foreground/80 leading-none px-1">
                      {group.firstName} {group.lastName}
                    </span>
                  )}

                  {group.messages.map((msg, mi) => (
                    <div key={msg.id} className="group/msg relative">
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted text-foreground rounded-tl-sm",
                          mi === 0 && !isMe && "rounded-tl-sm",
                          mi === 0 && isMe && "rounded-tr-sm",
                          mi > 0 && !isMe && "rounded-tl-lg",
                          mi > 0 && isMe && "rounded-tr-lg"
                        )}
                      >
                        {msg.body}
                      </div>
                      {/* Timestamp on hover for last message in group */}
                      {mi === group.messages.length - 1 && (
                        <span
                          className={cn(
                            "absolute -bottom-4 text-[10px] text-muted-foreground opacity-0 group-hover/msg:opacity-100 transition-opacity whitespace-nowrap",
                            isMe ? "right-1" : "left-1"
                          )}
                        >
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} className="h-4" />
        </div>

        {/* Input */}
        <div className="border-t border-border/40 bg-muted/10 p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message the team… (Enter to send)"
              rows={1}
              disabled={sending}
              className={cn(
                "flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50",
                "transition-colors disabled:opacity-50 leading-relaxed overflow-hidden"
              )}
              style={{ minHeight: "38px", maxHeight: "120px" }}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="shrink-0 h-[38px] w-[38px]"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            Shift+Enter for new line · Esc to close
          </p>
        </div>
      </div>
    </>
  );
}
