/** Wraps MDX article bodies in Tailwind Typography's `prose` class, styled via this site's own
 * tokens (see globals.css's `.prose` block) rather than the plugin's stock palette. `prose-lg`
 * matches the body-lg type scale better than the plugin's default `prose` sizing for long-form
 * reading content specifically (product UI elsewhere uses the PRD's own `body`/`body-sm` scale). */
export function ProseArticle({ children }: { children: React.ReactNode }) {
  return <div className="prose prose-lg mx-auto max-w-[68ch] dark:prose-invert">{children}</div>;
}
