import type { ChatMessage, PdfPlugin } from "@razinmohammedpt/hackai-sdk";
import { buildUserContent, type MessageAttachment } from "./attachments";

const DSL_REFERENCE = `
Drawing DSL — a flat JSON array of ops, each with a unique "id" and integer "step" (ops sharing
a step number reveal together; steps play in ascending order). All coordinates are [x, y] numbers
in an arbitrary 2D scene-unit space (origin/scale up to you, keep the diagram roughly within a
0-8 unit square unless the problem needs more room). Op types:

- move_cursor { to: [x,y] } — moves the drawing cursor before the next draw op (use before lines/shapes for a natural drawing-order feel)
- draw_line { from: [x,y], to: [x,y], meta?: {label} }
- draw_polygon { points: [[x,y], ...] (3+), filled?: boolean }
- draw_circle { center: [x,y], radius }
- draw_arc { center: [x,y], radius, startAngle, endAngle } (radians)
- label_angle { vertex: [x,y], arm1: [x,y], arm2: [x,y], targetId?: string, meta?: {label, value} } — draws a small angle arc + label
- label_side { from: [x,y], to: [x,y], targetId?: string, meta?: {label, value} } — labels a side's length near its midpoint
- place_text { at: [x,y], text: string, size?: "sm"|"md"|"lg" } — for a SHORT equation or value written directly on the canvas, anchored to a specific part of the figure (e.g. the Pythagorean relation written once beside the right angle it names). Never a multi-line derivation and never a restatement of steps already covered in the written answer — that's what answerMarkdown/solution are for; a diagram dominated by place_text/write_note isn't a diagram, it's the answer text pasted onto a canvas.
- write_note { text: string, reason?: string } — a step caption, NOT drawn on the canvas, shown in a separate notes list. "text" is the specific claim being made this step (e.g. "∠BAD = ∠ABC"); "reason" is the one-sentence justification a student would ask "why?" about (e.g. "Alternate interior angles are equal because DE ∥ BC."). Always fill in "reason" whenever the step asserts or derives something, not just when something is drawn.
- step_start / step_end { title?: string, description?: string } — step markers shown in the
  fullscreen animation's step sidebar. REQUIRED, no exceptions: every step_start MUST have both
  "title" (a short 2-5 word label, e.g. "Draw the base triangle") AND "description" (1-3 full
  sentences explaining what this step does and why it matters right now — the sidebar shows both;
  description gives the student something to actually read while stepping through, not just a
  label). A step_start with no description is a broken answer — never emit one.

Extended geometry ops — reach for these instead of approximating with draw_line/draw_polygon when
the construction genuinely calls for them:

- draw_ray { from: [x,y], to: [x,y] } — a line starting at "from" through "to", drawn with an
  arrowhead and extending a bit past "to" (open-ended). Use for angle arms, number-line rays.
- draw_vector { from: [x,y], to: [x,y] } — an arrow that stops exactly at "to" (closed-ended). Use
  for physics/force/displacement vectors, transformation arrows.
- draw_dashed_line { from: [x,y], to: [x,y] } — a dashed segment. Use for construction lines,
  auxiliary/helper lines, hidden edges, radii drawn for reference (not part of the main figure).
- draw_point { at: [x,y] } — a small filled dot marking a named point, independent of any line/
  polygon vertex (e.g. center of a circle, an intersection point you want to call out).
- draw_tick_marks { from: [x,y], to: [x,y], count?: 1-3 } — congruence tick marks across a segment's
  midpoint (like "‖" marks). Use to show two sides are equal length WITHOUT stating a number —
  give matching sides the same "count" (draw two draw_tick_marks ops, same count, one per segment).
- draw_right_angle_mark { vertex: [x,y], arm1: [x,y], arm2: [x,y], size? } — the small square symbol
  marking a 90° angle at "vertex", between the two arm directions.
- draw_parallel_marks { from: [x,y], to: [x,y], count?: 1-2 } — arrow/chevron marks across a segment
  showing it's parallel to another; give two parallel segments matching "count" values.
- draw_ellipse { center: [x,y], radiusX, radiusY, rotation? } (rotation in radians) — an ellipse,
  for foreshortened circles, elliptical orbits, or the flat "lid" ellipses used in draw_cylinder/
  draw_cone-style hand sketches.
- draw_parabola { vertex: [x,y], coefficient, xRange: [minX, maxX] } — plots y = coefficient*(x-vx)^2+vy
  where [vx,vy] is "vertex". Use for quadratic function graphs.
- draw_function { expr: string, xRange: [minX, maxX], samples? } — plots y = f(x) for an arbitrary
  expression in "x" (same expression syntax as parametric bindings below: + - * / ^ () sqrt sin cos
  tan abs round min max pi). Use for any function graph that isn't a plain parabola/line.
- draw_bezier { from: [x,y], control1: [x,y], control2: [x,y], to: [x,y] } — a smooth cubic curve.
  Use for freehand-looking curved boundaries that aren't circular arcs (e.g. a sketched region edge).
- draw_grid { boundingBox: {minX,minY,maxX,maxY}, spacing } — light background grid lines, for
  coordinate-plane problems. Add this FIRST (step 1, lowest step number) so other ops draw on top.
- draw_axes { origin: [x,y], xLength, yLength } — x/y axes with arrowheads, for coordinate-plane
  problems. Pairs with draw_grid.
- shade_region { points: [[x,y],...], opacity? } — a filled, semi-transparent wash over a region
  (default opacity 0.22) distinct from draw_polygon's crisp outline+fill. Use for "shade the area
  between the curves", "shade the sector", integral/area-under-curve visualizations.
- draw_bracket { from: [x,y], to: [x,y], label? } — a brace alongside a segment/region with an
  optional text label, for calling out a span/dimension without cluttering the figure itself (e.g.
  "{ height = 5 }" running down the side of a shape).
- draw_curved_arrow { center: [x,y], radius, startAngle, endAngle } (radians) — an arc ending in an
  arrowhead. Use for "rotate by θ", angular direction, transformation/rotation indicators.
- draw_cuboid { origin: [x,y], width, height, depth } — a pseudo-3D rectangular box (front face at
  "origin" sized width×height, extruded back by "depth"). Use for volume/surface-area problems on
  boxes/prisms.
- draw_cylinder { center: [x,y], radius, height } — a pseudo-3D cylinder, "center" is the midpoint
  of its central axis. Use for volume/surface-area problems on cylinders.
- draw_cone { apex: [x,y], baseCenter: [x,y], radius } — a pseudo-3D cone. Use for volume/surface-
  area problems on cones.
- draw_sphere_outline { center: [x,y], radius } — a pseudo-3D wireframe sphere (outline + equator +
  meridian curves). Use for volume/surface-area problems on spheres.
- draw_regular_polygon { center: [x,y], radius, sides, rotation?, filled? } — a regular n-gon
  inscribed in a circle of "radius" (3-20 sides). Use this instead of hand-computing draw_polygon
  vertices for pentagons/hexagons/heptagons/octagons/etc. — sides:3 is an equilateral triangle,
  sides:4 is a square (rotate by pi/4 for axis-aligned). "rotation" (radians) defaults to putting
  the first vertex straight up.

These are genuinely pseudo-3D (2D line/ellipse tricks that read as solid shapes to a viewer, in the
classic hand-drawn-textbook style) — not a real 3D camera. Don't attempt to combine them with camera
rotation or perspective; they're drawn at a fixed, slight isometric skew.

Like a real geometry teacher, not an AI dump:
- PROGRESSIVE CONSTRUCTION: never draw the finished figure in step 1. Build it piece by piece —
  e.g. step 1 draws just the base triangle, step 2 adds one auxiliary line, step 3 labels one pair
  of angles, step 4 labels the next, step 5 states the conclusion. Each step should add ONE new
  idea, not several at once. A student stepping through should see the proof unfold, not flash in.
- PRECISE, UNAMBIGUOUS NAMES: label points with capital letters (A, B, C, D, E...) and refer to
  angles/sides by those letters (e.g. "∠BAC", side "AB"), not by reusing the same Greek letter for
  multiple different angles. If you use Greek letters (α, β, γ) at all, each one must refer to
  exactly ONE angle for the whole diagram — never reuse a letter for a different angle elsewhere,
  even if they're later shown to be equal (state the equality in words/write_note instead, e.g.
  "∠BAD = ∠ABC (alternate interior angles)").
- write_note.text should be a complete, specific sentence a teacher would say out loud — never a
  vague fragment like "Use alternate interior angles to show the angles". Say exactly which angles
  and exactly what's being claimed: "Since DE is parallel to BC, ∠BAD equals ∠ABC (alternate
  interior angles)."
- CLARITY OVER DENSITY: don't cram many place_text/label ops at the same coordinates or on top of
  each other — space labels out, and prefer a write_note step caption over crowding the canvas with
  more place_text than the diagram can cleanly hold.
- USE REAL DIAGONALS: draw_line/draw_polygon points can be ANY [x,y] pair — don't default to only
  axis-aligned horizontal/vertical lines out of habit. Transversals, triangle sides, diagonals of a
  square, and non-right triangles should genuinely slant; compute their real endpoint coordinates
  (e.g. a 45° line from [0,0] has endpoint [k,k], not [k,0]).
- NO OVERLAPPING SHAPES: when a construction places new shapes against an existing figure (e.g.
  squares erected on the sides of a triangle for a Pythagorean-theorem proof), compute their
  points so they extend AWAY from the figure's interior and never overlap each other or cross
  back through it. Before emitting a polygon, sanity-check that its edges don't intersect any
  other shape's edges except at the single shared vertex/side they're meant to touch. A diagram
  where shapes visibly overlap or lines cross through unrelated shapes is wrong — redo the
  coordinates rather than emit that.
- ERECTING A SQUARE ON AN ARBITRARY SIDE (get this exactly right — this is the step most likely to
  go wrong, especially on a slanted side like a hypotenuse): given the side's two endpoints P1 and
  P2 (in that order), let d = [P2.x - P1.x, P2.y - P1.y]. The two candidate outward-perpendicular
  vectors are perpA = [-d.y, d.x] and perpB = [d.y, -d.x] — pick whichever one points AWAY from the
  rest of the figure (e.g. away from the triangle's third vertex or centroid; check by seeing which
  candidate, added to the segment's midpoint, moves further from that reference point). Then the
  square's 4 vertices IN ORDER are: P1, P2, [P2.x + perp.x, P2.y + perp.y], [P1.x + perp.x, P1.y +
  perp.y]. Do NOT invent a different third/fourth vertex — every vertex after P2 must be P2 or P1
  plus the SAME perpendicular vector (not a rotated or shortened version of it), or the shape will
  not actually be a square. Never reuse another square's corner points to build this one — each
  square's 4 vertices come ONLY from this P1/P2/perp formula, nothing borrowed from a neighboring
  shape. Sanity-check before emitting: exactly 4 points, all 4 sides the same length as |P1P2|, and
  consecutive sides perpendicular (dot product of consecutive edge vectors = 0).

  Worked example — the classic "squares on the sides of a right triangle" Pythagorean diagram, for
  a 3-4-5 triangle with right angle at the origin, legs along the axes: triangle points [[0,0],[4,0],
  [0,3]] (P=(0,0) right angle, so leg "a" is (0,0)->(4,0) and leg "b" is (0,0)->(0,3), hypotenuse is
  (4,0)->(0,3)). Square on leg a — P1=(0,0), P2=(4,0), d=(4,0), perp options (0,4) or (0,-4); away
  from the triangle (which is above the x-axis) means perp=(0,-4): points [[0,0],[4,0],[4,-4],[0,-4]].
  Square on leg b — P1=(0,3), P2=(0,0) (note the order: going FROM the far end TO the shared corner,
  so the outward perpendicular comes out correctly), d=(0,-3), perp options (-3,0) or (3,0); away from
  the triangle (which is to the right of the y-axis) means perp=(-3,0): points [[0,3],[0,0],[-3,0],
  [-3,3]]. Square on the hypotenuse — P1=(4,0), P2=(0,3), d=(-4,3), perp options (-3,-4) or (3,4);
  away from the triangle (whose third vertex (0,0) is on the (-3,-4) side, since (0,0) is roughly in
  that direction from the hypotenuse's midpoint) means perp=(3,4): points [[4,0],[0,3],[3,7],[7,4]].
  This is the ENTIRE figure for the classic diagram — just the triangle plus these 3 squares, nothing
  else (no extra rearranged squares, no additional triangles cut from them) unless the problem
  specifically asks for the rearrangement/dissection variant of the proof.
- MATH NOTATION IN LABELS: place_text.text and label_angle/label_side meta.label/meta.value are
  rendered as plain text on a WebGL canvas, NOT run through a LaTeX engine — do not wrap them in
  $...$ or use raw LaTeX commands like \\frac{}{}. Instead use: real Unicode characters directly
  where you can (², ³, √, π, θ, α, β, °, ≤, ≥, ≠, ×, ·, ∠, ∥, ⊥), or simple shorthand the renderer
  converts automatically: "^2" / "^{2}" for exponents, "_1" / "_{1}" for subscripts, "\\sqrt{2}" for
  a root, "\\theta"/"\\alpha"/"\\pi" etc. for common Greek letters. Example: write "a^2 + b^2 = c^2"
  or "a² + b² = c²", never "$a^2 + b^2 = c^2$".

Rules:
- Every op needs a unique "id" (short strings like "line-1" are fine) and a "step" integer.
- Use "targetId" on label_angle/label_side to point at the id of a draw_line/draw_polygon op it annotates, so hovering one highlights both.
- Keep the scene to roughly 10-40 ops, spread across at least 4-6 steps for any non-trivial figure.
- Include a "boundingBox" {minX,minY,maxX,maxY} that roughly frames the whole diagram.

CRITICAL: every op is a FLAT object. The "op" field's value is a string naming the op type — it is
NOT a nested wrapper key. All of that op's other fields sit directly alongside "op", "id", "step",
NOT nested inside an object keyed by the op name. For example, a place_text op looks EXACTLY like this:

{"id": "eq-1", "step": 1, "op": "place_text", "at": [2, 6], "text": "3x + 7 = 22", "size": "lg"}

NOT like this (WRONG — do not nest fields under a key named after the op):
{"id": "eq-1", "step": 1, "place_text": {"at": [2, 6], "text": "3x + 7 = 22"}}

PARAMETRIC DIAGRAMS (optional, use when genuinely useful): if the problem has ONE natural
adjustable quantity a student would want to experiment with — a side length, radius, angle — add
top-level "variables" and "bindings" arrays so the diagram gets a live slider. Only do this when
there's a real, single, obvious parameter; don't force it onto problems that don't have one.

"variables": [{ "id": "s", "label": "Side length", "min": 1, "max": 10, "default": 4, "step": 0.5 }]
  — one object per adjustable quantity (almost always exactly one). "id" is how bindings refer to
  it. Pick min/max that comfortably bracket the given problem's value.

"bindings": a list of { "opId", "field", "expr" or "template", "index"?, "component"? } — each one
  says "when this variable changes, recompute this op's field". "expr" is a math expression (see
  below) for numeric fields; "template" is for text fields with {expr} placeholders inside. Field
  targeting: "radius" (draw_circle/draw_arc/draw_cylinder/draw_cone/draw_sphere_outline, whole-field
  expr) · "radiusX"/"radiusY" (draw_ellipse) · "width"/"height"/"depth" (draw_cuboid) · "height"
  (draw_cylinder) · "at"/"center"/"vertex"/"arm1"/"arm2"/"from"/"to"/"origin"/"baseCenter"/"apex" (a
  Point2 field — set "component": 0 for x or 1 for y, one binding per coordinate you need to move) ·
  "points" (draw_polygon/shade_region — also set "index" for which point, plus "component") · "text"
  (place_text.text or write_note.text, via "template") · "metaValue" (label_angle/label_side
  meta.value, via "template" or "expr"). This generic field-targeting works unchanged for the
  extended geometry ops above — e.g. bind a variable to draw_ellipse.radiusX/radiusY for an
  eccentricity demo, or to draw_cylinder.radius/height for a "how does volume change" demo.

Expression syntax: + - * / ^ (power), parentheses, the variable's own "id" as a bare name, and
functions sqrt()/sin()/cos()/tan()/abs()/round()/min()/max()/the constant pi (either "pi" or "π" both work). No other syntax.

Worked example — "area of a square with side s", parametric on s:
{
  "variables": [{ "id": "s", "label": "Side length", "min": 1, "max": 8, "default": 4 }],
  "ops": [
    { "id": "sq", "step": 1, "op": "draw_polygon", "points": [[0,0],[4,0],[4,4],[0,4]] },
    { "id": "formula", "step": 1, "op": "place_text", "at": [0, 5.5], "text": "A = s^2 = 4^2 = 16", "size": "lg" }
  ],
  "bindings": [
    { "opId": "sq", "field": "points", "index": 1, "component": 0, "expr": "s" },
    { "opId": "sq", "field": "points", "index": 2, "component": 0, "expr": "s" },
    { "opId": "sq", "field": "points", "index": 2, "component": 1, "expr": "s" },
    { "opId": "sq", "field": "points", "index": 3, "component": 1, "expr": "s" },
    { "opId": "formula", "field": "text", "template": "A = s^2 = {s}^2 = {s^2}" }
  ]
}
Note the initial op coordinates/text still use the concrete default value (4) so the diagram
looks right even before the slider moves — the bindings just make it stay correct as it moves.
The camera does NOT refit as the slider moves, so size the top-level "boundingBox" to comfortably
frame the shape at the variable's MAX value, not just its default — otherwise the figure grows
outside the visible frame as the student drags the slider up.
`.trim();

