import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@openmaths/components/theme-provider";
import { LenisProvider } from "@/components/LenisProvider";
import { PostHogProvider } from "@/components/PostHogProvider";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "openmaths",
  url: SITE_URL,
  description: DESCRIPTION,
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "openmaths",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/help?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Landing-rework PRD §5: opts full (cross-document) navigations into the browser's native
            View Transitions — a same-origin nav cross-fades instead of hard-cutting. This is the
            standards-based half of §5's ask; React's own <ViewTransition> primitive (which would
            also smooth App Router's client-side navigations) needs React's canary channel and
            isn't in the stable 19.2 release this app runs — confirmed directly, not assumed — so
            wiring a manual `document.startViewTransition()` around the router would be fighting
            React's own batching rather than using a supported primitive. Zero-risk, progressive:
            unsupported browsers and reduced-motion users just get the normal instant navigation. */}
        <meta name="view-transition" content="same-origin" />
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider>
          <PostHogProvider>
            <WebVitalsReporter />
            <LenisProvider>
              <Nav />
              <main>{children}</main>
              <Footer />
            </LenisProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
