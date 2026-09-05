/** Illustrative, not a real customer — same reasoning as lib/placeholder-content.ts's
 * testimonials: proves out the /customers/[slug] page pattern before a real case study exists.
 * Swap for a real one (with permission) before launch. */
export interface CaseStudy {
  slug: string;
  company: string;
  headline: string;
  summary: string;
  body: string[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "example-high-school",
    company: "Example placeholder — a high school geometry class",
    headline: "Using a drawn diagram instead of a static slide",
    summary: "A hypothetical illustration of how a teacher might use openmaths to generate a worked example before assigning a problem set.",
    body: [
      "This case study is a placeholder describing the intended use case, not a real customer account — see the note in lib/case-studies.ts.",
      "The idea: a teacher generates a geometry problem similar to that week's homework, projects the diagram-drawing animation for the class, then assigns the real problem set — giving students one worked, narrated example to reference instead of just a formula on a slide.",
    ],
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
