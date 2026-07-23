"use server";

export type LinkPreview = {
  url: string;
  title: string | null;
  favicon: string | null;
};

// In-memory cache (per server instance) to avoid re-fetching the same URL.
const cache = new Map<string, LinkPreview>();

function faviconFor(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
}

// Block obvious internal/private hosts to limit SSRF surface.
function isBlockedHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .trim();
}

function extractTitle(html: string): string | null {
  // Prefer Open Graph / Twitter title, then <title>
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return decodeEntities(og[1]).slice(0, 200);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return decodeEntities(title[1]).slice(0, 200);

  return null;
}

export async function getLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { url: rawUrl, title: null, favicon: null };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { url: rawUrl, title: null, favicon: null };
  }
  if (isBlockedHost(url.hostname)) {
    return { url: rawUrl, title: null, favicon: faviconFor(url) };
  }

  const key = url.href;
  const cached = cache.get(key);
  if (cached) return cached;

  const fallback: LinkPreview = { url: rawUrl, title: null, favicon: faviconFor(url) };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ProboardiveBot/1.0; +https://proboardive.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("text/html")) {
      cache.set(key, fallback);
      return fallback;
    }

    // Read at most ~100KB — the <head> is all we need.
    const html = (await res.text()).slice(0, 100_000);
    const result: LinkPreview = {
      url: rawUrl,
      title: extractTitle(html),
      favicon: faviconFor(url),
    };
    cache.set(key, result);
    return result;
  } catch {
    return fallback;
  }
}
