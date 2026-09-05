import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";

const COLLAPSED_HEIGHT = 44;

/**
 * Nodes now carry a real, fixed `height` (not content-driven auto-height — see Board.tsx's
 * blockToNode for why), so toggling "collapsed" layout no longer shrinks the node on its own:
 * the React Flow node's actual height stays whatever it was. This imperatively resizes the node
 * to a header-only height on collapse and restores the previous height on expand.
 */
export function useCollapseHeight(nodeId: string, collapsed: boolean, defaultHeight: number) {
  const { updateNode, getNode } = useReactFlow();
  const expandedHeightRef = useRef(defaultHeight);
  const prevCollapsedRef = useRef(collapsed);

  useEffect(() => {
    if (prevCollapsedRef.current === collapsed) return;
    prevCollapsedRef.current = collapsed;

    if (collapsed) {
      const current = getNode(nodeId)?.height;
      if (current) expandedHeightRef.current = current;
      updateNode(nodeId, { height: COLLAPSED_HEIGHT });
    } else {
      updateNode(nodeId, { height: expandedHeightRef.current });
    }
  }, [collapsed, nodeId, updateNode, getNode]);
}
