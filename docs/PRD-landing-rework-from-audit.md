# PRD — Landing & Marketing-Site Rework (from the UI/UX + CRO Audit)

**Author:** Razin (with Claude)
**Status:** Ready for implementation
**Scope:** `/site` (the public marketing site) — landing page, every sub-page, the design/motion system, and SEO. No changes to `/app` or `/server` behaviour.
**Type:** Gap-analysis + implementation PRD — every item maps a specific audit finding to a concrete change against the **current** `/site` code.
**Related PRDs:** `PRD-marketing-site-and-design-system.md` (the site this reworks), `PRD-split-nextjs-app-and-hono-server.md` (the app/server the CTAs point at), `NODES-reference.md` (the real engine the hero imitates).
**Source of truth for design decisions:** "Comprehensive UI/UX and CRO Audit" (13-page report, uploaded). This PRD is the executable translation of that report onto the code that exists today.

---

## 0. How to read this PRD

The marketing site already exists and is built to a good standard (`PRD-marketing-site-and-design-system.md` shipped it). This is **not** a from-scratch build — it is a **rework**. Every section below is written as:

> **Current state** (what the code does today, with the exact file) → **Target** (what the audit asks for) → **Change** (the concrete edit) → **Acceptance** (how we know it's done).

The implementer (Claude Code, running in the background) should treat the **Change** blocks as the work list and the **Acceptance** blocks as the definition of done. Do not regress any existing feature, page, or route while reworking — the audit is additive/qualitative, not a teardown.

### Standing constraints (non-negotiable, apply to every task here)

1. **No secrets in the client.** The live-canvas hero and any interactive sandbox must never embed an API key, model name, or provider credential. Anything that needs AI runs on `/server` behind a public, rate-limited, read-only demo endpoint (see §4.5). If an interactive piece can be pre-scripted/deterministic instead of calling a model, prefer that.
2. **The client talks to our own server only.** No direct calls from `/site` to `hackai-sdk`, Gemini, OpenAI, or any provider. Base-URL'd API client only.
3. **No destructive operations.** No DB writes, no migrations, no seed/delete from the marketing site. It is a read-only shopfront.
4. **PRD → code, not live edits by hand here.** This document is the spec; implementation happens in the repo.
5. **Kill hardcoded `http://localhost:3000`.** It appears in `page.tsx`, `CTABand.tsx`, and `pricing/page.tsx` today. Every app-facing CTA must resolve through `NEXT_PUBLIC_APP_URL` (as `Nav.tsx` already does). This is both a bug and a launch blocker.
6. **Accessibility and performance are acceptance criteria, not aspirations** (§8). A section that hits the visual target but misses the perf/a11y budget is not done.

---

## 1. What the audit concluded (condensed)

The report's verdict: the site is structurally competent but **visually generic and under-converting**. It reads as "another SaaS landing page," not as the product it's selling — an app whose entire thesis is *watching math draw and explain itself*. The hero shows a small static triangle instead of the product doing the one thing that makes it special. The palette is a single indigo accent on paper; the audit wants a **surface-stratified, dual-mode canvas aesthetic** that visually *is* the product. Trust signals are placeholder stat counters rather than credible proof. Pricing is generically structured. There is no persistent conversion mechanism as the user scrolls.

The report's redesign blueprint, which this PRD implements:

- **Live, interactive canvas hero** replacing the static SVG triangle — the product literally drawing and branching a proof, on the same dot-grid canvas the app uses.
- **Dual-mode dark/light dot-grid canvas aesthetic** with **surface stratification** (distinct base / shell / card / border layers) and a **three-accent system** (Electric Blue, Violet, Emerald) instead of one hue.
- **Glassmorphic sticky conversion header** that appears on scroll.
- **Pinned, long-scroll scrollytelling** (≈350vh, four phases) that walks through the reasoning → branching → synthesis → verification story.
- **Asymmetric bento grid** (not the current uniform 4-up).
- **Institutional trust strip** with real, specific metrics and logos.
- **Restructured, tiered pricing** with a monthly/annual billing toggle and a clearly featured plan.
- **Zero-click onboarding sandbox** — let visitors use the product before signing up.
- Performance and accessibility budgets: 60fps / 16.6ms frames, LCP < 1.2s, CLS 0.00, WCAG 2.2 AA.
- A three-phase roadmap: **Days 1–7** design system + canvas alignment, **Days 8–21** hero sandbox + bento, **Days 22–35** scrollytelling + polish.

---

## 2. Current state inventory (the baseline we're reworking)

So the implementer starts from facts, not assumptions — this is exactly what exists today.

**Framework/stack (`site/package.json`):** Next.js 16.3, React 19.2, Tailwind v4 (CSS-first, `globals.css` `@theme inline`), `motion` v13, `gsap` v3.15, `lenis` v1.3, `katex` v0.18, `lucide-react`, `posthog-js`, MDX (`@next/mdx`, remark/rehype math + katex). **No JetBrains Mono, no WebGL/canvas lib** — hero motion is GSAP-on-SVG today.

**Design tokens (`site/src/app/globals.css`):** OKLCH ink/paper ramp (`--paper-50..950`) + **one** accent hue (`--accent-100..700`, indigo, hue 275) + success/warning/danger. Semantic aliases (`--background`, `--foreground`, `--muted`, `--border`, `--accent`) swap under `.dark`. Type scale (`--text-display-2xl` … `--text-caption`), radius scale, motion tokens (`--ease-*`, `--duration-*`). `.bg-graph-paper` utility exists (static grid, masked fade). Fonts: Geist + Geist Mono via `next/font`. Motion mirror in `site/src/lib/motion.ts` (`DURATION`, `EASE`, `STAGGER`).

**Landing (`site/src/app/page.tsx`, 212 lines):** graph-paper hero → `SignatureHero` (static SVG 6-8-10 triangle, GSAP stroke-draw, 3 text captions, **no audio, no interaction**) → 3× `StatCounter` (50000+, 98%, "4 answer forms" — **placeholders**) → "calculator vs openmaths" prose → 4-cell **symmetric** `BentoGrid` (forms) → `PinnedSteps` (**3** text steps, GSAP pin+scrub) → `TriangleSolverDemo` (real but trivial widget) → 6-cell feature bento → `Tabs` (use cases) → 3 `TestimonialCard` (**placeholder quotes**) → 3 free tools → pricing teaser → `CTABand`.

**Header (`site/src/components/Nav.tsx`):** sticky, `backdrop-blur`, `bg-background/80`, links Product/Tools/Pricing + `ThemeToggle` + "Open app" (uses `NEXT_PUBLIC_APP_URL` — good). **No scroll-state change, no conversion CTA that appears on scroll.**

**Pricing (`site/src/app/pricing/page.tsx` + `PricingTable.tsx`):** 3 tiers Free $0 / Pro $12·mo (highlighted) / Education "Contact us". **No billing toggle, no annual pricing, generic tier names.** `PricingTable` is a 3-col card grid, no featured scaling, no comparison.

**Other pages present (`site/src/app/`):** about, acceptable-use, blog(+[slug], category/[category]), changelog, community, contact, cookies, customers/[slug], dpa, faq, feedback, help(+[slug]), pricing, privacy, product, report-bug, resources(+[slug]), reviews, security, terms, tools(+[slug]). Plus `robots.ts`, `sitemap.ts`, `opengraph-image.tsx` (dark `#0a0a0f` OG — already close to the audit's palette).

**SEO infra (`layout.tsx`):** `metadataBase`, title template `%s — openmaths`, shared OG/Twitter, one `Organization` JSON-LD. Per-page `generateMetadata` is partial; richer JSON-LD types not yet present.

**Components (`site/src/components/`):** BentoGrid, Button (magnetic), CTABand, ContactForm, FAQAccordion, Footer, HelpSearch, LegalNotice, LenisProvider, Nav, PinnedSteps, PostHogProvider, PricingTable, ProseArticle, Reveal, Section, SignatureHero, StatCounter, Tabs, TestimonialCard, ThemeToggle, TriangleSolverDemo, WebVitalsReporter; tools/: Fraction/Percentage/Quadratic/RightTriangle/Unit.

**Content/data (`site/src/lib/`):** `placeholder-content.ts` (TESTIMONIALS + USE_CASES — flagged placeholder), `tools-data.ts` (5 tools), `case-studies.ts`, `content.ts`, `faq-data.ts`, `api.ts`, `motion.ts`.

The takeaway: the *skeleton* is right and the code quality is high. The rework is about **the design system values, the hero, the trust layer, the scroll story, the pricing structure, and a persistent conversion path** — not rebuilding routing or components wholesale.

---

## 3. Design system migration (Phase 1 · Days 1–7) — the foundation everything else builds on

This is the single highest-leverage change and **must land first**, because every section below inherits it. The audit's core aesthetic idea: the marketing site should look like the product. The product is a **dot-grid infinite canvas** with **stratified surfaces** (a dark base, raised shells, raised cards, hairline borders, glass toolbars) and **three functional accent colours**. The current single-indigo-on-paper system does not carry that. We migrate the token layer, not the component API — so components keep working while their look changes.

### 3.1 Surface stratification tokens

**Current state:** `globals.css` has `--background`/`--foreground`/`--muted`/`--border` only — a flat two-layer model. No concept of "base vs shell vs card vs glass."

**Target (from audit):** a layered surface ramp. Dark mode is the hero look; light mode mirrors it.

**Change:** Add these semantic surface tokens to `globals.css`, defined for **both** `:root` (light) and `.dark`. Keep the existing OKLCH `--paper-*` ramp available but retune the semantic aliases to the audit's values. Exact dark-mode targets from the report (author them as the primary/canonical values; light mode is the inverse):

| Token | Role | Dark value (audit) | Light value |
| --- | --- | --- | --- |
| `--surface-base` | page background / canvas ground | `#08090A` | `#F8FAFC` |
| `--surface-shell` | section shells, nav, footer | `#0E1013` | `#FFFFFF` |
| `--surface-card` | cards, bento cells, pricing tiers | `#14171C` | `#FFFFFF` (with border) |
| `--surface-card-hover` | card hover raise | `#181C22` | `#F1F5F9` |
| `--border-hairline` | 1px separators | `rgba(255,255,255,0.08)` | `rgba(2,6,23,0.08)` |
| `--border-strong` | focus rings, active edges | `rgba(255,255,255,0.16)` | `rgba(2,6,23,0.16)` |
| `--glass-bg` | glass toolbars/header | `rgba(20,23,28,0.75)` | `rgba(255,255,255,0.72)` |
| `--glass-blur` | backdrop blur radius | `16px` | `16px` |

Wire these into `@theme inline` as `--color-surface-base`, `--color-surface-shell`, `--color-surface-card`, etc., so components can use `bg-surface-card`, `border-border-hairline`, and so on. Re-point the existing aliases: `--background` → `--surface-base`, `--muted` → `--surface-shell`, `--border` → `--border-hairline`. Because `Section`, `BentoCard`, `PricingTable`, etc. already reference `bg-muted/40`, `border-border`, `bg-background`, retuning the aliases restyles them for free — then upgrade the highest-value components to the explicit surface tokens (§3.5).

> **Implementation note on colour space:** the audit gives hex; the current system is OKLCH. Author the new surface tokens **as given (hex is fine)** — do not force them back through OKLCH and risk drift from the report's exact values. Keep the accent triad below in whichever space renders those exact hues; hex is acceptable throughout. Consistency with the report's numbers beats colour-space purity.

### 3.2 Three-accent system

**Current state:** one accent hue (indigo, OKLCH hue 275), `--accent-100..700`, used everywhere via `--accent`.

**Target (from audit):** three functional accents, each with a job:

| Token | Colour | Meaning / usage |
| --- | --- | --- |
| `--accent-blue` | `#3B82F6` (Electric Blue) | Primary — CTAs, links, the "reasoning" accent, focus rings |
| `--accent-violet` | `#8B5CF6` (Violet) | Secondary — branching/sub-question story, gradients, "Most Popular" pricing |
| `--accent-emerald` | `#10B981` (Emerald) | Success/verification — "verified" states, checkmarks, the verification scroll phase |

**Change:** Introduce the triad in `globals.css` with tint/shade steps for each (e.g. `--accent-blue-500` canonical + `-400`/`-600` for hover/press), plus gradient tokens the audit leans on:

- `--gradient-reasoning: linear-gradient(135deg, var(--accent-blue), var(--accent-violet));`
- `--gradient-glow-blue: radial-gradient(60% 60% at 50% 0%, rgba(59,130,246,0.35), transparent);`

Re-point the semantic `--accent` alias to `--accent-blue-500` so the existing `bg-accent`/`text-accent` usages (Button primary, StatCounter, links, checkmarks) instantly adopt Electric Blue. Then migrate the semantically-specific uses to the right member of the triad: pricing "Most Popular" and the branching scroll phase → violet; verification/success and pricing checkmarks that mean "included" → emerald. **Preserve `--success`/`--warning`/`--danger`** for form/status semantics; `--accent-emerald` is a brand accent, not a replacement for the danger token.

**Contrast requirement:** every accent-on-surface and text-on-surface pair used for real content must pass WCAG 2.2 AA — 4.5:1 body, and the audit's stricter **7:1 for headings**. Electric Blue `#3B82F6` on `#08090A` passes for large text/UI but is borderline for small body text; use the `-400` lightened step for small text on dark, and verify every pairing (§8.3).

### 3.3 Typography

**Current state:** Geist + Geist Mono. KaTeX present. No code/monospace-for-math distinction beyond Geist Mono.

**Target (from audit):** Geist/Inter for UI, **JetBrains Mono** for code/formula/numeric emphasis, KaTeX for rendered math.

**Change:** Add `JetBrains_Mono` via `next/font/google` in `layout.tsx` as `--font-mono-code`, and expose `--font-mono` in `@theme` mapped to it (keep Geist Mono as fallback or repurpose). Use it for: the hero's caption/formula line, `StatCounter` numerals (tabular), inline formulae that aren't full KaTeX, and tool inputs/outputs. Keep the type scale tokens as-is — they're well-structured; the audit doesn't dispute the scale, only the type *pairing*. Confirm heading tracking stays tight (`tracking-tight` already applied on display sizes).

### 3.4 Dot-grid canvas background (dual-mode)

**Current state:** `.bg-graph-paper` — a static square grid with a top-down mask fade, one opacity, used only behind the hero.

**Target (from audit):** a **dot-grid** canvas motif (dots, not lines — this is the app's canvas look), working in both dark and light, subtle, used as the connective tissue of the page rather than one hero backdrop.

**Change:** Add a `.bg-dot-grid` utility to `globals.css`: `radial-gradient(circle, var(--border-hairline) 1px, transparent 1px)` at a 24px grid, with a radial or directional mask so it fades where content sits. Keep `.bg-graph-paper` for any section that wants the line look. Apply `.bg-dot-grid` to the hero and — sparingly — to one or two section shells so the "canvas" feeling persists on scroll without becoming noise. Under `prefers-reduced-motion` the grid is static (it already is); the interactive/parallax version is opt-in (§4.1).

### 3.5 Component restyle pass (mechanical, after tokens land)

Once §3.1–3.4 land, sweep the components so they *use* the new layers rather than the flat aliases:

- **`Section.tsx`** — add an optional `surface` prop (`"base" | "shell"`) so alternating sections can raise onto `--surface-shell`; keep default `base`. Preserves the current `width` API.
- **`BentoGrid.tsx` / `BentoCard.tsx`** — cards move to `bg-surface-card`, `border-border-hairline`, hover to `bg-surface-card-hover`; the spotlight gradient switches from `--accent-100` to a blue/violet glow. (Asymmetric layout is §4.3.)
- **`PricingTable.tsx`** — tiers on `bg-surface-card`; featured tier gets the violet treatment (§6.6).
- **`CTABand.tsx`** — glow uses `--gradient-glow-blue`; also fix its hardcoded `href` default (§0 constraint 5).
- **`Nav.tsx` / `Footer.tsx`** — onto `--glass-bg` / `--surface-shell` (nav glass is §4.2).
- **`Button.tsx`** — primary already `bg-accent` → now Electric Blue automatically; add a violet-gradient variant for hero primary if the audit's hero CTA calls for it.

**Acceptance for §3:** Toggling the theme shows a coherent dark-canvas ↔ light-canvas system with visible surface layering (you can tell base from card from glass); the three accents each appear in their assigned role; JetBrains Mono renders on formulae/numerals; a dot-grid reads behind the hero in both themes; no component looks broken; every text/accent pairing passes the §8.3 contrast gate; `prefers-reduced-motion` still yields a static, correct page.

---

## 4. Landing page rework, section by section (`site/src/app/page.tsx`)

The page keeps its ordering logic but each block is reworked. New section order after rework:

1. Hero (live interactive canvas) — §4.1
2. Trust strip (institutional proof) — §4.4
3. "Calculator vs openmaths" thesis — kept, restyled
4. Forms bento (asymmetric) — §4.3
5. Pinned scrollytelling (350vh, 4 phases) — §4.6
6. Zero-click sandbox — §4.5
7. Feature bento — restyled asymmetric
8. Use-case tabs — kept, restyled
9. Testimonials — real-proof rework — §4.4
10. Free tools teaser — kept, restyled
11. Pricing teaser + CTA band — §6.6 link
12. Glassmorphic sticky conversion header sits above all of it — §4.2

### 4.1 Hero — live interactive canvas replacing the static triangle

**Current state:** `SignatureHero.tsx` — a self-contained SVG 6-8-10 triangle, GSAP stroke-draw on a loop, three swapped text captions, no audio, **no interaction**. Its own docstring concedes it's a "stand-in" and that extracting the real engine (`app/src/components/engine/*`) is "its own project."

**Target (from audit):** the hero *is* the product — a live, interactive OpenMaths canvas on the dot-grid, showing a proof drawing itself and **branching a sub-question**, that the visitor can nudge/interact with. It should feel like the app, not a diagram.

**Change — build a purpose-built marketing canvas (`HeroCanvas.tsx`), do not import the app engine:**

- Create `site/src/components/HeroCanvas.tsx` — a self-contained interactive canvas hero. Rationale: the real engine isn't a shared package, extracting it is out of scope and risks pulling app-only deps (and, worse, auth/AI code) into the marketing bundle. Instead, build a **deterministic, pre-scripted "scene"** that reproduces the app's *look and motion* (dot-grid, node cards, connector lines, a drawn proof, a branched sub-question node) using Canvas2D (or lightweight WebGL only if a measured perf win justifies it) + GSAP for timing.
- **Interactivity (the part the audit wants that's missing today):** on pointer move, parallax the dot-grid and node layer subtly (translate by a few px, `will-change: transform`); allow the visitor to **hover a node to "expand" it** and **click the branch affordance to spawn the sub-question node** with the drawing animation. This is scripted state, not a real model call — zero backend, zero secrets.
- **The proof it draws:** keep the 6-8-10 Pythagorean scene as the primary (it's recognizable and correct), but render it as an app-style **question node → diagram node → solution-steps node**, with a **branch** to a "What if the legs were 5 and 12?" sub-question that draws its own 5-12-13 result. This directly stages the scrollytelling story (§4.6) in miniature.
- **Formula/caption line** uses JetBrains Mono + optional KaTeX for the `6² + 8² = 10²` step.
- **Fallback:** under `prefers-reduced-motion`, render a **static, fully-drawn** version of the same scene (the completed proof + the branch already shown) — no looping, no parallax. Under no-JS/SSR, render the static SVG scene (SignatureHero can be repurposed as that fallback so we don't lose it).
- **Performance:** the hero must not block LCP. The LCP element should be the H1 text, not the canvas — render the canvas progressively after first paint, cap the animation at 60fps, pause the RAF loop when the hero scrolls out of view (IntersectionObserver), and never ship a heavy WebGL context if Canvas2D hits the frame budget. Respect the LCP < 1.2s / CLS 0.00 budget (§8).

**Keep `SignatureHero.tsx`** as the reduced-motion / SSR static fallback and as the `product/page.tsx` feature-row media (it's used there too); `HeroCanvas` is the new home-hero.

**Acceptance:** the home hero shows an app-style canvas that draws a proof and can branch a sub-question on interaction; it looks like the product; H1 is the LCP element and LCP < 1.2s on a mid-tier device; 60fps during animation; reduced-motion shows a correct static scene; no network call, no secret, no layout shift.

### 4.2 Glassmorphic sticky conversion header

**Current state:** `Nav.tsx` is sticky with a constant `backdrop-blur` and `bg-background/80`. It does not change on scroll and has no conversion CTA that appears as you go.

**Target (from audit):** a glassmorphic header that, past ~500px of scroll, tightens into a **conversion bar** — condensed brand + a prominent "Start free" that wasn't competing with the hero CTA at the top.

**Change:** make `Nav.tsx` a client component that tracks scroll (`scrollY > 500`, throttled via `requestAnimationFrame`, not per-scroll React state thrash — mirror the `BentoCard` CSS-var pattern or use a single boolean state flipped past threshold). In the scrolled state: switch to `--glass-bg` + `backdrop-blur(var(--glass-blur))` + a hairline bottom border + subtle shadow; reveal the primary "Start free" CTA (Electric Blue) that is hidden/ghost at the top so it doesn't double the hero CTA. Animate the transition (opacity/transform, `--duration-base`, `--ease-standard`). Respect reduced-motion (cross-fade only, no slide). Keep it keyboard-reachable and `aria-current` correct. All app links via `NEXT_PUBLIC_APP_URL`.

**Acceptance:** scrolling past the hero produces a glass conversion header with a visible Start-free CTA; it's smooth (no jank, no CLS), themes correctly, and is fully keyboard/screen-reader accessible.

### 4.3 Asymmetric bento grids

**Current state:** `BentoGrid` is a uniform `sm:grid-cols-2 lg:grid-cols-4` (forms) / `lg:grid-cols-3` (features). Every cell is equal weight.

**Target (from audit):** an **asymmetric** bento — a hero/feature cell spanning 2×2 or a wide 2×1, mixed with standard cells, creating visual hierarchy and rhythm.

**Change:** extend `BentoGrid`/`BentoCard` to accept span props (`colSpan`, `rowSpan`) and add a `featured` card variant (larger type, a small inline visual/animation, the violet/blue glow). Restructure the **forms** section so "Geometry" (the flagship form, and the one the hero draws) is the featured 2×2 cell with a mini animated diagram, and Algebra/Graphs/Tables are standard cells around it. Do the same for the **features** bento — make "Voice narration" or "Non-linear canvas" the featured cell. Keep the spotlight hover; upgrade its colour per §3.5. Ensure the grid collapses gracefully to single-column on mobile with the featured cell still first.

**Acceptance:** both bento sections read as intentional, hierarchical layouts (not a uniform grid); the flagship cells stand out; hover micro-interactions work; mobile stacks cleanly; no CLS from the featured cell's inline visual.

### 4.4 Institutional trust strip + real testimonials

**Current state:** three `StatCounter`s with placeholder values (50000+, 98%, "4 answer forms"); three `TestimonialCard`s with quotes flagged as placeholder in `placeholder-content.ts`.

**Target (from audit):** a credible trust strip — specific metrics (the report cites e.g. **500,000+ equations explained, 99.4% accuracy, 4.9/5 rating**) and **institutional logos** (the report shows MIT / Stanford / Cambridge / ETH as the style of proof). Testimonials should read as real, attributed proof.

**Change:**
- Rework the stat row into a dedicated **trust strip** just under the hero: metrics in JetBrains Mono numerals via `StatCounter`, plus a **logo row** (a new `TrustLogos.tsx` rendering monochrome institution/press SVGs on the shell surface, with an "as used by / featured in" label).
- **Truthfulness gate (constraint):** do **not** ship fabricated metrics or institutional endorsements that imply real relationships that don't exist. Put the real numbers in `site/src/lib/trust-data.ts` and, where a metric or logo isn't yet real, either (a) use a defensible real number, or (b) mark it clearly as illustrative until real data exists — the same way `placeholder-content.ts` is already flagged. The *layout and design* are the deliverable now; the *claims* must be real before deploy. Add a `// TODO(razin): replace with real figure before launch` on any placeholder.
- Replace `TestimonialCard` content with real quotes when available; until then keep the placeholder flag and the illustrative labeling. Consider adding a source/role and, where real, a small avatar.

**Acceptance:** a trust strip with numeric metrics + a logo row renders on the shell surface below the hero; testimonials read as credible; **no fabricated institutional claim ships un-flagged**; the data lives in a single editable file for easy swap.

### 4.5 Zero-click onboarding sandbox

**Current state:** `TriangleSolverDemo` — a real but trivial right-triangle calculator embedded mid-page.

**Target (from audit):** a **zero-click sandbox** — let the visitor experience the actual product (type a question, watch it draw/explain) without signing up.

**Change (phased, honoring the no-secrets / server-only constraints):**
- **Phase A (ships in this rework):** upgrade the embedded demo into an **interactive canvas sandbox** that reuses `HeroCanvas`'s scene engine but lets the visitor pick from a **curated set of pre-solved questions** (e.g. 6-8-10 triangle, a quadratic, a linear graph, a fraction) and watch each **draw + narrate (text captions, optionally the real recorded audio sample the product page references)**. This is fully client-side and deterministic — no model call, no secret, instant, and it can't be abused or run up cost.
- **Phase B (optional, gated):** a true "type your own question" sandbox that calls a **new public, read-only, rate-limited demo endpoint on `/server`** (e.g. `POST /api/public/demo/solve`) which runs the real pipeline server-side with strict per-IP quotas, no auth, no user data, and a hard cap. Only build Phase B if product wants live input on the marketing page; it is explicitly out of the critical path and must pass a security review (rate limiting, input validation, cost ceiling) before shipping. **Do not** wire the client to any provider directly.

**Acceptance:** a visitor can, with zero clicks beyond selecting a sample, watch the product solve-and-explain on the marketing page; it's instant and secret-free (Phase A); if Phase B ships, it's server-side, rate-limited, and reviewed.

### 4.6 Pinned scrollytelling (≈350vh, four phases)

**Current state:** `PinnedSteps` pins the section and scrubs through **3 short text steps** (Ask / Watch / Explore) with a GSAP ScrollTrigger; reduced-motion falls back to a static stacked list. It's text-only — no visual builds as you scroll.

**Target (from audit):** a cinematic pinned sequence, ~350vh of scroll, **four phases**, each with a **visual that builds** in sync with scroll:
1. **Reasoning** — the model reasons through the problem (thinking → first step drawn).
2. **Sub-question branching** — a sub-question branches off into its own node.
3. **Formula synthesis** — the formula assembles / KaTeX renders the key relationship.
4. **Multi-modal verification** — the answer is verified across forms (diagram ↔ steps ↔ plot agree), emerald "verified" state.

**Change:** build `ScrollStory.tsx` (can supersede or wrap `PinnedSteps`): one ScrollTrigger pinning a ~350vh container, driving a GSAP timeline `scrub`bed to progress, with **four keyframed phases** each advancing a canvas/SVG visual (reuse `HeroCanvas`'s scene primitives — nodes, connectors, drawn proof — so the story visually matches the hero). Use the accent triad to code the phases (blue reasoning → violet branching → blue/violet synthesis → emerald verification). Progress indicator (the existing dot bar, upgraded). **Reduced-motion / mobile fallback:** a static, non-pinned vertical sequence of the four phases, each with its final-state visual and caption — keep `PinnedSteps`' existing reduced-motion pattern as the model. Guard the 350vh height so it doesn't create absurd scroll on small screens (cap phase length; consider a shorter pinned distance on mobile or the static fallback there).

**Acceptance:** scrolling the section pins it and steps through four phases with a visual that builds in sync, colour-coded by phase, ending on an emerald "verified" state; reduced-motion and mobile get a clean static four-step sequence; 60fps during scrub; no scroll-trap (user can always scroll past).

### 4.7 CTA + link hygiene across the page

**Current state:** `page.tsx` hero CTA and `CTABand` default use hardcoded `http://localhost:3000`; pricing tiers too.

**Change:** replace every hardcoded app URL with `NEXT_PUBLIC_APP_URL` (import a single `APP_URL` helper from `site/src/lib/api.ts` or a new `site/src/lib/urls.ts` so there's one source). Ensure every primary CTA text is consistent ("Start free") and every secondary CTA is distinct ("See it work" / "See how it works"). Add PostHog event tracking on the primary CTAs (the provider already exists) so conversion is measurable — a lightweight `data-cta` attribute + one handler, no PII.

**Acceptance:** no `localhost` string anywhere in `/site`; all app CTAs resolve via env; primary/secondary CTA copy is consistent; CTA clicks emit an analytics event.

---

## 5. Motion & interaction system (global)

**Current state:** `lib/motion.ts` (DURATION/EASE/STAGGER), Lenis smooth scroll (`LenisProvider`), GSAP ScrollTrigger (`PinnedSteps`), Motion (`Button` magnetic, `StatCounter`, `Reveal`), CSS motion tokens. Reduced-motion handled per-component. This is a solid base — the audit doesn't ask to replace it, it asks to **use it more ambitiously and consistently**.

**Change / additions:**
- **Keep Lenis + GSAP + Motion.** Add a shared `useReducedMotion` gate helper and a `useCanvasScene` hook (the shared scene primitives used by `HeroCanvas`, `ScrollStory`, and the sandbox) so all three canvas surfaces share one animation core — one place to tune, one place to hit the frame budget.
- **Reveal-on-scroll:** the existing `Reveal` + `STAGGER` is fine; ensure every new section uses it so entrances are consistent (60–80ms stagger).
- **View Transitions:** the audit mentions View Transitions; use the CSS View Transitions API for same-origin route changes within `/site` (e.g. tools hub → tool page) where supported, with graceful fallback. Optional/progressive — not a blocker.
- **Motion budget:** no animation may drop below 60fps; RAF loops pause off-screen (IntersectionObserver); `will-change` used only on actively-animating layers; no layout-triggering animated properties (animate `transform`/`opacity`, not `top`/`width`).
- **One reduced-motion contract:** every animated component must (a) render a correct, complete static state under `prefers-reduced-motion: reduce`, and (b) never hide content behind an animation that reduced-motion users can't trigger.

**Acceptance:** all canvas surfaces share one scene core; reveals are consistent; nothing animates below 60fps; every animated component has a correct reduced-motion static state.

---

## 6. Every other page — rework to the new system

Two levels of work: **(A) universal** — every page inherits the §3 design system automatically once tokens land, but each needs a visual pass to use surfaces/accents intentionally rather than just inheriting retuned aliases; **(B) page-specific** reworks below.

### 6.1 Universal pass (all pages)

Apply to every route: new surface layering (alternate `base`/`shell` sections via the `Section surface` prop), accent triad in the right roles, JetBrains Mono on numerals/formulae, dot-grid motif where it fits, consistent `Reveal` entrances, glass nav + fixed footer, and the CTA/link hygiene from §4.7 (no `localhost`, env-driven app links, analytics on primary CTAs). Every page must pass the §8 perf/a11y budgets, not just the landing.

### 6.2 Product page (`app/product/page.tsx`)

**Current:** feature rows alternating text/media, using `SignatureHero` as media and a "coming soon" audio placeholder. **Rework:** lead with `HeroCanvas` (or a product-specific scene) instead of the static `SignatureHero`; replace the "audio sample — coming soon" placeholder with the **real recorded narration sample** (the same asset the sandbox uses) in an accessible `<audio>` player with a transcript; make each feature row's media a **real mini-visual** (branching, multi-form, export) using the shared scene primitives; add a mid-page CTA and the trust strip. Keep the alternating-row structure — it's good.

### 6.3 Tools hub + tool pages (`app/tools/`, `app/tools/[slug]/`) — the SEO engine

**Current:** 5 tools (`tools-data.ts`), a hub grid, per-tool pages, real client widgets. This is the audit's **free-tools SEO strategy** made real, and it's the highest-ROI SEO surface.

**Rework:** (1) restyle hub + tool pages to the new system (each tool card on `surface-card`, category grouping with the accent triad). (2) **Expand toward the audit's ~12-tool launch list** — the current data file notes "ship 4–6 first, expand"; add high-search-volume tools (e.g. slope calculator, percentage change, GCD/LCM, mean/median/mode, systems-of-equations, area/volume, derivative/integral where feasible). (3) Each tool page must be a **complete SEO landing page**: unique title/description, `HowTo` + `FAQPage` + `SoftwareApplication`/`WebApplication` JSON-LD, a "related tools" block, and a soft CTA into the app ("want it drawn and explained? open in openmaths"). (4) Ensure every tool has a per-page OG image. See §7.

**Acceptance:** tools hub and every tool page are restyled, each tool page is a self-sufficient SEO landing page with structured data and internal links, and the tool set has grown toward the launch list.

### 6.4 About / company (`app/about/`)

**Current:** company page. **Rework:** restyle to the new system; add a mission statement that matches the "watch math explain itself" thesis, a values/story section on the canvas motif, and (when real) team + institutional/press proof consistent with §4.4's truthfulness gate.

### 6.5 FAQ (`app/faq/`, `FAQAccordion.tsx`, `faq-data.ts`)

**Current:** accordion + data file. **Rework:** restyle accordion to surface-card; ensure `FAQPage` JSON-LD is emitted (§7); group questions; make sure the accordion is fully keyboard-accessible (`aria-expanded`, arrow-key nav optional) and reduced-motion friendly.

### 6.6 Pricing (`app/pricing/page.tsx`, `PricingTable.tsx`)

**Current:** Free $0 / Pro $12·mo (highlighted) / Education "Contact us"; no billing toggle, no annual, generic names, no featured scaling.

**Target (from audit):** three tiers — **Starter (Free)** / **Pro Researcher ($16/mo, "Most Popular")** / **Lab · Institution (Custom)** — with a **Monthly / Annual toggle (Save 25%)** and the featured tier visually elevated (violet, scaled, badge).

**Change:**
- Restructure `TIERS` in `pricing/page.tsx`: Starter (Free), Pro Researcher, Lab·Institution. Use the audit's naming and the **$16/mo** Pro figure (annual = 25% off, show both). Keep the exact numbers editable in one place and flag any not-yet-final figure with `// TODO(razin)` per §4.4's truthfulness gate.
- Add a **billing toggle** (Monthly/Annual) — client state in `PricingTable` or a wrapper; annual shows the discounted monthly-equivalent + a "Save 25%" pill (violet). Persist choice in component state only (no storage needed).
- **Featured tier:** Pro Researcher gets `--accent-violet` border/badge ("Most Popular"), slight scale, and the primary CTA; others get secondary CTAs. Consider a **feature comparison** row set below the cards for detail.
- Fix hardcoded hrefs → `NEXT_PUBLIC_APP_URL`; Lab·Institution CTA → real contact route (`/contact`) not `mailto:` once contact is confirmed (§6.10).
- Emit `Product`/`Offer` JSON-LD for pricing where appropriate (§7).

**Acceptance:** pricing shows three correctly-named tiers with a working Monthly/Annual toggle and "Save 25%" annual, Pro Researcher featured in violet as "Most Popular," a comparison for detail, env-driven CTAs, and structured data; all figures live in one editable place with any placeholder flagged.

### 6.7 Content pages — blog, resources, help (`app/blog/`, `app/resources/`, `app/help/`, MDX + `ProseArticle`)

**Current:** MDX-driven, `.prose` tuned to the palette in `globals.css`, index + `[slug]` + categories, `HelpSearch`. **Rework:** re-tune `.prose` `--tw-prose-*` to the new surfaces/accents (links → Electric Blue, code bg → surface-card, blockquote border → accent); ensure KaTeX + JetBrains Mono code render well on the new surfaces; restyle index/category/search UIs; add `Article`/`BlogPosting` + `BreadcrumbList` JSON-LD (§7); ensure reading width (~68ch) and vertical rhythm hold. Content itself is out of scope — the *system* is the deliverable.

### 6.8 Social-proof & lifecycle pages — reviews, customers, changelog, community, feedback, report-bug

**Current:** all present (`reviews`, `customers/[slug]`, `changelog`, `community`, `feedback`, `report-bug`). **Rework:** restyle to the new system; **reviews/customers** must honor §4.4's truthfulness gate (no fabricated testimonials/case studies shipped as real — keep the `placeholder-content.ts`/`case-studies.ts` illustrative flags until real); **changelog** on the canvas motif with clear versioning; **feedback/report-bug** forms restyled and validated (they post to our own server only). Add appropriate JSON-LD (`Review`/`AggregateRating` **only when real**).

### 6.9 Legal & trust pages — privacy, terms, security, dpa, cookies, acceptable-use (`LegalNotice`, `ProseArticle`)

**Current:** legal content via prose + `LegalNotice`. **Rework:** restyle to the new system (readable prose on shell surface, clear TOC/anchors), ensure the **security** page communicates the real posture from `PRD-auth-security-audit.md` (server-side secrets, no keys in client, etc.) accurately and without over-claiming. Legal *copy* is out of scope; presentation + accuracy of the security page are in.

### 6.10 Contact (`app/contact/`, `ContactForm.tsx`)

**Current:** contact page + form. **Rework:** restyle; confirm the form posts to **our own server** endpoint (no third-party form service that would take data off-platform without review); validate with the existing `zod` + `react-hook-form` stack; make it the destination for the Lab·Institution pricing CTA. Accessible labels/errors, reduced-motion friendly.

### 6.11 Footer (`Footer.tsx`) & Nav mega-menu

**Current:** footer present; nav has 3 links (`Nav.tsx` docstring notes the full mega-menu waits on sections existing — they now exist). **Rework:** footer onto `--surface-shell` with the dot-grid motif, complete sitemap-style link columns (Product / Tools / Resources / Company / Legal), theme toggle, and social. Expand the nav to a proper menu now that Tools/Resources/Blog/Help/Pricing/About all exist — a Tools/Resources dropdown (accessible, keyboard-navigable, reduced-motion friendly) rather than dead or missing links.

**Acceptance for §6:** every route renders in the new design system, passes §8 budgets, emits the right structured data (§7), and ships no fabricated proof; pricing and tools get their specific reworks; nav/footer are complete.

---

## 7. SEO

**Current state:** `layout.tsx` has `metadataBase`, a title template, shared OG/Twitter, and one `Organization` JSON-LD. `robots.ts`, `sitemap.ts`, and a default `opengraph-image.tsx` exist. Per-page `generateMetadata` and richer JSON-LD are partial.

**Target:** full per-page SEO, with the tools pages as the primary organic-acquisition surface.

**Change:**
- **Per-page metadata:** every route exports `metadata`/`generateMetadata` with a unique title (via the template), a unique 150–160-char description, canonical URL, and OG/Twitter overrides. Dynamic routes (`tools/[slug]`, `blog/[slug]`, `resources/[slug]`, `help/[slug]`, `customers/[slug]`, `blog/category/[category]`) generate these from their data.
- **Structured data (JSON-LD) by page type:**
  - Home + layout: `Organization` (keep) + `WebSite` with `SearchAction` (sitelinks search box).
  - Tools hub: `CollectionPage`; each tool page: `SoftwareApplication`/`WebApplication` + `HowTo` + `FAQPage` (from each tool's `howTo`/FAQ data).
  - Blog/resources/help articles: `Article`/`BlogPosting` + `BreadcrumbList`.
  - FAQ page: `FAQPage`. Pricing: `Product` + `Offer` (only real offers). Reviews/customers: `Review`/`AggregateRating` **only when real** (truthfulness gate).
- **OG images:** per-page dynamic OG via the `next/og` `ImageResponse` pattern already used in `opengraph-image.tsx` — add sibling `opengraph-image.tsx` files (or `generateImageMetadata`) for tools, blog, product, pricing, so shares render a relevant, branded card in the new palette (the default already uses `#0a0a0f`, close to `--surface-base`).
- **Sitemap/robots:** extend `sitemap.ts` to enumerate every static + dynamic route (all tools, all articles) with `lastModified`/`changeFrequency`/`priority`; confirm `robots.ts` allows crawl and points at the sitemap.
- **Semantics & Core Web Vitals for SEO:** correct heading hierarchy (one H1 per page — the hero H1 is the LCP element), descriptive alt text on meaningful imagery, and the §8 CWV budgets (Google ranks on them). `WebVitalsReporter` already reports; wire it so regressions are visible.
- **Internal linking:** tools ↔ related tools ↔ app; blog/resources ↔ tools; footer sitemap columns (§6.11). This is what makes the free-tools strategy compound.

**Acceptance:** every page has unique metadata + canonical + OG; the right JSON-LD type validates (Rich Results Test) per page type; sitemap enumerates all routes including dynamic; no fabricated review/rating structured data; tools pages are fully optimized SEO landing pages.

---

## 8. Performance & accessibility budgets (acceptance gates, not goals)

These are the audit's stated budgets. A section that misses them is not done.

### 8.1 Performance
- **60fps / ≤16.6ms** frame time during all animation (hero canvas, scrollytelling scrub, bento hover, magnetic buttons, counters). Verify with DevTools Performance and the frame budget; profile the hero and scroll story specifically.
- **LCP < 1.2s** (mid-tier device / throttled). The LCP element is the hero **H1**, not the canvas — the canvas mounts progressively after first paint. No render-blocking above-the-fold JS beyond the essential.
- **CLS 0.00.** Reserve space for every async/animated element (canvas, images, OG, fonts). Use `next/font` (already) with `font-display` to avoid FOUT shift; give the hero canvas a fixed aspect box.
- **INP:** keep interactions responsive — no long tasks from scroll/animation on the main thread; throttle scroll handlers via RAF (Nav, parallax).
- **Bundle discipline:** the marketing site must not import app-only or provider SDKs. Hero/scroll canvas is self-contained; no `hackai-sdk`/model SDK in `/site`. Code-split heavy client components (`HeroCanvas`, `ScrollStory`, sandbox) so they don't bloat the initial payload. Lazy-mount below-the-fold canvases.
- **Lenis + ScrollTrigger** must not fight the browser's scroll or trap it; verify no scroll-jank on low-end devices; provide the non-pinned fallback on mobile where the 350vh story is too heavy.

### 8.2 Accessibility (WCAG 2.2 AA)
- **Contrast:** 4.5:1 body text, **7:1 headings** (audit's stricter bar), 3:1 for UI/large text — on **both** themes and on every surface layer. Electric Blue small text on dark uses the lightened `-400` step.
- **prefers-reduced-motion:** every animated component has a correct, complete static state (hero, scrollytelling, counters, magnetic buttons, reveals, nav transition). No content is reachable only via motion.
- **Keyboard:** full keyboard operability — nav (incl. new dropdown), pricing toggle, FAQ accordion, tabs, tool inputs, forms, sandbox selector; visible focus rings using `--border-strong`/accent; logical tab order; skip-to-content link.
- **Screen readers:** semantic landmarks (`header`/`nav`/`main`/`footer`), one H1/page, correct heading order, `aria-current` in nav, labelled form fields with associated errors, `role="status"` for the hero caption (already used in `SignatureHero`), decorative canvases `aria-hidden` with a text alternative describing what they show.
- **Targets:** 24×24px minimum interactive targets (WCAG 2.2), especially the pricing toggle and mobile nav.

### 8.3 Verification (must run before "done")
- **Contrast:** automated check of every foreground/surface pairing in both themes (script or axe); record pass/fail.
- **Lighthouse** (mobile) ≥ 95 Performance / 100 Accessibility / 100 Best-Practices / 100 SEO on home, product, pricing, tools hub, and a tool page.
- **axe-core** clean (no serious/critical) on the same page set.
- **Reduced-motion pass:** load each page with reduced-motion forced; confirm correct static states.
- **Rich Results Test** passes for each JSON-LD type.
- **CWV field-ready:** `WebVitalsReporter` shows LCP/CLS/INP within budget in a throttled run.

---

## 9. Phased roadmap (the audit's 3 phases, mapped to this codebase)

### Phase 1 · Days 1–7 — Design system & canvas alignment (foundation)
- §3 in full: surface tokens, three-accent triad, JetBrains Mono, dot-grid utility, component restyle sweep.
- §4.7 link/CTA hygiene (kill `localhost`, env-driven URLs, single URL helper) — small, do it now.
- §4.2 glassmorphic sticky conversion header.
- §6.1 universal pass begins (every page inherits + gets an intentional surface/accent pass).
- **Exit criteria:** theme toggle shows a coherent stratified dark/light canvas system; all components restyled; contrast gate passes; no `localhost` in `/site`; nav is the glass conversion header.

### Phase 2 · Days 8–21 — Hero sandbox & bento (the differentiators)
- §4.1 `HeroCanvas` — live interactive canvas hero (with static/SSR/reduced-motion fallbacks; `SignatureHero` retained as fallback).
- §4.5 Phase-A zero-click sandbox (curated pre-solved scenes) reusing the scene core.
- §4.3 asymmetric bento (forms + features) with featured cells.
- §4.4 trust strip + logo row + real/flagged testimonials.
- §6.6 pricing rework (tiers, billing toggle, featured violet, comparison).
- §6.3 tools hub + tool-page restyle and first tool-set expansion.
- **Exit criteria:** hero is a live product-like canvas with H1 as LCP < 1.2s at 60fps; sandbox lets visitors watch a real solve with zero secrets; bento is asymmetric; trust strip credible; pricing restructured with working toggle.

### Phase 3 · Days 22–35 — Scrollytelling & polish
- §4.6 `ScrollStory` — 350vh four-phase pinned scrollytelling (with mobile/reduced-motion static fallback).
- §5 View Transitions + motion consistency pass.
- §7 full SEO: per-page metadata, JSON-LD by type, per-page OG, sitemap expansion, internal linking.
- §6 remaining pages (product media, about, faq, content prose retune, legal/security, contact, footer/nav mega-menu, lifecycle pages).
- §8.3 full verification pass (Lighthouse/axe/Rich Results/reduced-motion/CWV) across the key page set.
- Optional: §4.5 Phase-B server-side live sandbox (only if product wants it; requires security review).
- **Exit criteria:** the four-phase scroll story runs at 60fps with clean fallbacks; every page is reworked, SEO-complete, and passes the §8 budgets; the whole site reads as "the product that watches math explain itself."

---

## 10. File-by-file change map (implementer's work list)

**Tokens / global**
- `site/src/app/globals.css` — add surface stratification tokens, three-accent triad + gradients, `.bg-dot-grid`, re-point semantic aliases, retune `.prose`, JetBrains Mono `@theme` var. *(§3)*
- `site/src/app/layout.tsx` — add `JetBrains_Mono` font; add `WebSite`+`SearchAction` JSON-LD; keep `Organization`. *(§3.3, §7)*
- `site/src/lib/motion.ts` — unchanged values; add scene-timing constants if needed. *(§5)*
- **New** `site/src/lib/urls.ts` — single `APP_URL` helper from `NEXT_PUBLIC_APP_URL`. *(§4.7)*
- **New** `site/src/lib/trust-data.ts` — trust metrics + logos (real/flagged). *(§4.4)*
- **New** `site/src/hooks/useCanvasScene.ts` — shared scene primitives for hero/story/sandbox. *(§5)*

**Landing & hero**
- `site/src/app/page.tsx` — reorder/rework sections; swap `SignatureHero`→`HeroCanvas`; trust strip; asymmetric bento; `ScrollStory`; sandbox; env CTAs + analytics. *(§4)*
- **New** `site/src/components/HeroCanvas.tsx` — interactive canvas hero. *(§4.1)*
- **New** `site/src/components/ScrollStory.tsx` — 350vh 4-phase scrollytelling (supersedes/wraps `PinnedSteps`). *(§4.6)*
- **New** `site/src/components/TrustLogos.tsx` — institution/press logo row. *(§4.4)*
- **New** `site/src/components/Sandbox.tsx` — zero-click curated sandbox (Phase A). *(§4.5)*
- `site/src/components/SignatureHero.tsx` — keep as static/SSR/reduced-motion fallback. *(§4.1)*
- `site/src/components/PinnedSteps.tsx` — kept as the reduced-motion/mobile fallback pattern for `ScrollStory`. *(§4.6)*
- `site/src/components/TriangleSolverDemo.tsx` — folded into / replaced by `Sandbox`. *(§4.5)*

**Components restyle**
- `site/src/components/Nav.tsx` — glass conversion header on scroll + mega-menu. *(§4.2, §6.11)*
- `site/src/components/BentoGrid.tsx` — span/featured props, asymmetric, accent glow. *(§4.3)*
- `site/src/components/Section.tsx` — `surface` prop. *(§3.5)*
- `site/src/components/CTABand.tsx` — glow token + fix hardcoded href. *(§3.5, §4.7)*
- `site/src/components/PricingTable.tsx` — billing toggle, featured violet, comparison. *(§6.6)*
- `site/src/components/Button.tsx` — violet-gradient hero variant (primary already inherits blue). *(§3.5)*
- `site/src/components/StatCounter.tsx`, `Footer.tsx`, `TestimonialCard.tsx`, `Tabs.tsx`, `FAQAccordion.tsx`, `ProseArticle.tsx`, `LegalNotice.tsx`, `ContactForm.tsx`, `HelpSearch.tsx` — surface/accent/mono restyle + a11y checks. *(§6.1)*

**Pages**
- `site/src/app/pricing/page.tsx` — new tiers + toggle data + JSON-LD. *(§6.6)*
- `site/src/app/product/page.tsx` — `HeroCanvas`, real audio sample + transcript, real mini-visuals. *(§6.2)*
- `site/src/app/tools/` + `tools/[slug]/` + `site/src/lib/tools-data.ts` + `site/src/components/tools/*` — restyle, expand tool set, per-page SEO + JSON-LD + OG. *(§6.3, §7)*
- `site/src/app/{about,faq,blog,resources,help,reviews,customers,changelog,community,feedback,report-bug,contact,privacy,terms,security,dpa,cookies,acceptable-use}` — universal pass + page-specific reworks + JSON-LD. *(§6)*

**SEO plumbing**
- `site/src/app/sitemap.ts` — enumerate all static + dynamic routes. *(§7)*
- `site/src/app/robots.ts` — confirm allow + sitemap ref. *(§7)*
- `site/src/app/opengraph-image.tsx` + **new** sibling `opengraph-image.tsx` in tools/blog/product/pricing segments. *(§7)*
- Per-route `generateMetadata` and JSON-LD `<script>` blocks. *(§7)*

**Server (only if §4.5 Phase B is chosen)**
- `server/src/routes/` — **new** public, rate-limited, no-auth `POST /api/public/demo/solve`; input validation; per-IP quota; cost ceiling; security review. *(§4.5 Phase B — optional)*

---

## 11. Master acceptance checklist (definition of done)

**Design system**
- [ ] Stratified surfaces visible (base/shell/card/glass) in both themes.
- [ ] Three accents each in their assigned role (blue primary, violet branching/featured, emerald verification/success).
- [ ] JetBrains Mono on numerals/formulae; KaTeX renders on new surfaces.
- [ ] Dot-grid canvas motif in both themes.

**Landing**
- [ ] Hero is a live, interactive, product-like canvas; H1 is LCP < 1.2s; 60fps; secret-free; static/reduced-motion fallback correct.
- [ ] Glass sticky conversion header appears past ~500px with a Start-free CTA.
- [ ] Trust strip with real/flagged metrics + logo row; no un-flagged fabricated proof.
- [ ] Asymmetric bento (forms + features) with featured cells.
- [ ] 350vh four-phase scrollytelling with visual builds + emerald verification end; mobile/reduced-motion static fallback.
- [ ] Zero-click sandbox (Phase A) lets visitors watch a real solve.
- [ ] No `localhost` anywhere; all app CTAs env-driven; analytics on primary CTAs.

**Pricing**
- [ ] Starter / Pro Researcher ($16, "Most Popular", violet) / Lab·Institution; Monthly/Annual toggle with "Save 25%"; comparison; env CTAs; figures in one editable place.

**All pages**
- [ ] Every route reworked to the system and passes §8 budgets.
- [ ] Tools pages are complete SEO landing pages; tool set expanded.
- [ ] Nav mega-menu + full footer sitemap.

**SEO**
- [ ] Per-page unique metadata + canonical + OG; JSON-LD by type validates; sitemap enumerates all routes; no fabricated review/rating markup.

**Perf & a11y (both themes)**
- [ ] Lighthouse mobile ≥95 Perf / 100 A11y / 100 BP / 100 SEO on home/product/pricing/tools hub/tool page.
- [ ] axe-core clean; contrast gate (4.5:1 body / 7:1 headings) passes; keyboard + screen-reader operable; reduced-motion correct; CLS 0.00; 60fps animations.

**Constraints**
- [ ] No API keys/model SDKs/provider calls in `/site`; any AI is server-side, rate-limited, reviewed.
- [ ] No destructive operations; marketing site is read-only.
- [ ] No existing page/route/feature regressed.

---

## 12. Out of scope & open questions

**Out of scope:** real marketing copy and final legal text (presentation only); real testimonials/case-study *content* (layout + truthfulness gate only); extracting the real app engine into a shared package (the hero deliberately uses a purpose-built scene instead); any `/app` or `/server` behaviour change except the optional §4.5 Phase-B demo endpoint.

**Open questions for Razin (decide before or during Phase 2; safe defaults chosen so implementation isn't blocked):**
1. **Trust-strip claims** — which metrics/logos are real and shippable now vs flagged-illustrative? *(Default: use defensible real numbers where known, flag the rest with `// TODO(razin)`.)*
2. **Pricing figures** — confirm Pro Researcher $16/mo and the 25% annual discount as final, and the Lab·Institution model. *(Default: implement the audit's numbers, flagged as provisional.)*
3. **Live sandbox** — ship §4.5 Phase B (type-your-own via a server demo endpoint), or Phase A (curated scenes) only? *(Default: Phase A only; Phase B behind product go-ahead + security review.)*
4. **Recorded narration sample** — is a real audio asset available for the product page + sandbox? *(Default: keep the placeholder flagged until the asset exists.)*
5. **Tool-set expansion scope** — how many of the ~12 launch tools to build this pass? *(Default: expand from 5 toward 8–10, prioritizing search volume.)*

---

*End of PRD. Implementation proceeds phase by phase (§9); each phase's exit criteria and the §11 checklist gate merge. No app/server behaviour changes except the optional, reviewed §4.5 Phase-B endpoint. Nothing in `/site` may hold a secret or call a provider directly.*





