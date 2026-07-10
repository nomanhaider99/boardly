"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { Loader2, Trash2, Send, ArrowRight, Search, X, Pen, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment, updateComment } from "@/app/actions/comment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CommentWithUser, MemberForMention } from "@/app/actions/comment";

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function renderBody(text: string, searchQuery?: string) {
  const parts = text.split(/(@[A-Za-z]\w*)/g);
  return parts.map((part, i) =>
    /^@[A-Za-z]\w*$/.test(part) ? (
      <span key={i} className="inline-flex items-center bg-primary/15 text-primary font-semibold px-1.5 py-0.5 rounded-md text-[0.85em] hover:bg-primary/25 transition-colors cursor-default">
        {part}
      </span>
    ) : searchQuery ? (
      <span key={i}>{highlightText(part, searchQuery)}</span>
    ) : (
      <span key={i}>{part}</span>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editing, startEdit] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredComments = useMemo(() => {
    if (!searchQuery.trim()) return commentList;
    const q = searchQuery.toLowerCase();
    return commentList.filter(
      (c) => c.body.toLowerCase().includes(q) ||
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q)
    );
  }, [commentList, searchQuery]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

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

  function startEditing(comment: CommentWithUser) {
    setEditingId(comment.id);
    setEditBody(comment.body);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditBody("");
  }

  async function saveEdit(comment: CommentWithUser) {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === comment.body) { cancelEditing(); return; }
    startEdit(async () => {
      const result = await updateComment(comment.id, trimmed);
      if (!result.success) { toast.error(result.error); return; }
      setCommentList((prev) => prev.map((c) => c.id === comment.id ? { ...c, body: trimmed, editedAt: new Date() } : c));
      cancelEditing();
      toast.success("Comment updated");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comments ({commentList.filter((c) => !c.isSystem).length})
        </h3>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search comments…"
            className="w-full h-9 rounded-lg border border-input bg-background pl-8 pr-7 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {searchQuery && (
        <p className="text-xs text-muted-foreground">
          {filteredComments.length} of {commentList.filter((c) => !c.isSystem).length} comments match
        </p>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          {/* Mention dropdown */}
          {mentionState !== null && filteredMembers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              {filteredMembers.map((m, i) => (
                <button
                  key={m.userId}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectMember(m); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    i === highlightedIndex ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {(boardLabelMap?.[m.userId] ?? m.firstName).charAt(0).toUpperCase()}
                  </span>
                  <span>{boardLabelMap?.[m.userId] ?? `${m.firstName} ${m.lastName}`}</span>
                </button>
              ))}
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
      {commentList.length > 0 && (
        <div className="space-y-2">
          {filteredComments.map((comment) =>
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
            ) : editingId === comment.id ? (
              // Edit mode
              <div key={comment.id} className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {comment.firstName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold">
                    {boardLabelMap?.[comment.userId] ?? `${comment.firstName} ${comment.lastName}`.trim()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <Input
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(comment);
                    if (e.key === "Escape") cancelEditing();
                  }}
                  className="h-24 resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(comment)} disabled={editing}>
                    {editing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={editing}>
                    <XIcon className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // Regular comment bubble
              <div key={comment.id} className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {comment.firstName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold">
                    {boardLabelMap?.[comment.userId] ?? `${comment.firstName} ${comment.lastName}`.trim()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(comment.createdAt)}
                  </span>
                  {comment.editedAt && (
                    <span className="text-[10px] text-muted-foreground italic">
                      (edited {timeAgo(comment.editedAt)})
                    </span>
                  )}
                  {comment.userId === currentUserId && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => startEditing(comment)}
                        disabled={editingId !== null || deletingId === comment.id}
                        className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                        aria-label="Edit comment"
                      >
                        <Pen className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id || editingId !== null}
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
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words pl-8">
                  {renderBody(comment.body, searchQuery)}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
