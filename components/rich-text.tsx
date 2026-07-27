"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref, type ReactNode } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Link2, RemoveFormatting, Heading, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Sanitizer ──────────────────────────────────────────────────────────────
// Allowlist-based: only formatting tags survive, every attribute is stripped
// except safe href on links and http(s) src on images. Runs in the browser
// (both components are client).

const ALLOWED_TAGS = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL",
  "UL", "OL", "LI", "BR", "P", "DIV", "A", "SPAN", "H3", "BLOCKQUOTE",
  "IMG", "FIGURE", "FIGCAPTION", "CODE",
]);
const ALLOWED_ATTRS: Record<string, string[]> = {
  A: ["href", "target", "rel", "data-file"],
  IMG: ["src", "alt"],
};

const SAFE_URL = /^https?:\/\//i;

export function sanitizeHtml(html: string): string {
  if (typeof document === "undefined" || !html) return html ?? "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const clean = (node: Element) => {
    // Walk live rather than over a snapshot: unwrapping a disallowed element
    // splices its children into this level, and those children still have to be
    // vetted. (A snapshot would let `<form><img onerror=…>` through untouched.)
    let child = node.firstElementChild;
    while (child) {
      const next = child.nextElementSibling;

      if (!ALLOWED_TAGS.has(child.tagName)) {
        // unwrap: lift the element's children into its place, drop the element
        const parent = child.parentNode!;
        const lifted = child.firstElementChild;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
        // Resume at the content we just lifted — it hasn't been checked yet.
        child = lifted ?? next;
        continue;
      }

      const allowed = ALLOWED_ATTRS[child.tagName] ?? [];
      for (const attr of [...child.attributes]) {
        if (!allowed.includes(attr.name.toLowerCase())) child.removeAttribute(attr.name);
      }
      if (child.tagName === "A") {
        const href = child.getAttribute("href") ?? "";
        if (!SAFE_URL.test(href)) {
          child.removeAttribute("href");
          child.removeAttribute("data-file");
        } else {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
      }
      if (child.tagName === "IMG" && !SAFE_URL.test(child.getAttribute("src") ?? "")) {
        // An image whose source we can't vouch for is dropped outright — unlike
        // a link, there's nothing useful left once the URL goes.
        child.remove();
        child = next;
        continue;
      }

      clean(child);
      child = next;
    }
  };
  clean(doc.body);

  // Drop caption elements the author never filled in.
  for (const cap of [...doc.body.querySelectorAll("figcaption")]) {
    if (!cap.textContent?.trim()) cap.remove();
  }

  return doc.body.innerHTML.trim();
}

/** True when the string carries rich-text markup (vs. legacy plain text). */
export function isRichText(s: string | null | undefined): boolean {
  return !!s && /<[a-z][\s\S]*>/i.test(s);
}

/** Plain-text projection of a rich-text body — for search, previews, counts. */
export function richTextToPlain(s: string | null | undefined): string {
  if (!s) return "";
  if (!isRichText(s)) return s;
  if (typeof document === "undefined") return s.replace(/<[^>]*>/g, " ");
  const doc = new DOMParser().parseFromString(s, "text/html");
  return doc.body.textContent ?? "";
}

/**
 * True when a body carries neither text nor an embedded image/file — an editor
 * left with nothing but `<div><br></div>` scaffolding counts as empty.
 */
export function isEmptyRichText(html: string): boolean {
  if (!html) return true;
  if (typeof document === "undefined") return !html.trim();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (doc.body.querySelector("img, a[href]")) return false;
  // contenteditable pads empty blocks with &nbsp; — that is not content.
  return !doc.body.textContent?.replace(/\u00a0/g, " ").trim();
}

// Shared typography so the editor and the read-only view match exactly.
// Element-level rules that Tailwind variants can't express live in globals.css
// under `.rich-prose`.
export const proseClass =
  "rich-prose text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 " +
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary/80 " +
  "[&_strong]:font-semibold [&_b]:font-semibold [&_u]:underline [&_h3]:font-semibold [&_h3]:text-base " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground " +
  "break-words whitespace-normal";

