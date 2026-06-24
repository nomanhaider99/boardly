"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { LayoutDashboard } from "lucide-react";
import { reorderLists } from "@/app/actions/list";
import { reorderCards, moveCrossListCard } from "@/app/actions/card";
import { ListColumn } from "@/components/list-column";
import { CardDetailDialog } from "@/components/card-detail-sheet";
import { AddListInline } from "@/components/add-list-inline";
import { getPusherClient } from "@/lib/pusher-client";
import { CARDS_UPDATED, type CardsUpdatedPayload } from "@/lib/pusher-shared";
import type { List, Card } from "@/db/schema";

export type CardsByList = Record<string, Card[]>;

interface BoardViewProps {
  boardId: string;
  currentUserId: string;
  initialLists: List[];
  initialCards: CardsByList;
}

export function BoardView({ boardId, currentUserId, initialLists, initialCards }: BoardViewProps) {
  const [lists, setLists] = useState<List[]>(initialLists);
  const [cardsByList, setCardsByList] = useState<CardsByList>(initialCards);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Track which list a dragged card started in and is currently over
  const fromListRef = useRef<string | null>(null);
  const overListRef = useRef<string | null>(null);

  // Stable ref so the Pusher handler always sees the latest state
  const cardsByListRef = useRef<CardsByList>(cardsByList);
  useEffect(() => { cardsByListRef.current = cardsByList; }, [cardsByList]);

  const activeCardIdRef = useRef<string | null>(null);
  useEffect(() => { activeCardIdRef.current = activeCardId; }, [activeCardId]);

  // Apply incoming real-time card updates (from other users)
  const applyCardsUpdated = useCallback((payload: CardsUpdatedPayload) => {
    // Don't apply while local user is dragging — would cause a snap
    if (activeCardIdRef.current) return;

    setCardsByList((prev) => {
      const next = { ...prev };
      for (const { listId, cardIds } of payload.lists) {
        const existing = prev[listId] ?? [];
        // Re-order existing card objects to match the incoming order
        const byId = Object.fromEntries(existing.map((c) => [c.id, c]));
        next[listId] = cardIds
          .map((id) => byId[id])
          .filter((c): c is Card => !!c);
      }
      return next;
    });
  }, []);

  // Pusher subscription
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`board-${boardId}`);
    channel.bind(CARDS_UPDATED, applyCardsUpdated);
    return () => {
      channel.unbind(CARDS_UPDATED, applyCardsUpdated);
      pusher.unsubscribe(`board-${boardId}`);
    };
  }, [boardId, applyCardsUpdated]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  function findCardList(cardId: string): string | null {
    for (const [listId, cards] of Object.entries(cardsByList)) {
      if (cards.some((c) => c.id === cardId)) return listId;
    }
    return null;
  }

  function onDragStart(event: DragStartEvent) {
    const { id, data } = event.active;
    if (data.current?.type === "card") {
      setActiveCardId(String(id));
      fromListRef.current = findCardList(String(id));
    }
    if (data.current?.type === "list") setActiveListId(String(id));
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.data.current?.type !== "card") return;

    const overId = String(over.id);
    const overList =
      over.data.current?.type === "list"
        ? overId
        : over.data.current?.listId ?? findCardList(overId);

    if (!overList) return;
    overListRef.current = overList;

    const activeList = findCardList(String(active.id));
    if (!activeList || activeList === overList) return;

    // Optimistic cross-list move in UI
    setCardsByList((prev) => {
      const sourceCards = [...(prev[activeList] ?? [])];
      const card = sourceCards.find((c) => c.id === active.id);
      if (!card) return prev;
      const newSource = sourceCards.filter((c) => c.id !== active.id);
      const destCards = [...(prev[overList] ?? []), { ...card, listId: overList }];
      return { ...prev, [activeList]: newSource, [overList]: destCards };
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCardId(null);
    setActiveListId(null);

    const dragFromList = fromListRef.current;
    fromListRef.current = null;

    if (!over) {
      overListRef.current = null;
      return;
    }

    // ── List reorder ──
    if (active.data.current?.type === "list") {
      overListRef.current = null;
      const oldIndex = lists.findIndex((l) => l.id === active.id);
      const newIndex = lists.findIndex((l) => l.id === over.id);
      if (oldIndex === newIndex) return;

      const reordered = arrayMove(lists, oldIndex, newIndex);
      setLists(reordered);
      const result = await reorderLists(boardId, reordered.map((l) => l.id));
      if (!result.success) {
        toast.error("Failed to save list order.");
        setLists(lists);
      }
      return;
    }

    // ── Card reorder / move ──
    if (active.data.current?.type === "card") {
      const targetList = overListRef.current ?? findCardList(String(active.id));
      overListRef.current = null;
      if (!targetList) return;

      const socketId = getPusherClient().connection.socket_id;

      const listCards = [...(cardsByList[targetList] ?? [])];
      const oldIndex = listCards.findIndex((c) => c.id === active.id);
      const newIndex = listCards.findIndex((c) => c.id === over.id);

      let finalCards = listCards;
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        finalCards = arrayMove(listCards, oldIndex, newIndex);
        setCardsByList((prev) => ({ ...prev, [targetList]: finalCards }));
      }

      const isCrossListMove = dragFromList && dragFromList !== targetList;

      if (isCrossListMove) {
        // Source list no longer has this card (already removed by onDragOver)
        const fromCards = cardsByList[dragFromList] ?? [];
        const result = await moveCrossListCard(
          String(active.id),
          dragFromList,
          targetList,
          fromCards.map((c) => c.id),
          finalCards.map((c) => c.id),
          boardId,
          socketId
        );
        if (!result.success) {
          toast.error("Failed to move card.");
          setCardsByList(initialCards);
        }
      } else {
        const result = await reorderCards(
          targetList,
          finalCards.map((c) => c.id),
          boardId,
          socketId
        );
        if (!result.success) {
          toast.error("Failed to save card order.");
          setCardsByList(initialCards);
        }
      }
    }
  }

  function onListAdded(list: List) {
    setLists((prev) => [...prev, list]);
    setCardsByList((prev) => ({ ...prev, [list.id]: [] }));
  }

  function onCardAdded(listId: string, card: Card) {
    setCardsByList((prev) => ({
      ...prev,
      [listId]: [...(prev[listId] ?? []), card],
    }));
  }

  function onListDeleted(listId: string) {
    setLists((prev) => prev.filter((l) => l.id !== listId));
    setCardsByList((prev) => {
      const next = { ...prev };
      delete next[listId];
      return next;
    });
  }

  function onListRenamed(listId: string, title: string) {
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, title } : l)));
  }

  function onCardDeleted(cardId: string) {
    setCardsByList((prev) => {
      const next = { ...prev };
      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].filter((c) => c.id !== cardId);
      }
      return next;
    });
    setSelectedCard(null);
  }

  function onCardUpdated(updated: Card) {
    setCardsByList((prev) => {
      const next = { ...prev };
      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((c) => (c.id === updated.id ? updated : c));
      }
      return next;
    });
    setSelectedCard(updated);
  }

  const activeCard = activeCardId
    ? Object.values(cardsByList).flat().find((c) => c.id === activeCardId)
    : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
          {lists.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <LayoutDashboard className="h-7 w-7" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-1">No lists yet</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                Add your first list to start organising cards on this board.
              </p>
              <AddListInline boardId={boardId} onListAdded={onListAdded} />
            </div>
          ) : (
            <div className="flex gap-3 items-start h-full overflow-x-auto pb-4 px-1">
              {lists.map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  cards={cardsByList[list.id] ?? []}
                  onCardClick={setSelectedCard}
                  onCardAdded={(card) => onCardAdded(list.id, card)}
                  onListDeleted={onListDeleted}
                  onListRenamed={onListRenamed}
                />
              ))}
              <AddListInline boardId={boardId} onListAdded={onListAdded} />
            </div>
          )}
        </SortableContext>

        <DragOverlay>
          {activeCard && (
            <div className="rotate-1 rounded-lg border border-primary/40 bg-card px-3 py-2.5 shadow-xl text-sm font-medium w-56 opacity-90">
              {activeCard.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <CardDetailDialog
        card={selectedCard}
        currentUserId={currentUserId}
        onClose={() => setSelectedCard(null)}
        onDeleted={onCardDeleted}
        onUpdated={onCardUpdated}
      />
    </>
  );
}
