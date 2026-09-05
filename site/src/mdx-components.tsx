import type { MDXComponents } from "mdx/types";
import Link from "next/link";

/**
 * Required by `@next/mdx` for the App Router (per its own docs: "will not work without it").
 * Only overrides `a` — internal links should use next/link for client-side navigation; everything
 * else is styled via the `prose` wrapper (`@tailwindcss/typography`) each content layout applies,
 * not per-element overrides here.
 */
const components: MDXComponents = {
  a: ({ href, children, ...props }) => {
    if (href?.startsWith("/")) {
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export function useMDXComponents(): MDXComponents {
  return components;
}
