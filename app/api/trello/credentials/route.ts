import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trelloConnections } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ id: trelloConnections.id })
    .from(trelloConnections)
    .where(eq(trelloConnections.userId, session.userId))
    .limit(1);

  return NextResponse.json({ connected: !!row });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey, token } = await req.json();
  if (!apiKey?.trim() || !token?.trim())
    return NextResponse.json({ error: "API key and token are required" }, { status: 400 });

  // Validate credentials against Trello API
  const test = await fetch(
    `https://api.trello.com/1/members/me?key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}&fields=id,fullName`,
    { cache: "no-store" }
  );
  if (!test.ok)
    return NextResponse.json(
      { error: "Invalid Trello credentials. Check your API key and token." },
      { status: 400 }
    );

  const trelloUser: { fullName: string } = await test.json();

  // Upsert
  await db
    .insert(trelloConnections)
    .values({ userId: session.userId, apiKey: apiKey.trim(), token: token.trim() })
    .onConflictDoUpdate({
      target: trelloConnections.userId,
      set: { apiKey: apiKey.trim(), token: token.trim() },
    });

  return NextResponse.json({ connected: true, trelloName: trelloUser.fullName });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .delete(trelloConnections)
    .where(eq(trelloConnections.userId, session.userId));

  return NextResponse.json({ connected: false });
}
