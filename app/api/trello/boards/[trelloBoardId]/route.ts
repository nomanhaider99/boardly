import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trelloConnections } from "@/db/schema";
import { getSession } from "@/lib/auth";

type TrelloAttachment = { id: string };
type TrelloCard = { id: string; idList: string; attachments?: TrelloAttachment[] };
type TrelloList = { id: string; name: string; pos: number };
type TrelloBoard = { id: string; name: string; lists: TrelloList[]; cards: TrelloCard[] };
type TrelloAction = { id: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trelloBoardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trelloBoardId } = await params;

  const [creds] = await db
    .select({ apiKey: trelloConnections.apiKey, token: trelloConnections.token })
    .from(trelloConnections)
    .where(eq(trelloConnections.userId, session.userId))
    .limit(1);

  if (!creds) return NextResponse.json({ error: "Not connected to Trello" }, { status: 400 });

  const auth = `key=${encodeURIComponent(creds.apiKey)}&token=${encodeURIComponent(creds.token)}`;

  // Fetch board (with attachment counts) + comment count in parallel
  const [boardRes, actionsRes] = await Promise.all([
    fetch(
      `https://api.trello.com/1/boards/${trelloBoardId}?lists=open&cards=open&card_attachments=true&list_fields=id,name,pos&card_fields=id,idList&${auth}`,
      { cache: "no-store" }
    ),
    fetch(
      `https://api.trello.com/1/boards/${trelloBoardId}/actions?filter=commentCard&limit=1000&fields=id&${auth}`,
      { cache: "no-store" }
    ).catch(() => null),
  ]);

  if (!boardRes.ok)
    return NextResponse.json({ error: "Failed to fetch board from Trello" }, { status: 502 });

  const board: TrelloBoard = await boardRes.json();
  const actions: TrelloAction[] = actionsRes?.ok ? await actionsRes.json() : [];

  const cardCountByList: Record<string, number> = {};
  let totalAttachments = 0;

  for (const card of board.cards) {
    cardCountByList[card.idList] = (cardCountByList[card.idList] ?? 0) + 1;
    totalAttachments += card.attachments?.length ?? 0;
  }

  const boardLists = board.lists
    .sort((a, b) => a.pos - b.pos)
    .map(l => ({ id: l.id, name: l.name, cardCount: cardCountByList[l.id] ?? 0 }));

  return NextResponse.json({
    board: {
      id: board.id,
      name: board.name,
      lists: boardLists,
      totalCards: board.cards.length,
      totalComments: actions.length,
      totalAttachments,
    },
  });
}
