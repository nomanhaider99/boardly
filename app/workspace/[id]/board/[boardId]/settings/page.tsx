import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWorkspaceDetail } from "@/app/actions/workspace";
import { getBoardMemberLabels, setBoardMemberMovePermission, type MemberWithBoardLabel } from "@/app/actions/board";
import { db } from "@/lib/db";
import { boards, boardMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { BoardSettingsContent } from "@/components/board-settings-content";

async function getBoard(boardId: string, userId: string) {
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) return null;

  const [membership] = await db
    .select()
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
    .limit(1);
  if (!membership) return null;

  return board;
}

export default async function BoardSettingsPage({
  params,
}: {
  params: Promise<{ id: string; boardId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id: workspaceId, boardId } = await params;

  const [workspace, board] = await Promise.all([
    getWorkspaceDetail(workspaceId),
    getBoard(boardId, session.userId),
  ]);

  if (!workspace || !board) notFound();

  const members = await getBoardMemberLabels(boardId);

  return (
    <BoardSettingsContent
      workspace={workspace}
      board={board}
      members={members}
      currentUserId={session.userId}
      isOwner={workspace.currentUserRole === "owner"}
    />
  );
}