"use server";

import { z } from "zod";

interface LinkMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  url: string;
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.protocol.startsWith("http")) {
      return { title: null, description: null, image: null, favicon: null, url };
    }
  } catch {
    return { title: null, description: null, image: null, favicon: null, url };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BoardlyBot/1.0; +https://boardly.app)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { title: null, description: null, image: null, favicon: null, url };
    }

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const ogDescriptionMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const ogUrlMatch = html.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);

    const twitterTitleMatch = html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
    const twitterDescriptionMatch = html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
    const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);

    const metaDescriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);

    const finalTitle = ogTitleMatch?.[1] || twitterTitleMatch?.[1] || title;
    const finalDescription = ogDescriptionMatch?.[1] || twitterDescriptionMatch?.[1] || metaDescriptionMatch?.[1] || null;
    const finalImage = ogImageMatch?.[1] || twitterImageMatch?.[1] || null;

    let favicon: string | null = null;
    const iconMatch = html.match(/<link\s+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']\s+href=["']([^"']+)["']/i);
    if (iconMatch) {
      favicon = new URL(iconMatch[1], url).href;
    } else {
      try {
        favicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
      } catch {}
    }

    return {
      title: finalTitle,
      description: finalDescription,
      image: finalImage ? new URL(finalImage, url).href : null,
      favicon,
      url: ogUrlMatch?.[1] ? new URL(ogUrlMatch[1], url).href : url,
    };
  } catch {
    return { title: null, description: null, image: null, favicon: null, url };
  }
}

export async function extractUrlsFromText(text: string): Promise<string[]> {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  return matches || [];
}