// ── Read-only view ─────────────────────────────────────────────────────────

export function RichTextView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(proseClass, className)}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

// ── Editor ─────────────────────────────────────────────────────────────────

type ToolButton = {
  cmd: string;
  arg?: string;
  icon: typeof Bold;
  label: string;
  prompt?: boolean;
};

const TOOLS: ToolButton[] = [
  { cmd: "bold", icon: Bold, label: "Bold" },
  { cmd: "italic", icon: Italic, label: "Italic" },
  { cmd: "underline", icon: Underline, label: "Underline" },
  { cmd: "strikeThrough", icon: Strikethrough, label: "Strikethrough" },
  { cmd: "insertUnorderedList", icon: List, label: "Bulleted list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
  { cmd: "formatBlock", arg: "<h3>", icon: Heading, label: "Heading" },
  { cmd: "formatBlock", arg: "<blockquote>", icon: Quote, label: "Quote" },
  { cmd: "createLink", icon: Link2, label: "Insert link", prompt: true },
  { cmd: "removeFormat", icon: RemoveFormatting, label: "Clear formatting" },
];

// Indices that get a divider drawn before them.
const TOOL_DIVIDERS = new Set([4, 6, 8, 9]);

const INLINE_FORMAT_TAGS = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "CODE", "A", "SPAN",
]);
const BLOCK_START = /^\s*<(figure|div|p|ul|ol|blockquote|h3)\b/i;

export type RichTextEditorHandle = {
  focus(): void;
  getHtml(): string;
  setHtml(html: string): void;
  /**
   * Insert markup at the caret (or at the end when the editor isn't focused).
   * `caretInto` is a selector matched against the inserted fragment — the caret
   * lands inside that element instead of after the whole insertion.
   */
  insertHtml(html: string, opts?: { caretInto?: string }): void;
  element(): HTMLDivElement | null;
};

interface RichTextEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ref?: Ref<RichTextEditorHandle>;
  /** Called when files are pasted or dropped onto the editor. */
  onFiles?: (files: File[]) => void;
  /** Runs before the editor's own key handling; call preventDefault to win. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Extra controls appended to the toolbar (e.g. an attach button). */
  toolbarExtra?: ReactNode;
  /** Sizing/overrides for the editable area. */
  editableClassName?: string;
}

