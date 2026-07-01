/**
 * One-time script: clear Mindwave | Production board and re-import from trello.json
 * Run: npx tsx import-trello-json.ts
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { config } from "dotenv";
import { readFileSync } from "fs";
import * as schema from "./db/schema/index";

config({ path: ".env.local" });

const BOARD_ID = "b6b81190-4329-49d1-a6bb-71aa9f39b94a";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });
  const { boards, cards, comments, lists, attachments, workspaceMembers } = schema;

  console.log("Reading trello.json…");
  const data = JSON.parse(readFileSync("trello.json", "utf8"));

  const activeLists = (data.lists as any[]).filter(l => !l.closed).sort((a, b) => a.pos - b.pos);
  const activeCards = (data.cards as any[]).filter(c => !c.closed);
  const commentActions = (data.actions as any[]).filter(a => a.type === "commentCard");

  console.log(`  Board: ${data.name}`);
  console.log(`  Active lists: ${activeLists.length}`);
  console.log(`  Active cards: ${activeCards.length}`);
  console.log(`  Comments:     ${commentActions.length}`);

  // Get board owner
  const [ownerRow] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .innerJoin(boards, eq(boards.workspaceId, workspaceMembers.workspaceId))
    .where(and(eq(boards.id, BOARD_ID), eq(workspaceMembers.role, "owner")))
    .limit(1);

  if (!ownerRow) { console.error("Board / owner not found"); process.exit(1); }
  const userId = ownerRow.userId;
  console.log(`\nOwner: ${userId}`);

  // Clear existing data
  console.log("\nClearing existing board data…");
  await db.delete(lists).where(eq(lists.boardId, BOARD_ID));
  console.log("  Cleared");

  // Index source data
  const cardsByList: Record<string, any[]> = {};
  for (const c of activeCards) (cardsByList[c.idList] ??= []).push(c);
  for (const arr of Object.values(cardsByList)) arr.sort((a, b) => a.pos - b.pos);

  const commentsByCard: Record<string, any[]> = {};
  for (const a of commentActions) {
    const cid = a.data?.card?.id;
    if (cid) (commentsByCard[cid] ??= []).push(a);
  }

  let totalLists = 0, totalCards = 0, totalComments = 0, totalAttachments = 0;

  for (let i = 0; i < activeLists.length; i++) {
    const tl = activeLists[i];

    const [insertedList] = await db
      .insert(lists)
      .values({ boardId: BOARD_ID, title: tl.name.slice(0, 100), position: (i + 1) * 1000 })
      .returning({ id: lists.id });
    totalLists++;

    const tCards = cardsByList[tl.id] ?? [];

    if (!tCards.length) {
      process.stdout.write(`  [${i + 1}/${activeLists.length}] "${tl.name.slice(0, 35)}" → 0 cards\n`);
      continue;
    }

    // Batch-insert all cards in this list
    const cardValues = tCards.map((tc: any, j: number) => {
      let bannerUrl: string | null = null;
      if (tc.cover?.scaled?.length) {
        const largest = [...tc.cover.scaled].sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0))[0];
        const url = largest?.url ?? null;
        // Skip Trello-hosted URLs — they require API auth to display
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

    // Collect comments + attachments for all cards in batch
    const allComments: any[] = [];
    const allAtts: any[] = [];

    for (let j = 0; j < tCards.length; j++) {
      const tc = tCards[j];
      const cardId = insertedCards[j].id;

      for (const a of (commentsByCard[tc.id] ?? [])) {
        allComments.push({
          cardId,
          userId,
          body: `**[${a.memberCreator?.fullName ?? "Trello user"}]** ${a.data.text}`,
          createdAt: new Date(a.date),
        });
      }

      for (const att of (tc.attachments ?? [])) {
        allAtts.push({
          cardId,
          url: att.url,
          type: (att.mimeType ?? "").startsWith("image/") ? "image" as const : "document" as const,
          fileName: (att.name || "attachment").slice(0, 255),
          size: att.bytes ?? 0,
          uploadedByUserId: userId,
        });
      }
    }

    if (allComments.length) {
      for (let k = 0; k < allComments.length; k += 100) {
        await db.insert(comments).values(allComments.slice(k, k + 100));
      }
      totalComments += allComments.length;
    }

    if (allAtts.length) {
      for (let k = 0; k < allAtts.length; k += 50) {
        await db.insert(attachments).values(allAtts.slice(k, k + 50));
      }
      totalAttachments += allAtts.length;
    }

    process.stdout.write(`  [${i + 1}/${activeLists.length}] "${tl.name.slice(0, 35)}" → ${tCards.length} cards\n`);
  }

  console.log(`
✅ Import complete!
   Lists:       ${totalLists}
   Cards:       ${totalCards}
   Comments:    ${totalComments}
   Attachments: ${totalAttachments}
`);
}

main().catch(e => { console.error(e); process.exit(1); });
