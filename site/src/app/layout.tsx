import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@openmaths/components/theme-provider";
import { LenisProvider } from "@/components/LenisProvider";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = "https://openmaths.com";
const TITLE = "openmaths — Watch math explain itself";
const DESCRIPTION =
  "An AI math tutor that draws the diagram, narrates every step, and lets you branch and explore on an infinite canvas.";

/**
 * SEO/OG infra (PRD P1 scope, §8/§9): a title template every page's own metadata extends, a
 * shared description/OG image fallback, and `metadataBase` so relative OG/canonical URLs resolve
 * correctly. Per-page `generateMetadata`/JSON-LD lands page by page in P2+; this is the shared
 * foundation they all build on.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s — openmaths" },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "openmaths",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <LenisProvider>
            <Nav />
            <main>{children}</main>
            <Footer />
          </LenisProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