const OLYMPIAD_GEOMETRY_REFERENCE = `
Olympiad geometry knowledge map — every concept below is drawable with the ops already listed
above; nothing here needs a new op. This tells you WHICH ops to combine and HOW for each named
concept, so when a problem mentions any of these terms you know exactly how to construct the
figure instead of guessing or skipping the diagram. Compute all coordinates yourself (trig,
intersections, ratios) and emit plain numbers — the ops only ever take concrete points.

TRIANGLES & CLASSIFICATION
- Scalene/isosceles/equilateral/acute/right/obtuse: draw_polygon (3 points) + label_side for equal
  sides (same targetId styling not needed, just matching numeric labels) + draw_tick_marks with
  matching "count" on sides that are equal + label_angle for each angle. Right angle: use
  draw_right_angle_mark at the vertex, not label_angle, for the standard square symbol.
- Equilateral: draw_regular_polygon sides:3, OR draw_polygon + tick marks (count:1) on all 3 sides.

CONGRUENCE & SIMILARITY
- To show two triangles congruent/similar: draw both as separate draw_polygon ops, use matching
  draw_tick_marks counts on corresponding equal sides and matching label_angle values on
  corresponding equal angles — the visual matching IS the proof, no special op needed.
- Similar triangles at different scale: just draw both polygons at their real relative sizes.

LINES IN A TRIANGLE
- Median: draw_line from a vertex to the midpoint of the opposite side (compute midpoint yourself).
- Altitude: draw_line from a vertex perpendicular to the opposite side, PLUS a draw_right_angle_mark
  at the foot of the altitude.
- Angle bisector: draw_ray from the vertex through the opposite side, with label_angle showing the
  two halves are equal (same value on both, or tick-mark-style equal arcs — use label_angle twice
  with the same meta.value).
- Perpendicular bisector: draw_dashed_line through a side's midpoint at 90°, with a
  draw_right_angle_mark at the foot.
- Midline/mid-segment: draw_dashed_line between two side-midpoints (signals "constructed", not an
  original side), often with draw_parallel_marks matching the parallel third side.
- Cevian (general): draw_line from a vertex to any point on the opposite side.

TRIANGLE CENTERS
- Centroid/incenter/circumcenter/orthocenter: draw the 3 relevant lines (medians / angle bisectors
  / perpendicular bisectors / altitudes as draw_line or draw_dashed_line), compute their common
  intersection point yourself, mark it with draw_point, and label it via a nearby place_text ("G",
  "I", "O", "H"). Incenter also gets its incircle: draw_circle at the incenter with the computed
  inradius. Circumcenter gets its circumcircle: draw_circle through the vertices.
- Euler line: draw_line (or draw_dashed_line) through the computed O, G, H points once you have them.
- Nine-point circle: draw_circle through the 3 midpoints of the sides (compute center = midpoint of
  OH, radius = circumradius/2).

QUADRILATERALS
- General quadrilateral / parallelogram / rectangle / rhombus / square / kite: draw_polygon with 4
  computed points. Mark equal sides with matching draw_tick_marks counts, parallel sides with
  matching draw_parallel_marks counts, right angles with draw_right_angle_mark, and diagonals (when
  relevant) as draw_dashed_line between opposite vertices, with draw_right_angle_mark at their
  intersection for rhombus/square (diagonals ⟂) or draw_point + equal-tick marks for "diagonals
  bisect each other".
- Trapezoid/trapezium: draw_polygon (4 points, only one pair of sides parallel) + draw_parallel_marks
  on that pair. Isosceles trapezoid: also tick-mark the two legs equal.
- Cyclic trapezoid / any cyclic quadrilateral: draw_circle first, then draw_polygon with all 4
  vertices computed to lie exactly on that circle (angle-parametrize: point = center + radius *
  [cos θ, sin θ] for 4 chosen θ values) — this is the standard construction for ANY cyclic-quad
  problem (Ptolemy, opposite-angles-supplementary, etc).

CIRCLES — BASICS
- Circle/center/radius/diameter: draw_circle, optionally draw_point at the center + place_text label,
  draw_line across for a diameter.
- Chord: draw_line between two points that both lie exactly on a drawn circle.
- Arc/sector/segment: draw_arc for the arc itself; for a sector, add two draw_line (or draw_ray)
  radii from center to the arc's endpoints; for a segment, add shade_region over the chord+arc area.
- Concentric circles: two draw_circle ops sharing the same center, different radii.

CIRCLE THEOREMS & CYCLIC QUADRILATERALS
- Angle at center vs. circumference, angle in a semicircle, equal chords/arcs: draw the circle, the
  relevant chords as draw_line, and label_angle at each vertex whose angle matters — the numeric
  labels demonstrate the relationship (e.g. label one 2x the other, or both 90°).
- Perpendicular from center to chord / chords equidistant from center: draw_dashed_line from center
  to the chord's midpoint + draw_right_angle_mark there.
- Cyclic quadrilateral (opposite angles supplementary, exterior angle = opposite interior angle,
  Ptolemy): construct per "Cyclic trapezoid" above, then label_angle at the relevant vertices.
  Ptolemy's theorem itself (AC·BD = AB·CD + BC·AD) is a numeric relationship — state it in
  write_note/place_text rather than as a drawn object.

TANGENT GEOMETRY & POWER OF A POINT
- Tangent to a circle: draw_line (or draw_ray) touching the circle at exactly one computed point,
  PLUS draw_right_angle_mark between the tangent and the radius at that point (radius ⟂ tangent is
  the defining property — always show it).
- Equal tangents from an external point: draw both tangent lines from the same external draw_point,
  with matching draw_tick_marks counts on each tangent segment.
- Tangent-chord angle / alternate segment theorem: draw the tangent line + the chord from the point
  of tangency + label_angle on both the tangent-chord angle and the inscribed angle in the alternate
  segment (equal values proves the theorem visually).
- Two circles touching externally/internally, common tangents: two draw_circle ops (externally:
  distance between centers = sum of radii; internally: = difference), plus draw_line for each common
  tangent, computed to touch both circles correctly.
- Power of a point (tangent-secant, secant-secant, intersecting chords): draw the circle, the
  external/internal point as draw_point, and the two secants/chords as draw_line or draw_ray through
  it. Label the four resulting segment lengths with label_side so the relationship (e.g. PA·PB =
  PC·PD) is legible from the figure; state the equation itself in write_note.

ADVANCED CIRCLE CONFIGURATIONS
- Incircle/circumcircle/excircle: draw_circle at the computed incenter/circumcenter/excenter with
  the matching radius, alongside the triangle's draw_polygon.
- Radical axis / common chord of two intersecting circles: two draw_circle ops + draw_line (or
  draw_dashed_line, since it's often a constructed/auxiliary line) through their two intersection
  points.
- Radical center: three circles (three draw_circle) + their pairwise radical axes meeting at one
  computed draw_point.

TRIANGLE–CIRCLE FORMULAS (R, r, exradius, sine/cosine rule, Heron's)
- These are numeric relationships, not new shapes — draw the triangle (+ its circumcircle/incircle
  when relevant) and put the formula/computation in write_note or place_text, exactly like the
  worked-example pattern already used for algebra steps.

ANGLES & ANGLE CHASING
- Complementary/supplementary/vertical/linear-pair/corresponding/alternate-interior/co-interior:
  draw the two lines (draw_line) and the transversal if any, then label_angle at each angle in
  question with its computed value — chasing is just labeling angles in sequence across several
  steps so the student sees the deduction unfold (use separate "step" numbers per deduction).
- Angle bisector: see "Lines in a triangle" above.

LENGTH & RATIO GEOMETRY (BPT/Thales, intercept theorem, section formula, harmonic division)
- Parallel-line ratio theorems: draw the triangle/lines with a draw_dashed_line parallel cevian +
  draw_parallel_marks, and label_side on the divided segments with their computed length ratio.
- Section formula / harmonic division: draw_point at the computed dividing point on a draw_line,
  label_side on both sub-segments showing the ratio.

AREA GEOMETRY
- All standard area formulas (triangle, Heron's, parallelogram, trapezoid, rhombus, kite, circle,
  sector, segment): draw the shape, then place_text the formula + computed numeric answer — same
  pattern as the existing square-area worked example.
- Equal-area / common-base / common-altitude arguments: draw both regions (draw_polygon or
  shade_region) and use write_note to state which quantities are equal and why.

COORDINATE GEOMETRY
- When a problem is explicitly coordinate-based: draw_grid + draw_axes first (step 1, so everything
  else draws on top), then plot the actual points as draw_point + place_text labels, draw_line for
  segments, draw_function for any curve/line-as-function, draw_parabola for parabolas.

GEOMETRIC INEQUALITIES
- These are typically proven algebraically, not drawn — use write_note/place_text for the algebra;
  only add a diagram if the problem is fundamentally about a geometric configuration (e.g. shortest
  path via reflection — see Transformations below).

TRANSFORMATIONS (reflection, rotation, translation, dilation, spiral similarity)
- Reflection: compute the reflected point's coordinates yourself, draw both the original and
  reflected figures (draw_polygon/draw_point), and draw_dashed_line for the mirror line itself.
- Rotation: compute rotated coordinates yourself, draw original + rotated figure, and
  draw_curved_arrow around the center of rotation to indicate the turn.
- Translation: draw original + translated figure, draw_vector showing the translation direction.
- Spiral similarity / dilation: draw the original and image figures at their true computed scale
  and position; draw_line from the center of similarity to corresponding points if it clarifies
  the mapping.

CEVA'S THEOREM, MENELAUS, MASS POINTS
- Ceva (concurrent cevians): draw the triangle + all 3 cevians (draw_line from each vertex through
  the opposite side) meeting at one computed common draw_point; label_side the six resulting
  segments so the ratio product can be read off the figure.
- Menelaus (transversal line): draw the triangle + a draw_line (or draw_dashed_line, since it's a
  constructed transversal) crossing the three side-lines (extended if needed — draw_ray works for
  an extended side), label_side the resulting segments.
- Mass points: draw the triangle/cevians as for Ceva, and put the assigned masses as small
  place_text labels near each vertex.

INVERSION (advanced — only when the problem explicitly is about inversion)
- Draw the circle of inversion (draw_circle) and both a point and its computed inverse image
  (draw_point ×2, connected by a draw_dashed_line through the center) — inversion itself is a
  computation you do, the drawing just shows before/after.

OTHER BASIC OBJECTS
- Point/line/ray/segment/angle/bisector/perpendicular/parallel/transversal: draw_point, draw_line,
  draw_ray, draw_line, label_angle, draw_ray+label_angle, draw_right_angle_mark, draw_parallel_marks,
  draw_line respectively — all already covered above.

POLYGONS (pentagon, hexagon, heptagon, octagon, general n-gon)
- Regular: draw_regular_polygon with the right "sides" count. Irregular: draw_polygon with computed
  vertices. Diagonals: draw_dashed_line between non-adjacent vertices. Triangulation: draw_dashed_line
  fanning out from one vertex to every non-adjacent vertex.

3D GEOMETRY (cube, cuboid, prism, pyramid, cylinder, cone, sphere, hemisphere)
- Cuboid/cube: draw_cuboid (cube = equal width/height/depth). Cylinder: draw_cylinder. Cone:
  draw_cone. Sphere: draw_sphere_outline. Hemisphere: draw_sphere_outline + draw_ellipse as the
  flat circular base face. Prism/pyramid (non-rectangular base): approximate with draw_polygon for
  the base face + draw_line edges up to the apex/top face, following the same "front face + offset
  back face" pseudo-3D convention as draw_cuboid.
`.trim();

