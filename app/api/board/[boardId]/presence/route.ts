import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { boardPresence, boards, workspaceMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

// A heartbeat lands every ~20s while the tab is visible, so a 60s window
// tolerates one missed beat before someone drops to "away".
const PRESENCE_WINDOW_MS = 60_000;

async function getBoardWorkspace(boardId: string, userId: string) {
  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) return { board: null, member: null };

  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, board.workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);

  return { board, member: member ?? null };
}

/** Presence rows for everyone in the board's workspace, plus an online flag. */
async function readPresence(boardId: string, workspaceId: string) {
  const wsMembers = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const memberIds = wsMembers.map((m) => m.userId);
  if (memberIds.length === 0) return [];

  const rows = await db
    .select({
      userId: boardPresence.userId,
      lastSeenAt: boardPresence.lastSeenAt,
    })
    .from(boardPresence)
    .where(
      and(
        eq(boardPresence.boardId, boardId),
        inArray(boardPresence.userId, memberIds)
      )
    );

  const cutoff = Date.now() - PRESENCE_WINDOW_MS;
  return rows.map((r) => ({
    userId: r.userId,
    lastSeenAt: r.lastSeenAt,
    online: new Date(r.lastSeenAt).getTime() >= cutoff,
  }));
}

// GET /api/board/[boardId]/presence — read-only presence snapshot
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const { board, member } = await getBoardWorkspace(boardId, session.userId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ presence: await readPresence(boardId, board.workspaceId) });
}

// POST /api/board/[boardId]/presence — heartbeat, then return the snapshot.
// Body `{ offline: true }` (sent as a beacon on tab close) retires the row so
// the user drops off immediately instead of waiting out the window.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const { board, member } = await getBoardWorkspace(boardId, session.userId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const goingOffline = raw?.offline === true;

  if (goingOffline) {
    await db
      .delete(boardPresence)
      .where(
        and(
          eq(boardPresence.boardId, boardId),
          eq(boardPresence.userId, session.userId)
        )
      );
    return NextResponse.json({ presence: [] });
  }

  const now = new Date();
  await db
    .insert(boardPresence)
    .values({ boardId, userId: session.userId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [boardPresence.boardId, boardPresence.userId],
      set: { lastSeenAt: now },
    });

  return NextResponse.json({ presence: await readPresence(boardId, board.workspaceId) });
}
