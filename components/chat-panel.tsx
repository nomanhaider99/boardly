"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Send, X, Loader2, Search,
  Paperclip, Link2, ExternalLink, FileText, ImageIcon,
  Users, Plus, Check, ArrowLeft, UserPlus, UserMinus,
  LogOut, Crown, ChevronRight, Pencil, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

type GroupMember = {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

type ChatGroup = {
  id: string;
  name: string;
  createdByUserId: string;
  members: GroupMember[];
  memberCount: number;
  lastMessage: {
    body: string;
    createdAt: string;
    fromMe: boolean;
    fromName: string;
  } | null;
};

type DmMessage = {
  id: string;
  body: string;
  createdAt: string;
  fromUserId: string;
  toUserId: string | null;
  firstName: string;
  lastName: string;
};

type ActiveConv =
  | { type: "dm"; member: Member }
  | { type: "group"; group: ChatGroup };

type PresenceEntry = { online: boolean; lastSeenAt: string };

/** userId → last known presence. Absent = never seen on this board. */
type PresenceMap = Record<string, PresenceEntry>;

type InboxMessage = {
  id: string;
  body: string;
  createdAt: string;
  fromUserId: string;
  toUserId: string | null;
  groupId: string | null;
  groupName: string | null;
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

// Must stay comfortably under the server's PRESENCE_WINDOW_MS (60s) so a single
// dropped beat doesn't flicker someone offline.
const PRESENCE_HEARTBEAT_MS = 20_000;
const INBOX_POLL_MS = 5_000;

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

function groupSubtitle(g: ChatGroup) {
  const names = g.members.map((m) => m.firstName);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}

function previewText(body: string) {
  return body
    .replace(/^!\[.*?\]\(.*?\)$/, "📷 Image")
    .replace(/^\[.*?\]\(.*?\)$/, "📎 File");
}

/** One-line summary of a message body for the new-message toast. */
function notificationPreview(body: string) {
  const text = body
    .split("\n")
    .map((l) => previewText(l.trim()))
    .filter(Boolean)
    .join(" ");
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
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

// ── Presence ──────────────────────────────────────────────────────────────────

/** Short status line: "Active now", "Active 5m ago", "Offline". */
function presenceLabel(p: PresenceEntry | undefined) {
  if (!p) return "Offline";
  if (p.online) return "Active now";
  const s = (Date.now() - new Date(p.lastSeenAt).getTime()) / 1000;
  if (s < 3600) return `Active ${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `Active ${Math.floor(s / 3600)}h ago`;
  return `Active ${Math.floor(s / 86400)}d ago`;
}

function PresenceDot({ online, size = "md" }: { online: boolean; size?: "sm" | "md" }) {
  return (
    <span
      title={online ? "Online" : "Offline"}
      className={cn(
        "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card transition-colors",
        size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
        online ? "bg-emerald-500" : "bg-muted-foreground/40"
      )}
    />
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ userId, firstName, lastName, size = "md" }: {
  userId: string; firstName: string; lastName: string; size?: "xs" | "sm" | "md" | "lg";
}) {
  const sz =
    size === "xs" ? "h-6 w-6 text-[9px]"
    : size === "sm" ? "h-7 w-7 text-[10px]"
    : size === "lg" ? "h-11 w-11 text-sm"
    : "h-9 w-9 text-xs";
  return (
    <div className={cn("shrink-0 flex items-center justify-center rounded-full font-bold text-white", sz, avatarColor(userId))}>
      {initials(firstName, lastName)}
    </div>
  );
}

/** Avatar with a live online/offline badge in the corner. */
function PresenceAvatar({
  userId, firstName, lastName, size = "md", online,
}: {
  userId: string; firstName: string; lastName: string;
  size?: "xs" | "sm" | "md" | "lg"; online: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <Avatar userId={userId} firstName={firstName} lastName={lastName} size={size} />
      <PresenceDot online={online} size={size === "xs" || size === "sm" ? "sm" : "md"} />
    </div>
  );
}

// Group avatar: a stack of the first couple member initials over a themed disc.
function GroupAvatar({ group, size = "md" }: { group: ChatGroup; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  return (
    <div className={cn(
      "relative shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/25",
      box
    )}>
      <Users className={cn(size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]", "text-primary")} />
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
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ActiveConv | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [unread, setUnread] = useState(0);
  const [presence, setPresence] = useState<PresenceMap>({});

  // Group creation state
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  // Add-members-to-existing-group state
  const [addingMembers, setAddingMembers] = useState(false);
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [addSearch, setAddSearch] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  // Group info / manage-members state
  const [groupInfo, setGroupInfo] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [renameSaving, setRenameSaving] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const latestAt = useRef<string | null>(null);
  const activeRef = useRef<ActiveConv | null>(null);
  const openRef = useRef(false);
  // Server-clock cursor for the inbox poll; null until the first round-trip.
  const inboxCursor = useRef<string | null>(null);
  // Message ids already toasted, so a retry or overlap can't double-notify.
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => { activeRef.current = active; }, [active]);
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
    onUploadError: (err) => { toast.error("Upload failed", { description: err.message }); },
  });

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    let nextMembers: Member[] = [];
    let nextGroups: ChatGroup[] = [];
    try {
      const [mr, gr] = await Promise.all([
        fetch(`/api/board/${boardId}/chat/members`),
        fetch(`/api/board/${boardId}/chat/groups`),
      ]);
      if (mr.ok) {
        const d: { members: Member[] } = await mr.json();
        nextMembers = d.members;
        setMembers(d.members);
      }
      if (gr.ok) {
        const d: { groups: ChatGroup[] } = await gr.json();
        nextGroups = d.groups;
        setGroups(d.groups);
      }
    } catch { /* ignore */ }
    return { members: nextMembers, groups: nextGroups };
  }, [boardId]);

  const fetchConversation = useCallback(async (conv: ActiveConv) => {
    setLoadingMessages(true);
    latestAt.current = null;
    const qs = conv.type === "dm"
      ? `partner=${conv.member.userId}`
      : `group=${conv.group.id}`;
    try {
      const r = await fetch(`/api/board/${boardId}/chat?${qs}`);
      if (!r.ok) return;
      const d: { messages: DmMessage[] } = await r.json();
      setMessages(d.messages);
    } catch { /* ignore */ }
    finally { setLoadingMessages(false); }
  }, [boardId]);

  const openConversation = useCallback((conv: ActiveConv) => {
    setActive(conv);
    setCreatingGroup(false);
    setAddingMembers(false);
    setGroupInfo(false);
    setMessages([]);
    setInput("");
    setPendingFile(null);
    setLinkMode(false);
    fetchConversation(conv);
  }, [fetchConversation]);

  // ── New-message notifications ──────────────────────────────────────────────

  /** Jump straight to the thread a toast came from, loading the list if needed. */
  const openFromNotification = useCallback(async (m: InboxMessage) => {
    setOpen(true);
    const { members: ms, groups: gs } = await fetchList();
    if (m.groupId) {
      const g = gs.find(x => x.id === m.groupId);
      if (g) openConversation({ type: "group", group: g });
    } else {
      const mem = ms.find(x => x.userId === m.fromUserId);
      if (mem) openConversation({ type: "dm", member: mem });
    }
  }, [fetchList, openConversation]);

  const notifyNewMessage = useCallback((m: InboxMessage) => {
    const sender = `${m.firstName} ${m.lastName}`;
    toast(m.groupName ? `${sender} · ${m.groupName}` : sender, {
      description: notificationPreview(m.body),
      icon: <MessageSquare className="h-[18px] w-[18px] text-primary" />,
      className: "border-l-4! border-l-primary!",
      action: { label: "Open", onClick: () => openFromNotification(m) },
    });
  }, [openFromNotification]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open && !members.length && !groups.length) {
      setLoadingList(true);
      fetchList().finally(() => setLoadingList(false));
    }
  }, [open, members.length, groups.length, fetchList]);

  useEffect(() => {
    const id = setInterval(() => { if (openRef.current) fetchList(); }, 5000);
    return () => clearInterval(id);
  }, [fetchList]);

  // Presence: beat while the tab is visible, and read back everyone's status.
  // A hidden tab stops beating, so you fade to offline instead of looking
  // permanently active on a board you walked away from.
  useEffect(() => {
    let cancelled = false;

    const beat = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/board/${boardId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!r.ok || cancelled) return;
        const d: { presence: { userId: string; lastSeenAt: string; online: boolean }[] } =
          await r.json();
        const next: PresenceMap = {};
        for (const p of d.presence) {
          next[p.userId] = { online: p.online, lastSeenAt: p.lastSeenAt };
        }
        setPresence(next);
      } catch { /* ignore */ }
    };

    // Leaving the page retires the row so others see you drop off at once.
    const goOffline = () => {
      navigator.sendBeacon?.(
        `/api/board/${boardId}/presence`,
        new Blob([JSON.stringify({ offline: true })], { type: "application/json" })
      );
    };

    beat();
    const id = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("pagehide", goOffline);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("pagehide", goOffline);
      goOffline();
    };
  }, [boardId]);

  // Inbox: every message addressed to me across all conversations. Runs whether
  // or not the panel is open — that's what makes the toast a notification.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const since = inboxCursor.current;
      try {
        const r = await fetch(
          `/api/board/${boardId}/chat/inbox${since ? `?since=${encodeURIComponent(since)}` : ""}`
        );
        if (!r.ok || cancelled) return;
        const d: { messages: InboxMessage[]; now: string } = await r.json();
        inboxCursor.current = d.now;

        const fresh = d.messages.filter(m => !notified.current.has(m.id));
        if (!fresh.length) return;
        for (const m of fresh) notified.current.add(m.id);

        // Keep the sidebar previews honest even while the panel is closed.
        fetchList();

        const conv = activeRef.current;
        let missed = 0;
        for (const m of fresh) {
          const inActiveConv = !conv ? false
            : conv.type === "group"
              ? m.groupId === conv.group.id
              : !m.groupId && m.fromUserId === conv.member.userId;

          if (inActiveConv) {
            setMessages(prev => prev.some(p => p.id === m.id) ? prev : [...prev, {
              id: m.id,
              body: m.body,
              createdAt: m.createdAt,
              fromUserId: m.fromUserId,
              toUserId: m.toUserId,
              firstName: m.firstName,
              lastName: m.lastName,
            }]);
            // Already on screen — don't interrupt with a toast.
            if (openRef.current) continue;
          }

          missed++;
          notifyNewMessage(m);
        }
        if (missed) setUnread(c => c + missed);
      } catch { /* ignore */ }
    };

    poll();
    const id = setInterval(poll, INBOX_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [boardId, fetchList, notifyNewMessage]);

  useEffect(() => {
    const poll = async () => {
      const conv = activeRef.current;
      if (!conv || !latestAt.current) return;
      const qs = conv.type === "dm"
        ? `partner=${conv.member.userId}`
        : `group=${conv.group.id}`;
      try {
        const r = await fetch(`/api/board/${boardId}/chat?${qs}&since=${encodeURIComponent(latestAt.current)}`);
        if (!r.ok) return;
        const d: { messages: DmMessage[] } = await r.json();
        if (!d.messages.length) return;
        // Unread is tallied by the inbox poll, which sees every conversation.
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const fresh = d.messages.filter(m => !ids.has(m.id));
          if (!fresh.length) return prev;
          return [...prev, ...fresh];
        });
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [boardId]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [messages]);

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 120);
  }, [active]);

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
        if (addingMembers) { setAddingMembers(false); return; }
        if (groupInfo) { setGroupInfo(false); return; }
        if (creatingGroup) { setCreatingGroup(false); return; }
        if (activeRef.current) { setActive(null); return; }
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linkMode, creatingGroup, addingMembers, groupInfo]);

  // ── Actions ────────────────────────────────────────────────────────────────

  function startAddMembers() {
    setAddingMembers(true);
    setAddSelected(new Set());
    setAddSearch("");
  }

  function toggleAddSelected(userId: string) {
    setAddSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function addMembers() {
    if (!active || active.type !== "group" || addSelected.size === 0 || savingAdd) return;
    const group = active.group;
    setSavingAdd(true);
    try {
      const r = await fetch(`/api/board/${boardId}/chat/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: [...addSelected] }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error("Couldn't add members", {
          description: e.error || "Please try again.",
        });
        return;
      }
      const d: { members: GroupMember[]; memberCount: number; added: number } = await r.json();
      const updated: ChatGroup = { ...group, members: d.members, memberCount: d.memberCount };
      setActive({ type: "group", group: updated });
      setGroups(prev => prev.map(g => g.id === group.id ? updated : g));
      setAddingMembers(false);
      if (d.added > 0) {
        toast.success(`Added ${d.added} member${d.added !== 1 ? "s" : ""}`, {
          description: `They can now see and post in “${group.name}”.`,
        });
      } else {
        toast.info("No new members added", {
          description: "Everyone you picked is already in the group.",
        });
      }
    } catch {
      toast.error("Couldn't add members", { description: "Please try again." });
    } finally {
      setSavingAdd(false);
    }
  }

  async function removeMember(userId: string) {
    if (!active || active.type !== "group" || removingId) return;
    const group = active.group;
    const removed = group.members.find(m => m.userId === userId);
    setRemovingId(userId);
    try {
      const r = await fetch(
        `/api/board/${boardId}/chat/groups/${group.id}/members?userId=${userId}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error("Couldn't remove member", {
          description: e.error || "Please try again.",
        });
        return;
      }
      const d: {
        members: GroupMember[];
        memberCount: number;
        createdByUserId?: string;
      } = await r.json();
      const updated: ChatGroup = {
        ...group,
        members: d.members,
        memberCount: d.memberCount,
        createdByUserId: d.createdByUserId ?? group.createdByUserId,
      };
      setActive({ type: "group", group: updated });
      setGroups(prev => prev.map(g => g.id === group.id ? updated : g));
      toast.success("Member removed", {
        description: removed
          ? `${fullName(removed)} was removed from “${group.name}”.`
          : `Removed from “${group.name}”.`,
      });
    } catch {
      toast.error("Couldn't remove member", { description: "Please try again." });
    } finally {
      setRemovingId(null);
    }
  }

  async function leaveGroup() {
    if (!active || active.type !== "group" || leaving) return;
    const group = active.group;
    setLeaving(true);
    try {
      const r = await fetch(
        `/api/board/${boardId}/chat/groups/${group.id}/members?userId=${currentUserId}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error(e.error || "Could not leave group");
        return;
      }
      // Remove the group locally and return to the list
      setGroups(prev => prev.filter(g => g.id !== group.id));
      setGroupInfo(false);
      setActive(null);
      setMessages([]);
      toast.success("Left group", { description: `You left “${group.name}”.` });
    } catch {
      toast.error("Couldn't leave group", { description: "Please try again." });
    } finally {
      setLeaving(false);
    }
  }

  async function renameGroup(name: string): Promise<boolean> {
    if (!active || active.type !== "group" || renameSaving) return false;
    const group = active.group;
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (trimmed === group.name) return true; // no change
    setRenameSaving(true);
    try {
      const r = await fetch(`/api/board/${boardId}/chat/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error("Couldn't rename group", {
          description: e.error || "Please try again.",
        });
        return false;
      }
      const d: { group: { id: string; name: string } } = await r.json();
      const updated: ChatGroup = { ...group, name: d.group.name };
      setActive({ type: "group", group: updated });
      setGroups(prev => prev.map(g => g.id === group.id ? updated : g));
      toast.success("Group renamed", { description: `Now called “${d.group.name}”.` });
      return true;
    } catch {
      toast.error("Couldn't rename group", { description: "Please try again." });
      return false;
    } finally {
      setRenameSaving(false);
    }
  }

  async function deleteGroup() {
    if (!active || active.type !== "group" || deletingGroup) return;
    const group = active.group;
    setDeletingGroup(true);
    try {
      const r = await fetch(`/api/board/${boardId}/chat/groups/${group.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error("Couldn't delete group", {
          description: e.error || "Please try again.",
        });
        return;
      }
      setGroups(prev => prev.filter(g => g.id !== group.id));
      setGroupInfo(false);
      setActive(null);
      setMessages([]);
      toast.success("Group deleted", {
        description: `“${group.name}” and its messages were removed.`,
      });
    } catch {
      toast.error("Couldn't delete group", { description: "Please try again." });
    } finally {
      setDeletingGroup(false);
    }
  }

  function startCreateGroup() {
    setCreatingGroup(true);
    setActive(null);
    setNewGroupName("");
    setSelectedIds(new Set());
    setMemberSearch("");
  }

  function toggleSelected(userId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name || selectedIds.size === 0 || savingGroup) return;
    setSavingGroup(true);
    try {
      const r = await fetch(`/api/board/${boardId}/chat/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, memberIds: [...selectedIds] }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error("Couldn't create group", {
          description: e.error || "Please try again.",
        });
        return;
      }
      const d: { group: ChatGroup } = await r.json();
      setGroups(prev => [d.group, ...prev]);
      setCreatingGroup(false);
      openConversation({ type: "group", group: d.group });
      toast.success("Group created", {
        description: `“${d.group.name}” is ready — with ${d.group.memberCount} members.`,
      });
    } catch {
      toast.error("Couldn't create group", { description: "Please try again." });
    } finally {
      setSavingGroup(false);
    }
  }

  async function sendMessage() {
    if (sending || !active) return;
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

    const payload = active.type === "dm"
      ? { toUserId: active.member.userId, body }
      : { groupId: active.group.id, body };

    try {
      const r = await fetch(`/api/board/${boardId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { setInput(text); return; }
      const d: { message: DmMessage } = await r.json();
      setMessages(prev => prev.some(m => m.id === d.message.id) ? prev : [...prev, d.message]);
      if (active.type === "dm") {
        setMembers(prev => prev.map(m =>
          m.userId === active.member.userId
            ? { ...m, lastMessage: { body, createdAt: d.message.createdAt, fromMe: true } }
            : m
        ));
      } else {
        setGroups(prev => prev.map(g =>
          g.id === active.group.id
            ? { ...g, lastMessage: { body, createdAt: d.message.createdAt, fromMe: true, fromName: "You" } }
            : g
        ));
      }
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

  const q = search.trim().toLowerCase();
  const filteredMembers = q
    ? members.filter(m => fullName(m).toLowerCase().includes(q))
    : members;
  const filteredGroups = q
    ? groups.filter(g => g.name.toLowerCase().includes(q))
    : groups;

  const activeGroupMembers = active?.type === "group" ? active.group.members : [];
  const nameByUser: Record<string, string> = {};
  for (const gm of activeGroupMembers) nameByUser[gm.userId] = gm.firstName;

  type Grp = { fromUserId: string; firstName: string; lastName: string; messages: DmMessage[]; date: string };
  const grouped: Grp[] = [];
  for (const msg of messages) {
    const last = grouped[grouped.length - 1];
    const date = new Date(msg.createdAt).toDateString();
    if (last && last.fromUserId === msg.fromUserId && last.date === date) {
      last.messages.push(msg);
    } else {
      grouped.push({ fromUserId: msg.fromUserId, firstName: msg.firstName, lastName: msg.lastName, messages: [msg], date });
    }
  }

  const canSend = !sending && !isUploading && (!!input.trim() || !!pendingFile);

  const isOnline = (userId: string) => presence[userId]?.online ?? false;
  const onlineCount = members.filter(m => isOnline(m.userId)).length;
  const groupOnlineCount = active?.type === "group"
    ? active.group.members.filter(m => m.userId !== currentUserId && isOnline(m.userId)).length
    : 0;

  const activeTitle = active?.type === "dm"
    ? fullName(active.member)
    : active?.group.name ?? "";
  const activeSubtitle = active?.type === "group"
    ? `${active.group.memberCount} members · ${groupSubtitle(active.group)}`
    : active?.type === "dm"
      ? presenceLabel(presence[active.member.userId])
      : "";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open board chat"
        className={cn(
          "fixed bottom-6 right-44 z-50 flex items-center gap-2 rounded-full",
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
        style={{ width: "min(920px, 95vw)", height: "min(680px, 90vh)" }}
      >
        {/* ── Left: conversation list ───────────────────────────────────── */}
        <div className="flex flex-col border-r border-border/40 bg-background/40" style={{ width: 288, minWidth: 288 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
            <div>
              <h2 className="font-heading font-bold text-base leading-none">Messages</h2>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                {members.length} people · {groups.length} group{groups.length !== 1 ? "s" : ""}
                {onlineCount > 0 && (
                  <span className="flex items-center gap-1 text-emerald-500 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {onlineCount} online
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={startCreateGroup}
              title="New group"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                creatingGroup
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Group
            </button>
          </div>

          {/* Search */}
          <div className="px-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search people & groups…"
                className="w-full h-8 rounded-lg border border-input bg-background/60 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loadingList && !members.length && !groups.length && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Groups section */}
            {filteredGroups.length > 0 && (
              <div className="pt-1">
                <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Groups
                </p>
                {filteredGroups.map(g => {
                  const isActive = active?.type === "group" && active.group.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => openConversation({ type: "group", group: g })}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all border-l-[3px]",
                        isActive
                          ? "bg-primary/10 border-l-primary"
                          : "hover:bg-muted/40 border-l-transparent"
                      )}
                    >
                      <GroupAvatar group={g} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn("text-xs font-semibold truncate", isActive && "text-primary")}>
                            {g.name}
                          </span>
                          {g.lastMessage && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatPreviewTime(g.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
                          {g.lastMessage
                            ? `${g.lastMessage.fromMe ? "You" : g.lastMessage.fromName}: ${previewText(g.lastMessage.body)}`
                            : <span className="italic">{g.memberCount} members</span>}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* People section */}
            {filteredMembers.length > 0 && (
              <div className="pt-1 pb-2">
                <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Direct messages
                </p>
                {filteredMembers.map(m => {
                  const isActive = active?.type === "dm" && active.member.userId === m.userId;
                  return (
                    <button
                      key={m.userId}
                      onClick={() => openConversation({ type: "dm", member: m })}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all border-l-[3px]",
                        isActive
                          ? "bg-primary/10 border-l-primary"
                          : "hover:bg-muted/40 border-l-transparent"
                      )}
                    >
                      <PresenceAvatar
                        userId={m.userId}
                        firstName={m.firstName}
                        lastName={m.lastName}
                        size="md"
                        online={isOnline(m.userId)}
                      />
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
                        <p className="text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
                          {m.lastMessage
                            ? `${m.lastMessage.fromMe ? "You: " : ""}${previewText(m.lastMessage.body)}`
                            : <span className="italic">No messages yet</span>}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!loadingList && filteredMembers.length === 0 && filteredGroups.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-10 px-4">
                {search ? "No matches found." : "No other members on this board."}
              </p>
            )}
          </div>
        </div>

        {/* ── Right: main pane ──────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 bg-background/20">
          {creatingGroup ? (
            <GroupCreator
              members={members}
              presence={presence}
              memberSearch={memberSearch}
              setMemberSearch={setMemberSearch}
              newGroupName={newGroupName}
              setNewGroupName={setNewGroupName}
              selectedIds={selectedIds}
              toggleSelected={toggleSelected}
              saving={savingGroup}
              onCancel={() => setCreatingGroup(false)}
              onCreate={createGroup}
              onClose={() => setOpen(false)}
            />
          ) : addingMembers && active?.type === "group" ? (
            <AddMembersPane
              group={active.group}
              members={members}
              presence={presence}
              search={addSearch}
              setSearch={setAddSearch}
              selectedIds={addSelected}
              toggleSelected={toggleAddSelected}
              saving={savingAdd}
              onCancel={() => setAddingMembers(false)}
              onAdd={addMembers}
              onClose={() => setOpen(false)}
            />
          ) : groupInfo && active?.type === "group" ? (
            <GroupMembersPane
              group={active.group}
              currentUserId={currentUserId}
              presence={presence}
              removingId={removingId}
              leaving={leaving}
              renameSaving={renameSaving}
              deleting={deletingGroup}
              onRemove={removeMember}
              onLeave={leaveGroup}
              onRename={renameGroup}
              onDelete={deleteGroup}
              onAddMembers={() => { setGroupInfo(false); startAddMembers(); }}
              onBack={() => setGroupInfo(false)}
              onClose={() => setOpen(false)}
            />
          ) : !active ? (
            /* Empty state */
            <div className="relative flex flex-col items-center justify-center flex-1 gap-5 px-8">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <MessageSquare className="h-9 w-9 text-primary" />
                </div>
                {onlineCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-card" />
                )}
              </div>
              <div className="text-center">
                <p className="font-heading font-bold text-base">Your messages</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[220px] leading-relaxed">
                  {onlineCount > 0
                    ? `${onlineCount} ${onlineCount === 1 ? "person is" : "people are"} active on this board right now. Pick someone to start a direct message, or create a group.`
                    : "Pick someone to start a direct message, or create a group to chat with several members at once."}
                </p>
              </div>
              <button
                onClick={startCreateGroup}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <UserPlus className="h-4 w-4" />
                New group
              </button>
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
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40 bg-background/40 backdrop-blur-sm shrink-0">
                <button
                  onClick={() => setActive(null)}
                  className="md:hidden text-muted-foreground hover:text-foreground p-1 -ml-1"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {active.type === "dm" ? (
                  <PresenceAvatar
                    userId={active.member.userId}
                    firstName={active.member.firstName}
                    lastName={active.member.lastName}
                    size="md"
                    online={isOnline(active.member.userId)}
                  />
                ) : (
                  <GroupAvatar group={active.group} />
                )}
                {active.type === "group" ? (
                  <button
                    onClick={() => setGroupInfo(true)}
                    title="Group members"
                    className="flex-1 min-w-0 text-left group/hdr"
                  >
                    <p className="font-semibold text-sm leading-tight truncate flex items-center gap-1">
                      {activeTitle}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/hdr:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-[11px] font-medium truncate text-muted-foreground flex items-center gap-1.5">
                      <span className="truncate">{activeSubtitle}</span>
                      {groupOnlineCount > 0 && (
                        <span className="shrink-0 flex items-center gap-1 text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {groupOnlineCount} online
                        </span>
                      )}
                    </p>
                  </button>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{activeTitle}</p>
                    <p className={cn(
                      "text-[11px] font-medium truncate",
                      isOnline(active.member.userId) ? "text-emerald-500" : "text-muted-foreground"
                    )}>
                      {activeSubtitle}
                    </p>
                  </div>
                )}
                {active.type === "group" && (
                  <>
                    <div className="hidden sm:flex -space-x-2">
                      {active.group.members.slice(0, 4).map(gm => (
                        <div
                          key={gm.userId}
                          title={`${fullName(gm)} — ${presenceLabel(presence[gm.userId])}`}
                          className="relative ring-2 ring-card rounded-full"
                        >
                          <Avatar userId={gm.userId} firstName={gm.firstName} lastName={gm.lastName} size="xs" />
                          {isOnline(gm.userId) && <PresenceDot online size="sm" />}
                        </div>
                      ))}
                      {active.group.memberCount > 4 && (
                        <div className="ring-2 ring-card flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                          +{active.group.memberCount - 4}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={startAddMembers}
                      title="Add members"
                      className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Add</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
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
                      {active.type === "group"
                        ? <Users className="h-5 w-5 text-muted-foreground" />
                        : <MessageSquare className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <p className="text-sm font-medium mt-1">No messages yet</p>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      {active.type === "group"
                        ? `Say hello to the ${active.group.memberCount} members of ${active.group.name}.`
                        : `Send the first message to ${active.member.firstName}.`}
                    </p>
                  </div>
                )}

                {(() => {
                  const rendered: React.ReactNode[] = [];
                  let lastDate = "";
                  const isGroup = active.type === "group";
                  for (const group of grouped) {
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
                              {isGroup ? fullName(group) : group.firstName}
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
                    placeholder={active.type === "group"
                      ? `Message ${active.group.name}…`
                      : `Message ${active.member.firstName}…`}
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

// ── Group creation pane ─────────────────────────────────────────────────────

function GroupCreator({
  members, presence, memberSearch, setMemberSearch, newGroupName, setNewGroupName,
  selectedIds, toggleSelected, saving, onCancel, onCreate, onClose,
}: {
  members: Member[];
  presence: PresenceMap;
  memberSearch: string;
  setMemberSearch: (v: string) => void;
  newGroupName: string;
  setNewGroupName: (v: string) => void;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  saving: boolean;
  onCancel: () => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const q = memberSearch.trim().toLowerCase();
  const list = q ? members.filter(m => fullName(m).toLowerCase().includes(q)) : members;
  const selected = members.filter(m => selectedIds.has(m.userId));
  const canCreate = !!newGroupName.trim() && selectedIds.size > 0 && !saving;

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40 bg-background/40 shrink-0">
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground p-1 -ml-1 rounded-lg hover:bg-muted/50"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">New group</p>
          <p className="text-[11px] text-muted-foreground">
            {selectedIds.size} selected
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Name */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Group name
        </label>
        <input
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          placeholder="e.g. Design Team"
          maxLength={80}
          autoFocus
          className="mt-1.5 w-full h-10 rounded-lg border border-input bg-background/60 px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors"
        />
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="px-5 pb-2 shrink-0 flex flex-wrap gap-1.5">
          {selected.map(m => (
            <span
              key={m.userId}
              className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary pl-1 pr-2 py-1 text-xs font-medium"
            >
              <Avatar userId={m.userId} firstName={m.firstName} lastName={m.lastName} size="xs" />
              {m.firstName}
              <button onClick={() => toggleSelected(m.userId)} className="hover:text-primary/70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Member search */}
      <div className="px-5 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            placeholder="Add members…"
            className="w-full h-9 rounded-lg border border-input bg-background/60 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
          />
        </div>
      </div>

      {/* Member checklist */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {list.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-10">
            {members.length === 0 ? "No members on this board." : "No members found."}
          </p>
        )}
        {list.map(m => {
          const checked = selectedIds.has(m.userId);
          return (
            <button
              key={m.userId}
              onClick={() => toggleSelected(m.userId)}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors",
                checked ? "bg-primary/10" : "hover:bg-muted/40"
              )}
            >
              <PresenceAvatar
                userId={m.userId}
                firstName={m.firstName}
                lastName={m.lastName}
                size="md"
                online={!!presence[m.userId]?.online}
              />
              <span className="flex-1 min-w-0">
                <span className={cn("block text-sm font-medium truncate", checked && "text-primary")}>
                  {fullName(m)}
                </span>
                <span className={cn(
                  "block text-[11px] truncate",
                  presence[m.userId]?.online ? "text-emerald-500" : "text-muted-foreground"
                )}>
                  {presenceLabel(presence[m.userId])}
                </span>
              </span>
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md border transition-colors shrink-0",
                checked ? "bg-primary border-primary text-primary-foreground" : "border-input"
              )}>
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-border/40 bg-background/40 flex items-center gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
        <div className="flex-1" />
        <button
          onClick={onCreate}
          disabled={!canCreate}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
            canCreate
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Create group
        </button>
      </div>
    </div>
  );
}

// ── Add-members-to-existing-group pane ──────────────────────────────────────

function AddMembersPane({
  group, members, presence, search, setSearch, selectedIds, toggleSelected,
  saving, onCancel, onAdd, onClose,
}: {
  group: ChatGroup;
  members: Member[];
  presence: PresenceMap;
  search: string;
  setSearch: (v: string) => void;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  saving: boolean;
  onCancel: () => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const inGroup = new Set(group.members.map((m) => m.userId));
  const candidates = members.filter((m) => !inGroup.has(m.userId));
  const q = search.trim().toLowerCase();
  const list = q ? candidates.filter(m => fullName(m).toLowerCase().includes(q)) : candidates;
  const canAdd = selectedIds.size > 0 && !saving;

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40 bg-background/40 shrink-0">
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground p-1 -ml-1 rounded-lg hover:bg-muted/50"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">Add to {group.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {selectedIds.size} selected · {group.memberCount} in group
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pt-4 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members to add…"
            autoFocus
            className="w-full h-9 rounded-lg border border-input bg-background/60 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
          />
        </div>
      </div>

      {/* Candidate checklist */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {list.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-10 px-4">
            {candidates.length === 0
              ? "Everyone on this board is already in the group."
              : "No members found."}
          </p>
        )}
        {list.map(m => {
          const checked = selectedIds.has(m.userId);
          return (
            <button
              key={m.userId}
              onClick={() => toggleSelected(m.userId)}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors",
                checked ? "bg-primary/10" : "hover:bg-muted/40"
              )}
            >
              <PresenceAvatar
                userId={m.userId}
                firstName={m.firstName}
                lastName={m.lastName}
                size="md"
                online={!!presence[m.userId]?.online}
              />
              <span className="flex-1 min-w-0">
                <span className={cn("block text-sm font-medium truncate", checked && "text-primary")}>
                  {fullName(m)}
                </span>
                <span className={cn(
                  "block text-[11px] truncate",
                  presence[m.userId]?.online ? "text-emerald-500" : "text-muted-foreground"
                )}>
                  {presenceLabel(presence[m.userId])}
                </span>
              </span>
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md border transition-colors shrink-0",
                checked ? "bg-primary border-primary text-primary-foreground" : "border-input"
              )}>
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-border/40 bg-background/40 flex items-center gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
        <div className="flex-1" />
        <button
          onClick={onAdd}
          disabled={!canAdd}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
            canAdd
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Add{selectedIds.size > 0 ? ` ${selectedIds.size}` : ""}
        </button>
      </div>
    </div>
  );
}

// ── Group members / manage pane ─────────────────────────────────────────────

function GroupMembersPane({
  group, currentUserId, presence, removingId, leaving, renameSaving, deleting,
  onRemove, onLeave, onRename, onDelete, onAddMembers, onBack, onClose,
}: {
  group: ChatGroup;
  currentUserId: string;
  presence: PresenceMap;
  removingId: string | null;
  leaving: boolean;
  renameSaving: boolean;
  deleting: boolean;
  onRemove: (userId: string) => void;
  onLeave: () => void;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
  onAddMembers: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const isCreator = group.createdByUserId === currentUserId;
  const onlineCount = group.members.filter(
    m => m.userId !== currentUserId && presence[m.userId]?.online
  ).length;
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Creator first, then whoever's online, then everyone else alphabetically
  const sorted = [...group.members].sort((a, b) => {
    if (a.userId === group.createdByUserId) return -1;
    if (b.userId === group.createdByUserId) return 1;
    const aOn = presence[a.userId]?.online ? 1 : 0;
    const bOn = presence[b.userId]?.online ? 1 : 0;
    if (aOn !== bOn) return bOn - aOn;
    return fullName(a).localeCompare(fullName(b));
  });

  function startEdit() {
    setNameDraft(group.name);
    setEditing(true);
    setTimeout(() => nameInputRef.current?.select(), 40);
  }

  async function saveName() {
    const ok = await onRename(nameDraft);
    if (ok) setEditing(false);
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40 bg-background/40 shrink-0">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground p-1 -ml-1 rounded-lg hover:bg-muted/50"
          aria-label="Back to conversation"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">Group info</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
            {onlineCount > 0 && (
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {onlineCount} online
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Group summary */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 shrink-0">
        <GroupAvatar group={group} />
        {editing ? (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              maxLength={80}
              autoFocus
              disabled={renameSaving}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); saveName(); }
                if (e.key === "Escape") { setEditing(false); }
              }}
              className="flex-1 min-w-0 h-9 rounded-lg border border-input bg-background/60 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors disabled:opacity-50"
            />
            <button
              onClick={saveName}
              disabled={renameSaving || !nameDraft.trim()}
              className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              title="Save name"
            >
              {renameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={renameSaving}
              className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm truncate">{group.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {group.memberCount} members{isCreator ? " · you're the admin" : ""}
              </p>
            </div>
            {isCreator && (
              <button
                onClick={startEdit}
                title="Rename group"
                className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add members shortcut */}
      <button
        onClick={onAddMembers}
        className="flex items-center gap-3 px-5 py-3 border-b border-border/30 text-left hover:bg-muted/40 transition-colors shrink-0"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserPlus className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm font-semibold text-primary">Add members</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {sorted.map(m => {
          const isSelf = m.userId === currentUserId;
          const isOwner = m.userId === group.createdByUserId;
          const canRemove = isCreator && !isSelf;
          const busy = removingId === m.userId;
          return (
            <div
              key={m.userId}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <PresenceAvatar
                userId={m.userId}
                firstName={m.firstName}
                lastName={m.lastName}
                size="md"
                online={!!presence[m.userId]?.online}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {fullName(m)}
                  {isSelf && <span className="text-[10px] text-muted-foreground font-normal">(you)</span>}
                </p>
                <p className="text-[11px] font-medium flex items-center gap-1.5 truncate">
                  {isOwner && (
                    <span className="text-amber-500 flex items-center gap-1 shrink-0">
                      <Crown className="h-3 w-3" /> Creator
                    </span>
                  )}
                  {isOwner && <span className="text-muted-foreground/50">·</span>}
                  <span className={cn(
                    "truncate",
                    presence[m.userId]?.online ? "text-emerald-500" : "text-muted-foreground"
                  )}>
                    {isSelf ? "Active now" : presenceLabel(presence[m.userId])}
                  </span>
                </p>
              </div>
              {canRemove && (
                <button
                  onClick={() => onRemove(m.userId)}
                  disabled={busy}
                  title={`Remove ${m.firstName}`}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer — leave / delete group */}
      <div className="shrink-0 px-5 py-3 border-t border-border/40 bg-background/40 space-y-2">
        {confirmDelete ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-semibold text-foreground">Delete “{group.name}”?</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              This permanently removes the group and all its messages for everyone. This can&apos;t be undone.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={onLeave}
              disabled={leaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Leave group
            </button>
            {isCreator && group.memberCount > 1 && (
              <p className="text-[10px] text-muted-foreground text-center">
                As admin, leaving hands ownership to another member.
              </p>
            )}
            {isCreator && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete group
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
