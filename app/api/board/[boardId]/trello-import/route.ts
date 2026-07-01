import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attachments,
  boards,
  cards,
  comments,
  lists,
  trelloConnections,
  workspaceMembers,
} from "@/db/schema";
import { getSession } from "@/lib/auth";

type TrelloAttachment = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  bytes: number;
  isUpload: boolean;
};

type TrelloCard = {
  id: string;
  idList: string;
  name: string;
  desc: string;
  due: string | null;
  pos: number;
  cover?: { idAttachment?: string | null };
  attachments?: TrelloAttachment[];
};

type TrelloList = { id: string; name: string; pos: number };

type TrelloBoard = {
  id: string;
  name: string;
  lists: TrelloList[];
  cards: TrelloCard[];
};

type TrelloAction = {
  id: string;
  type: string;
  date: string;
  data: { text: string; card: { id: string } };
  memberCreator: { fullName: string };
};

async function trelloFetch(path: string, params: Record<string, string>, signal: AbortSignal) {
  const url = new URL(`https://api.trello.com/1/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Trello ${path} → ${res.status}`);
  return res.json();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;

  let trelloBoardId: string | undefined;
  try {
    const body = await req.json();
    trelloBoardId = body?.trelloBoardId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!trelloBoardId)
    return NextResponse.json({ error: "trelloBoardId is required" }, { status: 400 });

  try {
    // Verify board membership
    const [board] = await db
      .select({ workspaceId: boards.workspaceId })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const [membership] = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, board.workspaceId),
          eq(workspaceMembers.userId, session.userId)
        )
      )
      .limit(1);
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Load Trello credentials
    const [creds] = await db
      .select({ apiKey: trelloConnections.apiKey, token: trelloConnections.token })
      .from(trelloConnections)
      .where(eq(trelloConnections.userId, session.userId))
      .limit(1);
    if (!creds)
      return NextResponse.json({ error: "Not connected to Trello" }, { status: 400 });

    const auth = { key: creds.apiKey, token: creds.token };

    // Fetch board + comments in parallel (30s timeout)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let trelloBoard: TrelloBoard;
    let trelloActions: TrelloAction[] = [];

    try {
      [trelloBoard, trelloActions] = await Promise.all([
        trelloFetch(`boards/${trelloBoardId}`, {
          ...auth,
          lists: "open",
          cards: "open",
          card_attachments: "true",
          list_fields: "id,name,pos",
          card_fields: "id,idList,name,desc,due,pos,cover",
        }, controller.signal),
        trelloFetch(`boards/${trelloBoardId}/actions`, {
          ...auth,
          filter: "commentCard",
          limit: "1000",
          fields: "id,date,data,memberCreator",
        }, controller.signal).catch(() => []), // comments are best-effort
      ]);
      clearTimeout(timer);
    } catch (fetchErr) {
      clearTimeout(timer);
      const msg = fetchErr instanceof Error ? fetchErr.message : "Trello request failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (!Array.isArray(trelloBoard.lists) || trelloBoard.lists.length === 0)
      return NextResponse.json({ imported: { lists: 0, cards: 0, comments: 0, attachments: 0 } });

    // Index comments by Trello card ID
    const commentsByCard: Record<string, TrelloAction[]> = {};
    for (const action of trelloActions) {
      const cardId = action.data?.card?.id;
      if (!cardId) continue;
      (commentsByCard[cardId] ??= []).push(action);
    }

    // Get current max list position
    const [lastList] = await db
      .select({ position: lists.position })
      .from(lists)
      .where(eq(lists.boardId, boardId))
      .orderBy(desc(lists.position))
      .limit(1);

    const startPos = (lastList?.position ?? 0) + 1000;
    const sortedLists = [...trelloBoard.lists].sort((a, b) => a.pos - b.pos);

    // Group + sort cards by list
    const cardsByList: Record<string, TrelloCard[]> = {};
    for (const card of trelloBoard.cards ?? []) {
      (cardsByList[card.idList] ??= []).push(card);
    }
    for (const arr of Object.values(cardsByList)) arr.sort((a, b) => a.pos - b.pos);

    let totalLists = 0;
    let totalCards = 0;
    let totalComments = 0;
    let totalAttachments = 0;

    for (let i = 0; i < sortedLists.length; i++) {
      const tList = sortedLists[i];

      const [insertedList] = await db
        .insert(lists)
        .values({ boardId, title: tList.name.slice(0, 100), position: startPos + i * 1000 })
        .returning({ id: lists.id });

      totalLists++;

      const tCards = cardsByList[tList.id] ?? [];

      for (let j = 0; j < tCards.length; j++) {
        const tc = tCards[j];

        // Resolve cover → bannerUrl (only use non-upload external URLs to avoid auth issues)
        let bannerUrl: string | null = null;
        if (tc.cover?.idAttachment && tc.attachments) {
          const coverAtt = tc.attachments.find(a => a.id === tc.cover?.idAttachment);
          if (coverAtt && !coverAtt.isUpload) bannerUrl = coverAtt.url;
        }

        const [insertedCard] = await db
          .insert(cards)
          .values({
            listId: insertedList.id,
            title: (tc.name || "Untitled").slice(0, 200),
            description: tc.desc?.trim() || null,
            position: j * 1000,
            dueDate: tc.due ? new Date(tc.due) : null,
            bannerUrl,
          })
          .returning({ id: cards.id });

        totalCards++;

        // Insert comments
        const cardComments = commentsByCard[tc.id] ?? [];
        if (cardComments.length > 0) {
          await db.insert(comments).values(
            cardComments.map(action => ({
              cardId: insertedCard.id,
              userId: session.userId,
              body: `**[${action.memberCreator?.fullName ?? "Trello user"}]** ${action.data.text}`,
              createdAt: new Date(action.date),
            }))
          );
          totalComments += cardComments.length;
        }

        // Insert attachments
        const cardAttachments = tc.attachments ?? [];
        if (cardAttachments.length > 0) {
          await db.insert(attachments).values(
            cardAttachments.map(att => ({
              cardId: insertedCard.id,
              url: att.url,
              type: (att.mimeType ?? "").startsWith("image/") ? "image" as const : "document" as const,
              fileName: att.name || "attachment",
              size: att.bytes ?? 0,
              uploadedByUserId: session.userId,
            }))
          );
          totalAttachments += cardAttachments.length;
        }
      }
    }

    return NextResponse.json({
      imported: { lists: totalLists, cards: totalCards, comments: totalComments, attachments: totalAttachments },
    });
  } catch (err) {
    console.error("[trello-import] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
