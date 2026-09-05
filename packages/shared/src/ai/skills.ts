export interface SkillData {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  isBuiltIn: boolean;
}

/** Built-in skills are just prompt-style presets — no DB row needed, always available. */
export const BUILT_IN_SKILLS: SkillData[] = [
  {
    id: "builtin:step-by-step",
    slug: "step-by-step",
    name: "Step-by-step",
    description: "Full worked derivation, one step at a time.",
    instructions:
      "Break the solution into clearly numbered steps. Show every intermediate calculation — don't skip algebraic manipulations a student would need to see to follow along.",
    isBuiltIn: true,
  },
  {
    id: "builtin:exam-prep",
    slug: "exam-prep",
    name: "Exam prep",
    description: "Exam-style formatting with key formulas boxed.",
    instructions:
      "Write the answer the way a model exam solution would be marked: state the formula(s) used up front (in bold), show the substitution and working concisely, and box or clearly highlight the final answer at the end.",
    isBuiltIn: true,
  },
  {
    id: "builtin:eli5",
    slug: "eli5",
    name: "Explain simply",
    description: "Beginner-friendly, avoids jargon.",
    instructions:
      "Explain like the student is new to this topic. Avoid unexplained jargon and dense notation — use plain language and simple analogies before introducing formal terms, and define any term you must use.",
    isBuiltIn: true,
  },
  {
    id: "builtin:proof-mode",
    slug: "proof-mode",
    name: "Proof mode",
    description: "Rigorous formal proof with justified steps.",
    instructions:
      "Write the response as a rigorous formal proof. Every claim must have an explicit justification (a theorem name, definition, or prior step it follows from) — do not assert anything without stating why it's true.",
    isBuiltIn: true,
  },
  {
    id: "builtin:quick-answer",
    slug: "quick-answer",
    name: "Quick answer",
    description: "Just the result plus a one-line reason.",
    instructions:
      "Be brief. Give the final answer first, then at most one or two sentences of reasoning — skip the full derivation unless the student asks for it.",
    isBuiltIn: true,
  },
  {
    id: "builtin:visual-first",
    slug: "visual-first",
    name: "Visual first",
    description: "Prioritizes the diagram over text.",
    instructions:
      "Prioritize a clear, detailed diagram over long text — keep the written explanation minimal (a few short sentences) and let the diagram and its step captions carry most of the explanation.",
    isBuiltIn: true,
  },
];

export function findBuiltInSkill(idOrSlug: string): SkillData | undefined {
  return BUILT_IN_SKILLS.find((s) => s.id === idOrSlug || s.slug === idOrSlug);
}
