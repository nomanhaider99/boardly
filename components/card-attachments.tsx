"use client";

import { useState } from "react";
import { FileText, Trash2, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { saveAttachment, deleteAttachment } from "@/app/actions/attachment";
import { UploadButton } from "@/lib/uploadthing";
import type { AttachmentWithUploader } from "@/app/actions/attachment";

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteAttachment(id);
    setDeletingId(null);
    if (!result.success) { toast.error(result.error); return; }
    setAttachmentList((prev) => prev.filter((a) => a.id !== id));
    toast.success("Attachment removed.");
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
                  type: file.type.startsWith("image/") ? "image" : "document",
                  fileName: file.name,
                  size: file.size,
                  createdAt: new Date(),
                  uploadedByUserId: currentUserId,
                  uploaderFirstName: "You",
                },
              ]);
            }
            toast.success("Uploaded!");
          }}
          onUploadError={(err) => { toast.error(err.message); }}
        />
      </div>

      {attachmentList.length === 0 && (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      )}

      <div className="space-y-2">
        {attachmentList.map((att) => (
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

            <div className="flex-1 min-w-0">
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
            </div>

            {att.uploadedByUserId === currentUserId && (
              <button
                onClick={() => handleDelete(att.id)}
                disabled={deletingId === att.id}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Remove attachment"
              >
                {deletingId === att.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
