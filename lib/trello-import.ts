/** Helpers shared by the Trello API import and the Trello JSON-export import. */

export type TrelloPreview = {
  url: string;
  width?: number;
  height?: number;
};

export type CoverSource = {
  cover?: {
    idAttachment?: string | null;
    scaled?: TrelloPreview[];
  } | null;
  attachments?: { id?: string; url?: string; previews?: TrelloPreview[] }[];
};

/**
 * Best cover image for a card.
 *
 * Trello covers reference an attachment and ship pre-scaled renditions of it.
 * Prefer the narrowest rendition that's still wide enough to look sharp as a
 * banner, rather than the largest — those run to several MB.
 */
export function pickCoverUrl(card: CoverSource): string | null {
  const previews: TrelloPreview[] = [];

  if (card.cover?.scaled?.length) previews.push(...card.cover.scaled);

  const coverAttId = card.cover?.idAttachment;
  if (coverAttId) {
    const att = (card.attachments ?? []).find((a) => a.id === coverAttId);
    if (att?.previews?.length) previews.push(...att.previews);
    // No renditions offered — fall back to the original file.
    if (previews.length === 0 && att?.url) return att.url;
  }

  const usable = previews.filter((p) => !!p.url);
  if (usable.length === 0) return null;

  const wideEnough = usable
    .filter((p) => (p.width ?? 0) >= 600)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

  const chosen =
    wideEnough[0] ?? [...usable].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return chosen?.url ?? null;
}

export function attachmentType(
  mimeType: string | undefined,
  fileName: string
): "image" | "video" | "document" {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  // Trello sometimes reports an empty or generic mime type; fall back to the name.
  if (/\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i.test(fileName)) return "image";
  if (/\.(mp4|mov|webm|m4v)$/i.test(fileName)) return "video";
  return "document";
}
