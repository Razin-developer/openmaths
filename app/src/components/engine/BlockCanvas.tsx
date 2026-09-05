"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import type { Scene } from "@/lib/dsl/types";
import { useEngineColors } from "@/components/engine/colors";
import { useBlockStore } from "@/store/blockStore";
import { SceneInterpreter } from "@/components/engine/SceneInterpreter";
import { HighlightOverlay } from "@/components/engine/HighlightOverlay";
import { StaticHighlightOverlay, anchorPointForOp } from "@/components/engine/StaticHighlightOverlay";
import { registerCanvasEl, registerSnapshotDataUrl } from "@/components/engine/canvasRegistry";
import { hashSceneContent, projectWorldToScreen } from "@/lib/board/orthoProjection";

const DEFAULT_BOUNDS = { minX: -1, minY: -1, maxX: 5, maxY: 5 };

// Dev-tooling addition (PRD "Performance Audit & Answer-Rendering Fix" — r3f-perf): an opt-in FPS
// overlay for diagnosing the R3F render engine specifically — off by default (no clutter in every
// dev session, and stripped from any production bundle by the `dev` check) and never enabled
// without an explicit `?perf=1` on the URL, so it never appears by accident.
//
// r3f-perf itself (the package this PRD line item names) was tried and found genuinely
// incompatible with this stack — not just the "unmet peer @react-three/fiber@^8" warning pnpm
// prints (this project is on v9), but a real, reproducible FATAL Turbopack panic on `next build`
// ("failed to convert rope into string / invalid utf-8 sequence") the moment its import was added
// to this file, confirmed live this session. Using drei's own `<Stats>` instead — same FPS-
// overlay purpose, already a compatible dependency of this project, no panic.
function isPerfOverlayEnabled(): boolean {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("perf") === "1";
}

// Hoisted (PRD "Performance Audit & Answer-Rendering Fix" B3) — fresh object/array literals on
// every render of the props R3F's <Canvas> receives, for no reason (none of these depend on props
// or state). `preserveDrawingBuffer` is needed to read back the freshly-rendered frame via
// `toDataURL()` — every <Canvas> this file ever mounts is now either the one live/animating
// context (fullscreen player) or a short-lived one-shot capture canvas for a static preview (see
// RasterizedDiagramPreview below), so paying for it unconditionally no longer means paying for it
// on every idle node-card diagram forever, the way it used to before this pass's rework.
const CANVAS_GL_CONFIG = { preserveDrawingBuffer: true, antialias: true };
const CANVAS_DPR: [number, number] = [1, 2];
const CANVAS_STYLE = { width: "100%", height: "100%", display: "block" } as const;
const CONTAINER_STYLE = { width: "100%", height: "100%", position: "relative" } as const;

// Real bug found live-testing the capture path (PRD B3 follow-up), twice: a one-shot capture
// canvas unmounts itself only ~2 frames (~33ms) after mounting (see CaptureAfterFrames), which
// loses the race against R3F's OWN internal pointer-event setup — `Provider`'s mount effect (part
// of R3F's separate internal reconciler root, which doesn't necessarily unmount in lockstep with
// the outer React tree) calls `state.events.connect(rootElement)`, which does
// `target.addEventListener(...)`, and can still fire after the fast unmount has already nulled out
// the ref it reads as `rootElement`/`target` — throwing "Cannot read properties of null (reading
// 'addEventListener')" (observed live, uncaught, in the console).
//
// First attempt was `{ enabled: false, priority: 0 }` — WRONG, confirmed live to still crash:
// `enabled` only gates whether captured pointer events get dispatched to handlers, it does nothing
// to stop `connect()` (and therefore `addEventListener`) from running in the first place — R3F
// calls `state.events.connect` unconditionally whenever it's defined, regardless of `enabled`. The
// only way to make the crash's own line unreachable is to make `connect` itself a safe no-op, not
// rely on a flag `connect`'s own internals never check.
const CAPTURE_EVENTS_DISABLED = () => ({ enabled: false, priority: 0, connect: () => {}, disconnect: () => {} });