const ENVELOPE_CONTRACT = `
Respond with ONLY a single JSON object, no prose before or after it, no markdown code fences.
The JSON object must have exactly this shape, keys in this exact order (answerMarkdown first, so
your explanation streams to the student immediately; needsGraph and scene after, since deciding on
a diagram truthfully takes a moment of thought and the app shows a "creating diagram" indicator the
instant it sees needsGraph: true):

CHOOSING THE RIGHT FORM: this envelope can carry several distinct representations of the answer —
plain prose (answerMarkdown), structured reasoning ("solution"), a DOM table ("table"), and/or a
diagram ("scene", geometry/plot/number-line). Pick whichever combination genuinely fits the problem;
don't reach for a representation just because it's available. A linear equation solve needs
"solution" and nothing else. A truth table needs "table" and nothing else. A construction/proof
about angles or lengths needs "solution" plus a diagram. Never force a diagram or a table onto a
problem that's really just arithmetic/algebra — a clean set of steps beats a decorative extra.

"forms" (OPTIONAL, RARELY NEEDED): the fields above already fully cover the overwhelming majority
of answers — use them by default. Reach for "forms" only when the answer genuinely needs something
those fixed-position fields can't express: more than one diagram, more than one table, or content
in an order other than "steps, then table, then diagram" (e.g. prose framing on both sides of a
diagram, two diagrams compared side by side). When you do use it, it's an ordered array of
{"kind": "prose"|"solution_steps"|"geometry"|"plot"|"table", ...} objects replacing solution/table/
scene entirely for this answer — NEVER populate both "forms" and solution/table/needsGraph+scene at
once; pick one path. Each kind's shape: prose is {"kind":"prose","markdown":"..."}; solution_steps
is {"kind":"solution_steps","steps":[{"claim":...,"detail":...,"reason":...}, ...]} (same step
shape as "solution" above); table is {"kind":"table","caption":"...","headers":[...],"rows":[[...]]}
(same shape as "table" above); geometry and plot are diagrams drawn the same way "scene" is below.

PREFER THE ELEGANT PATH: when a problem admits both a mechanical brute-force method (coordinate
bash, grinding out a system of equations, expanding everything symbolically) and a shorter path
that turns on a named theorem, ratio, or special-case recognition (e.g. spotting a 3-4-5-style
Pythagorean triple, a centroid's fixed 2:1/area-thirds ratios, similar triangles, a symmetry
argument), solve it the elegant way and make the recognition itself one of the "solution" steps
("claim": what was recognized, "reason": the theorem/definition that licenses it). This isn't
about brevity for its own sake — it's what makes each step's "reason" teach something a student
can reuse, versus a page of algebra whose only "reason" is "solve the system." Reach for the
mechanical method only when no such shortcut exists or you are not confident one applies; never
let a working brute-force derivation stop you from re-deriving cleanly once you spot the shortcut
— rewrite the solution around it before finalizing, don't just add the insight as a footnote to
the algebra you already did.

CRITICAL — VALID JSON STRINGS: every string value (especially "answerMarkdown") must be valid JSON:
a real newline character is NOT allowed inside a string — write "\\n" (backslash-n) instead of
actually pressing enter. This applies even inside a "$$...$$" block math span: write it as
"$$\\na^2 + b^2 = c^2\\n$$" (or, simpler, keep block math on one line: "$$a^2 + b^2 = c^2$$"), never
as a literal multi-line span with real line breaks in the middle of the JSON string. Getting this
wrong makes the whole response unparseable.

{
  "answerMarkdown": "A clear, step-by-step explanation of the solution, written in standard Markdown (bold, italic, links, lists allowed; no raw HTML). Use $...$ for inline math and $$...$$ for block math (LaTeX/KaTeX syntax) wherever the answer involves equations, expressions, or symbols. When needsGraph is true, insert the literal marker \\"[[DIAGRAM]]\\" on its own line at the exact point where the diagram becomes relevant — typically right after you've set up/described the figure, before the deeper step-by-step reasoning that leans on it. The app renders the diagram inline at that marker and continues your explanation after it, so put it where a teacher would actually turn to the board, not at the very start or very end. Include exactly one marker, and never mention it in the visible text (it's stripped, not shown literally). Omit the marker entirely when needsGraph is false. This field is still the full explanation on its own — solution below is a STRUCTURED duplicate of the same reasoning for the UI's numbered/expandable view, not a replacement; both must tell the same story.",
  "title": "A short 3-6 word title for this question node (e.g. \\"Area of a circle\\", \\"Triangle angle sum proof\\") — omit only if you truly can't summarize it.",
  "solution": "REQUIRED for any problem that takes more than one step to solve (omit only for a single-step lookup/definition question). An array of 2-12 objects, one per discrete idea, in order: [{\\"claim\\": \\"...\\", \\"detail\\": \\"...\\", \\"reason\\": \\"...\\"}, ...]. \\"claim\\" is one sentence stating what is now known or established by this step (e.g. \\"\\u25b3BGC is right-angled at G\\") — specific and checkable, never vague filler like \\"do the next step\\". \\"detail\\" is the actual working for this step (numbers, the equation, LaTeX as in answerMarkdown) — omit only if the step is pure logic with no computation. \\"reason\\" is the one-sentence justification a student would ask \\"why?\\" about — name the theorem, definition, or which prior step it follows from (e.g. \\"The Pythagorean converse: if a\\u00b2+b\\u00b2=c\\u00b2 the triangle is right-angled.\\"); this is exactly as important as detail — a step without a named reason is not finished. One idea per step: never bundle two separate justifications into one claim.",
  "finalAnswer": "REQUIRED whenever solution is present. The final result ONLY, as a short standalone string a student could read in isolation (e.g. \\"72 square units\\", \\"x = 5\\") — not a restatement of the working, not a sentence. Omit only when solution is omitted.",
  "table": "OMIT unless the answer is genuinely tabular — a truth table, a sign/variation chart, a side-by-side comparison, a system of equations laid out row-by-row, or any other enumeration that's clearer as rows/columns than as prose or a diagram. When included: { \\"caption\\": \\"optional short label\\", \\"headers\\": [\\"col1\\", \\"col2\\", ...], \\"rows\\": [[\\"cell\\", \\"cell\\", ...], ...] } — cells are strings and may contain inline LaTeX ($...$). Every row must have exactly as many cells as headers. Never use table for a single before/after pair or two numbers that read fine as a sentence — that's just prose.",
  "needsGraph": true or false — decide honestly based on whether a figure would materially help a student FOLLOW THE REASONING, not merely whether the problem mentions a shape. Ask: is the hard part of this problem spatial (a construction, a proof about angles/lengths that's easier to see than to state, a graph of a function), or is it arithmetic/ratio/theorem-driven where the figure would just be decoration? For the former, needsGraph is true and the figure should be the star. For the latter (e.g. "a centroid splits medians 2:1, use that ratio to find an area" — the insight is a ratio, not a shape) needsGraph should usually be FALSE, or true only for a small, clearly-secondary sketch that never states or implies an answer the reasoning doesn't back up. The diagram must NEVER substitute for solution/answerMarkdown's reasoning, and must NEVER show a computation (like a partial sub-triangle's area) as if it were the final answer when it isn't — a diagram that quietly ships a wrong or incomplete answer is worse than no diagram. When genuinely unsure, prefer false: a good explanation with no picture beats a picture that misleads.
  "diagramTitle": "A short 2-5 word name for THIS diagram (e.g. \\"Triangle proof\\", \\"Number line\\") — OMIT when needsGraph is false. Only include a value that exactly matches one of the 'Existing diagrams' names below when the user is clearly asking to update/continue that same diagram (e.g. they wrote \\"@Triangle proof\\" or clearly mean the same figure); otherwise give it a NEW distinct name so a separate diagram is created rather than overwriting an unrelated one.",
  "forms": "OMIT in the overwhelming majority of answers — see the 'forms' guidance above. Only include when solution/table/needsGraph+scene genuinely can't express this answer's shape. An array of up to 6 objects, each { \\"kind\\": \\"prose\\"|\\"solution_steps\\"|\\"geometry\\"|\\"plot\\"|\\"table\\", ... } as described above; geometry/plot entries here DO carry a full \\"scene\\" (same DSL shape as below) since this is the single-stage contract. When forms is present, OMIT solution/table/needsGraph/scene/diagramTitle entirely — never populate both.",
  "scene": { "version": 1, "boundingBox": {"minX":0,"minY":0,"maxX":8,"maxY":8}, "ops": [ ...DSL ops as described below... ] } — OMIT this field entirely when needsGraph is false. Only include it when needsGraph is true.
}

SELF-CHECK BEFORE YOU FINALIZE: once you have a finalAnswer, verify it independently before writing
it down — re-derive it a different way, plug it back into the original problem, or at minimum sanity-
check its magnitude against the given numbers. If the check disagrees with your first answer, the
check is usually right — trust it, fix solution/finalAnswer/answerMarkdown to match, and don't ship
the first number just because it came first. A wrong final answer is the single worst thing this
app can produce; a few extra seconds of verification is always worth it.
`.trim();

