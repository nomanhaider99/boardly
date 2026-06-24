"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, Calendar, Pencil, Check, X, ImagePlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { updateCard, deleteCard } from "@/app/actions/card";
import { getCardComments, getCardWorkspaceMembers } from "@/app/actions/comment";
import { getCardAttachments } from "@/app/actions/attachment";
import { getBoardMemberLabels } from "@/app/actions/board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CardComments } from "@/components/card-comments";
import { CardAttachments } from "@/components/card-attachments";
import { useUploadThing } from "@/lib/uploadthing";
import { getUrgency, urgencyConfig } from "@/lib/due-date";
import type { Card } from "@/db/schema";
import type { CommentWithUser, MemberForMention } from "@/app/actions/comment";
import type { AttachmentWithUploader } from "@/app/actions/attachment";

type EditField = "title" | "description" | "dueDate" | null;

function renderDescription(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((part, i) => {
    if (!/^https?:\/\//.test(part)) return <span key={i}>{part}</span>;
    const url = part.replace(/[.,;:!?)'"\]>]+$/, "");
    const trailing = part.slice(url.length);
    return (
      <span key={i}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors break-all cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
        {trailing}
      </span>
    );
  });
}

interface CardDetailDialogProps {
  card: Card | null;
  boardId: string;
  currentUserId: string;
  onClose: () => void;
  onDeleted: (cardId: string) => void;
  onUpdated: (card: Card) => void;
}

export function CardDetailDialog({
  card,
  boardId,
  currentUserId,
  onClose,
  onDeleted,
  onUpdated,
}: CardDetailDialogProps) {
  const [editingField, setEditingField] = useState<EditField>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingBanner, setRemovingBanner] = useState(false);
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [attachments, setAttachments] = useState<AttachmentWithUploader[]>([]);
  const [members, setMembers] = useState<MemberForMention[]>([]);
  const [boardLabelMap, setBoardLabelMap] = useState<Record<string, string>>({});
  const [loadingExtra, setLoadingExtra] = useState(false);

  const addCoverInputRef = useRef<HTMLInputElement>(null);
  const changeCoverInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: startBannerUpload, isUploading: bannerUploading } =
    useUploadThing("cardBanner", {
      onUploadError: (err) => { toast.error(err.message); },
    });

  useEffect(() => {
    if (!card) return;
    setEditingField(null);

    setLoadingExtra(true);
    Promise.all([
      getCardComments(card.id),
      getCardAttachments(card.id),
      getCardWorkspaceMembers(card.id),
      getBoardMemberLabels(boardId),
    ])
      .then(([c, a, m, labels]) => {
        setComments(c);
        setAttachments(a);
        setMembers(m);
        setBoardLabelMap(Object.fromEntries(
          labels.filter((l) => l.boardLabel).map((l) => [l.userId, l.boardLabel!])
        ));
      })
      .catch(() => toast.error("Failed to load card details."))
      .finally(() => setLoadingExtra(false));
  }, [card?.id]);

  function isDirty() {
    if (!card || !editingField) return false;
    if (editingField === "title") return draftTitle !== card.title;
    if (editingField === "description") return draftDescription !== (card.description ?? "");
    if (editingField === "dueDate") {
      const stored = card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : "";
      return draftDueDate !== stored;
    }
    return false;
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      if (isDirty() && !window.confirm("You have unsaved changes. Close anyway?")) return;
      setEditingField(null);
      onClose();
    }
  }

  function startEdit(field: EditField) {
    if (!card || editingField === field) return;
    if (field === "title") setDraftTitle(card.title);
    if (field === "description") setDraftDescription(card.description ?? "");
    if (field === "dueDate") {
      setDraftDueDate(card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : "");
    }
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
  }

  async function saveField(field: "title" | "description" | "dueDate") {
    if (!card) return;

    const payload: Parameters<typeof updateCard>[1] = {};
    if (field === "title") {
      const t = draftTitle.trim();
      if (!t) return;
      payload.title = t;
    } else if (field === "description") {
      payload.description = draftDescription.trim() || undefined;
    } else if (field === "dueDate") {
      payload.dueDate = draftDueDate ? new Date(draftDueDate) : null;
    }

    setSaving(true);
    const result = await updateCard(card.id, payload);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Saved.");

    const updated: Card = { ...card };
    if (field === "title") updated.title = draftTitle.trim();
    if (field === "description") updated.description = draftDescription.trim() || null;
    if (field === "dueDate") updated.dueDate = draftDueDate ? new Date(draftDueDate) : null;

    onUpdated(updated);
    setEditingField(null);
  }

  async function handleBannerFile(file: File) {
    if (!card) return;
    const files = await startBannerUpload([file]);
    if (!files?.[0]) return;
    const url = files[0].ufsUrl;
    const result = await updateCard(card.id, { bannerUrl: url });
    if (!result.success) { toast.error(result.error); return; }
    onUpdated({ ...card, bannerUrl: url });
    toast.success("Cover updated.");
  }

  async function handleRemoveBanner() {
    if (!card) return;
    setRemovingBanner(true);
    const result = await updateCard(card.id, { bannerUrl: null });
    setRemovingBanner(false);
    if (!result.success) { toast.error(result.error); return; }
    onUpdated({ ...card, bannerUrl: null });
    toast.success("Cover removed.");
  }

  async function handleDelete() {
    if (!card) return;
    setDeleting(true);
    const result = await deleteCard(card.id);
    setDeleting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Card deleted.");
    onDeleted(card.id);
    onClose();
  }

  const isBannerBusy = bannerUploading || removingBanner;

  return (
    <Dialog open={!!card} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[1100px] p-0 flex flex-col max-h-[90vh] overflow-hidden gap-0"
      >
        {card && (
          <>
            {/* Hidden file inputs for banner upload */}
            <input
              ref={addCoverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBannerFile(file);
                e.target.value = "";
              }}
            />
            <input
              ref={changeCoverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBannerFile(file);
                e.target.value = "";
              }}
            />

            {/* Banner image */}
            {card.bannerUrl ? (
              <div className="relative h-40 shrink-0 group/banner">
                <Image
                  src={card.bannerUrl}
                  alt="Card cover"
                  fill
                  className="object-cover rounded-t-xl"
                  sizes="840px"
                  priority
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/banner:opacity-100 transition-opacity rounded-t-xl flex items-end justify-end gap-2 p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-black/40 border-white/30 text-white hover:bg-black/60 hover:text-white gap-1.5"
                    onClick={() => changeCoverInputRef.current?.click()}
                    disabled={isBannerBusy}
                  >
                    {bannerUploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Change
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-black/40 border-white/30 text-white hover:bg-black/60 hover:text-white gap-1.5"
                    onClick={handleRemoveBanner}
                    disabled={isBannerBusy}
                  >
                    {removingBanner ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    Remove
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Sticky header — title + actions */}
            <div className="flex items-start gap-3 border-b border-border px-6 py-4 shrink-0">
              <div className="flex-1 min-w-0">
                {editingField === "title" ? (
                  <div className="space-y-2">
                    <Input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="text-base font-semibold font-heading"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveField("title");
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveField("title")}
                        disabled={saving || !draftTitle.trim()}
                        className="gap-1.5"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="group flex items-center gap-2 text-left w-full rounded px-1 -mx-1 py-0.5 hover:bg-muted/40 transition-colors"
                    onClick={() => startEdit("title")}
                    aria-label="Edit title"
                  >
                    <h2 className="font-heading font-semibold text-base leading-snug">
                      {card.title}
                    </h2>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!card.bannerUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => addCoverInputRef.current?.click()}
                    disabled={isBannerBusy}
                    aria-label="Add cover image"
                  >
                    {bannerUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    Add cover
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenChange(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Left column: description, due date, attachments */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-w-0">

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Description
                  </Label>
                  {editingField === "description" ? (
                    <div className="space-y-2">
                      <textarea
                        autoFocus
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        rows={4}
                        placeholder="Add a description…"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveField("description")}
                          disabled={saving}
                          className="gap-1.5"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      className="group flex items-start gap-2 text-left w-full rounded px-2 -mx-2 py-1.5 hover:bg-muted/40 transition-colors min-h-10 cursor-pointer"
                      onClick={() => startEdit("description")}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startEdit("description"); }}
                      aria-label="Edit description"
                    >
                      {card.description ? (
                        <p className="text-sm whitespace-pre-wrap flex-1 leading-relaxed">
                          {renderDescription(card.description)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic flex-1">
                          No description. Click to add one.
                        </p>
                      )}
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>

                {/* Due date */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Due date
                  </Label>
                  {editingField === "dueDate" ? (
                    <div className="space-y-2">
                      <Input
                        autoFocus
                        type="date"
                        value={draftDueDate}
                        onChange={(e) => setDraftDueDate(e.target.value)}
                        className="max-w-[200px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveField("dueDate")}
                          disabled={saving}
                          className="gap-1.5"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="group flex items-center gap-2 flex-wrap text-left rounded px-2 -mx-2 py-1.5 hover:bg-muted/40 transition-colors"
                      onClick={() => startEdit("dueDate")}
                      aria-label="Edit due date"
                    >
                      {card.dueDate ? (
                        <>
                          {(() => {
                            const urgency = getUrgency(new Date(card.dueDate));
                            return urgency !== "none" ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${urgencyConfig[urgency].pill}`}>
                                {urgencyConfig[urgency].label}
                              </span>
                            ) : null;
                          })()}
                          <span className="text-sm">
                            {new Date(card.dueDate).toLocaleDateString("en-US", {
                              weekday: "short",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          No due date. Click to set one.
                        </span>
                      )}
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                {/* Attachments */}
                {loadingExtra ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <CardAttachments
                    cardId={card.id}
                    currentUserId={currentUserId}
                    initialAttachments={attachments}
                  />
                )}
              </div>

              {/* Right column: comments */}
              <div className="w-[440px] shrink-0 border-l border-border/40 overflow-y-auto px-5 py-5">
                {loadingExtra ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <CardComments
                    cardId={card.id}
                    currentUserId={currentUserId}
                    initialComments={comments}
                    workspaceMembers={members}
                    boardLabelMap={boardLabelMap}
                  />
                )}
              </div>
            </div>

            {/* Sticky footer */}
            <div className="border-t border-border px-6 py-3 shrink-0">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="gap-1.5"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete card
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
