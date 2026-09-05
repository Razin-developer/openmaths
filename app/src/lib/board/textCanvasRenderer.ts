/**
 * Renders a single "slide" of plain-text step content onto a canvas — the piece that was missing
 * for exporting `FullscreenPlayer` (solution_steps/table) to video: those forms have no WebGL
 * scene, so there was nothing to call `captureStream()` on. Drawing each step onto an actual
 * canvas (instead of trying to rasterize live DOM/KaTeX, which is unreliable across browsers)
 * gives `recordCanvas`/`recordCanvasWithAudio` (videoExport.ts) something real to record, reusing
 * the exact same recording pipeline the diagram player already uses.
 */

export const TEXT_CANVAS_WIDTH = 1280;
export const TEXT_CANVAS_HEIGHT = 720;

export interface TextSlide {
  headline: string;
  detail?: string;
  stepLabel: string; // e.g. "Step 2 / 5"
  finalAnswer?: string; // shown only on the last slide
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCenteredLines(ctx: CanvasRenderingContext2D, lines: string[], centerX: number, startY: number, lineHeight: number) {
  lines.forEach((line, i) => ctx.fillText(line, centerX, startY + i * lineHeight));
  return startY + lines.length * lineHeight;
}

/** Reads the app's actual theme colors at draw time (works in both light and dark mode) rather
 * than hardcoding a palette that would drift from `globals.css`. */
function themeColors(): { background: string; foreground: string; muted: string; border: string } {
  const style = getComputedStyle(document.body);
  return {
    background: style.backgroundColor || "#ffffff",
    foreground: style.color || "#1a1a1a",
    muted: "rgba(128,128,128,0.9)",
    border: "rgba(128,128,128,0.35)",
  };
}

export function drawTextSlide(canvas: HTMLCanvasElement, slide: TextSlide) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = TEXT_CANVAS_WIDTH;
  canvas.height = TEXT_CANVAS_HEIGHT;
  const { background, foreground, muted, border } = themeColors();
  const centerX = TEXT_CANVAS_WIDTH / 2;
  const maxWidth = TEXT_CANVAS_WIDTH * 0.72;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, TEXT_CANVAS_WIDTH, TEXT_CANVAS_HEIGHT);

  ctx.textAlign = "center";
  ctx.fillStyle = muted;
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText(slide.stepLabel, centerX, 56);

  ctx.fillStyle = foreground;
  ctx.font = "600 40px system-ui, sans-serif";
  const headlineLines = wrapLines(ctx, slide.headline, maxWidth);
  const headlineHeight = headlineLines.length * 52;
  const detailLines = slide.detail ? wrapLines(ctx, slide.detail, maxWidth) : [];
  const detailHeight = detailLines.length * 34;
  const blockHeight = headlineHeight + (detailLines.length > 0 ? 24 + detailHeight : 0);
  let y = TEXT_CANVAS_HEIGHT / 2 - blockHeight / 2 + 40;

  y = drawCenteredLines(ctx, headlineLines, centerX, y, 52);

  if (detailLines.length > 0) {
    y += 24;
    ctx.fillStyle = muted;
    ctx.font = "400 26px system-ui, sans-serif";
    drawCenteredLines(ctx, detailLines, centerX, y, 34);
  }

  if (slide.finalAnswer) {
    const boxY = TEXT_CANVAS_HEIGHT - 130;
    ctx.font = "600 28px system-ui, sans-serif";
    const answerText = `Answer: ${slide.finalAnswer}`;
    const textWidth = ctx.measureText(answerText).width;
    const paddingX = 28;
    const boxWidth = textWidth + paddingX * 2;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(centerX - boxWidth / 2, boxY - 34, boxWidth, 56);
    ctx.fillStyle = foreground;
    ctx.fillText(answerText, centerX, boxY);
  }
}