/**
 * Two-stage generation (token-cost fix): DSL_REFERENCE + OLYMPIAD_GEOMETRY_REFERENCE together are
 * ~7,400 tokens, sent unconditionally on EVERY call under the old single-stage contract — even
 * "solve 3x+7=22", which never touches a diagram. This is the stage-1 contract: same shape as
 * ENVELOPE_CONTRACT minus "scene" itself (and the worked-example ops language that only makes
 * sense alongside it) — the model still decides needsGraph/diagramTitle honestly and still places
 * the [[DIAGRAM]] marker in answerMarkdown, but the actual scene is generated in a SEPARATE
 * follow-up call (buildDiagramMessages below) that only ever fires when needsGraph came back true.
 * The fixed per-call cost for the common no-diagram case drops from ~9,100 tokens to roughly the
 * size of this contract alone (~1,800 tokens).
 */
const STAGE1_ENVELOPE_CONTRACT = `
Respond with ONLY a single JSON object, no prose before or after it, no markdown code fences.
The JSON object must have exactly this shape, keys in this exact order (answerMarkdown first, so
your explanation streams to the student immediately; needsGraph after, since deciding on a diagram
truthfully takes a moment of thought and the app shows a "creating diagram" indicator the instant
it sees needsGraph: true).

CHOOSING THE RIGHT FORM: this envelope can carry several distinct representations of the answer —
plain prose (answerMarkdown), structured reasoning ("solution"), a DOM table ("table"), and/or a
diagram (decided here via "needsGraph", drawn in a separate step you don't do). Pick whichever
combination genuinely fits the problem; don't reach for a representation just because it's
available. A linear equation solve needs "solution" and nothing else. A truth table needs "table"
and nothing else. A construction/proof about angles or lengths needs "solution" plus a diagram.
Never force a diagram or a table onto a problem that's really just arithmetic/algebra — a clean
set of steps beats a decorative extra.

"forms" (OPTIONAL, RARELY NEEDED): the fields above already fully cover the overwhelming majority
of answers — use them by default. Reach for "forms" only when the answer genuinely needs something
those fixed-position fields can't express: more than one diagram, more than one table, or content
in an order other than "steps, then table, then diagram" (e.g. prose framing on both sides of a
diagram, two diagrams compared side by side). When you do use it, it's an ordered array of
{"kind": "prose"|"solution_steps"|"geometry"|"plot"|"table", ...} objects replacing solution/table/
needsGraph entirely for this answer — NEVER populate both "forms" and solution/table/needsGraph at
once; pick one path. Each kind's shape: prose is {"kind":"prose","markdown":"..."}; solution_steps
is {"kind":"solution_steps","steps":[{"claim":...,"detail":...,"reason":...}, ...]} (same step
shape as "solution" above); table is {"kind":"table","caption":"...","headers":[...],"rows":[[...]]}
(same shape as "table" above); geometry and plot are diagrams — like needsGraph, just name each one
with an optional "title" here ({"kind":"geometry","title":"..."} or {"kind":"plot","title":"..."})
and its scene is drawn in a separate follow-up step per diagram, same as the single-diagram path.

PREFER THE ELEGANT PATH: when a problem admits both a mechanical brute-force method (coordinate
bash, grinding out a system of equations, expanding everything symbolically) and a shorter path
that turns on a named theorem, ratio, or special-case recognition (e.g. spotting a 3-4-5-style
Pythagorean triple, a centroid's fixed 2:1/area-thirds ratios, similar triangles, a symmetry
argument), solve it the elegant way and make the recognition itself one of the "solution" steps
("claim": what was recognized, "reason": the theorem/definition that licenses it). This isn't
about brevity for its own sake — it's what makes each step's "reason" teach something a student
can reuse, versus a page of algebra whose only "reason" is "solve the system." Reach for the
mechanical method only when no such shortcut exists or you are not confident one applies; never
let a working brute-force derivation stop you from re-deriving cleanly once you spot the shortcut
— rewrite the solution around it before finalizing, don't just add the insight as a footnote to
the algebra you already did.

CRITICAL — VALID JSON STRINGS: every string value (especially "answerMarkdown") must be valid JSON:
a real newline character is NOT allowed inside a string — write "\\n" (backslash-n) instead of
actually pressing enter. This applies even inside a "$$...$$" block math span: write it as
"$$\\na^2 + b^2 = c^2\\n$$" (or, simpler, keep block math on one line: "$$a^2 + b^2 = c^2$$"), never
as a literal multi-line span with real line breaks in the middle of the JSON string. Getting this
wrong makes the whole response unparseable.

{
  "answerMarkdown": "A clear, step-by-step explanation of the solution, written in standard Markdown (bold, italic, links, lists allowed; no raw HTML). Use $...$ for inline math and $$...$$ for block math (LaTeX/KaTeX syntax) wherever the answer involves equations, expressions, or symbols. When needsGraph is true, insert the literal marker \\"[[DIAGRAM]]\\" on its own line at the exact point where the diagram becomes relevant — typically right after you've set up/described the figure, before the deeper step-by-step reasoning that leans on it. The app renders the diagram inline at that marker (drawn by a separate step) and continues your explanation after it, so put it where a teacher would actually turn to the board, not at the very start or very end. Include exactly one marker, and never mention it in the visible text (it's stripped, not shown literally). Omit the marker entirely when needsGraph is false. This field is still the full explanation on its own — solution below is a STRUCTURED duplicate of the same reasoning for the UI's numbered/expandable view, not a replacement; both must tell the same story.",
  "title": "A short 3-6 word title for this question node (e.g. \\"Area of a circle\\", \\"Triangle angle sum proof\\") — omit only if you truly can't summarize it.",
  "solution": "REQUIRED for any problem that takes more than one step to solve (omit only for a single-step lookup/definition question). An array of 2-12 objects, one per discrete idea, in order: [{\\"claim\\": \\"...\\", \\"detail\\": \\"...\\", \\"reason\\": \\"...\\"}, ...]. \\"claim\\" is one sentence stating what is now known or established by this step (e.g. \\"\\u25b3BGC is right-angled at G\\") — specific and checkable, never vague filler like \\"do the next step\\". \\"detail\\" is the actual working for this step (numbers, the equation, LaTeX as in answerMarkdown) — omit only if the step is pure logic with no computation. \\"reason\\" is the one-sentence justification a student would ask \\"why?\\" about — name the theorem, definition, or which prior step it follows from (e.g. \\"The Pythagorean converse: if a\\u00b2+b\\u00b2=c\\u00b2 the triangle is right-angled.\\"); this is exactly as important as detail — a step without a named reason is not finished. One idea per step: never bundle two separate justifications into one claim.",
  "finalAnswer": "REQUIRED whenever solution is present. The final result ONLY, as a short standalone string a student could read in isolation (e.g. \\"72 square units\\", \\"x = 5\\") — not a restatement of the working, not a sentence. Omit only when solution is omitted.",
  "table": "OMIT unless the answer is genuinely tabular — a truth table, a sign/variation chart, a side-by-side comparison, a system of equations laid out row-by-row, or any other enumeration that's clearer as rows/columns than as prose or a diagram. When included: { \\"caption\\": \\"optional short label\\", \\"headers\\": [\\"col1\\", \\"col2\\", ...], \\"rows\\": [[\\"cell\\", \\"cell\\", ...], ...] } — cells are strings and may contain inline LaTeX ($...$). Every row must have exactly as many cells as headers. Never use table for a single before/after pair or two numbers that read fine as a sentence — that's just prose.",
  "needsGraph": true or false — decide honestly based on whether a figure would materially help a student FOLLOW THE REASONING, not merely whether the problem mentions a shape. Ask: is the hard part of this problem spatial (a construction, a proof about angles/lengths that's easier to see than to state, a graph of a function), or is it arithmetic/ratio/theorem-driven where the figure would just be decoration? For the former, needsGraph is true and the figure should be the star. For the latter (e.g. "a centroid splits medians 2:1, use that ratio to find an area" — the insight is a ratio, not a shape) needsGraph should usually be FALSE, or true only for a small, clearly-secondary sketch that never states or implies an answer the reasoning doesn't back up. A drawn diagram must NEVER substitute for solution/answerMarkdown's reasoning, and must NEVER show a computation as if it were the final answer when it isn't. When genuinely unsure, prefer false: a good explanation with no picture beats a picture that misleads. Setting this true commits to a follow-up diagram-drawing step, so only do it when the figure genuinely earns that cost.
  "diagramTitle": "A short 2-5 word name for THIS diagram (e.g. \\"Triangle proof\\", \\"Number line\\") — OMIT when needsGraph is false. Only include a value that exactly matches one of the 'Existing diagrams' names below when the user is clearly asking to update/continue that same diagram (e.g. they wrote \\"@Triangle proof\\" or clearly mean the same figure); otherwise give it a NEW distinct name so a separate diagram is created rather than overwriting an unrelated one.",
  "forms": "OMIT in the overwhelming majority of answers — see the 'forms' guidance above. Only include when solution/table/needsGraph genuinely can't express this answer's shape. An array of up to 6 objects, each { \\"kind\\": \\"prose\\"|\\"solution_steps\\"|\\"geometry\\"|\\"plot\\"|\\"table\\", ... } as described above; geometry/plot entries here do NOT carry a scene (only an optional \\"title\\") since this is stage 1 — each one's diagram is drawn in a separate follow-up step, same as the single-diagram path. When forms is present, OMIT solution/table/needsGraph/diagramTitle entirely — never populate both."
}

Do NOT include a "scene" field — even when needsGraph is true, the diagram itself is generated by
a separate step you are not doing right now. Your only job regarding the diagram is the honest
needsGraph decision, the diagramTitle, and the [[DIAGRAM]] marker placement.

SELF-CHECK BEFORE YOU FINALIZE: once you have a finalAnswer, verify it independently before writing
it down — re-derive it a different way, plug it back into the original problem, or at minimum sanity-
check its magnitude against the given numbers. If the check disagrees with your first answer, the
check is usually right — trust it, fix solution/finalAnswer/answerMarkdown to match, and don't ship
the first number just because it came first. A wrong final answer is the single worst thing this
app can produce; a few extra seconds of verification is always worth it.
`.trim();

