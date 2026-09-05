import { randomUUID } from "crypto";
import { prisma } from "../index";
import type { Prisma } from "../index";
import { checkUrl } from "./linkCheck";

/** Mirrors app's `BrowserTab` (src/lib/board/types.ts) — kept as a local duplicate rather than a
 * cross-package import since it's a trivial 4-field shape and that file also carries a lot of
 * client-rendering-only types (BlockData etc.) not worth relocating here. */
interface BrowserTab {
  id: string;
  url: string;
  title?: string | null;
  favicon?: string | null;
}

/** A LINK block's tabs — falls back to a single legacy tab built from `prompt` for blocks created
 * before multi-tab support (which never got a `tabs` value written). */
function readTabs(block: { tabs: unknown; prompt: string }): BrowserTab[] {
  if (Array.isArray(block.tabs) && block.tabs.length > 0) return block.tabs as BrowserTab[];
  if (block.prompt) return [{ id: "legacy", url: block.prompt, title: null, favicon: null }];
  return [];
}

/** Every page (across every connected LINK block's tabs) a question is connected to. */
export async function getConnectedWebLinks(
  questionBlockId: string
): Promise<{ id: string; url: string; title: string | null }[]> {
  const connections = await prisma.connection.findMany({
    where: { targetBlockId: questionBlockId, source: { kind: "LINK" } },
    include: { source: true },
  });
  return connections.flatMap((c) =>
    readTabs(c.source).map((t) => ({ id: t.id, url: t.url, title: t.title ?? null }))
  );
}

export interface SkippedLink {
  url: string;
  reason: string;
}

/**
 * Adds each cited URL that isn't already connected to this question as a new TAB on the
 * question's single connected browser (LINK) node — creating that node on first use — instead of
 * spawning a separate node per link. URLs that don't resolve, or come back with an HTTP error
 * status, are left out entirely and reported back in `skipped` so the caller can tell the student
 * why (e.g. "example.com/dead-page: site returned 404").
 */
export async function syncWebLinkNodes(params: {
  canvasId: string;
  questionBlockId: string;
  questionPositionX: number;
  questionPositionY: number;
  urls: string[];
}) {
  const uniqueUrls = Array.from(new Set(params.urls.filter(Boolean)));
  if (uniqueUrls.length === 0) return { block: null, connection: null, addedTabs: [], skipped: [] };

  const existingConnection = await prisma.connection.findFirst({
    where: { targetBlockId: params.questionBlockId, source: { kind: "LINK" } },
    include: { source: true },
  });
  const existingTabs = existingConnection ? readTabs(existingConnection.source) : [];
  const existingUrls = new Set(existingTabs.map((t) => t.url));

  const addedTabs: BrowserTab[] = [];
  const skipped: SkippedLink[] = [];

  for (const url of uniqueUrls) {
    if (existingUrls.has(url)) continue;

    const result = await checkUrl(url);
    if (!result) {
      skipped.push({ url, reason: "Not a valid URL" });
      continue;
    }
    if (!result.ok) {
      skipped.push({ url, reason: result.status ? `Site returned ${result.status}` : "Site couldn't be reached" });
      continue;
    }

    addedTabs.push({ id: randomUUID(), url, title: result.title, favicon: result.favicon });
    existingUrls.add(url);
  }

  if (addedTabs.length === 0) {
    return { block: existingConnection?.source ?? null, connection: null, addedTabs: [], skipped };
  }

  if (existingConnection) {
    const tabs = [...existingTabs, ...addedTabs];
    const updated = await prisma.block.update({
      where: { id: existingConnection.source.id },
      data: { tabs: tabs as unknown as Prisma.InputJsonValue, prompt: tabs[0].url },
    });
    return { block: updated, connection: null, addedTabs, skipped };
  }

  const block = await prisma.block.create({
    data: {
      canvasId: params.canvasId,
      kind: "LINK",
      status: "READY",
      prompt: addedTabs[0].url,
      tabs: addedTabs as unknown as Prisma.InputJsonValue,
      positionX: params.questionPositionX - 360,
      positionY: params.questionPositionY,
    },
  });
  const connection = await prisma.connection.create({
    data: { canvasId: params.canvasId, sourceBlockId: block.id, targetBlockId: params.questionBlockId },
  });

  return { block, connection, addedTabs, skipped };
}

const MAX_ANCESTOR_DEPTH = 5;

/**
 * Sites connected to this question directly OR to any of its ancestor questions (via
 * parentBlockId, same chain buildGenerationContext walks for text context) — so a sub-question
 * automatically inherits its parent's site-restricted search, not just its own direct links.
 * Deduped by URL.
 */
export async function getInheritedWebLinks(
  questionBlockId: string
): Promise<{ id: string; url: string; title: string | null }[]> {
  // PRD "Performance Audit & Answer-Rendering Fix" B7 — this used to be TWO sequential queries
  // per ancestor level (a parentBlockId lookup, then a connections lookup) — up to
  // 2×MAX_ANCESTOR_DEPTH round-trips. Now: one query to find the target's canvas, one to fetch
  // every block's parent pointer in that canvas (walked in memory to build the ancestor chain),
  // and one to fetch every LINK connection for the whole chain at once via `targetBlockId: {in}`.
  const target = await prisma.block.findUnique({
    where: { id: questionBlockId },
    select: { canvasId: true, parentBlockId: true },
  });
  if (!target) return [];

  const ancestorIds: string[] = [];
  if (target.parentBlockId) {
    const canvasBlocks = await prisma.block.findMany({
      where: { canvasId: target.canvasId },
      select: { id: true, parentBlockId: true },
    });
    const byId = new Map(canvasBlocks.map((b) => [b.id, b]));
    let currentId: string | null = target.parentBlockId;
    let depth = 0;
    while (currentId && depth < MAX_ANCESTOR_DEPTH) {
      ancestorIds.push(currentId);
      currentId = byId.get(currentId)?.parentBlockId ?? null;
      depth += 1;
    }
  }

  const connections = await prisma.connection.findMany({
    where: { targetBlockId: { in: [questionBlockId, ...ancestorIds] }, source: { kind: "LINK" } },
    include: { source: true },
  });

  const seen = new Set<string>();
  const all: { id: string; url: string; title: string | null }[] = [];
  for (const connection of connections) {
    for (const tab of readTabs(connection.source)) {
      if (seen.has(tab.url)) continue;
      seen.add(tab.url);
      all.push({ id: tab.id, url: tab.url, title: tab.title ?? null });
    }
  }
  return all;
}

/** Hostname of a URL, or null if it doesn't parse — used to restrict Exa search to one site. */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
