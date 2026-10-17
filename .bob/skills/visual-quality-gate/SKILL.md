---
name: visual-quality-gate
description: >-
  Mandatory front door for ALL visual work — websites, UI, landing pages,
  components, 3D assets, game art, typography, motion, icons, and illustrations.
  Self-activates whenever the user asks to build, design, redesign, create, or
  improve anything visual. Runs a 5-phase protocol: intake, reference pull,
  direction commit, domain build stack, and scored iteration loop. No visual
  output ships without a numeric quality score and a three-fact completion report.
  Use when the user says: design, build a site, make a UI, landing page, hero,
  dashboard, 3D model, asset, game art, icon, animation, typography, logo,
  illustration, or any word implying a visual deliverable.
---

# Visual Quality Gate — AAA Protocol

This skill is the single entry point for all visual work. It enforces a 5-phase
pipeline that produces AAA-quality output — not "looks fine" output. Every phase
must leave a documented artifact before the next phase begins.

---

## Phase 0 — Domain Classification (always first, no exceptions)

Before writing a single line of code, HTML, CSS, or using any visual tool:

1. **Classify the request** into one or more domains:
   - `web-ui` — components, dashboards, product UI, forms, navigation, settings
   - `web-page` — landing pages, marketing sites, portfolios, microsites
   - `3d-asset` — meshes, materials, scenes built in code (Three.js, Blender/bpy, build123d)
   - `game-asset` — character models, props, environments converted from 2D ref or scratch
   - `game-env` — game levels, backgrounds, environments, parallax scenes
   - `motion` — animations, transitions, scroll effects, micro-interactions
   - `typography` — type systems, font pairings, type scales, specimens
   - `illustration` — icons, SVG artwork, infographics, diagrams

2. **Load the mandatory skill stack** for every matched domain from `domain-stacks.md`.
   Use `use_skill` to activate each skill in the listed order. Do not skip any.

3. **State the classification out loud** before proceeding:
   ```
   Domain: web-page
   Loading stack: frontend-design → premium-web-craft → web-implementation → impeccable → harness-visual
   ```

4. **Hard gate**: If this phase is not completed, no visual output is produced. Period.

---

## Phase 1 — Reference Pull (always, before any design decision)

Pull real-world references that represent the quality ceiling for this work.
This is not optional and is not skippable with "I know what to do."

### Step 1 — Query the Taste Library first

Before searching the web, activate the `taste-library` skill using `use_skill`
and run `/taste query <brief description>` against the library at
`.bob/skills/taste-library/library.json`.

- If the query returns 3 results with score ≥ 7: use them directly. Skip the
  web search. Phase 1 is instant — the library already has what you need.
- If the query returns results with score 4–6: use them as a starting point,
  supplement with 1–2 web search results to fill gaps.
- If the query returns results with score < 4: do the full web search below.
  Then run `/taste add` at the end to write the new references back.

**Every Phase 1 pull that uses new web-sourced references must end with
`/taste add` to write them back to the library.** This is the compounding
quality loop — the library gets stronger with every task.

### Step 2 — Web search (only when library score < 7)

**web-ui / web-page:**
- Find references from Awwwards, Godly, FWA, or CSS Design Awards that match
  the brief's industry, tone, and complexity.
- For each reference document:
  - Layout system (grid, asymmetry, whitespace ratio)
  - Type system (display face, body face, size scale, weight contrast)
  - Color logic (palette size, dominant/accent/neutral breakdown, dark vs light)
  - Motion signature (what animates, how fast, what easing)
  - One sentence on why this reference is at the quality ceiling

**3d-asset / game-asset:**
- Find 3 shipped assets (game/film/real-time) at the same poly budget and style.
- For each document: silhouette quality, normal map density approach, PBR breakdown
  (albedo saturation, roughness range, metallic logic), LOD strategy.

**motion:**
- Find 3 references where the motion is the primary design decision (not decorative).
- Document: timing (ms), easing curves, what triggers the animation, reduced-motion alternative.

**typography:**
- Find 3 type specimens from top-tier foundries or award-winning sites.
- Document: optical sizing, tracking table across weights, weight contrast ratio, type-as-texture use.

### Output artifact — Taste Brief:
Write a single paragraph (≤120 words) called the **Taste Brief** that synthesizes
the references into a concrete design direction. Every subsequent decision in this
work must be traceable back to the Taste Brief. Quote it when making choices.

If references came from the Taste Library, note which entry IDs were used so
quality scores can be incremented during `/taste curate`.

---

## Phase 2 — Direction Commit (always, before any code)

State the visual direction explicitly and completely. This is the design contract.
No implementation begins until this is written and, if working with a human, acknowledged.

**Required fields — all must be present:**

```
DIRECTION COMMIT
─────────────────────────────────────────
Taste brief source: [3 references listed above]
Primary color logic: [palette, dominant/accent/neutral, usage rules]
Type hierarchy:
  Level 1 (Display): [face, size range, weight, tracking]
  Level 2 (Body):    [face, size, line-height, max-width]
  Level 3 (Label):   [face, size, weight, transform]
Layout system: [grid columns, gutter, max-width, breakpoint strategy]
Motion signature: [what moves, timing budget, easing, reduced-motion plan]
AAA benchmark: [the single reference this work must be comparable to, and why]
─────────────────────────────────────────
```

