import crypto from "crypto";

/**
 * Trello serves attachment and cover-preview files from trello.com behind its
 * own auth — the raw URLs answer 401 for everyone, including with `?key&token`
 * in the query string. Only an `Authorization: OAuth …` header works.
 *
 * So imported files are stored as links back to our own proxy route, which
 * re-requests them from Trello with the importing user's credentials. The URL
 * carries an HMAC so the route can't be turned into an open proxy: it will only
 * fetch URLs this app minted.
 */

const PREFIX = "https://trello.com/1/cards/";

function key(): Buffer {
  const secret = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
  return crypto.createHash("sha256").update(`trello-asset:${secret}`).digest();
}

function sign(url: string, userId: string): string {
  return crypto.createHmac("sha256", key()).update(`${userId}\n${url}`).digest("hex");
}

/** True for the trello.com file URLs the proxy is allowed to fetch. */
export function isProxyableTrelloUrl(url: string): boolean {
  return url.startsWith(PREFIX);
}

/**
 * App-relative proxy URL for a Trello file, or null if the URL isn't a Trello
 * -hosted one (external attachments already resolve fine on their own).
 */
export function trelloAssetUrl(url: string, importerUserId: string): string | null {
  if (!isProxyableTrelloUrl(url)) return null;
  const qs = new URLSearchParams({
    u: url,
    uid: importerUserId,
    sig: sign(url, importerUserId),
  });
  return `/api/trello-asset?${qs.toString()}`;
}

/** Constant-time check that this app signed the (url, userId) pair. */
export function verifyTrelloAssetSignature(
  url: string,
  userId: string,
  signature: string
): boolean {
  const expected = sign(url, userId);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}
