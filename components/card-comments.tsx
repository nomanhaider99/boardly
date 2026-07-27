"use client";

import {
  useState, useTransition, useRef, useEffect, useMemo, useImperativeHandle,
  type Ref,
} from "react";
import { Loader2, Trash2, Send, ArrowRight, Search, X, Pencil, Check, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment, editComment } from "@/app/actions/comment";
import { saveAttachment } from "@/app/actions/attachment";
import { Button } from "@/components/ui/button";
import {
  RichTextEditor, proseClass, sanitizeHtml, isRichText, isEmptyRichText,
  richTextToPlain, escapeText, escapeAttr,
  type RichTextEditorHandle,
} from "@/components/rich-text";
import { useUploadThing } from "@/lib/uploadthing";
import { validateVideoFile } from "@/lib/video";
import { cn } from "@/lib/utils";
import type { CommentWithUser, MemberForMention } from "@/app/actions/comment";
import type { AttachmentWithUploader } from "@/app/actions/attachment";

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

// ── Body rendering ─────────────────────────────────────────────────────────

const MENTION_CLASS =
  "inline-flex items-center bg-primary/15 text-primary font-semibold px-1.5 py-0.5 " +
  "rounded-md text-[0.85em] transition-colors cursor-default";
const MARK_CLASS = "rounded bg-yellow-300/60 dark:bg-yellow-400/30 px-0.5 text-inherit";

const MENTION_RE = /(@[A-Za-z]\w*)/g;

/**
 * Sanitize a stored comment body, then decorate its text nodes: @mentions get a
 * chip, search hits get a <mark>. Legacy plain-text bodies are escaped first.
 * Decoration runs after sanitizing so our own markup survives it.
 */
function decorateBody(raw: string, query: string): string {
  if (typeof document === "undefined") return "";
  const html = isRichText(raw) ? sanitizeHtml(raw) : escapeText(raw);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const q = query.trim();

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    // Don't rewrite link labels or code spans.
    if (node.parentElement?.closest("a, code")) continue;
    textNodes.push(node);
  }

  const qRe = q ? new RegExp(`(${escapeRegExp(q)})`, "ig") : null;

  for (const node of textNodes) {
    const frag = doc.createDocumentFragment();
    let changed = false;

    const pushHighlighted = (text: string) => {
      if (!qRe) {
        if (text) frag.appendChild(doc.createTextNode(text));
        return;
      }
      for (const seg of text.split(qRe)) {
        if (!seg) continue;
        if (seg.toLowerCase() === q.toLowerCase()) {
          const mark = doc.createElement("mark");
          mark.className = MARK_CLASS;
          mark.textContent = seg;
          frag.appendChild(mark);
          changed = true;
        } else {
          frag.appendChild(doc.createTextNode(seg));
        }
      }
    };

    for (const part of node.data.split(MENTION_RE)) {
      if (!part) continue;
      if (/^@[A-Za-z]\w*$/.test(part)) {
        const span = doc.createElement("span");
        span.className = MENTION_CLASS;
        span.textContent = part;
        frag.appendChild(span);
        changed = true;
      } else {
        pushHighlighted(part);
      }
    }

    if (changed) node.replaceWith(frag);
  }

  return doc.body.innerHTML;
}

