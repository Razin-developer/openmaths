// Augments `@types/mdx`'s `declare module "*.mdx"` (which only types the `default` component
// export) to also type the `metadata` export every file under `src/content/**` provides — see
// that package's own index.d.ts doc comment for why this file (a TS "script", no top-level ESM
// syntax of its own) is the documented way to do this. `lib/content.ts`'s dynamic `import()`
// calls already cast this explicitly per-collection and don't need this; this is specifically for
// static imports (the legal pages) where TS enforces the declared module shape strictly.
declare module "*.mdx" {
  export const metadata: Record<string, unknown> & { title: string };
}
