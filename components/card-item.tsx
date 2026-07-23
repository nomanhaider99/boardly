"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar } from "lucide-react";
import Image from "next/image";
import { getUrgency, urgencyConfig } from "@/lib/due-date";
import { LabelPill } from "@/components/card-label";
import type { Card, CardLabel } from "@/db/schema";

interface CardItemProps {
  card: Card;
  listId: string;
  labels?: CardLabel[];
  dragDisabled?: boolean;
  onClick: () => void;
}

export function CardItem({ card, listId, labels = [], dragDisabled = false, onClick }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", listId }, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const urgency = getUrgency(card.dueDate ? new Date(card.dueDate) : null);

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
      className="group rounded-lg border border-white/10 bg-card/85 backdrop-blur-md cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 hover:bg-card hover:shadow-lg hover:shadow-primary/15 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 overflow-hidden"
    >
      {card.bannerUrl && (
        <div className="relative h-40 w-full bg-muted/40">
          <Image
            src={card.bannerUrl}
            alt=""
            fill
            className="object-contain"
            sizes="224px"
            draggable={false}
            // Imported Trello covers are served by our authenticated proxy; the
            // image optimizer fetches server-side without the session cookie,
            // so let the browser request them directly.
            unoptimized={card.bannerUrl.startsWith("/api/trello-asset")}
          />
        </div>
      )}

      <div className="px-3 py-2.5 space-y-1.5">
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {labels.map((l) => (
              <LabelPill key={l.id} label={l} size="sm" />
            ))}
          </div>
        )}

        <p className="text-sm font-medium leading-snug">{card.title}</p>

        <div className="flex items-center gap-2 flex-wrap">
          {card.description && (
            <span className="text-[10px] text-muted-foreground">Has description</span>
          )}
          {card.dueDate && urgency !== "none" && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${urgencyConfig[urgency].pill}`}
            >
              <Calendar className="h-2.5 w-2.5" />
              {new Date(card.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
