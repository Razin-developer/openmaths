import { create } from "zustand";

export type PlaybackStatus = "idle" | "playing" | "paused" | "done";

export interface BlockPlaybackState {
  status: PlaybackStatus;
  /** Index into the flattened ops array of the op currently animating (or last op index once done). */
  currentOpIndex: number;
  /** 0-1 progress of the op at currentOpIndex. */
  opProgress: number;
  /** Multiplier over each op's base duration — "step duration" in the UI. 1 = base speed. */
  speed: number;
  /** Seconds to pause (real time, not scaled by speed) after finishing a step before continuing. */
  stepDelay: number;
  /** Seconds remaining in an active post-step pause; 0 when not holding. */
  holdRemaining: number;
  /** When set, playback auto-pauses once currentOpIndex reaches this — used for animating a single
   * step forward (Play until here, then stop) rather than playing indefinitely. */
  autoPauseAtOpIndex: number | null;
  hoveredOpId: string | null;
}

const DEFAULT_STATE: BlockPlaybackState = {
  status: "idle",
  currentOpIndex: 0,
  opProgress: 0,
  speed: 1,
  stepDelay: 0,
  holdRemaining: 0,
  autoPauseAtOpIndex: null,
  hoveredOpId: null,
};

interface BlockStore {
  blocks: Record<string, BlockPlaybackState>;
  get: (blockId: string) => BlockPlaybackState;
  play: (blockId: string) => void;
  /** Plays forward from the current position and auto-pauses once `targetOpIndex` is reached —
   * used to animate a single step forward instead of jumping to it instantly. */
  playToOpIndex: (blockId: string, targetOpIndex: number) => void;
  pause: (blockId: string) => void;
  reset: (blockId: string) => void;
  tick: (blockId: string, deltaSeconds: number, durations: number[], opSteps: number[]) => void;
  jumpToOpIndex: (blockId: string, opIndex: number, totalOps: number) => void;
  setSpeed: (blockId: string, speed: number) => void;
  setStepDelay: (blockId: string, stepDelay: number) => void;
  setHovered: (blockId: string, opId: string | null) => void;
}

export const useBlockStore = create<BlockStore>((set, get) => ({
  blocks: {},

  get: (blockId) => get().blocks[blockId] ?? DEFAULT_STATE,

  play: (blockId) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_STATE;
      const atEnd = current.status === "done";
      return {
        blocks: {
          ...s.blocks,
          [blockId]: {
            ...current,
            status: "playing",
            currentOpIndex: atEnd ? 0 : current.currentOpIndex,
            opProgress: atEnd ? 0 : current.opProgress,
            autoPauseAtOpIndex: null,
          },
        },
      };
    }),

  playToOpIndex: (blockId, targetOpIndex) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_STATE;
      return {
        blocks: {
          ...s.blocks,
          [blockId]: { ...current, status: "playing", autoPauseAtOpIndex: targetOpIndex },
        },
      };
    }),

  pause: (blockId) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_STATE;
      if (current.status !== "playing") return s;
      return {
        blocks: { ...s.blocks, [blockId]: { ...current, status: "paused", holdRemaining: 0, autoPauseAtOpIndex: null } },
      };
    }),

  reset: (blockId) =>
    set((s) => ({
      blocks: {
        ...s.blocks,
        [blockId]: {
          ...DEFAULT_STATE,
          speed: (s.blocks[blockId] ?? DEFAULT_STATE).speed,
          stepDelay: (s.blocks[blockId] ?? DEFAULT_STATE).stepDelay,
        },
      },
    })),

  tick: (blockId, deltaSeconds, durations, opSteps) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_STATE;
      if (current.status !== "playing" || durations.length === 0) return s;

      let { currentOpIndex, opProgress, holdRemaining } = current;
      const { autoPauseAtOpIndex } = current;

      // A post-step pause is real-time (not sped up by the step-duration multiplier) — it's a
      // deliberate "let the student read this" beat, not part of the drawing animation itself.
      if (holdRemaining > 0) {
        holdRemaining = Math.max(0, holdRemaining - deltaSeconds);
        if (holdRemaining > 0) {
          return { blocks: { ...s.blocks, [blockId]: { ...current, holdRemaining } } };
        }
      }

      let remaining = deltaSeconds * current.speed;
      let paused = false;

      while (remaining > 0 && currentOpIndex < durations.length) {
        const duration = Math.max(durations[currentOpIndex], 0.001);
        const remainingInOp = duration * (1 - opProgress);
        if (remaining < remainingInOp) {
          opProgress += remaining / duration;
          remaining = 0;
        } else {
          remaining -= remainingInOp;
          const finishedStep = opSteps[currentOpIndex];
          currentOpIndex += 1;
          opProgress = 0;

          if (autoPauseAtOpIndex !== null && currentOpIndex >= autoPauseAtOpIndex) {
            paused = true;
            break;
          }

          const enteringNewStep = currentOpIndex < opSteps.length && opSteps[currentOpIndex] !== finishedStep;
          if (enteringNewStep && current.stepDelay > 0) {
            holdRemaining = current.stepDelay;
            break;
          }
        }
      }

      const done = currentOpIndex >= durations.length;
      return {
        blocks: {
          ...s.blocks,
          [blockId]: {
            ...current,
            currentOpIndex: done ? durations.length - 1 : currentOpIndex,
            opProgress: done ? 1 : opProgress,
            holdRemaining,
            status: done || paused ? (done ? "done" : "paused") : "playing",
            autoPauseAtOpIndex: done || paused ? null : autoPauseAtOpIndex,
          },
        },
      };
    }),

  jumpToOpIndex: (blockId, opIndex, totalOps) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_STATE;
      const clamped = Math.max(0, Math.min(opIndex, Math.max(totalOps - 1, 0)));
      return {
        blocks: {
          ...s.blocks,
          [blockId]: {
            ...current,
            currentOpIndex: clamped,
            opProgress: clamped >= totalOps - 1 && opIndex >= totalOps ? 1 : 0,
            status: "paused",
            holdRemaining: 0,
            autoPauseAtOpIndex: null,
          },
        },
      };
    }),

  setSpeed: (blockId, speed) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_STATE;
      return { blocks: { ...s.blocks, [blockId]: { ...current, speed } } };
    }),

  setStepDelay: (blockId, stepDelay) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_STATE;
      return { blocks: { ...s.blocks, [blockId]: { ...current, stepDelay } } };
    }),

  setHovered: (blockId, opId) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_STATE;
      if (current.hoveredOpId === opId) return s;
      return { blocks: { ...s.blocks, [blockId]: { ...current, hoveredOpId: opId } } };
    }),
}));
