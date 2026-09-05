import { describe, it, expect } from "vitest";
import { resolveScene, defaultVariableValues } from "@/lib/dsl/resolveScene";
import type { Scene } from "@/lib/dsl/types";

const RADIUS_SCENE: Scene = {
  version: 1,
  ops: [{ id: "c1", step: 0, op: "draw_circle", center: [0, 0], radius: 1 }],
  variables: [{ id: "r", label: "Radius", min: 1, max: 10, default: 2 }],
  bindings: [{ opId: "c1", field: "radius", expr: "r" }],
};

const NON_PARAMETRIC_SCENE: Scene = {
  version: 1,
  ops: [{ id: "p1", step: 0, op: "draw_point", at: [0, 0] }],
};

describe("defaultVariableValues", () => {
  it("returns each variable's own default", () => {
    expect(defaultVariableValues(RADIUS_SCENE)).toEqual({ r: 2 });
  });

  it("returns an empty object when the scene has no variables", () => {
    expect(defaultVariableValues(NON_PARAMETRIC_SCENE)).toEqual({});
  });
});

describe("resolveScene", () => {
  it("returns the SAME reference (no-op) when the scene has no bindings", () => {
    const resolved = resolveScene(NON_PARAMETRIC_SCENE, {});
    expect(resolved).toBe(NON_PARAMETRIC_SCENE);
  });

  it("resolves a plain-numeric expr binding onto its target field", () => {
    const resolved = resolveScene(RADIUS_SCENE, { r: 5 });
    const op = resolved.ops.find((o) => o.id === "c1") as unknown as { radius: number };
    expect(op.radius).toBe(5);
  });

  it("does not mutate the input scene (returns a fresh ops array)", () => {
    const before = JSON.stringify(RADIUS_SCENE);
    resolveScene(RADIUS_SCENE, { r: 9 });
    expect(JSON.stringify(RADIUS_SCENE)).toBe(before);
  });

  it("resolves a template binding, substituting {expr} placeholders", () => {
    const scene: Scene = {
      version: 1,
      ops: [{ id: "t1", step: 0, op: "place_text", at: [0, 0], text: "r = 0" }],
      variables: [{ id: "r", label: "Radius", min: 1, max: 10, default: 3 }],
      bindings: [{ opId: "t1", field: "text", template: "r = {r}" }],
    };
    const resolved = resolveScene(scene, { r: 7 });
    const op = resolved.ops.find((o) => o.id === "t1") as unknown as { text: string };
    expect(op.text).toBe("r = 7");
  });

  it("writes a metaValue binding into op.meta.value, formatted", () => {
    const scene: Scene = {
      version: 1,
      ops: [{ id: "c1", step: 0, op: "draw_circle", center: [0, 0], radius: 1, meta: { label: "r" } }],
      variables: [{ id: "r", label: "Radius", min: 1, max: 10, default: 2 }],
      bindings: [{ opId: "c1", field: "metaValue", expr: "r * 2" }],
    };
    const resolved = resolveScene(scene, { r: 4 });
    const op = resolved.ops.find((o) => o.id === "c1") as unknown as { meta: { value: string } };
    expect(op.meta.value).toBe("8");
  });

  it("moves a Point2-shaped field's x component (component: 0) without disturbing y", () => {
    const scene: Scene = {
      version: 1,
      ops: [{ id: "p1", step: 0, op: "draw_point", at: [1, 9] }],
      variables: [{ id: "x", label: "X", min: 0, max: 10, default: 1 }],
      bindings: [{ opId: "p1", field: "at", component: 0, expr: "x" }],
    };
    const resolved = resolveScene(scene, { x: 6 });
    const op = resolved.ops.find((o) => o.id === "p1") as unknown as { at: [number, number] };
    expect(op.at).toEqual([6, 9]);
  });

  it("skips a binding whose opId doesn't exist, without throwing", () => {
    const scene: Scene = {
      ...RADIUS_SCENE,
      bindings: [{ opId: "does-not-exist", field: "radius", expr: "r" }],
    };
    expect(() => resolveScene(scene, { r: 5 })).not.toThrow();
  });

  it("skips a binding whose expr references an unknown variable, without throwing or crashing the rest", () => {
    const scene: Scene = {
      version: 1,
      ops: [
        { id: "c1", step: 0, op: "draw_circle", center: [0, 0], radius: 1 },
        { id: "c2", step: 0, op: "draw_circle", center: [0, 0], radius: 1 },
      ],
      variables: [{ id: "r", label: "Radius", min: 1, max: 10, default: 2 }],
      bindings: [
        { opId: "c1", field: "radius", expr: "totally_unknown_var" },
        { opId: "c2", field: "radius", expr: "r" },
      ],
    };
    const resolved = resolveScene(scene, { r: 5 });
    const brokenOp = resolved.ops.find((o) => o.id === "c1") as unknown as { radius: number };
    const okOp = resolved.ops.find((o) => o.id === "c2") as unknown as { radius: number };
    // The broken binding leaves its op's original value untouched (radius: 1, its literal default)
    // rather than crashing the whole resolve pass — the sibling binding still resolves correctly.
    expect(brokenOp.radius).toBe(1);
    expect(okOp.radius).toBe(5);
  });
});
