import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments, boards, cards, comments, lists, workspaceMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const maxDuration = 60;

type InList = { id: string; name: string; pos: number };
type InAttachment = { name: string; url: string; mimeType: string; bytes: number };
type InCard = {
  id: string; idList: string; name: string; desc: string;
  due: string | null; pos: number;
  cover?: { scaled?: { url: string; height: number }[] } | null;
  attachments?: InAttachment[];
};
type InAction = {
  date: string;
  data: { text: string; card: { id: string } };
  memberCreator: { fullName: string };
};
type Payload = { lists: InList[]; cards: InCard[]; actions: InAction[] };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;

  let payload: Payload;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (!Array.isArray(payload?.lists) || !Array.isArray(payload?.cards))
    return NextResponse.json({ error: "Missing lists or cards in payload" }, { status: 400 });

  try {
    const [board] = await db
      .select({ workspaceId: boards.workspaceId })
      .from(boards).where(eq(boards.id, boardId)).limit(1);
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const [membership] = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, session.userId)))
      .limit(1);
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Index comments by Trello card ID
    const commentsByCard: Record<string, InAction[]> = {};
    for (const a of payload.actions ?? []) {
      const cid = a.data?.card?.id;
      if (cid) (commentsByCard[cid] ??= []).push(a);
    }

    // Index cards by list, sorted by pos
    const cardsByList: Record<string, InCard[]> = {};
    for (const c of payload.cards) (cardsByList[c.idList] ??= []).push(c);
    for (const arr of Object.values(cardsByList)) arr.sort((a, b) => a.pos - b.pos);

    // Starting list position
    const [lastList] = await db
      .select({ position: lists.position })
      .from(lists).where(eq(lists.boardId, boardId))
      .orderBy(desc(lists.position)).limit(1);
    const startPos = (lastList?.position ?? 0) + 1000;

    const sortedLists = [...payload.lists].sort((a, b) => a.pos - b.pos);
    let totalLists = 0, totalCards = 0, totalComments = 0, totalAttachments = 0;

    for (let i = 0; i < sortedLists.length; i++) {
      const tl = sortedLists[i];
      const [insertedList] = await db
        .insert(lists)
        .values({ boardId, title: tl.name.slice(0, 100), position: startPos + i * 1000 })
        .returning({ id: lists.id });
      totalLists++;

      const tCards = cardsByList[tl.id] ?? [];
      if (!tCards.length) continue;

      // Batch-insert all cards in this list
      const cardValues = tCards.map((tc, j) => {
        let bannerUrl: string | null = null;
        if (tc.cover?.scaled?.length) {
          const largest = [...tc.cover.scaled].sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
          const url = largest?.url ?? null;
          if (url && !url.includes("trello.com")) bannerUrl = url;
        }
        return {
          listId: insertedList.id,
          title: (tc.name || "Untitled").slice(0, 200),
          description: tc.desc?.trim() || null,
          position: j * 1000,
          dueDate: tc.due ? new Date(tc.due) : null,
          bannerUrl,
        };
      });

      const insertedCards = await db.insert(cards).values(cardValues).returning({ id: cards.id });
      totalCards += insertedCards.length;

      // Collect all comments for this list's cards
      const allComments: { cardId: string; userId: string; body: string; createdAt: Date }[] = [];
      const allAtts: { cardId: string; url: string; type: "image" | "document"; fileName: string; size: number; uploadedByUserId: string }[] = [];

      for (let j = 0; j < tCards.length; j++) {
        const tc = tCards[j];
        const cardId = insertedCards[j].id;

        for (const a of (commentsByCard[tc.id] ?? [])) {
          allComments.push({
            cardId,
            userId: session.userId,
            body: `**[${a.memberCreator?.fullName ?? "Trello user"}]** ${a.data.text}`,
            createdAt: new Date(a.date),
          });
        }

        for (const att of (tc.attachments ?? [])) {
          allAtts.push({
            cardId,
            url: att.url,
            type: (att.mimeType ?? "").startsWith("image/") ? "image" : "document",
            fileName: (att.name || "attachment").slice(0, 255),
            size: att.bytes ?? 0,
            uploadedByUserId: session.userId,
          });
        }
      }

      if (allComments.length) {
        for (const batch of chunk(allComments, 100)) {
          await db.insert(comments).values(batch);
        }
        totalComments += allComments.length;
      }

      if (allAtts.length) {
        for (const batch of chunk(allAtts, 50)) {
          await db.insert(attachments).values(batch);
        }
        totalAttachments += allAtts.length;
      }
    }

    return NextResponse.json({ imported: { lists: totalLists, cards: totalCards, comments: totalComments, attachments: totalAttachments } });
  } catch (err) {
    console.error("[json-import]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
