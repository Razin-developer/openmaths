import { notFound } from "next/navigation";
import { requireUser } from "@/lib/currentUser";
import { serverApiOptions } from "@/lib/serverApi";
import { Board } from "@/components/board/Board";
import { JoinCanvasPrompt } from "@/components/board/JoinCanvasPrompt";
import { api, ApiError } from "@openmaths/api-client";
import type { CanvasData, MessageData, BlockKind, BlockStatus } from "@/lib/board/types";
import type { Scene } from "@/lib/dsl/types";
import type { CanvasRole } from "@/lib/canvasAccess";

// Prisma-facing shape server-side (packages/db's Block/Message/Connection rows, round-tripped
// through JSON — Dates arrive as ISO strings already, unlike the old direct-Prisma version of
// this page which had to call `.toISOString()` itself).
interface RawBlock {
  id: string;
  canvasId: string;
  parentBlockId: string | null;
  kind: BlockKind;
  status: BlockStatus;
  title: string | null;
  prompt: string;
  modelId: string | null;
  reasoningEffort: string | null;
  scene: Scene | null;
  narration: CanvasData["blocks"][number]["narration"];
  tabs: CanvasData["blocks"][number]["tabs"] | null;
  errorMessage: string | null;
  positionX: number;
  positionY: number;
  messages: RawMessage[];
}

interface RawMessage {
  id: string;
  role: MessageData["role"];
  content: string;
  attachments: MessageData["attachments"];
  solution: MessageData["solution"];
  finalAnswer: string | null;
  table: MessageData["table"];
  createdAt: string;
}

interface RawConnection {
  id: string;
  canvasId: string;
  sourceBlockId: string;
  targetBlockId: string;
  label: string | null;
}

interface RawCanvas {
  id: string;
  title: string;
  blocks: RawBlock[];
  connections: RawConnection[];
}

/**
 * PRD "Split into app + server" P3-continued — converted from direct Prisma access to
 * `serverApi()` (this app no longer imports `@/lib/prisma` here at all). The full three-way
 * branch (accessible / valid-share-link-not-yet-joined / neither) now lives in `server`'s
 * `GET /canvases/:id` route (see its own doc comment) — this page just renders whichever of the
 * two shapes comes back, or 404s on neither.
 */
export default async function CanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ canvasId: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { canvasId } = await params;
  const { share } = await searchParams;
  await requireUser();
  const opts = await serverApiOptions();

  let result;
  try {
    result = await api.canvases.get(canvasId, share, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  if (result.joinPrompt) {
    const { joinPrompt } = result;
    return (
      <JoinCanvasPrompt
        canvasId={joinPrompt.canvasId}
        token={joinPrompt.token}
        canvasTitle={joinPrompt.canvasTitle}
        ownerName={joinPrompt.ownerName}
        role={joinPrompt.role}
      />
    );
  }

  const canvas = result.canvas as RawCanvas;
  const role = result.role as CanvasRole;

  const data: CanvasData = {
    id: canvas.id,
    title: canvas.title,
    blocks: canvas.blocks.map((block) => ({
      id: block.id,
      canvasId: block.canvasId,
      parentBlockId: block.parentBlockId,
      kind: block.kind,
      status: block.status,
      title: block.title,
      prompt: block.prompt,
      modelId: block.modelId,
      reasoningEffort: block.reasoningEffort,
      scene: block.scene ?? null,
      narration: block.narration,
      tabs: Array.isArray(block.tabs) ? block.tabs : null,
      errorMessage: block.errorMessage,
      positionX: block.positionX,
      positionY: block.positionY,
      messages: block.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments,
        solution: m.solution,
        finalAnswer: m.finalAnswer,
        table: m.table,
        createdAt: m.createdAt,
      })),
    })),
    connections: canvas.connections.map((c) => ({
      id: c.id,
      canvasId: c.canvasId,
      sourceBlockId: c.sourceBlockId,
      targetBlockId: c.targetBlockId,
      label: c.label,
    })),
  };

  return (
    <>
      <div className="hidden h-full md:block">
        <Board initialCanvas={data} role={role ?? "viewer"} />
      </div>
      <div className="flex h-full items-center justify-center p-6 text-center md:hidden">
        <p className="max-w-xs text-xs text-muted-foreground">
          The canvas is a power-tool UI best used on a tablet or desktop-sized screen.
        </p>
      </div>
    </>
  );
}
