import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

/**
 * Grows a node's real (fixed) React Flow height to fit its content as content streams/accumulates
 * — up to `maxHeight`, past which the node's own internal ScrollArea takes over instead of the
 * node growing further. Only ever grows, never shrinks (a node that briefly had more content and
 * then less — e.g. a fullscreen edit trimming text — shouldn't visibly collapse under the user).
 * Disabled once the node has been manually resized (see boardUiStore.manuallyResized): a user
 * drag is an explicit height choice this must not fight.
 */
export function useAutoGrowHeight(
  nodeId: string,
  contentRef: React.RefObject<HTMLElement | null>,
  options: { chromeHeight: number; minHeight: number; maxHeight: number; enabled: boolean }
) {
  const { updateNode, getNode } = useReactFlow();
  const { chromeHeight, minHeight, maxHeight, enabled } = options;

  useEffect(() => {
    if (!enabled) return;
    const el = contentRef.current;
    if (!el) return;

    function measure() {
      const contentHeight = el!.getBoundingClientRect().height;
      const desired = Math.min(Math.max(contentHeight + chromeHeight, minHeight), maxHeight);
      const current = getNode(nodeId)?.height ?? minHeight;
      if (desired > current + 0.5) updateNode(nodeId, { height: desired });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [nodeId, contentRef, chromeHeight, minHeight, maxHeight, enabled, updateNode, getNode]);
}
