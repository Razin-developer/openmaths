"use client";

import { useState } from "react";
import { MessagesSquare, Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NodeHeader } from "@/components/board/nodeTypes/NodeHeader";
import { NodeBody } from "@/components/board/nodeTypes/NodeBody";
import { FullscreenPlayer } from "@/components/board/nodeTypes/FullscreenPlayer";
import { useBoardUiStore } from "@/store/boardUiStore";
import { cn } from "@/lib/utils";
import type { BlockData } from "@/lib/board/types";
import type { BoardContext } from "@/components/board/Board";

/**
 * Defaults to true edge-to-edge (matching GraphAnimationFullscreen/NoteFullscreen/
 * WebBrowserFullscreen — see boardUiStore's `fullscreenMode`), with a windowed toggle in the
 * header for anyone who prefers the smaller floating card this used to be stuck as (PRD
 * "Fullscreen Player & Animation UX" §6.1/§6.3 — "one consistent fullscreen contract").
 *
 * When the latest answer is a narratable `solution_steps`/`table` form with no connected diagram,
 * opening fullscreen defaults to the stepped `FullscreenPlayer` instead of the plain chat view
 * (§3) — a small Chat/Player toggle keeps the regular chat (history, follow-ups) one click away
 * rather than replacing it outright.
 */
export function NodeFullscreen({ block, ctx }: { block: BlockData; ctx: BoardContext }) {
  const open = useBoardUiStore((s) => s.get(block.id).fullscreen);
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const fullscreenMode = useBoardUiStore((s) => s.fullscreenMode);
  const full = fullscreenMode === "full";

  const latestAnswer = [...block.messages].reverse().find((m) => m.role === "ASSISTANT");
  const hasDiagram = !!ctx.getConnectedGraphBlock(block.id);
  const playerAvailable =
    !hasDiagram &&
    !!latestAnswer &&
    ((latestAnswer.solution && latestAnswer.solution.length > 0) || !!latestAnswer.table);

  const [view, setView] = useState<"player" | "chat">(playerAvailable ? "player" : "chat");
  // This component mounts (and its useState initializer runs) as soon as the node exists — often
  // before any answer has streamed in, when `playerAvailable` is still false. Re-sync the default
  // on each closed->open transition (adjusting state during render, same pattern already used in
  // WebBrowserFullscreen.tsx) so opening fullscreen after an answer lands actually defaults to
  // the player instead of getting stuck on whatever was true at first mount.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setView(playerAvailable ? "player" : "chat");
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }
  const effectiveView = playerAvailable ? view : "chat";

  return (
    <Dialog open={open} onOpenChange={(next) => setFullscreen(block.id, next)}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0",
          full
            ? "fixed inset-0 top-0 left-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none"
            : "h-[85vh] w-[90vw] max-w-3xl"
        )}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Question detail</DialogTitle>
        <NodeHeader block={block} ctx={ctx} fullscreenContext>
          {playerAvailable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setView((v) => (v === "player" ? "chat" : "player"))}
                  aria-label={effectiveView === "player" ? "Switch to chat view" : "Switch to player view"}
                >
                  {effectiveView === "player" ? <MessagesSquare className="size-3" /> : <Play className="size-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{effectiveView === "player" ? "Chat view" : "Player view"}</TooltipContent>
            </Tooltip>
          )}
        </NodeHeader>
        {effectiveView === "player" && latestAnswer ? (
          <FullscreenPlayer
            blockId={block.id}
            solution={latestAnswer.solution}
            table={latestAnswer.table}
            finalAnswer={latestAnswer.finalAnswer}
          />
        ) : (
          <NodeBody block={block} ctx={ctx} />
        )}
      </DialogContent>
    </Dialog>
  );
}
