"use client";

import { useState, useTransition, useRef } from "react";
import { Loader2, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment } from "@/app/actions/comment";
import { Button } from "@/components/ui/button";
import type { CommentWithUser, MemberForMention } from "@/app/actions/comment";

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderBody(text: string) {
  const parts = text.split(/(@[A-Za-z]\w*)/g);
  return parts.map((part, i) =>
    /^@[A-Za-z]\w*$/.test(part) ? (
      <span key={i} className="inline-flex items-center bg-primary/15 text-primary font-semibold px-1.5 py-0.5 rounded-md text-[0.85em] hover:bg-primary/25 transition-colors cursor-default">
        {part}
      </span>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          userId: currentUserId,
          firstName: "You",
          lastName: "",
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

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Comments ({commentList.length})
      </h3>

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
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
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
        <div className="space-y-3">
          {commentList.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                {comment.firstName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">
                    {boardLabelMap?.[comment.userId] ?? `${comment.firstName} ${comment.lastName}`.trim()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(comment.createdAt)}
                  </span>
                  {comment.userId === currentUserId && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete comment"
                    >
                      {deletingId === comment.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                  {renderBody(comment.body)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
