import { Hono } from "hono";
import { hackAi } from "../lib/ai/client";

// Ported verbatim from app's src/app/api/models/route.ts (PRD "Split into app + server" P1).
let cachedModels: { id: string }[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export const modelsRoutes = new Hono();

modelsRoutes.get("/models", async (c) => {
  if (cachedModels && Date.now() - cachedAt < CACHE_TTL_MS) {
    return c.json({ models: cachedModels });
  }

  try {
    const result = await hackAi.models.list();
    const seen = new Set<string>();
    cachedModels = [];
    for (const m of result.data) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      cachedModels.push({ id: m.id });
    }
    cachedAt = Date.now();
    return c.json({ models: cachedModels });
  } catch {
    return c.json({ models: cachedModels ?? [] });
  }
});
