const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};
const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", i: "ᵢ", o: "ₒ", x: "ₓ",
};

const SYMBOL_MAP: Record<string, string> = {
  "\\times": "×", "\\cdot": "·", "\\div": "÷", "\\pm": "±", "\\mp": "∓",
  "\\pi": "π", "\\theta": "θ", "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
  "\\phi": "φ", "\\lambda": "λ", "\\mu": "μ", "\\sigma": "σ", "\\omega": "ω",
  "\\leq": "≤", "\\geq": "≥", "\\neq": "≠", "\\approx": "≈", "\\cong": "≅", "\\sim": "∼",
  "\\infty": "∞", "\\degree": "°", "\\circ": "°", "\\angle": "∠", "\\triangle": "△",
  "\\parallel": "∥", "\\perp": "⊥", "\\rightarrow": "→", "\\leftarrow": "←", "\\Rightarrow": "⇒",
  "\\in": "∈", "\\notin": "∉", "\\subset": "⊂", "\\cup": "∪", "\\cap": "∩",
  "\\sum": "∑", "\\prod": "∏", "\\int": "∫", "\\partial": "∂", "\\nabla": "∇",
  "\\ldots": "…", "\\cdots": "⋯",
};

function convertScript(match: string, content: string, map: Record<string, string>): string {
  const inner = content.replace(/[{}]/g, "");
  const converted = inner
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
  return converted;
}

/**
 * Converts common LaTeX-ish math markup (as the AI sometimes writes in diagram labels, e.g.
 * "a^2", "\\sqrt{2}", "\\theta") into plain Unicode a WebGL text mesh can actually render — the
 * drawing engine's labels render via a bare SDF font glyph mesh, not an HTML/KaTeX pipeline, so
 * raw LaTeX source (dollar signs, backslash commands, braces) would otherwise show up literally.
 * Not a full LaTeX engine — no real fraction bars, matrices, etc. — but covers the vast majority
 * of what actually appears in geometry/diagram labels (exponents, subscripts, greek letters,
 * comparison/set symbols).
 */
export function formatMathText(raw: string): string {
  let text = raw;

  // Strip $...$ / $$...$$ delimiters — the label is math either way, delimiters add nothing.
  text = text.replace(/\$\$?/g, "");

  // \sqrt{...} -> √(...)
  text = text.replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
  // \frac{a}{b} -> (a)/(b)
  text = text.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");

  // Superscripts/subscripts: ^{...} / ^x and _{...} / _x
  text = text.replace(/\^\{([^{}]+)\}/g, (m, g) => convertScript(m, g, SUPERSCRIPT_MAP));
  text = text.replace(/\^(\w)/g, (m, g) => convertScript(m, g, SUPERSCRIPT_MAP));
  text = text.replace(/_\{([^{}]+)\}/g, (m, g) => convertScript(m, g, SUBSCRIPT_MAP));
  text = text.replace(/_(\w)/g, (m, g) => convertScript(m, g, SUBSCRIPT_MAP));

  // Named symbols — longest keys first so e.g. \leq doesn't get chopped by a shorter partial match.
  const symbolKeys = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length);
  for (const key of symbolKeys) {
    text = text.split(key).join(SYMBOL_MAP[key]);
  }

  // Any remaining unrecognized \command — drop the backslash so it doesn't render as a literal
  // slash-word, keep the word itself.
  text = text.replace(/\\([a-zA-Z]+)/g, "$1");
  text = text.replace(/[{}]/g, "");

  return text.trim();
}
