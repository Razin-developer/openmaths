import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme-provider";
import { PreferencesProvider, PREFS_INIT_SCRIPT } from "@/components/preferences-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/shell/app-shell";
import { QueryProvider } from "@/components/query-provider";
import { AppToaster } from "@/components/app-toaster";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { ReactScanReporter } from "@/components/ReactScanReporter";
import { OfflineBanner } from "@/components/OfflineBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "openmaths",
  description: "AI-drawn, step-by-step math canvas.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set by proxy.ts's middleware (PRD "Auth & Security Audit" F5) — every request gets a fresh
  // nonce; these two <Script> tags are the only inline scripts this app renders itself, so they're
  // the only ones that need it threaded through manually (Next's own framework scripts pick up
  // the same nonce automatically from the CSP response header).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce}>
          {THEME_INIT_SCRIPT}
        </Script>
        <Script id="prefs-init" strategy="beforeInteractive" nonce={nonce}>
          {PREFS_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <PreferencesProvider>
            <QueryProvider>
              <TooltipProvider delayDuration={200}>
                <AppShell>{children}</AppShell>
                <AppToaster />
                <WebVitalsReporter />
                <ReactScanReporter />
                <OfflineBanner />
              </TooltipProvider>
            </QueryProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
