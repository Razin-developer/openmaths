import { prisma } from "../index";

const MAX_CONTEXT_DEPTH = 5;
const MAX_ANSWER_CHARS = 1500;

interface ContextSourceBlock {
  id: string;
  kind: string;
  prompt: string;
  title: string | null;
  latestAnswer: string | null;
}

function describeSource(source: ContextSourceBlock): string {
  if (source.kind === "NOTE") {
    return `Context from a connected note:\n${source.prompt.slice(0, MAX_ANSWER_CHARS)}`;
  }
  if (source.kind === "LINK") {
    // A live, site-restricted Exa search for this turn's question is folded in separately
    // (see the messages route) — this is just the fallback identification of the source itself.
    return `Connected web link: "${source.title ?? source.prompt}" (${source.prompt}).`;
  }
  const answer = (source.latestAnswer ?? "(no answer yet)").slice(0, MAX_ANSWER_CHARS);
  return `Context from related question "${source.prompt}":\n${answer}`;
}

/**
 * Assembles a bounded context string from a block's connected + ancestor blocks,
 * for feeding into generation so connected questions, notes, and parent nodes all
 * influence the answer. GRAPH-kind blocks are diagram-only and never contribute text.
 */
export async function buildGenerationContext(blockId: string): Promise<string | undefined> {
  const sources = new Map<string, ContextSourceBlock>();

  const target = await prisma.block.findUnique({
    where: { id: blockId },
    include: {
      incoming: {
        include: {
          source: {
            include: { messages: { where: { role: "ASSISTANT" }, orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
      },
    },
  });

  if (!target) return undefined;

  for (const connection of target.incoming) {
    const source = connection.source;
    if (source.kind === "GRAPH") continue;
    sources.set(source.id, {
      id: source.id,
      kind: source.kind,
      prompt: source.prompt,
      title: source.title,
      latestAnswer: source.messages[0]?.content ?? null,
    });
  }

  // PRD "Performance Audit & Answer-Rendering Fix" B7 — this used to be one `findUnique` PER
  // ancestor level (up to MAX_CONTEXT_DEPTH sequential round-trips). One query for every block on
  // the canvas, then walk the parent chain in memory — a single round-trip regardless of depth.
  if (target.parentBlockId) {
    const canvasBlocks = await prisma.block.findMany({
      where: { canvasId: target.canvasId },
      include: { messages: { where: { role: "ASSISTANT" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const byId = new Map(canvasBlocks.map((b) => [b.id, b]));

    let currentParentId: string | null = target.parentBlockId;
    let depth = 0;
    while (currentParentId && depth < MAX_CONTEXT_DEPTH) {
      if (sources.has(currentParentId)) break;
      const parent = byId.get(currentParentId);
      if (!parent || parent.kind === "GRAPH") break;
      sources.set(parent.id, {
        id: parent.id,
        kind: parent.kind,
        prompt: parent.prompt,
        title: parent.title,
        latestAnswer: parent.messages[0]?.content ?? null,
      });
      currentParentId = parent.parentBlockId;
      depth += 1;
    }
  }

  if (sources.size === 0) return undefined;

  const parts = Array.from(sources.values()).map(describeSource);
  return parts.join("\n\n");
}
