/**
 * Delete lists created by a previous Trello import.
 *
 * Imports append lists rather than replacing them, so re-importing a board
 * after the cover/comment/attachment fixes would duplicate everything. This
 * removes the earlier import first.
 *
 * Imported lists are recognised by the file URLs their cards carry:
 *   legacy   — raw `https://trello.com/...` links, i.e. imported before the
 *              proxy fix (these are the broken ones: covers missing, comments
 *              truncated at 1000, attachment links 401)
 *   proxied  — `/api/trello-asset?...` links, i.e. imported after the fix
 *
 * Lists with no import signature are never touched unless named explicitly
 * with --lists. Deleting a list cascades to its cards, comments, attachments,
 * card credentials and label assignments.
 *
 *   npx tsx --env-file=.env.local scripts/cleanup-trello-import.ts
 *   npx tsx --env-file=.env.local scripts/cleanup-trello-import.ts --board=<boardId>
 *   npx tsx --env-file=.env.local scripts/cleanup-trello-import.ts --board=<boardId> --apply
 *
 * Flags:
 *   --board=<id>     board to clean (omit to list boards and exit)
 *   --all            also delete lists imported after the fix, not just legacy ones
 *   --include-empty  also delete lists holding no cards (an imported list with no
 *                    cards carries no signature, so it can't be detected on its own)
 *   --lists=a,b,c    delete exactly these list ids, whatever their signature
 *   --apply          actually delete; without it the script only reports
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attachments,
  boards,
  cards,
  comments,
  lists,
  workspaces,
} from "@/db/schema";

const LEGACY_PREFIX = "https://trello.com/%";
const PROXY_PREFIX = "/api/trello-asset%";

type Flags = {
  board?: string;
  lists?: string[];
  all: boolean;
  includeEmpty: boolean;
  apply: boolean;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { all: false, includeEmpty: false, apply: false };
  for (const arg of argv) {
    if (arg === "--apply") flags.apply = true;
    else if (arg === "--all") flags.all = true;
    else if (arg === "--include-empty") flags.includeEmpty = true;
    else if (arg.startsWith("--board=")) flags.board = arg.slice(8).trim();
    else if (arg.startsWith("--lists="))
      flags.lists = arg.slice(8).split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--")) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }
  return flags;
}

async function listBoards() {
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      workspace: workspaces.name,
      listCount: sql<number>`count(${lists.id})::int`,
    })
    .from(boards)
    .innerJoin(workspaces, eq(workspaces.id, boards.workspaceId))
    .leftJoin(lists, eq(lists.boardId, boards.id))
    .groupBy(boards.id, boards.name, workspaces.name)
    .orderBy(boards.name);

  console.log("\nBoards:\n");
  for (const b of rows) {
    console.log(`  ${b.id}  ${b.workspace} / ${b.name}  (${b.listCount} lists)`);
  }
  console.log("\nRe-run with --board=<id> to inspect one.\n");
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (!flags.board) {
    await listBoards();
    return;
  }

  const [board] = await db
    .select({ id: boards.id, name: boards.name })
    .from(boards)
    .where(eq(boards.id, flags.board))
    .limit(1);
  if (!board) {
    console.error(`No board with id ${flags.board}`);
    process.exit(1);
  }

  // One aggregate pass over the board: per-list totals plus how many of its
  // files look legacy-imported vs proxy-imported.
  const rows = await db
    .select({
      listId: lists.id,
      title: lists.title,
      position: lists.position,
      cardCount: sql<number>`count(distinct ${cards.id})::int`,
      legacyFiles: sql<number>`count(distinct ${attachments.id}) filter (where ${attachments.url} like ${LEGACY_PREFIX})::int`,
      proxiedFiles: sql<number>`count(distinct ${attachments.id}) filter (where ${attachments.url} like ${PROXY_PREFIX})::int`,
      legacyBanners: sql<number>`count(distinct ${cards.id}) filter (where ${cards.bannerUrl} like ${LEGACY_PREFIX})::int`,
      proxiedBanners: sql<number>`count(distinct ${cards.id}) filter (where ${cards.bannerUrl} like ${PROXY_PREFIX})::int`,
    })
    .from(lists)
    .leftJoin(cards, eq(cards.listId, lists.id))
    .leftJoin(attachments, eq(attachments.cardId, cards.id))
    .where(eq(lists.boardId, board.id))
    .groupBy(lists.id, lists.title, lists.position)
    .orderBy(lists.position);

  // Comments counted separately — joining two one-to-many tables at once would
  // multiply the rows and inflate every total.
  const commentRows = await db
    .select({
      listId: cards.listId,
      commentCount: sql<number>`count(${comments.id})::int`,
    })
    .from(cards)
    .innerJoin(comments, eq(comments.cardId, cards.id))
    .where(
      inArray(
        cards.listId,
        rows.map((r) => r.listId)
      )
    )
    .groupBy(cards.listId);

  const commentsByList = new Map(commentRows.map((r) => [r.listId, r.commentCount]));

  const annotated = rows.map((r) => {
    const legacy = r.legacyFiles + r.legacyBanners;
    const proxied = r.proxiedFiles + r.proxiedBanners;
    const kind = legacy > 0 ? "legacy" : proxied > 0 ? "proxied" : "—";
    return { ...r, commentCount: commentsByList.get(r.listId) ?? 0, legacy, proxied, kind };
  });

  const short = (s: string) => (s.length > 46 ? `${s.slice(0, 45)}…` : s);

  console.log(`\nBoard: ${board.name}  (${board.id})\n`);
  console.log("  list id                               kind     cards  comments  files  title");
  for (const l of annotated) {
    console.log(
      `  ${l.listId}  ${l.kind.padEnd(7)}  ${String(l.cardCount).padStart(5)}` +
        `  ${String(l.commentCount).padStart(8)}  ${String(l.legacy + l.proxied).padStart(5)}  ${short(l.title)}`
    );
  }

  const empties = annotated.filter((l) => l.cardCount === 0);

  let doomed: typeof annotated;
  if (flags.lists) {
    const wanted = new Set(flags.lists);
    doomed = annotated.filter((l) => wanted.has(l.listId));
    const missing = flags.lists.filter((id) => !annotated.some((l) => l.listId === id));
    if (missing.length) {
      console.error(`\nThese list ids are not on this board: ${missing.join(", ")}`);
      process.exit(1);
    }
  } else {
    doomed = annotated.filter(
      (l) =>
        l.kind === "legacy" ||
        (flags.all && l.kind === "proxied") ||
        (flags.includeEmpty && l.cardCount === 0)
    );
  }

  // An imported list that ended up with no cards leaves no trace to match on, so
  // it survives the signature check and would duplicate on the next import.
  if (!flags.lists && !flags.includeEmpty && empties.length > 0) {
    console.log(
      `\nNote: ${empties.length} list(s) hold no cards, so they can't be identified as imported ` +
        `or not:\n${empties.map((l) => `  · ${short(l.title)}`).join("\n")}\n` +
        `If they came from the same import, add --include-empty, or name them with --lists=<id,…>.`
    );
  }

  if (doomed.length === 0) {
    console.log(
      flags.all
        ? "\nNothing to delete — no imported lists found.\n"
        : "\nNothing to delete — no legacy imports found. Use --all to include lists imported after the fix.\n"
    );
    return;
  }

  const totals = doomed.reduce(
    (acc, l) => ({
      cards: acc.cards + l.cardCount,
      comments: acc.comments + l.commentCount,
      files: acc.files + l.legacyFiles + l.proxiedFiles,
    }),
    { cards: 0, comments: 0, files: 0 }
  );

  console.log(`\n${flags.apply ? "Deleting" : "Would delete"} ${doomed.length} list(s):`);
  for (const l of doomed) console.log(`  - ${short(l.title)}  (${l.cardCount} cards)`);
  console.log(
    `\nCascades to ${totals.cards} cards, ${totals.comments} comments, ${totals.files} attachments.`
  );

  if (!flags.apply) {
    console.log("\nDry run. Re-run with --apply to delete.\n");
    return;
  }

  const ids = doomed.map((l) => l.listId);
  // Scoped to this board as well as the ids, so a stale id can't reach elsewhere.
  await db.delete(lists).where(and(eq(lists.boardId, board.id), inArray(lists.id, ids)));

  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(lists)
    .where(and(eq(lists.boardId, board.id), inArray(lists.id, ids)));

  if (remaining > 0) {
    console.error(`\nExpected 0 of those lists to remain, found ${remaining}.`);
    process.exit(1);
  }

  const [{ orphanCards }] = await db
    .select({ orphanCards: sql<number>`count(*)::int` })
    .from(cards)
    .where(inArray(cards.listId, ids));

  console.log(`\nDeleted ${doomed.length} list(s). Cards left behind: ${orphanCards}.`);
  console.log("Re-run the Trello import to bring the board back in cleanly.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
