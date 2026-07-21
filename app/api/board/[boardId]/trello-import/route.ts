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
import { trelloAssetUrl } from "@/lib/trello-asset";
import { attachmentType, pickCoverUrl } from "@/lib/trello-import";

// Boards with thousands of comments and attachments need well over the default
// budget: the comment history alone can be a dozen paginated Trello calls.
export const maxDuration = 300;

type TrelloPreview = {
  id: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
};

type TrelloAttachment = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  bytes: number;
  isUpload: boolean;
  previews?: TrelloPreview[];
};

type TrelloCover = {
  idAttachment?: string | null;
  color?: string | null;
  scaled?: TrelloPreview[];
};

type TrelloCard = {
  id: string;
  idList: string;
  name: string;
  desc: string;
  due: string | null;
  pos: number;
  cover?: TrelloCover | null;
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

// Trello caps a single actions call at 1000 regardless of what you ask for, so
// history has to be walked with the `before` cursor.
const ACTIONS_PAGE_SIZE = 1000;
const MAX_ACTION_PAGES = 60; // ≈60k comments; a stop so a huge board can't hang
const DB_CHUNK = 500;

async function trelloFetch(
  path: string,
  params: Record<string, string>,
  signal: AbortSignal
) {
  const url = new URL(`https://api.trello.com/1/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Trello ${path} → ${res.status}`);
  return res.json();
}

/** Walk `/boards/{id}/actions` back through time until Trello runs out. */
async function fetchAllComments(
  trelloBoardId: string,
  auth: Record<string, string>,
  signal: AbortSignal
): Promise<TrelloAction[]> {
  const all: TrelloAction[] = [];
  const seen = new Set<string>();
  let before: string | undefined;

  for (let page = 0; page < MAX_ACTION_PAGES; page++) {
    const batch: TrelloAction[] = await trelloFetch(
      `boards/${trelloBoardId}/actions`,
      {
        ...auth,
        filter: "commentCard",
        limit: String(ACTIONS_PAGE_SIZE),
        fields: "id,date,data,memberCreator",
        ...(before ? { before } : {}),
      },
      signal
    );
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const a of batch) {
      if (a?.id && !seen.has(a.id)) {
        seen.add(a.id);
        all.push(a);
      }
    }

    const oldest = batch[batch.length - 1]?.date;
    // No forward progress means the cursor is stuck — stop rather than loop.
    if (!oldest || oldest === before) break;
    before = oldest;

    if (batch.length < ACTIONS_PAGE_SIZE) break;
  }

  return all;
}

