"use client";

import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Link2, RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Sanitizer ──────────────────────────────────────────────────────────────
// Allowlist-based: only formatting tags survive, every attribute is stripped
// except safe href on links. Runs in the browser (both components are client).

const ALLOWED_TAGS = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL",
  "UL", "OL", "LI", "BR", "P", "DIV", "A", "SPAN", "H3", "BLOCKQUOTE",
]);
const ALLOWED_ATTRS: Record<string, string[]> = { A: ["href", "target", "rel"] };

export function sanitizeHtml(html: string): string {
  if (typeof document === "undefined" || !html) return html ?? "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const clean = (node: Element) => {
    // snapshot — we mutate the tree while iterating
    for (const child of [...node.children]) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        // unwrap: lift the element's children into its place, drop the element
        const parent = child.parentNode!;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
        continue;
      }
      const allowed = ALLOWED_ATTRS[child.tagName] ?? [];
      for (const attr of [...child.attributes]) {
        if (!allowed.includes(attr.name.toLowerCase())) child.removeAttribute(attr.name);
      }
      if (child.tagName === "A") {
        const href = child.getAttribute("href") ?? "";
        if (!/^https?:\/\//i.test(href)) {
          child.removeAttribute("href");
        } else {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
      }
      clean(child);
    }
  };
  clean(doc.body);
  return doc.body.innerHTML.trim();
}

/** True when the string carries rich-text markup (vs. legacy plain text). */
export function isRichText(s: string | null | undefined): boolean {
  return !!s && /<[a-z][\s\S]*>/i.test(s);
}

// Shared typography so the editor and the read-only view match exactly.
const proseClass =
  "text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 " +
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
  { cmd: "createLink", icon: Link2, label: "Insert link", prompt: true },
  { cmd: "removeFormat", icon: RemoveFormatting, label: "Clear formatting" },
];

interface RichTextEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function RichTextEditor({
  initialHtml,
  onChange,
  placeholder = "Add a description…",
  autoFocus,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Seed the contenteditable once; keep it uncontrolled afterwards so the
  // caret never jumps while typing.
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = isRichText(initialHtml)
      ? initialHtml
      : initialHtml
        ? `<div>${escapeText(initialHtml)}</div>`
        : "";
    if (autoFocus) placeCaretAtEnd(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function run(tool: ToolButton) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand("styleWithCSS", false, "false");
      if (tool.prompt) {
        const url = window.prompt("Link URL");
        if (!url) return;
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        document.execCommand(tool.cmd, false, href);
      } else {
        document.execCommand(tool.cmd, false, tool.arg);
      }
    } catch {
      /* execCommand is best-effort */
    }
    emit();
  }

  return (
    <div className="rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring/50 transition-colors overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/30 px-1.5 py-1">
        {TOOLS.map((tool, i) => (
          <span key={tool.cmd} className="contents">
            {(i === 4 || i === 6 || i === 7) && (
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
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        className={cn(
          proseClass,
          "min-h-[6rem] max-h-80 overflow-y-auto px-3 py-2 focus:outline-none",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
        )}
      />
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
