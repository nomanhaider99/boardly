"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment } from "@/app/actions/comment";
import { Button } from "@/components/ui/button";
import type { CommentWithUser } from "@/app/actions/comment";

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface CardCommentsProps {
  cardId: string;
  currentUserId: string;
  initialComments: CommentWithUser[];
}

export function CardComments({ cardId, currentUserId, initialComments }: CardCommentsProps) {
  const [commentList, setCommentList] = useState<CommentWithUser[]>(initialComments);
  const [body, setBody] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const fd = new FormData();
    fd.append("body", body.trim());

    startSubmit(async () => {
      const result = await addComment(cardId, fd);
      if (!result.success) { toast.error(result.error); return; }
      // Optimistic add
      setCommentList((prev) => [
        ...prev,
        {
          id: result.commentId!,
          body: body.trim(),
          createdAt: new Date(),
          userId: currentUserId,
          firstName: "You",
          lastName: "",
        },
      ]);
      setBody("");
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

      {/* Thread */}
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
                    {comment.firstName} {comment.lastName}
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
                  {comment.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
          }}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon" disabled={submitting || !body.trim()} className="shrink-0 h-9 w-9">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      <p className="text-[10px] text-muted-foreground">⌘ + Enter to submit</p>
    </div>
  );
}
