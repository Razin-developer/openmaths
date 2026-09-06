"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Landing-rework PRD §4.1: the hero is a purpose-built, deterministic Canvas2D scene — not the
 * real app engine (extracting that is out of scope and would risk pulling app-only/auth code into
 * the marketing bundle) — that reproduces the app's look: a question card, a diagram drawing
 * itself stroke by stroke, and a branch affordance that spawns a sub-question with its own drawn
 * proof. Zero network calls, zero secrets, fully client-side and scripted.
 */

const WIDTH = 640;
const HEIGHT = 360;
const BRANCH_HOTSPOT = { x: 210, y: 165, r: 16 };

interface Point {
  x: number;
  y: number;
}

function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, sub?: string) {
  ctx.save();
  const r = 10;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(label, x + 14, y + 22);
  if (sub) {
    ctx.fillStyle = "#64748b";
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(sub, x + 14, y + 40);
  }
  ctx.restore();
}

function drawConnector(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

/** Draws a right triangle stroke-by-stroke (three legs, one after another) as `progress` (0-1)
 * advances — the "diagram building itself" effect, done with real path math, not a canned GIF. */
function drawTriangle(ctx: CanvasRenderingContext2D, ox: number, oy: number, legX: number, legY: number, progress: number, color: string) {
  const a: Point = { x: ox, y: oy };
  const b: Point = { x: ox, y: oy + legY };
  const c: Point = { x: ox + legX, y: oy + legY };
  const segments: [Point, Point][] = [
    [a, b],
    [b, c],
    [c, a],
  ];
  const drawn = progress * segments.length;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  segments.forEach(([p1, p2], i) => {
    const segProgress = Math.max(0, Math.min(1, drawn - i));
    if (segProgress <= 0) return;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + (p2.x - p1.x) * segProgress, p1.y + (p2.y - p1.y) * segProgress);
    ctx.stroke();
  });
  ctx.restore();
}

function drawBranchAffordance(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(BRANCH_HOTSPOT.x, BRANCH_HOTSPOT.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.fillStyle = "#3b82f6";
  ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+", BRANCH_HOTSPOT.x, BRANCH_HOTSPOT.y + 1);
  ctx.restore();
}

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const stateRef = useRef({ progress: 0, branchOpen: false, branchProgress: 0, parallaxX: 0, parallaxY: 0 });
  const rafRef = useRef<number | undefined>(undefined);
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function draw() {
      const s = stateRef.current;
      ctx!.clearRect(0, 0, WIDTH, HEIGHT);
      ctx!.save();
      ctx!.translate(s.parallaxX, s.parallaxY);

      drawCard(ctx!, 24, 24, 190, 50, "Right triangle", "legs 6 and 8");
      drawConnector(ctx!, { x: 119, y: 74 }, { x: 119, y: 108 });
      drawTriangle(ctx!, 70, 108, 140, 110, s.progress, "#ffffff");

      if (s.progress > 0.95) {
        ctx!.fillStyle = "#ffffff";
        ctx!.font = "600 13px ui-monospace, monospace";
        ctx!.fillText("6² + 8² = 10²", 220, 190);
      }

      if (s.branchOpen) {
        drawConnector(ctx!, { x: 210, y: 165 }, { x: 340, y: 228 });
        drawCard(ctx!, 340, 228, 210, 50, "Sub-question", "legs 5 and 12");
        drawTriangle(ctx!, 380, 288, 60, 50, s.branchProgress, "#c4b5fd");
      } else {
        drawBranchAffordance(ctx!);
      }

      ctx!.restore();
    }

    function tick() {
      const s = stateRef.current;
      let animating = false;
      if (s.progress < 1) {
        s.progress = Math.min(1, s.progress + 0.025);
        animating = true;
      }
      if (s.branchOpen && s.branchProgress < 1) {
        s.branchProgress = Math.min(1, s.branchProgress + 0.05);
        animating = true;
      }
      draw();
      rafRef.current = animating && visibleRef.current ? requestAnimationFrame(tick) : undefined;
    }

    function startLoop() {
      if (rafRef.current === undefined) rafRef.current = requestAnimationFrame(tick);
    }

    function scheduleDraw() {
      if (rafRef.current !== undefined) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined;
        draw();
      });
    }

    if (reduceMotion) {
      stateRef.current = { progress: 1, branchOpen: true, branchProgress: 1, parallaxX: 0, parallaxY: 0 };
      draw();
    } else {
      startLoop();
    }

    function onPointerMove(e: PointerEvent) {
      if (reduceMotion) return;
      const rect = canvas!.getBoundingClientRect();
      stateRef.current.parallaxX = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
      stateRef.current.parallaxY = ((e.clientY - rect.top) / rect.height - 0.5) * 6;
      scheduleDraw();
    }

    function onClick(e: MouseEvent) {
      if (stateRef.current.branchOpen) return;
      const rect = canvas!.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (WIDTH / rect.width);
      const y = (e.clientY - rect.top) * (HEIGHT / rect.height);
      const dx = x - BRANCH_HOTSPOT.x;
      const dy = y - BRANCH_HOTSPOT.y;
      if (Math.sqrt(dx * dx + dy * dy) > BRANCH_HOTSPOT.r) return;
      stateRef.current.branchOpen = true;
      if (reduceMotion) {
        stateRef.current.branchProgress = 1;
        draw();
      } else {
        startLoop();
      }
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("click", onClick);

    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting && !reduceMotion) startLoop();
    });
    io.observe(canvas);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("click", onClick);
      io.disconnect();
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion]);

  return (
    <div className="relative mx-auto aspect-[16/9] w-full max-w-[640px]">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
        role="img"
        aria-label="An animated diagram of a right triangle with legs 6 and 8 drawing itself, with a button to branch into a sub-question about a triangle with legs 5 and 12."
        className="cursor-pointer"
      />
    </div>
  );
}