function CommentBody({ body, query, className }: { body: string; query: string; className?: string }) {
  const html = useMemo(() => decorateBody(body, query), [body, query]);
  return <div className={cn(proseClass, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Mention plumbing inside contenteditable ────────────────────────────────

type MentionHit = { search: string; node: Text; start: number; end: number };

/** Locate an in-progress `@word` immediately before a collapsed caret. */
function findMentionHit(root: HTMLElement | null): MentionHit | null {
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return null;

  const node = sel.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return null;

  const before = (node as Text).data.slice(0, sel.anchorOffset);
  const match = before.match(/(^|\s)@(\w*)$/);
  if (!match) return null;

  return {
    search: match[2],
    node: node as Text,
    start: before.length - match[2].length - 1, // index of the '@'
    end: sel.anchorOffset,
  };
}

/** Replace the in-progress `@word` with the finished mention plus a space. */
function commitMention(root: HTMLElement | null, label: string): boolean {
  const hit = findMentionHit(root);
  if (!hit) return false;

  const range = document.createRange();
  range.setStart(hit.node, hit.start);
  range.setEnd(hit.node, hit.end);
  range.deleteContents();

  // Non-breaking space so contenteditable cannot collapse it at a block end.
  const text = document.createTextNode(`@${label}\u00a0`);
  range.insertNode(text);

  const after = document.createRange();
  after.setStartAfter(text);
  after.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(after);
  return true;
}

// ── Editor (composer + inline edit share this) ─────────────────────────────

function attachmentKind(mime: string): "image" | "video" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

export type CommentEditorHandle = {
  clear(): void;
  focus(): void;
  getHtml(): string;
};

interface CommentEditorProps {
  cardId: string;
  currentUserId: string;
  initialHtml: string;
  placeholder: string;
  members: MemberForMention[];
  boardLabelMap?: Record<string, string>;
  onChange: (html: string) => void;
  onMentionUser: (userId: string, label: string) => void;
  onAttachmentAdded?: (attachment: AttachmentWithUploader) => void;
  onSubmitShortcut?: () => void;
  autoFocus?: boolean;
  editableClassName?: string;
  ref?: Ref<CommentEditorHandle>;
}

function CommentEditor({
  cardId,
  currentUserId,
  initialHtml,
  placeholder,
  members,
  boardLabelMap,
  onChange,
  onMentionUser,
  onAttachmentAdded,
  onSubmitShortcut,
  autoFocus,
  editableClassName,
  ref,
}: CommentEditorProps) {
  const rteRef = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const { startUpload, isUploading } = useUploadThing("cardAttachment", {
    onUploadError: (err) => { toast.error("Upload failed", { description: err.message }); },
  });

  useImperativeHandle(ref, () => ({
    clear: () => { rteRef.current?.setHtml(""); setMentionSearch(null); },
    focus: () => rteRef.current?.focus(),
    getHtml: () => rteRef.current?.getHtml() ?? "",
  }));

  // Every match is rendered — the list scrolls rather than truncating, so a
  // board with more than a handful of members stays fully reachable.
  const filteredMembers =
    mentionSearch === null
      ? []
      : members.filter((m) => {
          const q = mentionSearch.toLowerCase();
          return (
            m.firstName.toLowerCase().startsWith(q) ||
            m.lastName.toLowerCase().startsWith(q)
          );
        });

  // Keep the keyboard-highlighted row visible as ↑↓ walks past the fold.
  // "nearest" is a no-op when the row is already on screen, so hovering with the
  // mouse (which also moves the highlight) never yanks the list around.
  useEffect(() => {
    if (mentionSearch === null) return;
    mentionItemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, mentionSearch]);

  function syncMentionState() {
    const hit = findMentionHit(rteRef.current?.element() ?? null);
    if (hit) {
      setMentionSearch(hit.search);
      setHighlightedIndex(0);
    } else {
      setMentionSearch(null);
    }
  }

  function handleChange(html: string) {
    onChange(html);
    syncMentionState();
  }

  function selectMember(member: MemberForMention) {
    const el = rteRef.current?.element();
    if (!el) return;
    const label = boardLabelMap?.[member.userId] ?? member.firstName;
    if (commitMention(el, label)) {
      onMentionUser(member.userId, label);
      onChange(el.innerHTML);
    }
    setMentionSearch(null);
    setHighlightedIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (mentionSearch !== null && filteredMembers.length > 0) {
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
        e.preventDefault();
        setMentionSearch(null);
        return;
      }
    }

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmitShortcut?.();
    }
  }

  // Upload pasted/dropped/picked files, register them as card attachments, and
  // drop a reference into the comment at the caret.
  async function handleFiles(files: File[]) {
    const allowed: File[] = [];
    for (const file of files) {
      const err = validateVideoFile(file);
      if (err) { toast.error(err); continue; }
      allowed.push(file);
    }
    if (allowed.length === 0) return;

    let uploaded;
    try {
      uploaded = await startUpload(allowed);
    } catch {
      return; // onUploadError already surfaced this
    }
    if (!uploaded || uploaded.length === 0) return;

    let inserted = 0;
    for (const file of uploaded) {
      const type = file.type ?? "";
      const result = await saveAttachment(cardId, {
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type,
      });
      if (!result.success) { toast.error(result.error); continue; }

      onAttachmentAdded?.({
        id: result.attachmentId!,
        url: file.ufsUrl,
        type: attachmentKind(type),
        fileName: file.name,
        size: file.size,
        createdAt: new Date(),
        uploadedByUserId: currentUserId,
        uploaderFirstName: "You",
      });

      if (type.startsWith("image/")) {
        // Caret lands in the caption so a description can be typed right away.
        rteRef.current?.insertHtml(
          `<figure><img src="${escapeAttr(file.ufsUrl)}" alt="${escapeAttr(file.name)}">` +
            `<figcaption data-placeholder="Add a caption…"></figcaption></figure><div><br></div>`,
          { caretInto: "figcaption" }
        );
      } else {
        rteRef.current?.insertHtml(
          `<a href="${escapeAttr(file.ufsUrl)}" data-file="1" target="_blank" rel="noopener noreferrer">` +
            `${escapeText(file.name)}</a>&nbsp;`
        );
      }
      inserted++;
    }

    onChange(rteRef.current?.getHtml() ?? "");
    if (inserted > 0) {
      toast.success(inserted === 1 ? "Attached to this card." : `${inserted} files attached to this card.`);
    }
  }

  return (
    <div className="relative">
      {/* Mention dropdown */}
      {mentionSearch !== null && filteredMembers.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-20 rounded-xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-xl ring-1 ring-foreground/5 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Tag a member ({filteredMembers.length})
            </span>
            <span className="text-[10px] text-muted-foreground/70">↑↓ to navigate · ↵ to select</span>
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain pb-1">
            {filteredMembers.map((m, i) => {
              const label = boardLabelMap?.[m.userId] ?? `${m.firstName} ${m.lastName}`.trim();
              const active = i === highlightedIndex;
              return (
                <button
                  key={m.userId}
                  ref={(el) => { mentionItemRefs.current[i] = el; }}
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

      <RichTextEditor
        ref={rteRef}
        initialHtml={initialHtml}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFiles={handleFiles}
        placeholder={placeholder}
        autoFocus={autoFocus}
        editableClassName={cn("min-h-[4.5rem] max-h-72", editableClassName)}
        toolbarExtra={
          <>
            <button
              type="button"
              title="Attach a file"
              aria-label="Attach a file"
              disabled={isUploading}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {isUploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Paperclip className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = [...(e.target.files ?? [])];
                e.target.value = "";
                if (picked.length > 0) handleFiles(picked);
              }}
            />
          </>
        }
      />

      {isUploading && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading…
        </p>
      )}
    </div>
  );
}

// ── Thread ─────────────────────────────────────────────────────────────────

interface CardCommentsProps {
  cardId: string;
  currentUserId: string;
  initialComments: CommentWithUser[];
  workspaceMembers: MemberForMention[];
  boardLabelMap?: Record<string, string>;
  /** Files attached from the comment box also land in the card's attachments. */
  onAttachmentAdded?: (attachment: AttachmentWithUploader) => void;
}

export function CardComments({
  cardId,
  currentUserId,
  initialComments,
  workspaceMembers,
  boardLabelMap,
  onAttachmentAdded,
}: CardCommentsProps) {
  const [commentList, setCommentList] = useState<CommentWithUser[]>(initialComments);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<Map<string, string>>(new Map());
  const [submitting, startSubmit] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editMentions, setEditMentions] = useState<Map<string, string>>(new Map());
  const [savingEdit, setSavingEdit] = useState(false);

  // Search state
  const [search, setSearch] = useState("");

  const composerRef = useRef<CommentEditorHandle>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const query = search.trim().toLowerCase();

  // Comments that match the search (system rows excluded from search).
  // Matching runs against the plain-text projection so markup and image URLs
  // can't produce phantom hits.
  const visibleComments = useMemo(() => {
    if (!query) return commentList;
    return commentList.filter(
      (c) => !c.isSystem && richTextToPlain(c.body).toLowerCase().includes(query)
    );
  }, [commentList, query]);

  const matchCount = query ? visibleComments.length : 0;

  // Scroll the first match into view when the query changes
  useEffect(() => {
    if (query && threadRef.current) {
      threadRef.current.scrollTop = 0;
    }
  }, [query]);

  // Only report mentions whose chip is still present in the body — a user who
  // typed then deleted a mention shouldn't get notified.
  function liveMentionIds(html: string, map: Map<string, string>): string[] {
    const plain = richTextToPlain(html);
    return [...map].filter(([, label]) => plain.includes(`@${label}`)).map(([id]) => id);
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const html = sanitizeHtml(composerRef.current?.getHtml() ?? body);
    if (isEmptyRichText(html)) return;

    startSubmit(async () => {
      const result = await addComment(cardId, {
        body: html,
        mentionedUserIds: liveMentionIds(html, mentions),
      });
      if (!result.success) { toast.error(result.error); return; }
      setCommentList((prev) => [
        {
          id: result.commentId!,
          body: html,
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
      setMentions(new Map());
      composerRef.current?.clear();
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
    setEditMentions(new Map());
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
    setEditMentions(new Map());
  }

  async function saveEdit(id: string) {
    const html = sanitizeHtml(editDraft);
    if (isEmptyRichText(html)) return;
    setSavingEdit(true);
    const result = await editComment(id, html, liveMentionIds(html, editMentions));
    setSavingEdit(false);
    if (!result.success) { toast.error(result.error); return; }
    const now = new Date();
    setCommentList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, body: html, editedAt: now } : c))
    );
    cancelEdit();
    toast.success("Comment updated.");
  }

  const nonSystemCount = commentList.filter((c) => !c.isSystem).length;
  const canSubmit = !isEmptyRichText(body);

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
        <CommentEditor
          ref={composerRef}
          cardId={cardId}
          currentUserId={currentUserId}
          initialHtml=""
          placeholder="Write a comment… (@ to mention, paste or drop a file to attach)"
          members={workspaceMembers}
          boardLabelMap={boardLabelMap}
          onChange={setBody}
          onMentionUser={(userId, label) =>
            setMentions((prev) => new Map(prev).set(userId, label))
          }
          onAttachmentAdded={onAttachmentAdded}
          onSubmitShortcut={handleSubmit}
        />

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            ⌘ + Enter to submit · files are attached to the card too
          </p>
          <Button type="submit" size="sm" disabled={submitting || !canSubmit} className="gap-1.5">
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
                    <CommentEditor
                      key={comment.id}
                      cardId={cardId}
                      currentUserId={currentUserId}
                      initialHtml={comment.body}
                      placeholder="Edit your comment…"
                      members={workspaceMembers}
                      boardLabelMap={boardLabelMap}
                      onChange={setEditDraft}
                      onMentionUser={(userId, label) =>
                        setEditMentions((prev) => new Map(prev).set(userId, label))
                      }
                      onAttachmentAdded={onAttachmentAdded}
                      onSubmitShortcut={() => saveEdit(comment.id)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(comment.id)}
                        disabled={savingEdit || isEmptyRichText(editDraft)}
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
                    <CommentBody
                      body={comment.body}
                      query={query}
                      className="text-foreground/90 pl-8"
                    />
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
