import type { EngineColors } from "@/components/engine/colors";

export interface OpPrimitiveProps<TOp> {
  op: TOp;
  /** 0 = not yet drawn, 1 = fully drawn; fractional while this op is the one currently animating. */
  progress: number;
  hovered: boolean;
  onHoverChange: (opId: string | null) => void;
  colors: EngineColors;
}
