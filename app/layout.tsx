import type { Metadata } from "next";
import { Manrope, Bricolage_Grotesque } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ThemedToaster } from "@/components/themed-toaster";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://proboardive.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Proboardive — Organize your work, ship what matters",
    template: "%s — Proboardive",
  },
  description:
    "Proboardive is a kanban workspace for teams: drag-and-drop boards, real-time collaboration, card comments, and an AI board agent that takes action for you.",
  applicationName: "Proboardive",
  keywords: [
    "project management",
    "kanban boards",
    "task organization",
    "team collaboration",
    "drag-and-drop",
    "AI board agent",
    "workspace management",
  ],
  authors: [{ name: "Proboardive" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Proboardive",
    url: siteUrl,
    title: "Proboardive — Organize your work, ship what matters",
    description:
      "A kanban workspace for teams: drag-and-drop boards, real-time collaboration, and an AI board agent that takes action for you.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Proboardive — Organize your work, ship what matters",
    description:
      "A kanban workspace for teams: drag-and-drop boards, real-time collaboration, and an AI board agent that takes action for you.",
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
