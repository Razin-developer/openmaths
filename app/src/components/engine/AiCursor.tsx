"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { Scene } from "@/lib/dsl/types";
import { getCursorHeading, getCursorPosition } from "@/components/engine/timelineUtils";
import { useEngineColors } from "@/components/engine/colors";

/** The drawing cursor's friendly name — shown in a small note tag next to it while it's
 * actively drawing, so it reads as "someone" sketching the diagram rather than a bare marker. */
export const AI_CURSOR_NAME = "Compass";

const nibShape = new THREE.Shape();
nibShape.moveTo(0, 0.16);
nibShape.lineTo(-0.08, -0.06);
nibShape.lineTo(-0.028, -0.035);
nibShape.lineTo(0, -0.09);
nibShape.lineTo(0.028, -0.035);
nibShape.lineTo(0.08, -0.06);
nibShape.closePath();
const nibGeometry = new THREE.ShapeGeometry(nibShape);

export function AiCursor({
  scene,
  currentOpIndex,
  opProgress,
  visible,
}: {
  scene: Scene;
  currentOpIndex: number;
  opProgress: number;
  visible: boolean;
}) {
  const colors = useEngineColors();
  const position = useMemo(
    () => getCursorPosition(scene.ops, currentOpIndex, opProgress),
    [scene, currentOpIndex, opProgress]
  );
  const heading = useMemo(
    () => getCursorHeading(scene.ops, currentOpIndex, opProgress),
    [scene, currentOpIndex, opProgress]
  );

  if (!visible || !position) return null;

  return (
    <group position={[position[0], position[1], 0.05]}>
      <mesh rotation={[0, 0, heading]}>
        <primitive object={nibGeometry} attach="geometry" />
        <meshBasicMaterial color={colors.ink} transparent opacity={0.95} />
      </mesh>
      {/* <mesh>
        <ringGeometry args={[0.1, 0.15, 24]} />
        <meshBasicMaterial color={colors.ink} transparent opacity={0.3} />
      </mesh> */}
      <Html center distanceFactor={8} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
        <div className="-translate-y-6 rounded-md border border-border bg-popover px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-popover-foreground shadow-sm">
          {AI_CURSOR_NAME}
        </div>
      </Html>
    </group>
  );
}
