import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import { BUILT_IN_SKILLS } from "@openmaths/shared/ai/skills";
import { requireAuth } from "../middleware/auth";
import { hackAi, DEFAULT_MODEL_ID } from "../lib/ai/client";

// Ported verbatim from app's src/app/api/skills/{route.ts,[skillId]/route.ts,generate/route.ts}
// (PRD "Split into app + server" P3-continued).
export const skillsRoutes = new Hono();

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "skill"
  );
}

skillsRoutes.get("/skills", requireAuth, async (c) => {
  const user = c.get("user");
  const customSkills = await prisma.skill.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return c.json({
    skills: [
      ...BUILT_IN_SKILLS,
      ...customSkills.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description ?? "",
        instructions: s.instructions,
        isBuiltIn: false,
      })),
    ],
  });
});

skillsRoutes.post("/skills", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";

  if (!name || !instructions) return c.json({ error: "name and instructions are required" }, 400);

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let attempt = 1;
  while (await prisma.skill.findUnique({ where: { userId_slug: { userId: user.id, slug } } })) {
    slug = `${baseSlug}-${++attempt}`;
  }

  const skill = await prisma.skill.create({
    data: { userId: user.id, name, slug, description: description || null, instructions },
  });

  return c.json({ skill: { ...skill, isBuiltIn: false } }, 201);
});

skillsRoutes.patch("/skills/:skillId", requireAuth, async (c) => {
  const skillId = c.req.param("skillId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const existing = await prisma.skill.findFirst({ where: { id: skillId, userId: user.id } });
  if (!existing) return c.json({ error: "Skill not found" }, 404);

  const skill = await prisma.skill.update({
    where: { id: skillId },
    data: {
      name: typeof body?.name === "string" ? body.name.trim() : undefined,
      description: typeof body?.description === "string" ? body.description.trim() : undefined,
      instructions: typeof body?.instructions === "string" ? body.instructions.trim() : undefined,
    },
  });

  return c.json({ skill: { ...skill, isBuiltIn: false } });
});

skillsRoutes.delete("/skills/:skillId", requireAuth, async (c) => {
  const skillId = c.req.param("skillId");
  const user = c.get("user");

  const existing = await prisma.skill.findFirst({ where: { id: skillId, userId: user.id } });
  if (!existing) return c.json({ error: "Skill not found" }, 404);

  await prisma.skill.delete({ where: { id: skillId } });
  return c.json({ ok: true });
});

interface DraftedSkill {
  name: string;
  description: string;
  instructions: string;
}

function parseDraft(raw: string): DraftedSkill | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed?.name === "string" && typeof parsed?.description === "string" && typeof parsed?.instructions === "string") {
      return parsed as DraftedSkill;
    }
  } catch {
    // fall through
  }
  return null;
}

skillsRoutes.post("/skills/generate", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!description) return c.json({ error: "description is required" }, 400);

  const completion = await hackAi.chat.completions.create({
    model: DEFAULT_MODEL_ID,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "You draft reusable 'skills' (response style presets) for a math tutoring AI. Given a short description of the style the user wants, respond with ONLY a JSON object (no prose, no code fences) of the shape " +
          '{"name": "2-4 word title", "description": "one short sentence", "instructions": "2-4 sentences of direct instruction to the tutoring AI about how it should format/style its response when this skill is active"}.',
      },
      { role: "user", content: description },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const draft = parseDraft(raw);
  if (!draft) return c.json({ error: "Couldn't draft a skill from that description" }, 502);

  return c.json({ draft });
});