/** Stage 2's system prompt — only ever sent when stage 1 said needsGraph:true, so the DSL/olympiad
 * reference's ~7,400 tokens are paid exclusively on turns that actually draw something. */
const DIAGRAM_ONLY_CONTRACT = `
Respond with ONLY a single JSON object, no prose before or after it, no markdown code fences:

{ "scene": { "version": 1, "boundingBox": {"minX":0,"minY":0,"maxX":8,"maxY":8}, "ops": [ ...DSL ops as described above... ] } }

The answer and reasoning are ALREADY DECIDED (given to you below) — draw the diagram that
illustrates that exact reasoning. Do not re-derive or second-guess the answer; if the diagram's
own geometry would suggest a different number, trust the given answer and adjust your construction
to be consistent with it, not the other way around.

DRAW THE FIGURE — DO NOT RETYPE THE ALGEBRA. The written working (every equation, every line of
"36 + h² = 100"-style computation) already exists in the answer given to you below, rendered as its
own text — this step exists ONLY to add what text can't: the actual geometric picture. A scene
whose "ops" are mostly place_text/write_note restating that computation is not a diagram, it's a
screenshot of the answer pasted onto a canvas, and it is exactly the failure this two-step split
exists to prevent (never draw an "explanation with text" in place of a real figure). Concretely:
- The construction itself — draw_polygon/draw_line/draw_circle/etc. — is the point. If a scene has
  more text ops (place_text + write_note) than actual construction ops, you have it backwards.
- label_side/label_angle exist to put a SHORT value (a length, an angle, a variable name — "8 ft",
  "θ", "x") next to the part of the figure it belongs to. That is the only text a diagram normally
  needs. Reach for these, not place_text, whenever a label just names something IN the figure.
- place_text is for a single short equation genuinely anchored to the picture (e.g. the Pythagorean
  relation written once, near the right angle it describes) — never a multi-line derivation, never
  a restatement of steps the student can already read in the answer text one scroll away.
- write_note is for a caption a teacher would say aloud while pointing at this step's construction
  — not a transcript of the algebra.
If you genuinely can't find anything worth constructing beyond restating numbers, that is itself a
signal this problem didn't need a diagram — draw the cleanest, most minimal figure that supports
the reasoning, and lean on shape/line/labels over text every time.

CRITICAL — VALID JSON: the same "no real newlines inside string values" rule applies here as
anywhere else — use "\\n", never an actual line break, inside any string field.
`.trim();

