# openmaths — PRD: Public Product Site, Pages & Design/Motion System

| | |
|---|---|
| **Product** | openmaths — AI math explainer |
| **Version** | 1.0 |
| **Author** | Razin (with Claude) |
| **Date** | 2026-09-03 |
| **Audience** | Claude Code (implementing agent) |
| **Scope** | The **public product website** — the marketing/landing surface and all supporting pages (community, blog, help, feedback, bug report, legal, contact, about, FAQ, reviews, resources, and a suite of free math **mini-tools**) — plus a **premium design system and motion system** benchmarked against Apple, Claude, Cloudflare, Vercel, Linear, Notion, and award-winning creative sites. Delivered as an **exact page schema** to build. |

> This is the "why should I care / what is this" surface — separate from the app. It must load fast, rank in search, and feel *awesome but never gimmicky*. Motion is purposeful (it demonstrates the product), 60fps, and reduced-motion-safe.

---

## 1. Where it lives (folder decision)
Add a **new marketing surface** to the monorepo from `docs/PRD-split-nextjs-app-and-hono-server.md`:
- **Recommended:** `site` — a **separate Next.js app** (marketing/site) at the root domain `openmaths.com`, with the product app at `app.openmaths.com`. Big-tech pattern: marketing is SSG/ISR + SEO-optimized and must not carry the app's auth/WebGL/Prisma weight. Its only backend touch is form submissions (→ the Hono `server`) and links into the app.
- **Alternative (one deploy):** a `(marketing)` route group inside `app`. Simpler infra, but couples marketing perf/SEO to the app bundle — avoid unless you must ship one deploy.
The page schema below is identical either way.

---

## 2. Design language — what to borrow from the best
The through-line across Apple / Claude / Cloudflare / Vercel / Linear / Notion is **restraint + precision + generous whitespace + one confident accent + crisp typography + subtle, purposeful motion.** openmaths' own voice: **calm, precise, and human — Linear-grade precision with Claude-grade warmth**, plus a light **math/chalk/graph-paper motif** that ties to the product.

| Reference | What to take |
|---|---|
| **Apple** | Cinematic **scroll-driven product reveals**; huge confident type; one idea per viewport. |
| **Claude** | Warm, human, calm copy; cream/ink palette; soft, unintimidating tone (fits a learning product). |
| **Linear** | Precision, dark mode done right, gradient accents, keyboard-fast feel, a beautiful **changelog**. |
| **Vercel** | Monochrome sharpness, geometric **bento grids**, ruthless performance, black/white + one accent. |
| **Cloudflare** | A single bold accent used decisively; technical-but-approachable clarity. |
| **Notion** | Friendly illustration, a rich **templates/resources** hub, approachable empty states. |
| **Awwwards / creative (plotter.so-tier)** | One **signature hero moment** that makes people say "whoa" — for us, the product literally drawing + narrating a proof live. |

**The signature moment (our "awesome"):** the hero shows the *actual product working* — a right triangle (or a Pythagoras proof) **drawing itself step by step with synced narration and the step captions**, looping. Nothing sells an AI math explainer like watching it explain. Everything else is restraint around that.

---

