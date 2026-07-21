import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trelloConnections } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { isProxyableTrelloUrl, verifyTrelloAssetSignature } from "@/lib/trello-asset";

/**
 * GET /api/trello-asset?u=<trello url>&uid=<importer>&sig=<hmac>
 *
 * Streams an imported Trello attachment or cover preview, adding the OAuth
 * header Trello requires. Signed URLs only, so this can't be used as a general
 * outbound proxy, and the caller must be signed in.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("u");
  const uid = req.nextUrl.searchParams.get("uid");
  const sig = req.nextUrl.searchParams.get("sig");
  if (!url || !uid || !sig)
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

  if (!isProxyableTrelloUrl(url))
    return NextResponse.json({ error: "Unsupported URL" }, { status: 400 });

  if (!verifyTrelloAssetSignature(url, uid, sig))
    return NextResponse.json({ error: "Bad signature" }, { status: 403 });

  const [creds] = await db
    .select({ apiKey: trelloConnections.apiKey, token: trelloConnections.token })
    .from(trelloConnections)
    .where(eq(trelloConnections.userId, uid))
    .limit(1);
  if (!creds)
    return NextResponse.json(
      { error: "The Trello account these files were imported with is no longer connected." },
      { status: 409 }
    );

  const range = req.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        Authorization: `OAuth oauth_consumer_key="${creds.apiKey}", oauth_token="${creds.token}"`,
        ...(range ? { Range: range } : {}),
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Could not reach Trello" }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206)
    return NextResponse.json(
      { error: `Trello returned ${upstream.status}` },
      { status: upstream.status === 401 || upstream.status === 404 ? upstream.status : 502 }
    );

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Render in place rather than forcing a download; the UI links these directly.
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
