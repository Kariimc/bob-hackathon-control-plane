# /score — Visual Quality Score

Run the Phase 4 quality checks on the current visual deliverable and return a
structured score report. Blocks completion if thresholds are not met.

## Usage

```
/score
/score web
/score 3d
/score motion
```

Without an argument, auto-detects the domain from the current task context.
With an argument, runs checks for that domain only.

---

## What this command does

1. **Detect domain** — infer from active files, recent tool calls, and current
   task context which domain applies: `web-ui`, `web-page`, `3d-asset`,
   `game-asset`, `motion`, `typography`, or `illustration`.

2. **Run all applicable checks** from the Phase 4 threshold table in
   `visual-quality-gate`. For each check:
   - State the check name
   - State the threshold
   - State the measured or estimated value
   - State PASS or FAIL

3. **Produce a score summary:**

```
VISUAL QUALITY SCORE
────────────────────────────────────────
Domain: web-page
Iteration: 2 of minimum 3

CHECK                          THRESHOLD    MEASURED     STATUS
────────────────────────────────────────────────────────────────
Lighthouse Performance         ≥ 90         94           PASS
CLS                            = 0          0.00         PASS
LCP                            ≤ 2.5 s      1.8 s        PASS
WCAG AA body text contrast     ≥ 4.5:1      7.2:1        PASS
WCAG AA large text contrast    ≥ 3:1        5.1:1        PASS
prefers-reduced-motion         present      present      PASS
Keyboard navigation            complete     complete     PASS
────────────────────────────────────────────────────────────────
OVERALL: PASS (7/7)

Next minimum iteration: 1 more required (minimum 3 total for web-page)
```

4. **If any check FAILs:**
   - List the failing checks with their gaps
   - State the specific fix for each
   - State that completion is **blocked** until the check passes
   - Offer to apply the fix immediately

5. **If iteration minimum not yet met:**
   - State how many more iterations are required
   - State that completion is **blocked** regardless of pass/fail status

6. **If all checks PASS and minimum iterations met:**
   - State that the Phase 4 gate is clear
   - Prompt for the Three-Fact Report to complete Phase 5

---

## Checks by domain

### web-ui / web-page
- Lighthouse Performance score ≥ 90
- Cumulative Layout Shift (CLS) = 0
- Largest Contentful Paint (LCP) ≤ 2.5 s
- WCAG AA body text contrast ≥ 4.5:1
- WCAG AA large text contrast ≥ 3:1
- `prefers-reduced-motion` alternative: present and tested
- Keyboard navigation: all interactive elements reachable and operable
- Focus indicators: visible, ≥ 3:1 contrast against adjacent background
- All images: `alt` attributes present
- All icons: `aria-label` or `<title>` + `aria-labelledby` present

### 3d-asset
- Poly count: within ± 5% of stated budget
- Manifold mesh: zero open edges, zero non-manifold vertices
- UV coverage: ≥ 85%, no overlapping islands
- Normal map bake RMSE: ≤ 0.002
- glTF export: passes gltf-validator, zero errors

### game-asset
- LOD chain: minimum 3 levels (100%, 50%, 25%)
- Texel density: uniform within ± 10% across UV islands
- PBR materials: validated under 3-point lighting
- Engine import: no missing material errors

### motion
- Frame budget: ≤ 16 ms per frame (60 fps)
- `prefers-reduced-motion` variant: present and tested
- CLS: animations do not trigger unexpected layout shift
- SSR safety: no hydration mismatch from animation initial states

### typography
- Body text contrast: ≥ 4.5:1 WCAG AA
- Large text contrast: ≥ 3:1 WCAG AA
- Optical sizes: verified at all 3 hierarchy levels
- Font loading: no FOUT in production build

### illustration / icon
- All SVGs: `aria-label` or `<title>` + `aria-labelledby`
- Stroke widths: relative units (em or %) not absolute pixels
- Optical weight: consistent across icon set at 24px render

---

## How to measure when DevTools is not available

When Lighthouse, DevTools, or a browser cannot be used directly, estimate or
infer scores from the code. Be honest about what is measured vs. estimated.

- **Lighthouse Performance**: Estimate from: image sizes (compressed?), render-blocking
  resources, server response time, script defer/async usage.
- **CLS**: Inspect for: images without `width`/`height`, dynamically injected
  content above existing content, web font swaps without `font-display`.
- **LCP**: Identify the likely LCP element; check if it is preloaded and
  above-the-fold.
- **Contrast**: Calculate from the hex/hsl values using the WCAG contrast formula.
- **Poly count**: Count faces in the generated mesh code.
- **Manifold**: Inspect geometry for coincident vertices, unclosed loops, or
  non-manifold edges.

Always label estimated values as `(estimated)` in the score table. Only values
measured by a tool should be reported as definitive.
