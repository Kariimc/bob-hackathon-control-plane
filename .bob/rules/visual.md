# Visual Quality Rules

These rules apply to every session, every visual task, without exception.
They are not guidelines. They are gates. Work that violates them is not complete.

---

## Rule 1 — No visual output without a Taste Brief

Before any code, HTML, CSS, asset, shader, or design tool is used to produce
visual output, three real-world references must be documented and synthesized
into a Taste Brief (≤120 words).

**What counts as a valid reference:**
- A live URL from Awwwards, FWA, Godly, CSS Design Awards, or Behance
- A shipped game/film asset with a named studio and title
- A type specimen from a named foundry

**What does not count:**
- "Something like Apple's website" (too vague — find the actual page)
- A screenshot without a source
- A previous project you built

**The Taste Brief must name the references explicitly.** "Inspired by award-winning
sites" is not a Taste Brief.

---

## Rule 2 — No single-shot visual work

Every visual deliverable iterates at minimum twice.

The first pass is a draft. Always. No matter how confident you are.
The second pass responds to a scored diff — a concrete gap between the first
pass and the Phase 4 thresholds — not to a feeling that it looks better.

**Minimum iteration count by deliverable:**

| Deliverable | Minimum iterations |
|---|---|
| Full page / site | 3 |
| UI component | 2 |
| 3D asset | 3 (blockout → retopo → final) |
| Game asset | 3 (concept → mid → final) |
| Motion system | 2 |
| Icon set | 2 |
| Typography system | 2 |

Declaring completion after fewer iterations than the minimum is not permitted,
even if all thresholds pass on the first attempt.

---

## Rule 3 — No completion claim without numeric proof

The following phrases are **blocked** without a Three-Fact Report attached:
- "Done", "Complete", "Finished"
- "Looks great", "Looks good", "That's perfect"
- "Here's the final version"
- Any implication that the work is ready to ship

The Three-Fact Report format (from `visual-quality-gate` Phase 5) is mandatory.
It must contain: (1) what was built and why it meets the brief with explicit
reference citation, (2) all numeric scores from the Phase 4 threshold checks,
(3) the single most impactful next improvement if given one more iteration.

A Three-Fact Report that omits numeric scores is invalid. A score of "N/A" is
only acceptable for checks that genuinely cannot be measured in the current
environment — and must explain why.

---

## Rule 4 — Accessibility is structural, not cosmetic

The following are **always required** on every visual deliverable. They are not
optional enhancements. They are scored in Phase 4. Failing them fails the gate.

**For all web work:**
- All interactive elements are keyboard-navigable (Tab, Enter, Escape, arrow keys)
- All interactive elements have visible focus indicators that pass 3:1 contrast
- All images have `alt` text (decorative images use `alt=""`)
- All icons have `aria-label` or `<title>` + `aria-labelledby`
- All form inputs have associated `<label>` elements
- All color-only information is also conveyed by text or shape
- Body text contrast ratio ≥ 4.5:1 (WCAG AA)
- Large text (≥ 18pt / 14pt bold) contrast ratio ≥ 3:1

**For all motion work:**
- Every animation has a `prefers-reduced-motion` alternative
- The reduced-motion alternative is tested — not just written
- No animation creates involuntary motion (parallax, auto-play video) without a
  user-controlled off toggle

**For all 3D web work:**
- A static fallback exists for browsers/devices where WebGL is unavailable
- Performance is validated on a mid-range mobile device profile

---

## Rule 5 — The harness runs, always

For web visual work: `harness-visual` is the build process, not an optional check.
For 3D work: `harness-3d` is the build process, not an optional check.

**What "runs" means:**
- The generate → preview → measure → iterate loop executes at minimum twice
- A preview is rendered and inspected at each iteration (not assumed correct)
- Scores are recorded numerically — not described as "looks fine"
- The loop exits on threshold passage, not on time pressure or confidence

**What does not satisfy this rule:**
- "I've applied the harness principles" without running the loop
- Checking one threshold and declaring others "probably fine"
- Skipping the harness because the deliverable is "simple"

There is no simple visual deliverable. Every deliverable either passes the
harness or it is a draft.