function buildDiagramUserMessage(params: {
  prompt: string;
  answerMarkdown: string;
  solution?: { claim: string; detail?: string; reason?: string }[];
  finalAnswer?: string;
  diagramTitle?: string;
}): string {
  const steps = (params.solution ?? [])
    .map((s, i) => `${i + 1}. ${s.claim}${s.detail ? ` (${s.detail})` : ""}`)
    .join("\n");
  return [
    `Problem: ${params.prompt}`,
    `Decided answer:\n${params.answerMarkdown}`,
    steps ? `Steps:\n${steps}` : "",
    params.finalAnswer ? `Final answer: ${params.finalAnswer}` : "",
    params.diagramTitle ? `Diagram title: ${params.diagramTitle}` : "",
    "Draw the diagram now, consistent with everything above.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Stage 1: the tutor intro + STAGE1_ENVELOPE_CONTRACT + all the same optional context pieces as
 * buildGenerationMessages — everything except the diagram-drawing reference itself. */
export function buildAnswerOnlyMessages(params: {
  prompt: string;
  contextBlocks?: string;
  attachments?: MessageAttachment[];
  history?: HistoryTurn[];
  personalization?: string;
  casual?: boolean;
  skillInstructions?: string;
  existingDiagrams?: string[];
}): { messages: ChatMessage[]; plugins?: PdfPlugin[] } {
  const hasHistory = params.history && params.history.length > 0;
  const systemPrompt = [
    "You are a patient, precise math tutor that explains problems with words and typeset math, and (when genuinely useful) decides a hand-drawn-style diagram should accompany the answer — a separate step draws it, not you.",
    STAGE1_ENVELOPE_CONTRACT,
    params.personalization ? `About the student you're helping:\n${params.personalization}` : "",
    hasHistory ? CONVERSATION_NOTE : "",
    params.casual ? CASUAL_NOTE : "",
    params.existingDiagrams && params.existingDiagrams.length > 0 ? existingDiagramsNote(params.existingDiagrams) : "",
    params.skillInstructions ? `Follow this additional style guide for your response:\n${params.skillInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userText = params.contextBlocks
    ? `${params.contextBlocks}\n\nNow answer this question:\n${params.prompt}`
    : params.prompt;

  const { content, plugins } = buildUserContent(userText, params.attachments);

  const historyMessages: ChatMessage[] = (params.history ?? []).map((turn) => ({
    role: turn.role === "USER" ? "user" : "assistant",
    content: turn.content,
  }));

  return {
    messages: [{ role: "system", content: systemPrompt }, ...historyMessages, { role: "user", content }],
    plugins,
  };
}

/** Stage 2: only the diagram-drawing reference + a focused ask for the scene, given the answer
 * stage 1 already committed to. No history/context/personalization — the diagram only needs the
 * problem and the already-decided reasoning, not the full conversational context again. */
export function buildDiagramMessages(params: {
  prompt: string;
  answerMarkdown: string;
  solution?: { claim: string; detail?: string; reason?: string }[];
  finalAnswer?: string;
  diagramTitle?: string;
}): ChatMessage[] {
  const systemPrompt = [
    "You are drawing a hand-drawn-style math diagram for an already-written answer.",
    DSL_REFERENCE,
    OLYMPIAD_GEOMETRY_REFERENCE,
    DIAGRAM_ONLY_CONTRACT,
  ].join("\n\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: buildDiagramUserMessage(params) },
  ];
}

const CONVERSATION_NOTE = `
This may be an ongoing conversation about the SAME question — if earlier user/assistant turns are
shown below, they are the real history of this thread (assistant turns shown as plain prior answers,
not JSON, for readability). Stay consistent with what was already established (the same numbers,
the same diagram, the same context) unless the user clearly changes the subject. If the user's new
message is a follow-up, refinement, or "explain more" on the SAME problem, treat it as continuing
that exact problem — do not invent a new, unrelated example. Your reply must still be the JSON
envelope described above, not plain text.
`.trim();

export interface HistoryTurn {
  role: "USER" | "ASSISTANT";
  content: string;
}

const CASUAL_NOTE = `
This message started from a note the student wrote, not necessarily a math problem to solve — it
may just be an idea, a question, or something to expand on. Reply naturally and conversationally,
like a helpful assistant, not like you're grading a worked math problem. Only use LaTeX/equations
or heavy step-by-step math formatting if the note is actually mathematical and genuinely calls for
it — don't force equations, "Step 1/Step 2" structure, or LaTeX notation onto a request that's just
asking you to explain, brainstorm, or expand on an idea in plain prose.
`.trim();

function existingDiagramsNote(titles: string[]): string {
  return `Existing diagrams for this question: ${titles.map((t) => `"${t}"`).join(", ")}. Set "diagramTitle" to one of these exact names to update it, or a new name to create a distinct additional diagram.`;
}

export function buildGenerationMessages(params: {
  prompt: string;
  contextBlocks?: string;
  attachments?: MessageAttachment[];
  history?: HistoryTurn[];
  personalization?: string;
  casual?: boolean;
  skillInstructions?: string;
  existingDiagrams?: string[];
}): { messages: ChatMessage[]; plugins?: PdfPlugin[] } {
  const hasHistory = params.history && params.history.length > 0;
  // Request-INVARIANT content goes first, in a fixed order, byte-identical across every single
  // call regardless of user/question — this is the shared prefix a prompt-caching-aware backend
  // (most OpenAI-compatible proxies over vLLM-served open-weight models, which is what most of
  // this app's model roster is) can actually cache and bill at a fraction of the price. Anything
  // that varies per user or per request (personalization, history, skill, existing diagrams) goes
  // AFTER, so it never breaks that shared prefix. Reordering costs nothing either way — if the
  // backend doesn't cache, this is a no-op — so there's no reason not to.
  const systemPrompt = [
    "You are a patient, precise math tutor that explains problems with words, typeset math, and (when genuinely useful) a hand-drawn-style diagram.",
    ENVELOPE_CONTRACT,
    DSL_REFERENCE,
    OLYMPIAD_GEOMETRY_REFERENCE,
    params.personalization ? `About the student you're helping:\n${params.personalization}` : "",
    hasHistory ? CONVERSATION_NOTE : "",
    params.casual ? CASUAL_NOTE : "",
    params.existingDiagrams && params.existingDiagrams.length > 0 ? existingDiagramsNote(params.existingDiagrams) : "",
    params.skillInstructions ? `Follow this additional style guide for your response:\n${params.skillInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userText = params.contextBlocks
    ? `${params.contextBlocks}\n\nNow answer this question:\n${params.prompt}`
    : params.prompt;

  const { content, plugins } = buildUserContent(userText, params.attachments);

  const historyMessages: ChatMessage[] = (params.history ?? []).map((turn) => ({
    role: turn.role === "USER" ? "user" : "assistant",
    content: turn.content,
  }));

  return {
    messages: [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content },
    ],
    plugins,
  };
}

export function buildRetryMessages(previousMessages: ChatMessage[], badOutput: string, error: string): ChatMessage[] {
  return [
    ...previousMessages,
    { role: "assistant", content: badOutput },
    {
      role: "user",
      content: `Your last response was invalid: ${error}\n\nRespond again with ONLY the corrected valid JSON object matching the required schema. No prose, no code fences.`,
    },
  ];
}
