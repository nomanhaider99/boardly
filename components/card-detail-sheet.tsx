"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { updateCard, deleteCard } from "@/app/actions/card";
import { getCardComments } from "@/app/actions/comment";
import { getCardAttachments } from "@/app/actions/attachment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardComments } from "@/components/card-comments";
import { CardAttachments } from "@/components/card-attachments";
import type { Card } from "@/db/schema";
import type { CommentWithUser } from "@/app/actions/comment";
import type { AttachmentWithUploader } from "@/app/actions/attachment";

interface CardDetailSheetProps {
  card: Card | null;
  currentUserId: string;
  onClose: () => void;
  onDeleted: (cardId: string) => void;
  onUpdated: (card: Card) => void;
}

export function CardDetailSheet({
  card,
  currentUserId,
  onClose,
  onDeleted,
  onUpdated,
}: CardDetailSheetProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [attachments, setAttachments] = useState<AttachmentWithUploader[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (card) dialogRef.current?.focus();
  }, [card?.id]);

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description ?? "");
    setDueDate(card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : "");

    // Load comments + attachments
    setLoadingExtra(true);
    Promise.all([getCardComments(card.id), getCardAttachments(card.id)])
      .then(([c, a]) => { setComments(c); setAttachments(a); })
      .catch(() => toast.error("Failed to load card details."))
      .finally(() => setLoadingExtra(false));
  }, [card?.id]);

  if (!card) return null;

  async function handleSave() {
    if (!card) return;
    setSaving(true);
    const result = await updateCard(card.id, {
      title: title.trim() || card.title,
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Card updated.");
    onUpdated({
      ...card,
      title: title.trim() || card.title,
      description: description.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    });
  }

  async function handleDelete() {
    if (!card) return;
    setDeleting(true);
    const result = await deleteCard(card.id);
    setDeleting(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Card deleted.");
    onDeleted(card.id);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Card details"
        tabIndex={-1}
        className="fixed right-0 top-0 bottom-0 z-50 flex w-full sm:max-w-md flex-col bg-card border-l border-border shadow-2xl outline-none"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 className="font-heading font-semibold">Card details</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close card details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── Title / Description / Due date ── */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="card-title">Title</Label>
              <Input
                id="card-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Card title"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-desc">Description</Label>
              <textarea
                id="card-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description…"
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-due" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Due date
              </Label>
              <Input
                id="card-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/40" />

          {/* ── Attachments ── */}
          {loadingExtra ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <CardAttachments
                cardId={card.id}
                currentUserId={currentUserId}
                initialAttachments={attachments}
              />

              <div className="border-t border-border/40" />

              {/* ── Comments ── */}
              <CardComments
                cardId={card.id}
                currentUserId={currentUserId}
                initialComments={comments}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-1.5"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