## 3. Design system (tokens — exact)
Author as CSS variables + Tailwind theme (separate from the app's strict-monochrome `globals.css`; the marketing site may introduce one accent). Support light + dark.

- **Type:** a display/UI sans (e.g. Geist/Inter) + a warm serif accent for editorial (blog) + a mono (Geist Mono) for math/code. Scale: `display-2xl` 72/76, `display-xl` 60/64, `h1` 48/52, `h2` 36/40, `h3` 28/34, `h4` 22/28, `body-lg` 18/28, `body` 16/26, `body-sm` 14/22, `caption` 13/18, `mono` 14/22. Fluid clamp() between breakpoints.
- **Color:** neutral ink/paper ramp (12 steps) for both themes; **one accent** (pick a "chalk" hue — e.g. a confident indigo/teal) with tint/shade ramp; 2–3 gradient presets (subtle, for hero glows/section dividers); semantic tokens (success/warn/danger) used sparingly. Graph-paper/dot texture as a background motif (very low opacity).
- **Spacing:** 4px base; scale 4/8/12/16/24/32/48/64/96/128/160. Section vertical rhythm 96–160.
- **Radius:** sm 6, md 10, lg 16, xl 24, pill; **elevation:** 3 soft shadow tiers (light) + subtle border-glow (dark).
- **Layout:** max content width ~1200; wide (bento) ~1320; prose 68ch. 12-col grid.
- **Motion tokens:** durations `fast 150 / base 250 / slow 400 / cinematic 700`; easings `standard cubic-bezier(.2,.8,.2,1)`, `emphasized (.16,1,.3,1)`, spring presets (stiffness/damping) for interactive elements; a global stagger unit (60–80ms).
- **Iconography/illustration:** a consistent line-icon set + a small custom illustration style (chalk/graph motifs); avoid generic stock.

---

## 4. Motion system (the "awesome, not gimmicky" bar)
- **Stack:** **Motion (Framer Motion)** for component/gesture/layout animation; **GSAP + ScrollTrigger** for hero/scroll timelines and pinned sequences; **Lenis** for buttery smooth scroll; **native CSS scroll-driven animations + View Transitions API** as progressive enhancement where supported. (2026 consensus stack.)
- **Signature patterns (use deliberately):** hero live-product animation (the drawing+narration loop); **scroll-triggered reveals** (fade/slide/scale-in with stagger) on every section; **pinned scroll sequence** for "How it works" (each step draws as you scroll — Apple-style); **bento grid** with hover micro-interactions (tilt/parallax/spotlight); **interactive "try it" demo** (a real mini widget, not a video); animated **number counters** for stats; a **topic marquee**; smooth **page transitions** (View Transitions); magnetic buttons + cursor affordances used sparingly.
- **Discipline (mandatory):** every animation serves comprehension or delight tied to the product; nothing purely decorative that hurts perf. **Honor `prefers-reduced-motion`** (replace motion with instant states / gentle fades). Budget: no animation blocks INP > 200ms; hero animation lazy-inits and pauses off-screen. Test on mid-range mobile.

---

## 5. Page schema (the exact sitemap) — build this

### 5.1 Route map
| Route | Page | Render | Purpose |
|---|---|---|---|
| `/` | Home / Landing | SSG | The pitch + signature demo + funnel to app |
| `/product` | Product / Features | SSG | Deep dive: engine, voice, canvas, multi-form, sharing |
| `/tools` | Tools hub | SSG | Directory of free math mini-apps (SEO + funnel) |
| `/tools/[slug]` | Individual tool | SSG/ISR | One free math utility per page (see §6) |
| `/pricing` | Pricing | SSG | Free / Pro / Education tiers + FAQ |
| `/about` | About | SSG | Mission, story, values, team |
| `/blog` , `/blog/[slug]` , `/blog/category/[cat]` | Blog | ISR/MDX | Math explainers + product/SEO content |
| `/resources` | Resources hub | SSG | Guides, cheatsheets, glossary, curriculum, downloads |
| `/resources/[slug]` | Resource article | ISR/MDX | Long-form learning content |
| `/community` | Community | SSG | Showcase gallery, Discord/forum, ambassadors |
| `/reviews` | Reviews / Testimonials | SSG | Social-proof wall, ratings, case studies |
| `/customers/[slug]` | Case study | ISR | Deep testimonial/story |
| `/faq` | FAQ | SSG | Categorized accordion Q&A |
| `/help` , `/help/[category]` , `/help/[category]/[article]` | Help Center / KB | ISR/MDX | Docs & how-tos |
| `/changelog` | Changelog | ISR/MDX | Release notes (Linear/Vercel-style) |
| `/contact` | Contact | SSG + form | Reach us; routes to Hono server |
| `/feedback` | Feedback / Feature requests | SSG + board | Ideas board (or embed) |
| `/report-bug` | Report a bug | SSG + form | Structured bug intake → server |
| `/privacy` `/terms` `/cookies` `/security` `/acceptable-use` `/dpa` | Legal | SSG/MDX | Policies (edu/GDPR-ready) |
| `/careers` (opt), `/press` / brand kit (opt) | Company | SSG | Hiring, media assets |
| `sitemap.xml`, `robots.txt`, `/manifest` , OG image routes | Infra | — | SEO/social |

Global: **Nav** (sticky, mega-menu for Product/Tools/Resources, dark-mode toggle, "Open app" CTA) and **fat Footer** (product, tools, resources, company, legal, social, newsletter) on every page. Cookie-consent banner.

### 5.2 Home page (`/`) — full section stack
1. **Hero** — headline ("Watch math explain itself"), subhead, primary CTA "Start free" (→ app) + secondary "See it work"; **live product animation** (drawing + narrated steps, looping); subtle graph-paper backdrop + accent glow.
2. **Social proof strip** — "trusted by learners at…" logo/marquee or user-count stat counters.
3. **Problem → insight** — the "ChatGPT gives an answer; openmaths teaches it" contrast (the centroid/Pythagoras story), animated before/after.
4. **The forms showcase** — bento grid: Geometry (draws & explains), Algebra (step-by-step), Graphs/Plots, Tables — each cell a tiny live/looping demo (ties to `PRD-v2-production.md` forms).
5. **How it works** — pinned scroll sequence, 3 steps (Ask → Watch it draw & narrate → Explore on the canvas).
6. **Interactive "Try it"** — an embedded real mini widget (a `/tools` demo) the visitor uses without signing up.
7. **Feature bento** — voice narration, the non-linear canvas, multi-form, sharing/collaboration, export video, mobile.
8. **Use cases** — tabs: Students / Self-learners / Teachers / Parents.
9. **Reviews** — testimonial wall (rating + quote + avatar), pulls from `/reviews`.
10. **Tools teaser** — "Free math tools, no login" → grid of top mini-apps → `/tools`.
11. **Pricing teaser** — 3 tiers condensed → `/pricing`.
12. **Final CTA band** — big "Start explaining math" + email capture.
13. **Footer.**

### 5.3 Per-page section stacks (concise)
- **/product:** hero → engine deep-dive (draw-on animation) → voice narration (audio demo) → canvas/branching → multi-form gallery → sharing/roles → export → security/trust → CTA.
- **/tools:** hero + search/filter → category grid (Algebra, Geometry, Calculus, Graphing, Converters, Statistics) → featured tools → "why free" + funnel to app → CTA.
- **/tools/[slug]:** the working tool (top, above the fold) → how-to + worked example → related formulas → related tools → "do this with full explanations in the app" CTA → FAQ (JSON-LD).
- **/pricing:** toggle (monthly/annual, or Free/Edu) → 3 tier cards (Free / Pro / Education) → feature comparison table → pricing FAQ → CTA.
- **/about:** mission hero → origin story → values → team grid → "join us"/contact.
- **/blog & [slug]:** filterable card grid + featured → article (prose 68ch, TOC, KaTeX support, author, share, related) → newsletter.
- **/resources & [slug]:** hub with categories (Guides, Cheatsheets, Glossary, Curriculum, Downloads) → article template (like blog, print-friendly).
- **/community:** showcase gallery of shared canvases → Discord/forum CTA → ambassadors/contributors → events.
- **/reviews:** aggregate rating hero → filterable testimonial wall → case-study cards → submit-a-review CTA.
- **/faq:** search + categorized accordions (Getting started, Pricing, Accounts, Privacy, Tools) — FAQ JSON-LD.
- **/help:** search-first help center → category cards → article template with breadcrumbs, feedback ("was this helpful?"), related.
- **/changelog:** reverse-chron entries (date, tags, media), RSS.
- **/contact / /feedback / /report-bug:** intro + the relevant **form** (validated, honeypot/anti-spam) posting to the Hono server or a form/board service; success states; alternate channels.
- **Legal pages:** MDX, last-updated, TOC, plain-language summaries at top.

---

## 6. The free math mini-tools (the "sub small apps")
A suite of **free, no-login, instant** math utilities — each its own SEO landing page under `/tools/[slug]`, funneling to the full app. This is a proven **free-tools SEO growth strategy** (rank for long-tail "…calculator/solver" queries) and shows the product's competence. Launch set:
- **Equation Solver** (linear/quadratic), **Graphing Calculator** (plot y=f(x)), **Triangle/Right-Triangle Solver** (Pythagoras + trig), **Unit Converter**, **Percentage Calculator**, **Fraction Calculator**, **Derivative & Integral Visualizer**, **Matrix Calculator**, **Prime/Factorization**, **Quadratic Roots + Parabola**, **Statistics (mean/median/SD)**, **Slope & Distance**.
Each: reuse the app's engine (via the Hono API / shared `packages/shared` DSL) so the tool's visual matches the product; every tool ends with "See the full step-by-step explanation in openmaths →". Add `SoftwareApplication`/`HowTo` JSON-LD. Ship 4–6 first, expand.

---

## 7. Component library (marketing)
Nav (+ mega-menu, mobile drawer), Footer, Button (primary/secondary/ghost, magnetic), Hero (variants), BentoGrid + BentoCard, FeatureRow (alt image/text), InteractiveDemo embed, LiveProductAnimation, TestimonialCard + Wall, RatingStars, PricingTable + TierCard, FAQAccordion, CTABand, BlogCard, ToolCard, StatCounter, LogoMarquee, TopicMarquee, LaTeX/Code showcase, Tabs, Steps (pinned), NewsletterForm, ContactForm/BugForm (RHF + zod), CookieBanner, ThemeToggle, Breadcrumbs, TOC, Callout, RevealOnScroll wrapper, PageTransition. MDX component mappings for content.

---

## 8. Tech stack
- **Next.js (App Router)**, SSG/ISR for all marketing pages (SEO + speed), RSC-first, `next/image`, route-level `metadata`.
- **Content:** MDX via **Contentlayer/Velite** (blog, resources, help, changelog, legal) — or a headless CMS (Sanity) if non-devs will edit. Start with MDX.
- **Styling:** Tailwind + the §3 tokens; dark mode via `class`.
- **Motion:** Motion + GSAP/ScrollTrigger + Lenis + native scroll-driven/View Transitions (§4).
- **Math:** KaTeX for typeset content; the shared DSL engine (from the app) for tool visuals.
- **SEO:** per-page metadata + **JSON-LD** (Organization, Product, SoftwareApplication for tools, FAQPage, Article, BreadcrumbList), `sitemap.xml`, `robots.txt`, dynamic **OG images** (`@vercel/og`), canonical URLs, RSS for blog/changelog.
- **Forms:** React Hook Form + zod → the Hono `server` (contact/bug/feedback/newsletter), with anti-spam.
- **Analytics:** privacy-friendly (Plausible/PostHog); Core Web Vitals reporting.
- **Deploy:** separate from the app (root domain); ISR/on-demand revalidation for content.

---

## 9. Accessibility, performance & SEO budgets
- WCAG 2.1 AA (contrast, keyboard, focus, alt text, semantic headings), `prefers-reduced-motion` fully honored.
- Lighthouse ≥ 95 on marketing pages; **LCP < 2.0s, INP < 200ms, CLS < 0.05**; hero animation lazy + off-screen-paused; fonts `display: swap` + preloaded; images AVIF/WebP + responsive.
- Every page: unique title/description, OG image, JSON-LD, in a sitemap.

---

## 10. Phased build
- **P1 — Foundations:** `site` scaffold, design tokens + Tailwind theme, core components (Nav/Footer/Button/Section/Reveal), motion setup (Motion/GSAP/Lenis), theming, SEO/OG infra.
- **P2 — Home + Product + Pricing:** the signature hero animation, forms showcase, how-it-works pinned sequence, one interactive demo. (This is the "awesome" milestone.)
- **P3 — Tools suite:** the tools hub + first 4–6 mini-apps (reusing the engine) with JSON-LD.
- **P4 — Content surfaces:** Blog, Resources, Help Center, Changelog, FAQ (MDX pipeline).
- **P5 — Trust & company:** About, Reviews/Case studies, Community, Contact, Feedback, Report-a-bug, all Legal.
- **P6 — Polish:** page transitions, micro-interactions, a11y + perf pass, analytics, OG images, full SEO audit.

---

## 11. Acceptance criteria
- AC1. A distinct `site` (or `(marketing)` group) exists with every route in §5.1, each with real content, unique SEO metadata + JSON-LD, in the sitemap.
- AC2. The home hero shows the **live product animation** (draw + narrate), and "How it works" is a pinned scroll sequence — both 60fps and reduced-motion-safe.
- AC3. The design system (§3 tokens) is implemented as reusable tokens/components; light + dark; visually on par with the Linear/Vercel/Claude reference bar (design-critique sign-off).
- AC4. ≥ 4 working free tools live under `/tools/[slug]`, each with a funnel CTA + JSON-LD.
- AC5. Blog/Resources/Help/Changelog run on the MDX/CMS pipeline; contact/bug/feedback forms submit to the Hono server with validation + anti-spam.
- AC6. All legal pages present; cookie consent live; analytics + Core Web Vitals wired.
- AC7. Perf/SEO budgets met (§9); `prefers-reduced-motion` honored everywhere; keyboard-navigable.
- AC8. Every animation is purposeful (guides attention or demos the product) — no gratuitous motion; a design-critique + accessibility-review pass is recorded.

---

## 12. Sources
- SaaS landing page trends 2026 (real examples): https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples
- What makes a great SaaS landing page 2026: https://framiq.app/blog/best-saas-landing-pages-2026
- Award-winning site inspiration (motion bar): https://www.awwwards.com/websites/portfolio/ , https://www.webdesignawards.io/winners/2026/portfolio
- Web animation stack 2026 (GSAP vs Motion, when to use each): https://blog.codercops.com/blog/web-animation-gsap-framer-motion-css-2026
- Lenis smooth scroll implementation: https://www.jiapixel.com/blogs/lenis-smooth-scrolling-elevate-your-web-animations-with-buttery-smoothness
- View Transitions API + CSS scroll-driven animations (2026): https://www.frontendhorizon.com/blog/view-transitions-api-and-css-scroll-driven-animations-the-browser-wins-of-2026
- The free-tools SEO strategy (calculators/converters/generators) — Ahrefs: https://ahrefs.com/blog/the-free-tools-seo-strategy/
- HubSpot free tools (product-led free-tools model): https://www.hubspot.com/free-business-tools