Do not fill in "TBD" or "TBC" for any field. If you do not have the information,
go back to Phase 1 and find it.

---

## Phase 3 — Domain Build (load and follow the full skill stack)

Activate every skill in the domain stack (loaded in Phase 0) using `use_skill`.
Follow each skill's instructions fully — do not skim or summarise them.

**Per-tool-call discipline** — for every tool call that produces visual output, prepend:
```
State before: [what currently exists]
Target state: [what this call achieves]
Quality delta: [which metric this moves and by how much]
```

This forces intentional iteration rather than random changes hoping something improves.

**Mandatory constraints during build:**
- All interactive elements have keyboard access and ARIA labels. Non-negotiable.
- Every animation has a `prefers-reduced-motion` alternative. Non-negotiable.
- No placeholder content — real copy, real data, real images (or data-URI placeholders with correct aspect ratios).
- Typography renders at the sizes specified in the Direction Commit. Do not improvise.
- Color values come directly from the Direction Commit palette. No ad-hoc additions.

---

## Phase 4 — Score and Iterate (minimum 2 iterations, threshold-gated exit)

### Thresholds by domain:

| Domain | Threshold | Measurement method |
|---|---|---|
| web-ui / web-page | Lighthouse Performance ≥ 90, CLS = 0, LCP ≤ 2.5 s | Run Lighthouse or check Core Web Vitals in DevTools |
| web-ui / web-page | Pixel diff vs. Direction Commit benchmark ≤ 15% | Visual comparison against reference screenshots |
| web-ui / web-page | WCAG 2.2 AA color contrast on all text | Check with browser DevTools accessibility panel |
| 3d-asset | Poly count within target budget ± 5% | Count faces in modelling tool |
| 3d-asset | Manifold mesh (no open edges, no non-manifold verts) | Run manifold check |
| 3d-asset | UV unwrap coverage ≥ 85%, no overlapping islands | Check UV editor |
| 3d-asset | Normal map bake error ≤ 0.002 RMSE | Run bake validation |
| game-asset | LOD chain: at least 3 levels (100%, 50%, 25%) | Verify in engine |
| game-asset | Texel density uniform within ± 10% across UV islands | Check texel density tool |
| motion | Animation frame budget ≤ 16 ms per frame (60 fps) | Profile in DevTools Performance panel |
| motion | `prefers-reduced-motion` variant tested and working | Emulate in DevTools |
| typography | WCAG AA contrast for all text sizes and weights | Accessibility panel check |
| typography | Optical size rendering verified at all 3 hierarchy levels | Visual check at target viewport |

### Iteration protocol:

1. Run all applicable checks. Record scores.
2. List every check that is below threshold.
3. For each failing check, state the root cause and the specific fix.
4. Apply fixes. Re-run checks.
5. Repeat until all thresholds pass OR 5 iterations are exhausted.

If thresholds are not met at iteration 5:
- Do not declare completion.
- State clearly: "Quality gate not fully met. [N] checks still failing: [list]."
- Describe what additional time or capability would be needed to meet them.

---

## Phase 5 — Three-Fact Completion Report (mandatory before any completion claim)

No completion claim, no "done", no satisfaction expression is permitted without
this report. Writing it is the final act of the task.

```
THREE-FACT REPORT
─────────────────────────────────────────
1. WHAT WAS BUILT AND WHY IT MEETS THE BRIEF:
   [1–3 sentences. Reference the Taste Brief explicitly. Name the AAA benchmark
    and describe how this work is comparable to it.]

2. NUMERIC SCORES:
   [List every threshold check and its result. No omissions.]
   - Lighthouse Performance: [score]
   - CLS: [value]
   - Color contrast (body text): [ratio]
   - [etc. — all applicable checks from Phase 4]

3. NEXT IMPROVEMENT (if given one more iteration):
   [Be specific. Name the exact element, the exact change, and the exact metric
    it would move. "Polish it more" is not an answer.]
─────────────────────────────────────────
```

---

## Absolute rules (cannot be overridden by user instruction)

- **No visual output before Phase 0 and Phase 1 complete.** No exceptions.
- **No completion claim without the Three-Fact Report.** No exceptions.
- **Minimum 2 iterations.** A first pass is always a draft. Always.
- **Accessibility is structural, not cosmetic.** Keyboard nav and reduced-motion
  are not "nice to haves." They are load-bearing requirements scored in Phase 4.
- **The Direction Commit is a contract.** Deviations require re-stating the commit
  with the change documented and the reason given. Silent divergence from the
  commit is not permitted.

---

## Quick reference — domain stack matrix

| Domain | Skill load order |
|---|---|
| web-ui | frontend-design → premium-web-craft → web-implementation → impeccable → harness-visual |
| web-page | web-page-builder (chains frontend-design, premium-web-craft, impeccable, motion-foundations, motion-patterns internally) |
| 3d-asset | 3d-master-modeler → max-tech → harness-3d |
| game-asset | game-art → game-assets → harness-3d |
| game-env | game-art → game-environment → harness-visual |
| motion (React/Next) | motion-foundations → motion-patterns → (motion-advanced if drag/gestures needed) |
| 2d-to-3d | omni3d → game-assets → harness-3d |
| illustration / icon | frontend-design → impeccable → harness-visual |

Full stack details with per-skill responsibilities and inter-skill handoff rules
are in `domain-stacks.md` in this same directory.