function CanvasRegistrar({ blockId }: { blockId: string }) {
  const domElement = useThree((s) => s.gl.domElement);
  useEffect(() => {
    registerCanvasEl(blockId, domElement);
    return () => registerCanvasEl(blockId, null);
  }, [blockId, domElement]);
  return null;
}

/**
 * Confirmed via live testing (PRD "Performance Audit & Answer-Rendering Fix" follow-up): R3F's
 * OWN internal size measurement (`react-use-measure` watching R3F's own wrapper div) reliably
 * gets stuck at the browser's bare 300x150 canvas default and never re-measures, even though
 * OUR OWN outer ResizeObserver (below, in BlockCanvas) correctly measures the real container size
 * — reproduced in a real desktop-sized, fully composited viewport, not a testing artifact. Rather
 * than depend on R3F's internal remeasurement working, push our own already-correct size into the
 * renderer directly via the public `setSize` store action every time it changes.
 */
function CanvasSizeSync({ width, height }: { width: number; height: number }) {
  const setSize = useThree((s) => s.setSize);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setSize(width, height);
    // `setSize` is an imperative call directly on the renderer, not a declarative JSX prop change
    // — R3F's `frameloop="demand"` only auto-invalidates on the latter (its reconciler diffing
    // scene children), so a resize would otherwise never redraw a demand-mode canvas at all. Live
    // mode doesn't need this (it's already rendering every frame), but calling it unconditionally
    // is harmless there.
    invalidate();
  }, [width, height, setSize, invalidate]);
  return null;
}

/**
 * Root cause, actually fixed (not just worked around): R3F's `<Canvas>` measures itself via
 * `react-use-measure`, whose default is the native `ResizeObserver` — and that observer
 * demonstrably never fires in some real environments (confirmed live: a plain, freshly-appended,
 * freshly-sized div with its own bare `new ResizeObserver(...)` gets zero callbacks). Since
 * `useMeasure`'s own callback ignores whatever arguments the observer passes and just re-reads
 * `getBoundingClientRect()` fresh every time it's called (confirmed by reading react-use-measure's
 * source), the fix doesn't need a real ResizeObserver at all — only something that calls the
 * callback periodically. `resize.polyfill` is the exact lever `useMeasure` exposes for swapping
 * the observer implementation; a tiny interval-based one sidesteps the native API's reliability
 * entirely rather than routing around its absence with our own duplicate measurement effect
 * (CanvasSizeSync only pushes the WebGL drawing-buffer size, not the CSS box size R3F itself
 * controls — that's why a correctly-sized container could still leave the canvas element visually
 * stuck at the browser's bare 300×150 default even with CanvasSizeSync in place). 150ms is cheap
 * for the handful of diagram canvases on screen at once, and useMeasure only actually updates
 * state when the freshly-read rect differs from the last one, so idle polling costs is a comparison,
 * not a re-render.
 */
