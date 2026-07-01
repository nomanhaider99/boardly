"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Send, X, Loader2, Search,
  Paperclip, Link2, ExternalLink, FileText, ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUploadThing } from "@/lib/uploadthing";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
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

type PendingFile = {
  url: string;
  name: string;
  type: string;
  isImage: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-orange-500",
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

function fullName(m: { firstName: string; lastName: string }) {
  return `${m.firstName} ${m.lastName}`;
}

function formatPreviewTime(iso: string) {
  const d = new Date(iso), now = new Date();
  const s = (now.getTime() - d.getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatBubbleTime(iso: string) {
  const d = new Date(iso), now = new Date();
  const s = (now.getTime() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function dateDivider(iso: string) {
  const d = new Date(iso), now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ userId, firstName, lastName, size = "md" }: {
  userId: string; firstName: string; lastName: string; size?: "sm" | "md" | "lg";
}) {
  const sz = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";
  return (
    <div className={cn("shrink-0 flex items-center justify-center rounded-full font-bold text-white", sz, avatarColor(userId))}>
      {initials(firstName, lastName)}
    </div>
  );
}

// ── Rich message body renderer ────────────────────────────────────────────────

const IS_IMAGE_URL = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
const IMG_MD = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/;
const FILE_MD = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;
const URL_SPLIT = /(https?:\/\/[^\s<>"']+)/g;

function RenderLine({ line, isMe }: { line: string; isMe: boolean }) {
  const img = line.match(IMG_MD);
  if (img) return (
    <a href={img[2]} target="_blank" rel="noopener noreferrer" className="block mt-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img[2]} alt={img[1] || "image"} className="rounded-lg max-h-56 max-w-[280px] object-cover" />
    </a>
  );

  const file = line.match(FILE_MD);
  if (file) return (
    <a href={file[2]} target="_blank" rel="noopener noreferrer"
      className={cn("flex items-center gap-2 px-3 py-2 rounded-lg mt-1 transition-colors text-sm",
        isMe ? "bg-white/15 hover:bg-white/25" : "bg-black/8 hover:bg-black/14")}>
      <FileText className="h-4 w-4 shrink-0 opacity-80" />
      <span className="truncate font-medium flex-1">{file[1]}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </a>
  );

  const parts = line.split(URL_SPLIT);
  if (parts.length === 1) return <>{line}</>;

  return (
    <>
      {parts.map((part, i) => {
        if (!part.match(/^https?:\/\//)) return <span key={i}>{part}</span>;
        if (IS_IMAGE_URL.test(part)) return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="block mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={part} alt="image" className="rounded-lg max-h-56 max-w-[280px] object-cover" />
          </a>
        );
        let display = part;
        try { const u = new URL(part); display = u.hostname + (u.pathname !== "/" ? u.pathname : ""); } catch {}
        if (display.length > 45) display = display.slice(0, 45) + "…";
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className={cn("inline-flex items-center gap-0.5 underline underline-offset-2 break-all",
              isMe ? "text-blue-100 hover:text-white" : "text-primary hover:text-primary/80")}>
            {display}<ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        );
      })}
    </>
  );
}

function MessageBody({ body, isMe }: { body: string; isMe: boolean }) {
  const lines = body.split("\n");
  return (
    <span className="break-words whitespace-pre-wrap">
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          <RenderLine line={line} isMe={isMe} />
        </span>
      ))}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { boardId: string; currentUserId: string }

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
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [unread, setUnread] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const latestAt = useRef<string | null>(null);
  const activePartnerRef = useRef<Member | null>(null);
  const openRef = useRef(false);

  useEffect(() => { activePartnerRef.current = activePartner; }, [activePartner]);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    if (messages.length) latestAt.current = messages[messages.length - 1].createdAt;
  }, [messages]);

  // ── File upload ────────────────────────────────────────────────────────────

  const { startUpload, isUploading } = useUploadThing("chatFile", {
    onClientUploadComplete: (res) => {
      const f = res[0];
      const isImage = (f.type ?? "").startsWith("image/") || IS_IMAGE_URL.test(f.name);
      setPendingFile({ url: f.ufsUrl, name: f.name, type: f.type ?? "", isImage });
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    onUploadError: (err) => { toast.error(`Upload failed: ${err.message}`); },
  });

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchMembers = useCallback(async () => {
    try {
      const r = await fetch(`/api/board/${boardId}/chat/members`);
      if (!r.ok) return;
      const d: { members: Member[] } = await r.json();
      setMembers(d.members);
    } catch { /* ignore */ }
  }, [boardId]);

  const fetchConversation = useCallback(async (partnerId: string) => {
    setLoadingMessages(true);
    latestAt.current = null;
    try {
      const r = await fetch(`/api/board/${boardId}/chat?partner=${partnerId}`);
      if (!r.ok) return;
      const d: { messages: DmMessage[] } = await r.json();
      setMessages(d.messages);
    } catch { /* ignore */ }
    finally { setLoadingMessages(false); }
  }, [boardId]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open && !members.length) {
      setLoadingMembers(true);
      fetchMembers().finally(() => setLoadingMembers(false));
    }
  }, [open, members.length, fetchMembers]);

  useEffect(() => {
    const id = setInterval(() => { if (openRef.current) fetchMembers(); }, 5000);
    return () => clearInterval(id);
  }, [fetchMembers]);

  useEffect(() => {
    const poll = async () => {
      const p = activePartnerRef.current;
      if (!p || !latestAt.current) return;
      try {
        const r = await fetch(`/api/board/${boardId}/chat?partner=${p.userId}&since=${encodeURIComponent(latestAt.current)}`);
        if (!r.ok) return;
        const d: { messages: DmMessage[] } = await r.json();
        if (!d.messages.length) return;
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const fresh = d.messages.filter(m => !ids.has(m.id));
          if (!fresh.length) return prev;
          if (!openRef.current) setUnread(c => c + fresh.filter(m => m.fromUserId !== currentUserId).length);
          return [...prev, ...fresh];
        });
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [boardId, currentUserId]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [messages]);

  useEffect(() => {
    if (activePartner) setTimeout(() => inputRef.current?.focus(), 120);
  }, [activePartner]);

  useEffect(() => {
    if (open) { setUnread(0); }
  }, [open]);

  useEffect(() => {
    if (linkMode) setTimeout(() => linkInputRef.current?.focus(), 50);
  }, [linkMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openRef.current) {
        if (linkMode) { setLinkMode(false); return; }
        if (activePartnerRef.current) { setActivePartner(null); return; }
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linkMode]);

  // ── Actions ────────────────────────────────────────────────────────────────

  function selectPartner(m: Member) {
    setActivePartner(m);
    setMessages([]);
    setInput("");
    setPendingFile(null);
    setLinkMode(false);
    fetchConversation(m.userId);
  }

  async function sendMessage() {
    if (sending || !activePartner) return;
    const text = input.trim();
    if (!text && !pendingFile) return;

    let body = text;
    if (pendingFile) {
      const md = pendingFile.isImage
        ? `![${pendingFile.name}](${pendingFile.url})`
        : `[${pendingFile.name}](${pendingFile.url})`;
      body = text ? `${text}\n${md}` : md;
    }

    setSending(true);
    setInput("");
    setPendingFile(null);
    setLinkMode(false);

    try {
      const r = await fetch(`/api/board/${boardId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: activePartner.userId, body }),
      });
      if (!r.ok) { setInput(text); return; }
      const d: { message: DmMessage } = await r.json();
      setMessages(prev => prev.some(m => m.id === d.message.id) ? prev : [...prev, d.message]);
      setMembers(prev => prev.map(m =>
        m.userId === activePartner.userId
          ? { ...m, lastMessage: { body, createdAt: d.message.createdAt, fromMe: true } }
          : m
      ));
    } catch { setInput(text); }
    finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function insertLink() {
    const url = linkUrl.trim();
    if (!url) { setLinkMode(false); return; }
    const formatted = /^https?:\/\//.test(url) ? url : `https://${url}`;
    const ta = inputRef.current;
    if (ta) {
      const s = ta.selectionStart ?? input.length;
      const before = input.slice(0, s);
      const after = input.slice(s);
      const sep = before && !before.endsWith("\n") && !before.endsWith(" ") ? " " : "";
      setInput(`${before}${sep}${formatted}${after}`);
    } else {
      setInput(p => p ? `${p} ${formatted}` : formatted);
    }
    setLinkUrl("");
    setLinkMode(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function onTextKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? members.filter(m => fullName(m).toLowerCase().includes(search.toLowerCase()))
    : members;

  type Group = { fromUserId: string; firstName: string; lastName: string; messages: DmMessage[]; date: string };
  const groups: Group[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const date = new Date(msg.createdAt).toDateString();
    if (last && last.fromUserId === msg.fromUserId && last.date === date) {
      last.messages.push(msg);
    } else {
      groups.push({ fromUserId: msg.fromUserId, firstName: msg.firstName, lastName: msg.lastName, messages: [msg], date });
    }
  }

  const canSend = !sending && !isUploading && (!!input.trim() || !!pendingFile);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open board chat"
        className={cn(
          "fixed top-[10px] right-4 z-50 flex items-center gap-2 rounded-full",
          "border border-border/60 bg-card/90 backdrop-blur-sm px-3.5 py-2 text-sm font-medium shadow-md",
          "hover:bg-muted hover:shadow-lg transition-all duration-200",
          open ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"
        )}
      >
        <MessageSquare className="h-4 w-4 text-primary" />
        <span>Chat</span>
        {unread > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* ── Backdrop ────────────────────────────────────────────────────── */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* ── Dialog ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
          "flex overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl",
          "transition-all duration-200",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ width: "min(900px, 95vw)", height: "min(680px, 90vh)" }}
      >
        {/* ── Left: contacts ────────────────────────────────────────────── */}
        <div className="flex flex-col border-r border-border/40 bg-background/30" style={{ width: 260, minWidth: 260 }}>
          {/* Header */}
          <div className="px-4 pt-5 pb-3 shrink-0">
            <h2 className="font-heading font-bold text-base">Messages</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {members.length} board member{members.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Search */}
          <div className="px-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full h-8 rounded-lg border border-input bg-background/60 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
              />
            </div>
          </div>

          {/* Member list */}
          <div className="flex-1 overflow-y-auto">
            {loadingMembers && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loadingMembers && filtered.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-10 px-4">
                {search ? "No members found." : "No other members on this board."}
              </p>
            )}
            {filtered.map(m => {
              const active = activePartner?.userId === m.userId;
              return (
                <button
                  key={m.userId}
                  onClick={() => selectPartner(m)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 text-left transition-all border-b border-border/20",
                    active
                      ? "bg-primary/10 border-l-[3px] border-l-primary"
                      : "hover:bg-muted/40 border-l-[3px] border-l-transparent"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar userId={m.userId} firstName={m.firstName} lastName={m.lastName} size="md" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("text-xs font-semibold truncate", active && "text-primary")}>
                        {fullName(m)}
                      </span>
                      {m.lastMessage && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatPreviewTime(m.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
                      {m.lastMessage
                        ? `${m.lastMessage.fromMe ? "You: " : ""}${m.lastMessage.body.replace(/^!\[.*?\]\(.*?\)$/, "📷 Image").replace(/^\[.*?\]\(.*?\)$/, "📎 File")}`
                        : <span className="italic">No messages yet</span>}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: conversation ───────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 bg-background/20">
          {!activePartner ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center flex-1 gap-5 px-8">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <MessageSquare className="h-9 w-9 text-primary" />
                </div>
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div className="text-center">
                <p className="font-heading font-bold text-base">Pick a conversation</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[200px] leading-relaxed">
                  Select a board member on the left to send them a message.
                </p>
              </div>
              {/* Close button for empty state */}
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40 bg-background/30 backdrop-blur-sm shrink-0">
                <div className="relative">
                  <Avatar userId={activePartner.userId} firstName={activePartner.firstName} lastName={activePartner.lastName} size="md" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{fullName(activePartner)}</p>
                  <p className="text-[11px] text-emerald-500 font-medium">Active now</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50 ml-auto"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                {loadingMessages && (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!loadingMessages && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mt-1">No messages yet</p>
                    <p className="text-xs text-muted-foreground">
                      Send the first message to {activePartner.firstName}.
                    </p>
                  </div>
                )}

                {(() => {
                  const rendered: React.ReactNode[] = [];
                  let lastDate = "";
                  for (const group of groups) {
                    const d = dateDivider(group.messages[0].createdAt);
                    if (d !== lastDate) {
                      lastDate = d;
                      rendered.push(
                        <div key={`divider-${d}`} className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-border/40" />
                          <span className="text-[11px] font-medium text-muted-foreground px-2">{d}</span>
                          <div className="flex-1 h-px bg-border/40" />
                        </div>
                      );
                    }

                    const isMe = group.fromUserId === currentUserId;
                    rendered.push(
                      <div key={group.messages[0].id} className={cn("flex gap-2.5 mb-3", isMe ? "flex-row-reverse" : "flex-row")}>
                        {!isMe && (
                          <Avatar userId={group.fromUserId} firstName={group.firstName} lastName={group.lastName} size="sm" />
                        )}
                        <div className={cn("flex flex-col gap-0.5 max-w-[68%]", isMe && "items-end")}>
                          {!isMe && (
                            <span className="text-[11px] font-semibold text-foreground/60 px-1 mb-0.5">
                              {group.firstName}
                            </span>
                          )}
                          {group.messages.map((msg, mi) => (
                            <div key={msg.id} className="group/msg relative">
                              <div className={cn(
                                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                                isMe
                                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                                  : "bg-muted/80 text-foreground rounded-tl-sm border border-border/30",
                                mi > 0 && isMe && "rounded-tr-2xl",
                                mi > 0 && !isMe && "rounded-tl-2xl",
                              )}>
                                <MessageBody body={msg.body} isMe={isMe} />
                              </div>
                              {mi === group.messages.length - 1 && (
                                <span className={cn(
                                  "absolute -bottom-4 text-[10px] text-muted-foreground whitespace-nowrap",
                                  "opacity-0 group-hover/msg:opacity-100 transition-opacity pointer-events-none",
                                  isMe ? "right-1" : "left-1"
                                )}>
                                  {formatBubbleTime(msg.createdAt)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return rendered;
                })()}

                <div ref={bottomRef} className="h-6" />
              </div>

              {/* ── Composer ──────────────────────────────────────────── */}
              <div className="shrink-0 px-4 pb-4 pt-2">
                <div className={cn(
                  "rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm overflow-hidden",
                  "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all"
                )}>
                  {/* Pending file preview */}
                  {pendingFile && (
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                      <div className={cn(
                        "flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg text-xs font-medium flex-1 min-w-0",
                        "bg-primary/10 text-primary border border-primary/20"
                      )}>
                        {pendingFile.isImage
                          ? <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                          : <FileText className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate flex-1">{pendingFile.name}</span>
                        <button
                          onClick={() => setPendingFile(null)}
                          className="shrink-0 ml-1 text-primary/60 hover:text-primary rounded p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Link insert bar */}
                  {linkMode && (
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        ref={linkInputRef}
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        placeholder="Paste or type a URL…"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.preventDefault(); insertLink(); }
                          if (e.key === "Escape") { setLinkMode(false); setLinkUrl(""); }
                        }}
                      />
                      <button
                        onClick={insertLink}
                        className="shrink-0 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded hover:bg-primary/10"
                      >
                        Insert
                      </button>
                      <button
                        onClick={() => { setLinkMode(false); setLinkUrl(""); }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); autoResize(e.target); }}
                    onKeyDown={onTextKeyDown}
                    placeholder={`Message ${activePartner.firstName}…`}
                    rows={1}
                    disabled={sending}
                    className={cn(
                      "w-full resize-none bg-transparent px-3.5 pt-3 pb-2 text-sm",
                      "placeholder:text-muted-foreground focus:outline-none",
                      "disabled:opacity-50 leading-relaxed"
                    )}
                    style={{ minHeight: 44, maxHeight: 160 }}
                  />

                  {/* Action bar */}
                  <div className="flex items-center gap-1 px-2 pb-2 pt-1 border-t border-border/30">
                    {/* File attach */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      title="Attach file or image"
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-40"
                      )}
                    >
                      {isUploading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Paperclip className="h-3.5 w-3.5" />}
                      <span>{isUploading ? "Uploading…" : "Attach"}</span>
                    </button>

                    {/* Link insert */}
                    <button
                      onClick={() => setLinkMode(v => !v)}
                      title="Insert link"
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        linkMode
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Link</span>
                    </button>

                    <div className="flex-1" />

                    <span className="text-[10px] text-muted-foreground mr-2 hidden sm:block">
                      Enter to send · Shift+Enter new line
                    </span>

                    {/* Send */}
                    <button
                      onClick={sendMessage}
                      disabled={!canSend}
                      className={cn(
                        "flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        canSend
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={e => {
          const files = e.target.files;
          if (files?.length) startUpload(Array.from(files));
          e.target.value = "";
        }}
      />
    </>
  );
}
