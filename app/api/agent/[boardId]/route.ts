import { convertToCoreMessages, streamText } from "ai";
import { NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { boards, lists, cards, workspaceMembers, users } from "@/db/schema";
import { getModel, type ModelProvider } from "@/lib/ai-provider";
import { createAgentTools } from "@/lib/agent-tools";

const MAX_STEPS = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { boardId } = await params;

  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) return new Response("Board not found", { status: 404 });

  // Permission gate — same membership check used everywhere else in the app.
  // A single check here is sufficient because:
  //   • Tools run server-side within the same request scope as this check.
  //   • session.userId is read from the JWT cookie — never from the request body.
  //   • boardListIds (built below) prevents any tool from touching cards on other boards,
  //     even if the model were to hallucinate an ID from a different board.
  // Session isolation: useChat history lives in the client component's React state.
  // No server-side conversation store exists, so two users on the same board always
  // receive independent contexts with no cross-contamination.
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, board.workspaceId),
        eq(workspaceMembers.userId, session.userId)
      )
    )
    .limit(1);
  if (!membership) return new Response("You do not have access to this board.", { status: 403 });

  // Fetch the acting user's display name for the system prompt.
  const [actingUser] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const actingUserName = actingUser
    ? `${actingUser.firstName} ${actingUser.lastName}`
    : session.email;

  // Fetch all workspace members for the system prompt
  const boardMembers = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      role: workspaceMembers.role,
      roleLabel: workspaceMembers.roleLabel,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, board.workspaceId));

  const membersContext = boardMembers
    .map((m) => {
      const displayName = m.roleLabel ?? `${m.firstName} ${m.lastName}`;
      return `  - ${displayName} (id: ${m.userId}, fullName: ${m.firstName} ${m.lastName}, role: ${m.role})`;
    })
    .join("\n");

  // Load full board state for system prompt + permission sets
  const boardLists = await db
    .select()
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position));

  const boardListIds = new Set(boardLists.map((l) => l.id));

  const boardCards =
    boardLists.length > 0
      ? await db
          .select()
          .from(cards)
          .where(inArray(cards.listId, [...boardListIds]))
          .orderBy(asc(cards.position))
      : [];

  // Build a map of listId → cards for the system prompt
  const cardsByList = new Map<string, typeof boardCards>();
  for (const list of boardLists) cardsByList.set(list.id, []);
  for (const card of boardCards) cardsByList.get(card.listId)?.push(card);

  const boardContext = boardLists
    .map((list) => {
      const listCards = cardsByList.get(list.id) ?? [];
      const cardLines = listCards
        .map((c) => `    - ${c.title} (id: ${c.id})`)
        .join("\n");
      return `  List: ${list.title} (id: ${list.id})\n${cardLines || "    (no cards)"}`;
    })
    .join("\n");

  const body = await request.json();
  const { messages: rawMessages, modelProvider = "gemini" } = body as {
    messages: Parameters<typeof convertToCoreMessages>[0];
    modelProvider?: string;
  };

  if (modelProvider !== "gemini" && modelProvider !== "claude" && modelProvider !== "mistral") {
    return new Response('Invalid model provider. Must be "gemini", "claude", or "mistral".', { status: 400 });
  }

  let model;
  try {
    model = getModel(modelProvider as ModelProvider);
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Failed to initialize model provider.",
      { status: 400 }
    );
  }

  const tools = createAgentTools({ boardId, boardListIds, userId: session.userId });

  const result = streamText({
    model,
    system: `You are Boardly's AI board agent for the board "${board.name}".
You are acting on behalf of ${actingUserName}. Every action you take (posting comments, moving cards) will be recorded as if they performed it manually. Do not impersonate anyone else or take actions outside this board.

You have three tools available:
- addComment: post a comment on a card as ${actingUserName}. When tagging members, write @FirstName (or their display name) in the comment text AND pass their UUID(s) in mentionedUserIds.
- moveCard: move a card to a different list (triggers real-time updates for all viewers)
- webSearch: search the web for current information

When using addComment or moveCard, use the card and list IDs from the board state below. Never make up IDs.
When tagging a member, match by first name, last name, or display name from the board members list below. Use their exact id as the mentionedUserId.
When you complete a tool action, briefly confirm what you did (e.g. "Done — I moved 'Task X' to Done.").
Be concise. Do not repeat the full board state back to the user.

Board members:
${membersContext}

Current board state:
${boardContext}`,
    messages: convertToCoreMessages(rawMessages),
    tools,
    maxSteps: MAX_STEPS,
  });

  return result.toDataStreamResponse({
    getErrorMessage: (err) =>
      err instanceof Error ? err.message : "An unexpected error occurred.",
  });
}