class PollingResizeObserver {
  private callback: ResizeObserverCallback;
  private targets = new Set<Element>();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  private tick = () => {
    if (this.targets.size > 0) {
      // useMeasure's own handler ignores these arguments and re-measures directly — an empty
      // entries array and `this` cast are enough to satisfy the interface, nothing more is read.
      this.callback([] as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
    }
  };

  observe(target: Element) {
    this.targets.add(target);
    if (this.intervalId === null) this.intervalId = setInterval(this.tick, 150);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Disables react-use-measure's scroll-based fallback tracking (R3F's own useMeasure call
// defaults to `scroll: true`) — irrelevant now that measurement is polling-driven, but no reason
// to also pay for scroll-listener churn. `resize` is spread onto useMeasure's options, so this is
// the one lever Canvas exposes to change how it measures itself.
const CANVAS_RESIZE_CONFIG = { scroll: false, debounce: { scroll: 0, resize: 0 }, polyfill: PollingResizeObserver };


/** Mirrors CanvasSizeSync — must be rendered as a child of `<Canvas>` (its `useThree` call
 * requires the R3F context, which only exists inside the Canvas tree), not in the component that
 * creates the `<Canvas>` element itself. Keeps the camera in sync with fit changes (resize, zoom
 * buttons, scene bounding-box changes) after the initial mount, without remounting the Canvas —
 * `applyCameraFit` writes directly onto the THREE.Camera instance, an imperative mutation
 * frameloop="demand" has no way to notice on its own, so it needs the same manual invalidate(). */
function CanvasCameraSync({ camera, fit }: { camera: THREE.OrthographicCamera; fit: ReturnType<typeof computeFitCamera> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    applyCameraFit(camera, fit);
    invalidate();
  }, [camera, fit, invalidate]);
  return null;
}

function applyCameraFit(camera: THREE.OrthographicCamera, fit: ReturnType<typeof computeFitCamera>) {
  camera.zoom = fit.zoom;
  camera.left = fit.left;
  camera.right = fit.right;
  camera.top = fit.top;
  camera.bottom = fit.bottom;
  camera.position.set(fit.cx, fit.cy, 10);
  camera.updateProjectionMatrix();
}

/** Rendered as a Canvas child only during a one-shot raster capture (see RasterizedDiagramPreview
 * below) — `useFrame` only fires on frames R3F actually renders, so counting to 2 (not 1)
 * guarantees at least one full render has genuinely completed and been swapped into the visible
 * drawing buffer before reading it back, rather than racing the very first frame in flight. */
function CaptureAfterFrames({ onCaptured }: { onCaptured: (canvas: HTMLCanvasElement) => void }) {
  const framesRef = useRef(0);
  const doneRef = useRef(false);
  useFrame(({ gl }) => {
    if (doneRef.current) return;
    framesRef.current += 1;
    if (framesRef.current >= 2) {
      doneRef.current = true;
      onCaptured(gl.domElement);
    }
  });
  return null;
}

function DiagramCanvas({
  blockId,
  scene,
  mode,
  hoverBlockId,
  fit,
  size,
  registerId,
  onCaptured,
}: {
  blockId: string;
  scene: Scene;
  mode: "live" | "static";
  hoverBlockId?: string;
  fit: ReturnType<typeof computeFitCamera>;
  size: { width: number; height: number };
  /** Registers this canvas into canvasRegistry under this id (live/fullscreen mode's video
   * export reads it back) — omitted for a transient one-shot capture canvas, which is torn down
   * right after `onCaptured` fires and has nothing left for anyone to read from by then. */
  registerId?: string;
  /** One-shot raster capture (PRD B3) — when provided, this canvas exists only to render a
   * couple of frames and hand back its drawing buffer; the caller is expected to unmount it
   * immediately afterward. Omitted entirely for the persistent live/fullscreen canvas. */
  onCaptured?: (canvas: HTMLCanvasElement) => void;
}) {
  const colors = useEngineColors();
  const hoverKey = hoverBlockId ?? blockId;
  const hoveredOpId = useBlockStore((s) => (s.blocks[hoverKey] ?? s.get(hoverKey)).hoveredOpId);

  const [camera] = useState(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    applyCameraFit(cam, fit);
    (cam as THREE.OrthographicCamera & { manual: boolean }).manual = true;
    return cam;
  });
  return (
    <Canvas
      orthographic
      camera={camera}
      gl={CANVAS_GL_CONFIG}
      dpr={CANVAS_DPR}
      style={CANVAS_STYLE}
      resize={CANVAS_RESIZE_CONFIG}
      frameloop="always"
      events={onCaptured ? CAPTURE_EVENTS_DISABLED : undefined}
    >
      {isPerfOverlayEnabled() && <Stats />}
      <color attach="background" args={[colors.background]} />
      <CanvasSizeSync width={size.width} height={size.height} />
      <CanvasCameraSync camera={camera} fit={fit} />
      {registerId && <CanvasRegistrar blockId={registerId} />}
      {onCaptured && <CaptureAfterFrames onCaptured={onCaptured} />}
      <SceneInterpreter blockId={blockId} scene={scene} mode={mode} hoverBlockId={hoverBlockId} />
      <HighlightOverlay scene={scene} hoveredOpId={hoveredOpId} />
    </Canvas>
  );
}

function computeFitCamera(width: number, height: number, boundingBox: Scene["boundingBox"], zoomMultiplier: number) {
  const box = boundingBox ?? DEFAULT_BOUNDS;
  const boxWidth = Math.max(box.maxX - box.minX, 0.1);
  const boxHeight = Math.max(box.maxY - box.minY, 0.1);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const padding = 1.35;

  const fitZoom = Math.min(width / (boxWidth * padding), height / (boxHeight * padding));
  const zoom = (Number.isFinite(fitZoom) && fitZoom > 0 ? fitZoom : 60) * zoomMultiplier;
  return { cx, cy, zoom, left: -width / 2, right: width / 2, top: height / 2, bottom: -height / 2 };
}

/** Shared by both the live canvas and the rasterized preview below — measures the container div
 * the same way (polling would be overkill here; this is OUR OWN div, not R3F's internal one, and
 * a plain ResizeObserver on it has always worked reliably). */
function useContainerSize(containerRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function measure() {
      const rect = el!.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setSize((prev) =>
        prev && Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
          ? prev
          : { width: rect.width, height: rect.height }
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);
  return size;
}

interface DiagramSnapshot {
  dataUrl: string;
  fit: ReturnType<typeof computeFitCamera>;
  size: { width: number; height: number };
}

/**
 * PRD B3 — the raster-preview cache. Keyed by scene *content* (`hashSceneContent`), not the
 * `scene` object's identity: every board sync/API refetch produces a fresh `scene` object even
 * when its content is byte-identical (a JSON value parsed anew each time), which would otherwise
 * invalidate this cache — and therefore force a fresh live-canvas capture — far more often than
 * the diagram itself actually changed. A plain `Map` (not a `WeakMap`) is deliberate here for the
 * same reason: nothing keeps a `scene` object alive long enough to key off its identity once the
 * API response that produced it is garbage-collected. Capped so a very long session visiting many
 * distinct diagrams can't grow this unboundedly — an LRU-ish "drop the oldest" eviction, not
 * anything fancier; this is a perf cache, not correctness-critical state.
 */
const SNAPSHOT_CACHE_LIMIT = 300;
const snapshotCache = new Map<string, DiagramSnapshot>();

function snapshotCacheKey(sceneHash: string, size: { width: number; height: number }, zoomMultiplier: number, background: string): string {
  return `${sceneHash}:${Math.round(size.width)}x${Math.round(size.height)}:${zoomMultiplier}:${background}`;
}

function cacheSnapshot(key: string, snapshot: DiagramSnapshot) {
  if (!snapshotCache.has(key) && snapshotCache.size >= SNAPSHOT_CACHE_LIMIT) {
    const oldest = snapshotCache.keys().next().value;
    if (oldest !== undefined) snapshotCache.delete(oldest);
  }
  snapshotCache.set(key, snapshot);
}

// Real gap found live-testing the raster rewrite (PRD B3 follow-up): hover-highlight on a
// node-card diagram used to be driven by hovering the live Three.js mesh directly (SceneInterpreter
// wires `onPointerOver` on each op's primitive, which called `setHovered`) — that keeps working in
// the demand-mode-only version of this fix (the canvas stays mounted, just not animating), but once
// the canvas is torn down after capture there's no interactive mesh left to hover at all, so
// hover-highlight on a settled raster preview silently did nothing (confirmed live: hovering the
// diagram produced no tooltip). The fix is a plain 2D hit-test over the flat `<img>`, reusing the
// exact same anchor/projection math StaticHighlightOverlay already uses to place the tooltip — so
// "which op is under the cursor" and "where does that op's tooltip render" share one source of
// truth instead of drifting apart.
const HOVER_HIT_RADIUS_PX = 18;

function hitTestOp(scene: Scene, fit: DiagramSnapshot["fit"], size: DiagramSnapshot["size"], point: { x: number; y: number }): string | null {
  let bestId: string | null = null;
  let bestDist = HOVER_HIT_RADIUS_PX;
  for (const op of scene.ops) {
    if (!op.meta || (op.meta.label === undefined && op.meta.value === undefined)) continue;
    const anchor = anchorPointForOp(op);
    if (!anchor) continue;
    const { x, y } = projectWorldToScreen(anchor, fit, size);
    const dist = Math.hypot(x - point.x, y - point.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = op.id;
    }
  }
  return bestId;
}

/**
 * PRD "Performance Audit & Answer-Rendering Fix" B3 — the actual "static preview only gets a live
 * WebGL context when focused/animating" architecture. A node-card diagram preview no longer holds
 * a persistent WebGL context at all: it mounts a live canvas just long enough to render two real
 * frames (`CaptureAfterFrames`), rasterizes that into a cached `<img>`, and tears the WebGL
 * context down immediately — so an idle canvas full of diagram nodes costs zero live contexts,
 * not "a context that's merely not rendering every frame" (the demand-mode-only version of this
 * fix this PRD item went through earlier in the same session, superseded by this). Hover-highlight
 * (StaticHighlightOverlay) and PDF export (registerSnapshotDataUrl, read by ExportButton.tsx) are
 * both re-derived from the cached raster + fit math instead of a live Three.js scene/camera.
 */
function RasterizedDiagramPreview({
  blockId,
  scene,
  zoomMultiplier,
  hoverBlockId,
}: {
  blockId: string;
  scene: Scene;
  zoomMultiplier: number;
  hoverBlockId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useContainerSize(containerRef);
  const colors = useEngineColors();
  const hoverKey = hoverBlockId ?? blockId;
  const hoveredOpId = useBlockStore((s) => (s.blocks[hoverKey] ?? s.get(hoverKey)).hoveredOpId);
  const setHovered = useBlockStore((s) => s.setHovered);

  const sceneHash = useMemo(() => hashSceneContent(scene), [scene]);
  const cacheKey = size ? snapshotCacheKey(sceneHash, size, zoomMultiplier, colors.background) : null;
  // A plain cache read, not state — `cacheKey` already fully determines the right answer every
  // render (whether it's a hit or a miss), so there's nothing to "sync" via an effect. The one
  // thing state IS needed for is forcing a re-render right after `onCaptured` populates the cache
  // for a key React has no other way to know just changed underneath it.
  const snapshot = cacheKey ? (snapshotCache.get(cacheKey) ?? null) : null;
  const [, forceRerender] = useState(0);

  const captureFit = size ? computeFitCamera(size.width, size.height, scene.boundingBox, zoomMultiplier) : null;
  const capturing = !!size && !!captureFit && !snapshot;

  // Real bug found live-testing PDF export: `blockId` here is ALREADY the caller's suffixed key
  // (GraphNode.tsx passes `blockId={`${block.id}:preview`}`, the same convention the old live-canvas
  // registry used) — re-appending ":preview" a second time registered the snapshot under a key
  // ExportButton.tsx's `getSnapshotDataUrl(`${graphBlock.id}:preview`)` lookup could never match,
  // silently sending PDF export requests with no diagram image at all (confirmed live: the export
  // fetch's body had no `diagramImageDataUrl`, no error, no visible symptom — the PDF just quietly
  // exported without its diagram). Register under `blockId` itself, unsuffixed.
  useEffect(() => {
    if (!snapshot) return;
    registerSnapshotDataUrl(blockId, snapshot.dataUrl);
    return () => registerSnapshotDataUrl(blockId, null);
  }, [blockId, snapshot]);

  return (
    <div ref={containerRef} style={CONTAINER_STYLE}>
      {capturing && size && captureFit && (
        <DiagramCanvas
          key={`${blockId}:capture:${cacheKey}`}
          blockId={blockId}
          scene={scene}
          mode="static"
          hoverBlockId={hoverBlockId}
          fit={captureFit}
          size={size}
          onCaptured={(canvas) => {
            if (!cacheKey) return;
            // Read the pixels back immediately — the canvas is still fully alive here, this is
            // just a synchronous readback, nothing to race against.
            const dataUrl = canvas.toDataURL("image/png");
            // But DON'T unmount the capture Canvas in the same tick (which is what setting
            // `snapshot` via cacheSnapshot+forceRerender does, since `capturing` flips to false on
            // the next render). Real bug found live-testing theme toggling repeatedly (PRD B3
            // follow-up, 3rd fix attempt): R3F's `Provider` component — part of its OWN internal
            // reconciler root, which does not necessarily finish mounting/settling in lockstep with
            // the outer React tree — can still be mid-setup (specifically: hasn't yet applied this
            // Canvas's `events` override onto its store, so `state.events` is briefly whatever the
            // PREVIOUS instance/default left it as) when the unmount lands, so even an `events`
            // override with a no-op `connect` doesn't reliably prevent the crash — it depends on
            // WHICH `connect` is live at that exact moment, not just what this instance asked for.
            // Confirmed live: intermittent (~1 in 3 rapid remounts), "Cannot read properties of
            // null (reading 'addEventListener')", uncaught. A short delay before unmounting gives
            // R3F's internal setup a full chance to settle first — cheap here since a capture is a
            // one-shot event, not a hot path.
            const snap: DiagramSnapshot = { dataUrl, fit: captureFit, size };
            setTimeout(() => {
              cacheSnapshot(cacheKey, snap);
              forceRerender((v) => v + 1);
            }, 120);
          }}
        />
      )}
      {snapshot && !capturing && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a captured WebGL raster, not an
              optimizable remote asset; next/image's loader pipeline doesn't apply to data URLs. */}
          <img
            src={snapshot.dataUrl}
            alt=""
            style={CANVAS_STYLE}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              setHovered(hoverKey, hitTestOp(scene, snapshot.fit, snapshot.size, point));
            }}
            onPointerLeave={() => setHovered(hoverKey, null)}
          />
          <StaticHighlightOverlay scene={scene} hoveredOpId={hoveredOpId} fit={snapshot.fit} size={snapshot.size} />
        </>
      )}
    </div>
  );
}

