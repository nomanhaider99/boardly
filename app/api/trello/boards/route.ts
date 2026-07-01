import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trelloConnections } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [creds] = await db
    .select({ apiKey: trelloConnections.apiKey, token: trelloConnections.token })
    .from(trelloConnections)
    .where(eq(trelloConnections.userId, session.userId))
    .limit(1);

  if (!creds) return NextResponse.json({ error: "Not connected to Trello" }, { status: 400 });

  const res = await fetch(
    `https://api.trello.com/1/members/me/boards?key=${encodeURIComponent(creds.apiKey)}&token=${encodeURIComponent(creds.token)}&filter=open&fields=id,name,shortUrl`,
    { cache: "no-store" }
  );

  if (!res.ok) return NextResponse.json({ error: "Failed to fetch boards from Trello" }, { status: 502 });

  const boards: { id: string; name: string; shortUrl: string }[] = await res.json();

  return NextResponse.json({ boards });
}