/** Insert in chunks — a single statement with thousands of rows will be rejected. */
async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>
): Promise<number> {
  for (let i = 0; i < rows.length; i += DB_CHUNK) {
    await insert(rows.slice(i, i + DB_CHUNK));
  }
  return rows.length;
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 240_000);

    let trelloBoard: TrelloBoard;
    let trelloActions: TrelloAction[] = [];

    try {
      [trelloBoard, trelloActions] = await Promise.all([
        trelloFetch(
          `boards/${trelloBoardId}`,
          {
            ...auth,
            lists: "open",
            cards: "open",
            card_attachments: "true",
            list_fields: "id,name,pos",
            card_fields: "id,idList,name,desc,due,pos,cover",
          },
          controller.signal
        ),
        // Best-effort: a board still imports if its history can't be read.
        fetchAllComments(trelloBoardId, auth, controller.signal).catch(() => []),
      ]);
      clearTimeout(timer);
    } catch (fetchErr) {
      clearTimeout(timer);
      const msg = fetchErr instanceof Error ? fetchErr.message : "Trello request failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (!Array.isArray(trelloBoard.lists) || trelloBoard.lists.length === 0)
      return NextResponse.json({
        imported: { lists: 0, cards: 0, comments: 0, attachments: 0, covers: 0 },
      });

    // Index comments by Trello card ID, oldest first so the thread reads in order
    const commentsByCard: Record<string, TrelloAction[]> = {};
    for (const action of trelloActions) {
      const cardId = action.data?.card?.id;
      if (!cardId) continue;
      (commentsByCard[cardId] ??= []).push(action);
    }
    for (const arr of Object.values(commentsByCard)) {
      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

    // ── Lists ────────────────────────────────────────────────────────────────
    const insertedLists = await db
      .insert(lists)
      .values(
        sortedLists.map((l, i) => ({
          boardId,
          title: l.name.slice(0, 100),
          position: startPos + i * 1000,
        }))
      )
      .returning({ id: lists.id });

    // ── Cards ────────────────────────────────────────────────────────────────
    // Built as one flat batch so the whole board costs a handful of round trips
    // instead of two per card.
    const cardRows: {
      listId: string;
      title: string;
      description: string | null;
      position: number;
      dueDate: Date | null;
      bannerUrl: string | null;
    }[] = [];
    const cardOrder: TrelloCard[] = [];
    let covers = 0;

    sortedLists.forEach((tList, i) => {
      const listId = insertedLists[i].id;
      for (const [j, tc] of (cardsByList[tList.id] ?? []).entries()) {
        const rawCover = pickCoverUrl(tc);
        // Covers live behind Trello auth, so store the proxied form.
        const bannerUrl = rawCover
          ? trelloAssetUrl(rawCover, session.userId) ?? rawCover
          : null;
        if (bannerUrl) covers++;

        cardRows.push({
          listId,
          title: (tc.name || "Untitled").slice(0, 200),
          description: tc.desc?.trim() || null,
          position: j * 1000,
          dueDate: tc.due ? new Date(tc.due) : null,
          bannerUrl,
        });
        cardOrder.push(tc);
      }
    });

    const insertedCardIds: string[] = [];
    for (let i = 0; i < cardRows.length; i += DB_CHUNK) {
      const chunk = cardRows.slice(i, i + DB_CHUNK);
      const returned = await db.insert(cards).values(chunk).returning({ id: cards.id });
      insertedCardIds.push(...returned.map((r) => r.id));
    }

    // ── Comments + attachments ───────────────────────────────────────────────
    const commentRows: {
      cardId: string;
      userId: string;
      body: string;
      createdAt: Date;
    }[] = [];
    const attachmentRows: {
      cardId: string;
      url: string;
      type: "image" | "video" | "document";
      fileName: string;
      size: number;
      uploadedByUserId: string;
    }[] = [];

    cardOrder.forEach((tc, idx) => {
      const cardId = insertedCardIds[idx];
      if (!cardId) return;

      for (const action of commentsByCard[tc.id] ?? []) {
        commentRows.push({
          cardId,
          userId: session.userId,
          body: `**[${action.memberCreator?.fullName ?? "Trello user"}]** ${action.data.text}`,
          createdAt: new Date(action.date),
        });
      }

      for (const att of tc.attachments ?? []) {
        if (!att.url) continue;
        // Uploaded files need the proxy; links added to a card are already
        // public URLs and should keep pointing at their original destination.
        const url = att.isUpload
          ? trelloAssetUrl(att.url, session.userId) ?? att.url
          : att.url;
        const fileName = att.name || "attachment";
        attachmentRows.push({
          cardId,
          url,
          type: attachmentType(att.mimeType, fileName),
          fileName: fileName.slice(0, 200),
          size: att.bytes ?? 0,
          uploadedByUserId: session.userId,
        });
      }
    });

    const totalComments = await insertChunked(commentRows, (chunk) =>
      db.insert(comments).values(chunk)
    );
    const totalAttachments = await insertChunked(attachmentRows, (chunk) =>
      db.insert(attachments).values(chunk)
    );

    return NextResponse.json({
      imported: {
        lists: insertedLists.length,
        cards: insertedCardIds.length,
        comments: totalComments,
        attachments: totalAttachments,
        covers,
      },
    });
  } catch (err) {
    console.error("[trello-import] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
