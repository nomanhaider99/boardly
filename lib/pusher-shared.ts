export const CARDS_UPDATED = "cards-updated";

export type CardsUpdatedPayload = {
  lists: Array<{ listId: string; cardIds: string[] }>;
};

export function boardChannel(boardId: string) {
  return `board-${boardId}`;
}
