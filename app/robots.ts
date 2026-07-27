import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://proboardive.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated app surfaces have no SEO value and shouldn't be crawled.
      disallow: [
        "/dashboard",
        "/workspace/",
        "/profile",
        "/invites",
        "/accept-invite",
        "/verify-email",
        "/reset-password",
        "/2fa",
        "/api/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
