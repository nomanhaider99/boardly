"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar } from "lucide-react";
import type { Card } from "@/db/schema";

interface CardItemProps {
  card: Card;
  listId: string;
  onClick: () => void;
}

export function CardItem({ card, listId, onClick }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", listId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const isOverdue =
    card.dueDate && new Date(card.dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      aria-label={`Open card: ${card.title}`}
      className="group rounded-lg border border-border/50 bg-background px-3 py-2.5 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all space-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <p className="text-sm font-medium leading-snug">{card.title}</p>

      <div className="flex items-center gap-2 flex-wrap">
        {card.description && (
          <span className="text-[10px] text-muted-foreground">Has description</span>
        )}
        {card.dueDate && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-medium ${
              isOverdue ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            <Calendar className="h-2.5 w-2.5" />
            {new Date(card.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}
