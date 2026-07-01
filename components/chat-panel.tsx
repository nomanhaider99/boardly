"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, X, Loader2, Search, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  lastMessage: {
    body: string;
    createdAt: string;
    fromMe: boolean;
  } | null;
};

type DmMessage = {
  id: string;
  body: string;
  createdAt: string;
  fromUserId: string;
  toUserId: string;
  firstName: string;
  lastName: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function fullName(m: { firstName: string; lastName: string }) {
  return `${m.firstName} ${m.lastName}`;
}

function formatPreviewTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (
    d.toDateString() === now.toDateString()
  ) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-orange-500",
];
function avatarColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({
  userId,
  firstName,
  lastName,
  size = "md",
}: {
  userId: string;
  firstName: string;
  lastName: string;
  size?: "sm" | "md" | "lg";
}) {
  const cls = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  return (
    <div
      className={cn(
        "shrink-0 flex items-center justify-center rounded-full font-bold text-white",
        cls,
        avatarColor(userId)
      )}
    >
      {initials(firstName, lastName)}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  boardId: string;
  currentUserId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel({ boardId, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState("");
  const [activePartner, setActivePartner] = useState<Member | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const latestMsgAt = useRef<string | null>(null);
  const activePartnerRef = useRef<Member | null>(null);
  const openRef = useRef(false);

  useEffect(() => { activePartnerRef.current = activePartner; }, [activePartner]);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    if (messages.length > 0) latestMsgAt.current = messages[messages.length - 1].createdAt;
  }, [messages]);

  // ── Fetch members ──────────────────────────────────────────────────────────

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/${boardId}/chat/members`);
      if (!res.ok) return;
      const data: { members: Member[] } = await res.json();
      setMembers(data.members);
    } catch { /* ignore */ }
  }, [boardId]);

  // ── Fetch conversation ─────────────────────────────────────────────────────

  const fetchConversation = useCallback(async (partnerId: string) => {
    setLoadingMessages(true);
    latestMsgAt.current = null;
    try {
      const res = await fetch(`/api/board/${boardId}/chat?partner=${partnerId}`);
      if (!res.ok) return;
      const data: { messages: DmMessage[] } = await res.json();
      setMessages(data.messages);
    } catch { /* ignore */ }
    finally { setLoadingMessages(false); }
  }, [boardId]);

  // ── Initial member load ────────────────────────────────────────────────────

  useEffect(() => {
    if (open && members.length === 0) {
      setLoadingMembers(true);
      fetchMembers().finally(() => setLoadingMembers(false));
    }
  }, [open, members.length, fetchMembers]);

  // ── Poll members list every 5s (update last-message previews) ─────────────

  useEffect(() => {
    const id = setInterval(() => {
      if (openRef.current) fetchMembers();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchMembers]);

  // ── Poll active conversation every 3s ─────────────────────────────────────

  useEffect(() => {
    const poll = async () => {
      const partner = activePartnerRef.current;
      if (!partner || !latestMsgAt.current) return;
      try {
        const since = encodeURIComponent(latestMsgAt.current);
        const res = await fetch(`/api/board/${boardId}/chat?partner=${partner.userId}&since=${since}`);
        if (!res.ok) return;
        const data: { messages: DmMessage[] } = await res.json();
        if (!data.messages.length) return;
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const fresh = data.messages.filter((m) => !ids.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [boardId]);

  // ── Scroll to bottom on new messages ──────────────────────────────────────

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [messages]);

  // ── Focus input when partner selected ─────────────────────────────────────

  useEffect(() => {
    if (activePartner) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activePartner]);

  // ── Open/close handlers ───────────────────────────────────────────────────

  useEffect(() => {
    if (open) setTotalUnread(0);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && openRef.current) {
        if (activePartnerRef.current) setActivePartner(null);
        else setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Select partner ────────────────────────────────────────────────────────

  function selectPartner(m: Member) {
    setActivePartner(m);
    setMessages([]);
    fetchConversation(m.userId);
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    const body = input.trim();
    if (!body || sending || !activePartner) return;
    setSending(true);
    setInput("");

    try {
      const res = await fetch(`/api/board/${boardId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: activePartner.userId, body }),
      });
      if (!res.ok) { setInput(body); return; }
      const data: { message: DmMessage } = await res.json();
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
      );
      // Update last-message in member list
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === activePartner.userId
            ? { ...m, lastMessage: { body, createdAt: data.message.createdAt, fromMe: true } }
            : m
        )
      );
    } catch { setInput(body); }
    finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── Filtered members ──────────────────────────────────────────────────────

  const filteredMembers = search.trim()
    ? members.filter((m) =>
        fullName(m).toLowerCase().includes(search.toLowerCase())
      )
    : members;

  // ── Grouped messages ──────────────────────────────────────────────────────

  type Group = { fromUserId: string; firstName: string; messages: DmMessage[] };
  const groups: Group[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.fromUserId === msg.fromUserId) {
      last.messages.push(msg);
    } else {
      groups.push({ fromUserId: msg.fromUserId, firstName: msg.firstName, messages: [msg] });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Trigger button (top-right, aligned with board header) ─────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle board chat"
        className={cn(
          "fixed top-[10px] right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card/90 backdrop-blur px-3.5 py-2 text-sm font-medium shadow-md",
          "hover:bg-muted hover:shadow-lg transition-all duration-200",
          open ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"
        )}
      >
        <MessageSquare className="h-4 w-4 text-primary" />
        <span>Chat</span>
        {totalUnread > 0 && (
          <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-screen flex flex-col bg-card border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{ width: "min(720px, 95vw)" }}
      >
        <div className="flex flex-1 min-h-0">
          {/* ── Left: Members sidebar ──────────────────────────────────── */}
          <div className="flex flex-col border-r border-border/60 bg-muted/20" style={{ width: 260 }}>
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 shrink-0">
              <div>
                <h2 className="text-sm font-bold leading-tight">Board Chat</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {members.length} member{members.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setOpen(false); setActivePartner(null); }}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members…"
                  className="w-full h-8 rounded-lg border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                />
              </div>
            </div>

            {/* Member list */}
            <div className="flex-1 overflow-y-auto">
              {loadingMembers && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loadingMembers && filteredMembers.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8 px-4">
                  {search ? "No members match your search." : "No other members on this board."}
                </p>
              )}

              {filteredMembers.map((m) => {
                const isActive = activePartner?.userId === m.userId;
                return (
                  <button
                    key={m.userId}
                    onClick={() => selectPartner(m)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-3 text-left transition-colors border-b border-border/30",
                      isActive
                        ? "bg-primary/8 border-l-2 border-l-primary"
                        : "hover:bg-muted/50 border-l-2 border-l-transparent"
                    )}
                  >
                    <Avatar userId={m.userId} firstName={m.firstName} lastName={m.lastName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn("text-xs font-semibold truncate", isActive && "text-primary")}>
                          {fullName(m)}
                        </span>
                        {m.lastMessage && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatPreviewTime(m.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-snug">
                        {m.lastMessage
                          ? `${m.lastMessage.fromMe ? "You: " : ""}${m.lastMessage.body}`
                          : "No messages yet"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: Conversation ────────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0">
            {!activePartner ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center flex-1 text-center px-6 gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Select a team member</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
                    Choose someone from the left to start or continue a conversation.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40 bg-background/60 shrink-0">
                  <button
                    onClick={() => setActivePartner(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors md:hidden"
                    aria-label="Back to members"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar
                    userId={activePartner.userId}
                    firstName={activePartner.firstName}
                    lastName={activePartner.lastName}
                    size="md"
                  />
                  <div>
                    <p className="text-sm font-semibold leading-tight">{fullName(activePartner)}</p>
                    <p className="text-[11px] text-muted-foreground">Board member</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  {loadingMessages && (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {!loadingMessages && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        No messages yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Say hello to {activePartner.firstName}!
                      </p>
                    </div>
                  )}

                  {groups.map((group) => {
                    const isMe = group.fromUserId === currentUserId;
                    return (
                      <div
                        key={group.messages[0].id}
                        className={cn("flex gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}
                      >
                        {!isMe && (
                          <Avatar
                            userId={group.fromUserId}
                            firstName={group.firstName}
                            lastName={group.messages[0].lastName}
                            size="sm"
                          />
                        )}

                        <div className={cn("flex flex-col gap-1 max-w-[65%]", isMe && "items-end")}>
                          {!isMe && (
                            <span className="text-[11px] font-semibold text-foreground/70 px-1 leading-none">
                              {group.firstName}
                            </span>
                          )}

                          {group.messages.map((msg, mi) => (
                            <div key={msg.id} className="group/msg relative">
                              <div
                                className={cn(
                                  "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap shadow-sm",
                                  isMe
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-muted text-foreground rounded-tl-sm"
                                )}
                              >
                                {msg.body}
                              </div>
                              {mi === group.messages.length - 1 && (
                                <span
                                  className={cn(
                                    "absolute -bottom-4 text-[10px] text-muted-foreground opacity-0 group-hover/msg:opacity-100 transition-opacity whitespace-nowrap",
                                    isMe ? "right-1" : "left-1"
                                  )}
                                >
                                  {formatMessageTime(msg.createdAt)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={bottomRef} className="h-5" />
                </div>

                {/* Input */}
                <div className="border-t border-border/40 bg-background/60 px-4 py-3 shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                      }}
                      onKeyDown={onKeyDown}
                      placeholder={`Message ${activePartner.firstName}…`}
                      rows={1}
                      disabled={sending}
                      className={cn(
                        "flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm",
                        "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50",
                        "transition-colors disabled:opacity-50 leading-relaxed overflow-hidden"
                      )}
                      style={{ minHeight: "42px", maxHeight: "128px" }}
                    />
                    <Button
                      size="icon"
                      onClick={sendMessage}
                      disabled={sending || !input.trim()}
                      className="shrink-0 h-[42px] w-[42px]"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                    Enter to send · Shift+Enter for new line
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
