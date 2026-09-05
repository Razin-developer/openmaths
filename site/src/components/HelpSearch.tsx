"use client";

import { useState } from "react";
import Link from "next/link";
import type { HelpMeta } from "@/lib/content";

/** Client-side filter over a small, fully-known article list (P4's scope: a handful of articles,
 * not hundreds) — no search index/service needed for this size, just a substring match against
 * title/description. */
export function HelpSearch({ articles }: { articles: Array<HelpMeta & { slug: string }> }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? articles.filter((a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
    : articles;
  const categories = Array.from(new Set(filtered.map((a) => a.category)));

  return (
    <div className="flex flex-col gap-10">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search help articles…"
        className="mx-auto w-full max-w-[480px] rounded-pill border border-border bg-background px-5 py-3 text-body text-foreground"
      />
      {filtered.length === 0 && (
        <p role="status" className="text-center text-body text-muted-foreground">
          No articles match &ldquo;{query}&rdquo;.
        </p>
      )}
      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-4">
          <h2 className="text-h4 font-semibold">{category}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered
              .filter((a) => a.category === category)
              .map((article) => (
                <Link
                  key={article.slug}
                  href={`/help/${article.slug}`}
                  className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-5 transition-colors hover:bg-muted"
                >
                  <h3 className="text-body font-semibold">{article.title}</h3>
                  <p className="text-body-sm text-muted-foreground">{article.description}</p>
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
