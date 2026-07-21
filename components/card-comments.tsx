"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { Loader2, Trash2, Send, ArrowRight, Search, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment, editComment } from "@/app/actions/comment";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CommentWithUser, MemberForMention } from "@/app/actions/comment";

// ── Avatar (image with deterministic-colour initials fallback) ──────────────

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-orange-500",
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function MemberAvatar({
  userId, name, avatarUrl, className,
}: { userId: string; name: string; avatarUrl?: string | null; className?: string }) {
  const base = cn(
    "shrink-0 flex items-center justify-center rounded-full text-white font-bold overflow-hidden",
    className
  );
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={name} className={cn(base, "object-cover")} />
    );
  }
  return (
    <span className={cn(base, avatarColor(userId))}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEdited(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Highlight a search term inside a plain-text segment.
function highlightSegment(text: string, query: string, keyPrefix: string) {
  const q = query.trim();
  if (!q) return <span key={keyPrefix}>{text}</span>;
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const segs = text.split(re);
  return (
    <span key={keyPrefix}>
      {segs.map((seg, j) =>
        seg && q && seg.toLowerCase() === q.toLowerCase() ? (
          <mark key={j} className="rounded bg-yellow-300/60 dark:bg-yellow-400/30 px-0.5 text-inherit">
            {seg}
          </mark>
        ) : (
          <span key={j}>{seg}</span>
        )
      )}
    </span>
  );
}

// Render a comment body: highlight @mentions, and optionally a search query.
function renderBody(text: string, query = "") {
  const parts = text.split(/(@[A-Za-z]\w*)/g);
  return parts.map((part, i) =>
    /^@[A-Za-z]\w*$/.test(part) ? (
      <span key={i} className="inline-flex items-center bg-primary/15 text-primary font-semibold px-1.5 py-0.5 rounded-md text-[0.85em] hover:bg-primary/25 transition-colors cursor-default">
        {part}
      </span>
    ) : (
      highlightSegment(part, query, `s${i}`)
    )
  );
}

interface CardCommentsProps {
  cardId: string;
  currentUserId: string;
  initialComments: CommentWithUser[];
  workspaceMembers: MemberForMention[];
  boardLabelMap?: Record<string, string>;
}

export function CardComments({
  cardId,
  currentUserId,
  initialComments,
  workspaceMembers,
  boardLabelMap,
}: CardCommentsProps) {
  const [commentList, setCommentList] = useState<CommentWithUser[]>(initialComments);
  const [body, setBody] = useState("");
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
  const [mentionState, setMentionState] = useState<{ search: string; atIndex: number } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Search state
  const [search, setSearch] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const query = search.trim().toLowerCase();

  // Comments that match the search (system rows excluded from search)
  const visibleComments = useMemo(() => {
    if (!query) return commentList;
    return commentList.filter(
      (c) => !c.isSystem && c.body.toLowerCase().includes(query)
    );
  }, [commentList, query]);

  const matchCount = query ? visibleComments.length : 0;

  // Scroll the first match into view when the query changes
  useEffect(() => {
    if (query && threadRef.current) {
      threadRef.current.scrollTop = 0;
    }
  }, [query]);

  const filteredMembers =
    mentionState !== null
      ? workspaceMembers
          .filter((m) => {
            const q = mentionState.search.toLowerCase();
            return (
              m.firstName.toLowerCase().startsWith(q) ||
              m.lastName.toLowerCase().startsWith(q)
            );
          })
          .slice(0, 5)
      : [];

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setBody(val);

    const pos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, pos);
    const match = textBeforeCursor.match(/(^|[\s\n])@(\w*)$/);
    if (match) {
      const atIndex = textBeforeCursor.lastIndexOf("@");
      setMentionState({ search: match[2], atIndex });
      setHighlightedIndex(0);
    } else {
      setMentionState(null);
    }
  }

  function selectMember(member: MemberForMention) {
    if (!textareaRef.current || mentionState === null) return;
    const cursorPos = textareaRef.current.selectionStart ?? body.length;
    const before = body.slice(0, mentionState.atIndex);
    const after = body.slice(cursorPos);
    const mentionName = boardLabelMap?.[member.userId] ?? member.firstName;
    const insertion = `@${mentionName} `;
    setBody(before + insertion + after);
    setMentionedIds((prev) => new Set([...prev, member.userId]));
    setMentionState(null);
    setHighlightedIndex(0);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const newPos = before.length + insertion.length;
      textareaRef.current.setSelectionRange(newPos, newPos);
      textareaRef.current.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionState !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filteredMembers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        selectMember(filteredMembers[highlightedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionState(null);
        return;
      }
    }

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    startSubmit(async () => {
      const result = await addComment(cardId, {
        body: trimmed,
        mentionedUserIds: [...mentionedIds],
      });
      if (!result.success) { toast.error(result.error); return; }
      setCommentList((prev) => [
        {
          id: result.commentId!,
          body: trimmed,
          createdAt: new Date(),
          editedAt: null,
          userId: currentUserId,
          firstName: "You",
          lastName: "",
          avatarUrl: null,
          isSystem: false,
        },
        ...prev,
      ]);
      setBody("");
      setMentionedIds(new Set());
      setMentionState(null);
    });
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteComment(id);
    setDeletingId(null);
    if (!result.success) { toast.error(result.error); return; }
    setCommentList((prev) => prev.filter((c) => c.id !== id));
  }

  function startEdit(comment: CommentWithUser) {
    setEditingId(comment.id);
    setEditDraft(comment.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(id: string) {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    const result = await editComment(id, trimmed);
    setSavingEdit(false);
    if (!result.success) { toast.error(result.error); return; }
    const now = new Date();
    setCommentList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, body: trimmed, editedAt: now } : c))
    );
    setEditingId(null);
    setEditDraft("");
    toast.success("Comment updated.");
  }

  const nonSystemCount = commentList.filter((c) => !c.isSystem).length;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Comments ({nonSystemCount})
      </h3>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search comments…"
          className="w-full h-8 rounded-lg border border-input bg-background pl-8 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear comment search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {query && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          {matchCount === 0 ? "No matching comments." : `${matchCount} matching comment${matchCount === 1 ? "" : "s"}.`}
        </p>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          {/* Mention dropdown */}
          {mentionState !== null && filteredMembers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-20 rounded-xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-xl ring-1 ring-foreground/5 overflow-hidden">
              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tag a member
                </span>
                <span className="text-[10px] text-muted-foreground/70">↑↓ to navigate · ↵ to select</span>
              </div>
              <div className="max-h-56 overflow-y-auto pb-1">
                {filteredMembers.map((m, i) => {
                  const label = boardLabelMap?.[m.userId] ?? `${m.firstName} ${m.lastName}`.trim();
                  const active = i === highlightedIndex;
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onMouseDown={(e) => { e.preventDefault(); selectMember(m); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 mx-1 rounded-lg text-sm text-left transition-colors",
                        active ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                      style={{ width: "calc(100% - 0.5rem)" }}
                    >
                      <MemberAvatar
                        userId={m.userId}
                        name={m.firstName}
                        avatarUrl={m.avatarUrl}
                        className="h-8 w-8 text-xs ring-2 ring-background"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium truncate leading-tight", active && "text-primary")}>
                          {label}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate leading-tight">
                          {`${m.firstName} ${m.lastName}`.trim()}
                        </p>
                      </div>
                      {active && (
                        <span className="text-[10px] font-semibold text-primary shrink-0">Tag</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment… (type @ to mention someone)"
            rows={1}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground min-h-[4rem] transition-[height]"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">⌘ + Enter to submit</p>
          <Button type="submit" size="sm" disabled={submitting || !body.trim()} className="gap-1.5">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Comment
          </Button>
        </div>
      </form>

      {/* Thread — newest first */}
      {visibleComments.length > 0 && (
        <div ref={threadRef} className="space-y-2">
          {visibleComments.map((comment) =>
            comment.isSystem ? (
              // Activity row
              <div key={comment.id} className="flex items-start gap-2 py-1 px-1">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted border border-border mt-0.5">
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {comment.body}
                  <span className="ml-1.5 text-[10px] opacity-60">{timeAgo(comment.createdAt)}</span>
                </p>
              </div>
            ) : (
              // Regular comment bubble
              <div key={comment.id} className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MemberAvatar
                    userId={comment.userId}
                    name={comment.firstName}
                    avatarUrl={comment.avatarUrl}
                    className="h-6 w-6 text-[10px]"
                  />
                  <span className="text-xs font-semibold">
                    {boardLabelMap?.[comment.userId] ?? `${comment.firstName} ${comment.lastName}`.trim()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(comment.createdAt)}
                  </span>
                  {comment.userId === currentUserId && editingId !== comment.id && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        onClick={() => startEdit(comment)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Edit comment"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete comment"
                      >
                        {deletingId === comment.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="space-y-2 pl-8">
                    <textarea
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/50"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") cancelEdit();
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(comment.id);
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(comment.id)}
                        disabled={savingEdit || !editDraft.trim()}
                        className="h-7 gap-1.5 text-xs"
                      >
                        {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 text-xs">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words pl-8">
                      {renderBody(comment.body, query)}
                    </p>
                    {comment.editedAt && (
                      <p className="pl-8 text-[10px] text-muted-foreground/70 italic">
                        Edited on {formatEdited(comment.editedAt)}
                      </p>
                    )}
                  </>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
