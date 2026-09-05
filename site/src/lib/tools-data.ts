import type { ComponentType } from "react";
import { RightTriangleSolver } from "@/components/tools/RightTriangleSolver";
import { QuadraticSolver } from "@/components/tools/QuadraticSolver";
import { PercentageCalculator } from "@/components/tools/PercentageCalculator";
import { FractionCalculator } from "@/components/tools/FractionCalculator";
import { UnitConverter } from "@/components/tools/UnitConverter";

export interface ToolMeta {
  slug: string;
  name: string;
  category: "Algebra" | "Geometry" | "Converters" | "Arithmetic";
  shortDescription: string;
  howTo: string[];
  component: ComponentType;
}

/**
 * PRD §6's launch list names 12 tools, "ship 4-6 first, expand" — this is 5, one per category
 * the hub groups by (§5.3's "/tools" category grid: Algebra, Geometry, Calculus, Graphing,
 * Converters, Statistics — Calculus/Graphing/Statistics are real remaining scope, not shipped
 * here). Each tool's actual computation lives in `lib/tools/*` as plain, dependency-free
 * functions — reusing `packages/shared`'s DSL was considered and rejected for this pass: that
 * package's exports are geometry-scene/envelope types built for the app's diagram engine, not
 * generic arithmetic, so there's nothing to actually reuse yet for tools this simple.
 */
export const TOOLS: ToolMeta[] = [
  {
    slug: "right-triangle-solver",
    name: "Right Triangle Solver",
    category: "Geometry",
    shortDescription: "Solve for a missing leg or the hypotenuse via the Pythagorean theorem.",
    howTo: [
      "Enter any two of the three values: leg a, leg b, or the hypotenuse.",
      "The third value, plus the triangle's area and perimeter, is solved automatically.",
    ],
    component: RightTriangleSolver,
  },
  {
    slug: "quadratic-equation-solver",
    name: "Quadratic Equation Solver",
    category: "Algebra",
    shortDescription: "Find the roots, discriminant, and vertex of ax² + bx + c = 0.",
    howTo: [
      "Enter the coefficients a, b, and c.",
      "Real roots, the discriminant, and the parabola's vertex are computed instantly — complex roots are shown when the discriminant is negative.",
    ],
    component: QuadraticSolver,
  },
  {
    slug: "percentage-calculator",
    name: "Percentage Calculator",
    category: "Arithmetic",
    shortDescription: "X% of Y, what percent X is of Y, or the percentage change between two values.",
    howTo: ["Pick which of the three percentage questions you're asking.", "Enter the two numbers — the result updates as you type."],
    component: PercentageCalculator,
  },
  {
    slug: "fraction-calculator",
    name: "Fraction Calculator",
    category: "Arithmetic",
    shortDescription: "Add, subtract, multiply, or divide two fractions, simplified automatically.",
    howTo: ["Enter both fractions' numerators and denominators.", "Pick an operation — the result is simplified to lowest terms."],
    component: FractionCalculator,
  },
  {
    slug: "unit-converter",
    name: "Unit Converter",
    category: "Converters",
    shortDescription: "Convert between length, weight, and temperature units.",
    howTo: ["Choose a category (length, weight, or temperature).", "Enter a value and pick the units to convert between."],
    component: UnitConverter,
  },
];

export function getTool(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