export function RichTextEditor({
  initialHtml,
  onChange,
  placeholder = "Add a description…",
  autoFocus,
  ref,
  onFiles,
  onKeyDown,
  toolbarExtra,
  editableClassName,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Seed the contenteditable once; keep it uncontrolled afterwards so the
  // caret never jumps while typing.
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = isRichText(initialHtml)
      ? initialHtml
      : initialHtml
        ? `<div>${escapeText(initialHtml)}</div>`
        : "";
    if (autoFocus) {
      editorRef.current.focus();
      placeCaretAtEnd(editorRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      placeCaretAtEnd(editorRef.current);
    },
    getHtml: () => editorRef.current?.innerHTML ?? "",
    setHtml: (html: string) => {
      if (!editorRef.current) return;
      editorRef.current.innerHTML = html;
      emit();
    },
    insertHtml: (html: string, opts?: { caretInto?: string }) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();

      const sel = window.getSelection();
      let range: Range;
      if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        range = sel.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
      }
      range.deleteContents();

      // Block content must not land inside active inline formatting — pasting an
      // image with bold switched on would otherwise nest <figure> inside <b>,
      // which is invalid and makes the caption (and everything after) bold.
      if (BLOCK_START.test(html)) {
        const start = range.startContainer;
        let node: Element | null =
          start.nodeType === Node.TEXT_NODE ? start.parentElement : (start as Element);
        let outermostInline: Element | null = null;
        while (node && node !== el && el.contains(node)) {
          if (INLINE_FORMAT_TAGS.has(node.tagName)) outermostInline = node;
          node = node.parentElement;
        }
        if (outermostInline) {
          range.setStartAfter(outermostInline);
          range.collapse(true);
        }
      }

      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      // These stay valid after insertNode — the nodes are moved, not cloned.
      const caretTarget = opts?.caretInto
        ? tpl.content.querySelector<HTMLElement>(opts.caretInto)
        : null;
      const lastNode = tpl.content.lastChild;
      range.insertNode(tpl.content);

      if (caretTarget) {
        // Chrome won't type into a caret anchored at an element offset in an
        // empty node — it relocates to the next block. Anchor inside a text
        // node instead; an empty one still counts as :empty, so the caption
        // placeholder keeps showing.
        const last = caretTarget.lastChild;
        const seed =
          last && last.nodeType === Node.TEXT_NODE
            ? (last as Text)
            : caretTarget.appendChild(document.createTextNode(""));
        const inside = document.createRange();
        inside.setStart(seed, seed.length);
        inside.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(inside);
      } else if (lastNode) {
        const after = document.createRange();
        after.setStartAfter(lastNode);
        after.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(after);
      }
      emit();
    },
    element: () => editorRef.current,
  }));

  function run(tool: ToolButton) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand("styleWithCSS", false, "false");
      if (tool.prompt) {
        const url = window.prompt("Link URL");
        if (!url) return;
        const href = SAFE_URL.test(url) ? url : `https://${url}`;
        document.execCommand(tool.cmd, false, href);
      } else {
        document.execCommand(tool.cmd, false, tool.arg);
      }
    } catch {
      /* execCommand is best-effort */
    }
    emit();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length > 0 && onFiles) {
      e.preventDefault();
      onFiles(files);
      return;
    }
    // Run pasted markup through the same allowlist the saved body gets, so
    // Word/Docs styling can't ride in.
    const html = e.clipboardData?.getData("text/html");
    if (html) {
      e.preventDefault();
      try {
        document.execCommand("insertHTML", false, sanitizeHtml(html));
      } catch {
        /* fall through to the browser default */
      }
      emit();
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    setDragging(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length > 0 && onFiles) {
      e.preventDefault();
      onFiles(files);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    // Enter inside a caption should leave the figure rather than growing the
    // caption into a multi-line block.
    if (e.key === "Enter" && !e.shiftKey) {
      const sel = window.getSelection();
      const caption = sel?.anchorNode
        ? (sel.anchorNode.nodeType === Node.ELEMENT_NODE
            ? (sel.anchorNode as Element)
            : sel.anchorNode.parentElement
          )?.closest("figcaption")
        : null;
      if (caption) {
        e.preventDefault();
        const figure = caption.closest("figure");
        if (!figure) return;
        let next = figure.nextElementSibling;
        if (!next || next.tagName !== "DIV") {
          next = document.createElement("div");
          next.innerHTML = "<br>";
          figure.after(next);
        }
        placeCaretAtEnd(next as HTMLElement);
        emit();
      }
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-background transition-colors overflow-hidden",
        "focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring/50",
        dragging && "border-primary ring-2 ring-primary/40"
      )}
      onDragOver={onFiles ? (e) => { e.preventDefault(); setDragging(true); } : undefined}
      onDragLeave={onFiles ? () => setDragging(false) : undefined}
      onDrop={onFiles ? handleDrop : undefined}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/30 px-1.5 py-1">
        {TOOLS.map((tool, i) => (
          <span key={`${tool.cmd}-${tool.arg ?? ""}`} className="contents">
            {TOOL_DIVIDERS.has(i) && (
              <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden />
            )}
            <button
              type="button"
              title={tool.label}
              aria-label={tool.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(tool)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <tool.icon className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {toolbarExtra && (
          <>
            <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden />
            {toolbarExtra}
          </>
        )}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className={cn(
          proseClass,
          "min-h-[6rem] max-h-80 overflow-y-auto px-3 py-2 focus:outline-none",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
          editableClassName
        )}
      />
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

export function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** Escape a value destined for a double-quoted HTML attribute. */
export function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Collapse the caret to the end of `el`. The element must already sit inside a
 * focused contenteditable — calling focus() on a non-focusable node (a
 * <figcaption>, say) would bounce focus to the host and drop the range.
 */
function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
