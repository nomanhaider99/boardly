"use client";

import { useState, useRef } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, MoreHorizontal, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { createCard } from "@/app/actions/card";
import { deleteList, updateListTitle } from "@/app/actions/list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardItem } from "@/components/card-item";
import type { List, Card } from "@/db/schema";

interface ListColumnProps {
  list: List;
  cards: Card[];
  onCardClick: (card: Card) => void;
  onCardAdded: (card: Card) => void;
  onListDeleted: (listId: string) => void;
  onListRenamed: (listId: string, title: string) => void;
}

export function ListColumn({
  list,
  cards,
  onCardClick,
  onCardAdded,
  onListDeleted,
  onListRenamed,
}: ListColumnProps) {
  const [addingCard, setAddingCard] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [addingCard_loading, setAddingCardLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(list.title);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id, data: { type: "list" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!cardTitle.trim()) return;
    setAddingCardLoading(true);
    const fd = new FormData();
    fd.append("title", cardTitle.trim());
    const result = await createCard(list.id, fd);
    setAddingCardLoading(false);
    if (!result.success) { toast.error(result.error); return; }
    const newCard: Card = {
      id: result.cardId!,
      listId: list.id,
      title: cardTitle.trim(),
      description: null,
      position: cards.length,
      dueDate: null,
      bannerUrl: null,
      createdAt: new Date(),
    };
    onCardAdded(newCard);
    setCardTitle("");
    inputRef.current?.focus();
  }

  async function handleRenameCommit() {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === list.title) { setEditingTitle(false); return; }
    const result = await updateListTitle(list.id, trimmed);
    if (!result.success) { toast.error(result.error); setTitleValue(list.title); }
    else onListRenamed(list.id, trimmed);
    setEditingTitle(false);
  }

  async function handleDelete() {
    setShowMenu(false);
    const result = await deleteList(list.id);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("List deleted.");
    onListDeleted(list.id);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-64 shrink-0 flex flex-col rounded-xl bg-card border border-border/50 max-h-[calc(100vh-180px)]"
    >
      {/* List header */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-0.5"
          aria-label="Drag list"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {editingTitle ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCommit();
                if (e.key === "Escape") { setTitleValue(list.title); setEditingTitle(false); }
              }}
              className="h-7 text-sm font-semibold py-0 px-1.5"
              autoFocus
            />
            <button onClick={handleRenameCommit} className="text-primary hover:opacity-80"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setTitleValue(list.title); setEditingTitle(false); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button
            className="flex-1 text-left text-sm font-semibold truncate hover:text-primary transition-colors"
            onClick={() => setEditingTitle(true)}
          >
            {list.title}
          </button>
        )}

        <span className="text-xs text-muted-foreground shrink-0">{cards.length}</span>

        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="text-muted-foreground hover:text-foreground p-0.5"
            aria-label={`Options for ${list.title}`}
            aria-haspopup="true"
            aria-expanded={showMenu}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-6 z-20 min-w-[140px] rounded-lg border border-border bg-card shadow-lg py-1">
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete list
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-1 space-y-1.5">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <CardItem key={card.id} card={card} listId={list.id} onClick={() => onCardClick(card)} />
          ))}
        </SortableContext>
        {cards.length === 0 && !addingCard && (
          <p className="py-3 text-center text-xs text-muted-foreground select-none">
            No cards yet
          </p>
        )}
      </div>

      {/* Add card */}
      <div className="px-2 pb-2 pt-1">
        {addingCard ? (
          <form onSubmit={handleAddCard} className="space-y-1.5">
            <Input
              ref={inputRef}
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              placeholder="Card title…"
              className="text-sm h-8"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Escape") { setAddingCard(false); setCardTitle(""); } }}
            />
            <div className="flex gap-1.5">
              <Button type="submit" size="sm" disabled={addingCard_loading || !cardTitle.trim()} className="h-7 text-xs gap-1">
                {addingCard_loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setAddingCard(false); setCardTitle(""); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add card
          </button>
        )}
      </div>
    </div>
  );
}
