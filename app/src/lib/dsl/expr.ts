/**
 * A small, safe math expression evaluator for parametric diagrams — never uses eval()/Function()
 * since these expressions are AI-authored strings. Supports: + - * / ^ (power), unary minus,
 * parentheses, numbers, variable names, and a handful of functions (sqrt, sin, cos, tan, abs,
 * round, min, max) plus the constant pi.
 */

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
};

// "π" is accepted alongside "pi" — the DSL prompt tells the model to write real Unicode symbols
// (π, not "pi") in on-canvas labels, and it carries that habit into binding expressions too, so
// rejecting it there would silently break the exact formulas most likely to be parametric (area,
// circumference, volume — all π-based).
const CONSTANTS: Record<string, number> = { pi: Math.PI, "π": Math.PI, e: Math.E };

type Token = { type: "num"; value: number } | { type: "id"; value: string } | { type: "op"; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ type: "num", value: parseFloat(input.slice(i, j)) });
      i = j;
    } else if (/[a-zA-Z_π]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_π]/.test(input[j])) j++;
      tokens.push({ type: "id", value: input.slice(i, j) });
      i = j;
    } else if ("+-*/^(),".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
    } else {
      throw new Error(`Unexpected character "${ch}" in expression`);
    }
  }
  return tokens;
}

/** Recursive-descent parser/evaluator: expr -> term (('+'|'-') term)* ; term -> power (('*'|'/') power)* ; power -> unary ('^' unary)? ; unary -> '-'? atom ; atom -> num | id | id'(' args ')' | '(' expr ')' */
class Parser {
  private tokens: Token[];
  private pos = 0;
  private vars: Record<string, number>;

  constructor(tokens: Token[], vars: Record<string, number>) {
    this.tokens = tokens;
    this.vars = vars;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): number {
    const value = this.parseExpr();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos}`);
    }
    return value;
  }

  private parseExpr(): number {
    let value = this.parseTerm();
    for (;;) {
      const tok = this.peek();
      if (tok?.type === "op" && (tok.value === "+" || tok.value === "-")) {
        this.next();
        const rhs = this.parseTerm();
        value = tok.value === "+" ? value + rhs : value - rhs;
      } else break;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parsePower();
    for (;;) {
      const tok = this.peek();
      if (tok?.type === "op" && (tok.value === "*" || tok.value === "/")) {
        this.next();
        const rhs = this.parsePower();
        value = tok.value === "*" ? value * rhs : value / rhs;
      } else break;
    }
    return value;
  }

  private parsePower(): number {
    const base = this.parseUnary();
    const tok = this.peek();
    if (tok?.type === "op" && tok.value === "^") {
      this.next();
      const exponent = this.parsePower();
      return Math.pow(base, exponent);
    }
    return base;
  }

  private parseUnary(): number {
    const tok = this.peek();
    if (tok?.type === "op" && tok.value === "-") {
      this.next();
      return -this.parseUnary();
    }
    return this.parseAtom();
  }

  private parseAtom(): number {
    const tok = this.next();
    if (!tok) throw new Error("Unexpected end of expression");

    if (tok.type === "num") return tok.value;

    if (tok.type === "op" && tok.value === "(") {
      const value = this.parseExpr();
      const close = this.next();
      if (!close || close.type !== "op" || close.value !== ")") throw new Error("Expected closing parenthesis");
      return value;
    }

    if (tok.type === "id") {
      const name = tok.value;
      const nextTok = this.peek();
      if (nextTok?.type === "op" && nextTok.value === "(") {
        this.next();
        const args: number[] = [];
        if (!(this.peek()?.type === "op" && this.peek()?.value === ")")) {
          args.push(this.parseExpr());
          while (this.peek()?.type === "op" && this.peek()?.value === ",") {
            this.next();
            args.push(this.parseExpr());
          }
        }
        const close = this.next();
        if (!close || close.type !== "op" || close.value !== ")") throw new Error("Expected closing parenthesis");
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Unknown function "${name}"`);
        return fn(...args);
      }
      if (name in this.vars) return this.vars[name];
      if (name in CONSTANTS) return CONSTANTS[name];
      throw new Error(`Unknown variable "${name}"`);
    }

    throw new Error("Unexpected token in expression");
  }
}

/** Evaluates a math expression string against a set of named variable values. Throws on malformed
 * input or unknown identifiers — callers should catch and fall back gracefully. */
export function evaluateExpr(expr: string, vars: Record<string, number>): number {
  const tokens = tokenize(expr);
  return new Parser(tokens, vars).parse();
}

/** Best-effort formatting for a computed number in a diagram label — trims trailing zeros, caps
 * decimals at 2 places. */
export function formatExprResult(value: number): string {
  if (!Number.isFinite(value)) return "?";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
