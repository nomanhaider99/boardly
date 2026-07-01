import { tool } from "ai";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, comments, commentMentions, lists } from "@/db/schema";

type Context = {
  boardId: string;
  /** Set of list IDs that belong to this board — used for every permission check */
  boardListIds: Set<string>;
  userId: string;
};

export function createAgentTools(ctx: Context) {
  const { boardId, boardListIds, userId } = ctx;

  // ── addComment ────────────────────────────────────────────────────────────
  const addComment = tool({
    description:
      "Post a comment on a card as the current user. Use this when asked to comment, reply, or leave a note on a card. When the user asks to tag or mention board members, include their UUIDs in mentionedUserIds and write @FirstName in the comment text.",
    parameters: z.object({
      cardId: z.string().describe("The UUID of the card to comment on"),
      text: z.string().describe("The comment text to post. Use @Name syntax for any mentions."),
      mentionedUserIds: z
        .array(z.string())
        .optional()
        .describe("UUIDs of board members to tag in this comment. Use the member IDs from the board members list."),
    }),
    execute: async ({ cardId, text, mentionedUserIds }) => {
      const [card] = await db
        .select({ listId: cards.listId, title: cards.title })
        .from(cards)
        .where(eq(cards.id, cardId))
        .limit(1);

      if (!card || !boardListIds.has(card.listId)) {
        return { success: false as const, error: "Card not found on this board." };
      }

      const [comment] = await db
        .insert(comments)
        .values({ cardId, userId, body: text })
        .returning({ id: comments.id });

      if (mentionedUserIds && mentionedUserIds.length > 0) {
        await db.insert(commentMentions).values(
          mentionedUserIds.map((uid) => ({ commentId: comment.id, mentionedUserId: uid }))
        );
      }

      return { success: true as const, cardTitle: card.title, commentId: comment.id };
    },
  });

  // ── moveCard ──────────────────────────────────────────────────────────────
  const moveCard = tool({
    description:
      "Move a card to a different list on this board. Position is 0-based and optional (defaults to last). Triggers real-time updates for all viewers.",
    parameters: z.object({
      cardId: z.string().describe("The UUID of the card to move"),
      targetListId: z.string().describe("The UUID of the destination list"),
      position: z
        .number()
        .optional()
        .describe("Position in the target list (0 = first). Defaults to last."),
    }),
    execute: async ({ cardId, targetListId, position }) => {
      if (!boardListIds.has(targetListId)) {
        return { success: false as const, error: "Target list is not on this board." };
      }

      const [card] = await db
        .select({ listId: cards.listId, title: cards.title })
        .from(cards)
        .where(eq(cards.id, cardId))
        .limit(1);

      if (!card || !boardListIds.has(card.listId)) {
        return { success: false as const, error: "Card not found on this board." };
      }

      const fromListId = card.listId;
      const sameList = fromListId === targetListId;

      // Load current card order for both affected lists
      const [fromCards, toCards] = await Promise.all([
        !sameList
          ? db
              .select({ id: cards.id })
              .from(cards)
              .where(eq(cards.listId, fromListId))
              .orderBy(asc(cards.position))
          : Promise.resolve([] as { id: string }[]),
        db
          .select({ id: cards.id })
          .from(cards)
          .where(eq(cards.listId, targetListId))
          .orderBy(asc(cards.position)),
      ]);

      const fromIds = fromCards.map((c) => c.id).filter((id) => id !== cardId);
      // Remove the card from the target list too (handles same-list reorder)
      const toIds = toCards.map((c) => c.id).filter((id) => id !== cardId);
      const insertAt = position !== undefined ? Math.min(position, toIds.length) : toIds.length;
      toIds.splice(insertAt, 0, cardId);

      await Promise.all([
        // Update target list positions (sets new listId on the moved card)
        ...toIds.map((id, idx) =>
          db.update(cards).set({ listId: targetListId, position: idx }).where(eq(cards.id, id))
        ),
        // Update source list positions
        ...(!sameList
          ? fromIds.map((id, idx) =>
              db.update(cards).set({ position: idx }).where(eq(cards.id, id))
            )
          : []),
      ]);

      // Resolve list titles for the human-readable result
      const listIds = [...new Set([fromListId, targetListId])];
      const listRows = await db
        .select({ id: lists.id, title: lists.title })
        .from(lists)
        .where(inArray(lists.id, listIds));
      const listMap = Object.fromEntries(listRows.map((l) => [l.id, l.title]));

      return {
        success: true as const,
        cardTitle: card.title,
        fromList: listMap[fromListId] ?? fromListId,
        toList: listMap[targetListId] ?? targetListId,
      };
    },
  });

  // ── webSearch ─────────────────────────────────────────────────────────────
  const webSearch = tool({
    description:
      "Search the web for current information. Use when the user asks about something that may require up-to-date external knowledge.",
    parameters: z.object({
      query: z.string().describe("The search query"),
    }),
    execute: async ({ query }) => {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return {
          success: false as const,
          error:
            "TAVILY_API_KEY is not configured. Add it to your environment variables to enable web search.",
        };
      }

      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }),
      });

      if (!res.ok) {
        return { success: false as const, error: `Web search failed: ${res.statusText}` };
      }

      const data = await res.json();
      const results = (data.results ?? []).map(
        (r: { title: string; url: string; content: string }) => ({
          title: r.title,
          url: r.url,
          snippet: r.content?.slice(0, 400) ?? "",
        })
      );

      return { success: true as const, query, results };
    },
  });

  return { addComment, moveCard, webSearch };
}
