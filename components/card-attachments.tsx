"use client";

import { useState } from "react";
import {
  FileText, Trash2, Loader2, Paperclip, MoreHorizontal, Pencil, Check, X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { saveAttachment, deleteAttachment, renameAttachment } from "@/app/actions/attachment";
import { UploadButton } from "@/lib/uploadthing";
import { validateVideoFile } from "@/lib/video";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { AttachmentWithUploader } from "@/app/actions/attachment";

const INITIAL_VISIBLE = 5;

function attachmentType(mime: string): "image" | "video" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CardAttachmentsProps {
  cardId: string;
  currentUserId: string;
  initialAttachments: AttachmentWithUploader[];
}

export function CardAttachments({
  cardId,
  currentUserId,
  initialAttachments,
}: CardAttachmentsProps) {
  const [attachmentList, setAttachmentList] = useState<AttachmentWithUploader[]>(initialAttachments);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const visible = showAll ? attachmentList : attachmentList.slice(0, INITIAL_VISIBLE);
  const hiddenCount = attachmentList.length - INITIAL_VISIBLE;

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteAttachment(id);
    setDeletingId(null);
    if (!result.success) { toast.error(result.error); return; }
    setAttachmentList((prev) => prev.filter((a) => a.id !== id));
    toast.success("Attachment removed.");
  }

  function startRename(att: AttachmentWithUploader) {
    setEditingId(att.id);
    setEditName(att.fileName);
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    const current = attachmentList.find((a) => a.id === id);
    if (current && name === current.fileName) { setEditingId(null); return; }
    setSavingRename(true);
    const result = await renameAttachment(id, name);
    setSavingRename(false);
    if (!result.success) { toast.error(result.error); return; }
    setAttachmentList((prev) => prev.map((a) => (a.id === id ? { ...a, fileName: name } : a)));
    setEditingId(null);
    toast.success("Renamed.");
  }

  // Filename (link, or inline edit) + meta + a three-dot owner menu — shared
  // between the video and image/document layouts.
  function nameAndActions(att: AttachmentWithUploader) {
    const isOwner = att.uploadedByUserId === currentUserId;
    return (
      <>
        <div className="flex-1 min-w-0">
          {editingId === att.id ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={savingRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveRename(att.id); }
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 min-w-0 h-7 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
              <button
                onClick={() => saveRename(att.id)}
                disabled={savingRename}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                aria-label="Save name"
              >
                {savingRename ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Cancel rename"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:text-primary transition-colors truncate block"
              >
                {att.fileName}
              </a>
              <p className="text-[10px] text-muted-foreground">
                {formatBytes(att.size)} · by {att.uploaderFirstName}
              </p>
            </>
          )}
        </div>

        {isOwner && editingId !== att.id && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[popup-open]:bg-muted"
              aria-label="Attachment options"
            >
              {deletingId === att.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <MoreHorizontal className="h-4 w-4" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => startRename(att)}>
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(att.id)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3 w-3" />
          Attachments ({attachmentList.length})
        </h3>
        <UploadButton
          endpoint="cardAttachment"
          appearance={{
            button: "ut-ready:bg-primary ut-ready:text-primary-foreground ut-uploading:bg-primary/70 text-xs h-7 px-3 rounded-lg font-medium",
            allowedContent: "hidden",
          }}
          onBeforeUploadBegin={(files) => {
            const allowed: File[] = [];
            for (const file of files) {
              const err = validateVideoFile(file);
              if (err) { toast.error(err); continue; }
              allowed.push(file);
            }
            return allowed;
          }}
          onClientUploadComplete={async (files) => {
            for (const file of files) {
              const result = await saveAttachment(cardId, {
                url: file.ufsUrl,
                name: file.name,
                size: file.size,
                type: file.type,
              });
              if (!result.success) { toast.error(result.error); continue; }
              setAttachmentList((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  url: file.ufsUrl,
                  type: attachmentType(file.type),
                  fileName: file.name,
                  size: file.size,
                  createdAt: new Date(),
                  uploadedByUserId: currentUserId,
                  uploaderFirstName: "You",
                },
              ]);
            }
            // Reveal newly uploaded items even if the list was collapsed.
            setShowAll(true);
            toast.success("Uploaded!");
          }}
          onUploadError={(err) => { toast.error(err.message); }}
        />
      </div>

      {attachmentList.length === 0 && (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      )}

      <div className="space-y-2">
        {visible.map((att) =>
          att.type === "video" ? (
            <div
              key={att.id}
              className="rounded-lg border border-border/50 bg-background p-2 space-y-2"
            >
              <video
                src={att.url}
                controls
                preload="metadata"
                className="w-full max-h-64 rounded-md bg-black"
              />
              <div className="flex items-center gap-2">{nameAndActions(att)}</div>
            </div>
          ) : (
            <div
              key={att.id}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-2"
            >
              {att.type === "image" ? (
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <div className="h-12 w-16 rounded overflow-hidden border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.url}
                      alt={att.fileName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        (e.currentTarget.parentElement as HTMLElement).classList.add("flex", "items-center", "justify-center");
                      }}
                    />
                  </div>
                </a>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
              )}
              {nameAndActions(att)}
            </div>
          )
        )}
      </div>

      {/* Show all / show less */}
      {attachmentList.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
          {showAll ? "Show less" : `Show all attachments (${hiddenCount} more)`}
        </button>
      )}
    </div>
  );
}
