"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createList } from "@/app/actions/list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { List } from "@/db/schema";

export function AddListInline({
  boardId,
  onListAdded,
}: {
  boardId: string;
  onListAdded: (list: List) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("title", title.trim());
    const result = await createList(boardId, fd);
    setLoading(false);
    if (!result.success) { toast.error(result.error); return; }
    const newList: List = {
      id: result.listId!,
      boardId,
      title: title.trim(),
      position: 9999,
    };
    onListAdded(newList);
    setTitle("");
    // stay open to add another
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex h-10 w-56 shrink-0 items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add list
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-64 shrink-0 rounded-xl border border-border bg-card p-3 space-y-2"
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="List title…"
        className="h-8 text-sm"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Escape") { setAdding(false); setTitle(""); } }}
      />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={loading || !title.trim()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add list"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => { setAdding(false); setTitle(""); }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </form>
  );
}