function LiveDiagramCanvas({
  blockId,
  scene,
  zoomMultiplier,
  hoverBlockId,
}: {
  blockId: string;
  scene: Scene;
  zoomMultiplier: number;
  hoverBlockId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useContainerSize(containerRef);
  const fit = size ? computeFitCamera(size.width, size.height, scene.boundingBox, zoomMultiplier) : null;

  return (
    <div ref={containerRef} style={CONTAINER_STYLE}>
      {fit && size && (
        <DiagramCanvas key={blockId} blockId={blockId} scene={scene} mode="live" hoverBlockId={hoverBlockId} fit={fit} size={size} registerId={blockId} />
      )}
    </div>
  );
}

export function BlockCanvas({
  blockId,
  scene,
  mode = "live",
  zoomMultiplier = 1,
  hoverBlockId,
}: {
  blockId: string;
  scene: Scene;
  mode?: "live" | "static";
  /** Manual zoom multiplier applied on top of the auto-fit zoom (1 = fit exactly). */
  zoomMultiplier?: number;
  /** See SceneInterpreter — lets an inline preview (its own playback-state key) still react to
   * external hover triggers (e.g. text mentions) that target the real block id. */
  hoverBlockId?: string;
}) {
  if (mode === "static") {
    return <RasterizedDiagramPreview blockId={blockId} scene={scene} zoomMultiplier={zoomMultiplier} hoverBlockId={hoverBlockId} />;
  }
  return <LiveDiagramCanvas blockId={blockId} scene={scene} zoomMultiplier={zoomMultiplier} hoverBlockId={hoverBlockId} />;
}
