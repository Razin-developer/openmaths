import { prisma } from "../index";
import type { Prisma } from "../index";
import type { Scene } from "@openmaths/shared/dsl/types";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeTitle(title: string | null): string {
  return (title ?? "").replace(/^Diagram:\s*/i, "").trim().toLowerCase();
}

/**
 * Ensures a QUESTION/SUB_QUESTION block has the right connected GRAPH child carrying a diagram —
 * creates one on first need, updates an existing one's scene when it can be matched by name
 * (supporting several distinct named diagrams per question), and otherwise falls back to
 * updating the single existing diagram (or the most recently created one) so a question with no
 * name given by the model doesn't multiply nodes it didn't ask for.
 */
export async function syncGraphNode(params: {
  canvasId: string;
  questionBlockId: string;
  questionPositionX: number;
  questionPositionY: number;
  scene: Scene;
  title?: string;
  diagramTitle?: string;
}) {
  const existingConnections = await prisma.connection.findMany({
    where: { sourceBlockId: params.questionBlockId, target: { kind: "GRAPH" } },
    include: { target: true },
    orderBy: { createdAt: "asc" },
  });

  let match = params.diagramTitle
    ? existingConnections.find((c) => normalizeTitle(c.target.title) === normalizeTitle(params.diagramTitle!))
    : undefined;

  // No exact name match: if the model didn't name a diagram and exactly one already exists,
  // treat this as an update to that one (backward-compatible single-diagram behavior). If it DID
  // name a diagram but nothing matched, or several already exist with no name given, fall through
  // to creating a new named diagram rather than guessing which existing one to overwrite.
  if (!match && !params.diagramTitle && existingConnections.length === 1) {
    match = existingConnections[0];
  }

  if (match) {
    const graphBlock = await prisma.block.update({
      where: { id: match.targetBlockId },
      data: { scene: toJsonValue(params.scene), status: "READY" },
    });
    return { graphBlock, connection: match, created: false };
  }

  const displayTitle = params.diagramTitle || params.title;
  const offset = existingConnections.length * 40;

  const graphBlock = await prisma.block.create({
    data: {
      canvasId: params.canvasId,
      kind: "GRAPH",
      status: "READY",
      prompt: "",
      title: displayTitle ? `Diagram: ${displayTitle}`.slice(0, 60) : null,
      scene: toJsonValue(params.scene),
      positionX: params.questionPositionX + 360,
      positionY: params.questionPositionY + offset,
    },
  });

  const connection = await prisma.connection.create({
    data: {
      canvasId: params.canvasId,
      sourceBlockId: params.questionBlockId,
      targetBlockId: graphBlock.id,
    },
  });

  return { graphBlock, connection, created: true };
}

/** Titles (with any "Diagram: " prefix stripped) of a question's currently connected diagrams. */
export async function getConnectedDiagramTitles(questionBlockId: string): Promise<string[]> {
  const connections = await prisma.connection.findMany({
    where: { sourceBlockId: questionBlockId, target: { kind: "GRAPH" } },
    include: { target: true },
    orderBy: { createdAt: "asc" },
  });
  return connections
    .map((c) => c.target.title)
    .filter((t): t is string => !!t)
    .map((t) => t.replace(/^Diagram:\s*/i, "").trim());
}
