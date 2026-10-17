# Domain Stack Reference

Supporting reference for `visual-quality-gate`. Defines the full skill load
order for each domain, per-skill responsibilities, and inter-skill handoff rules.

---

## web-ui

**Use for:** components, dashboards, product UI, forms, navigation, settings pages,
design systems, admin interfaces, empty states, onboarding flows, modals, tooltips.

**Skill load order:**

```
1. frontend-design
2. premium-web-craft
3. web-implementation
4. impeccable
5. harness-visual
```

**Per-skill responsibilities:**

| Skill | What it owns in this domain |
|---|---|
| `frontend-design` | Aesthetic direction — type system, color logic, whitespace language, visual hierarchy. Must produce a complete direction brief before the next skill loads. |
| `premium-web-craft` | Award-tier techniques — bleeding-edge CSS, scroll effects, custom cursors, clip-path, GSAP patterns, Awwwards/Godly reference research. |
| `web-implementation` | Core Web Vitals engineering — SSR/ISR, hydration, CLS, LCP, INP. No visual technique ships if it hurts performance. |
| `impeccable` | Polish pass — spacing consistency, interaction states (hover, focus, active, disabled, loading, empty), error states, edge cases, WCAG AA audit. |
| `harness-visual` | Iteration harness — generate → preview → measure → iterate until thresholds pass. |

**Handoff rules:**
- `frontend-design` must output the Direction Commit (see Phase 2) before `premium-web-craft` loads.
- `web-implementation` must confirm Lighthouse ≥ 90 before `impeccable` runs.
- `impeccable` must complete its audit checklist before `harness-visual` final scoring.

---

## web-page

**Use for:** landing pages, marketing sites, portfolios, microsites, product pages,
event pages, campaign pages, hero sections.

**Skill load order:**

```
1. web-page-builder
   └── internally chains:
       frontend-design
       premium-web-craft
       impeccable
       motion-foundations
       motion-patterns
```

**Notes:**
- `web-page-builder` is the single activatable skill. It orchestrates the chain internally.
- For pages requiring advanced motion (drag, gestures, text animations, SVG paths),
  also activate `motion-advanced` after `motion-patterns`.
- For pages requiring a 3D hero or 3D background, also activate `3d-master-modeler`
  and `max-tech` alongside the web-page stack.

**Handoff rules:**
- The Direction Commit from `frontend-design` governs every visual decision in all
  downstream skills. No skill in the chain overrides it without re-stating the commit.

---

## 3d-asset

**Use for:** meshes, materials, complete scenes built in code — Three.js, Blender
headless (bpy), build123d, OpenSCAD, procedural generation, glTF delivery.

**Skill load order:**

```
1. 3d-workflow       ← LOAD FIRST — authoritative production spec
2. 3d-master-modeler
3. max-tech
4. harness-3d
```

**Per-skill responsibilities:**

| Skill | What it owns |
|---|---|
| `3d-workflow` | The complete production pipeline: concept spec, topology rules, UV rules, PBR physical values, canonical lighting rig, LOD protocol, code architecture templates, and all validation scripts. Must be loaded before any geometry is created. |
| `3d-master-modeler` | Geometry execution — runs the pipeline defined in `3d-workflow`. Owns sculpt, retopology, UV, and bake. Defers to `3d-workflow` for all quality decisions. |
| `max-tech` | GPU delivery — WebGL capability detection, Three.js WebGPU/TSL, shader selection from `3d-workflow/shaders.md`, performance budget. |
| `harness-3d` | Gated iteration harness. Calls `validate-mesh.mjs` at each gate. Does not advance phases until numeric thresholds pass. |

**Validation script:** Run gates with `node .bob/skills/3d-workflow/validate-mesh.mjs`

**Quality gates specific to 3d-asset:**
- Concept spec filled (all fields from `3d-workflow` Phase 0.1 spec sheet).
- Silhouette reads clearly from all 8 canonical angles.
- Poly count: within ± 5% of stated budget.
- Manifold: zero non-manifold edges, zero non-manifold vertices.
- Quad ratio: ≥ 90% (max 10% tris at poles and terminations).
- N-gon count: 0.
- UV coverage: ≥ 85%, no overlapping islands, density variance ≤ 10%.
- PBR values: all within physical ranges defined in `3d-workflow` Phase 4.1.
- Normal map bake: no visible seams at UV island borders at 1m distance.
- glTF export: passes gltf-validator with no errors, max 1 warning.

---

## game-asset

**Use for:** character models, props, weapons, vehicles, collectables — assets
converted from 2D reference art or built from a concept brief, destined for
Unity or Unreal Engine.

**Skill load order:**

```
1. 3d-workflow       ← LOAD FIRST — authoritative production spec
2. game-art
3. game-assets
4. harness-3d
```

**Per-skill responsibilities:**

| Skill | What it owns |
|---|---|
| `3d-workflow` | Complete pipeline spec, topology rules, PBR physical values, canonical lighting rig (`rig.md`), LOD protocol, shader library (`shaders.md`), and validation script. Loaded first, governs all downstream decisions. |
| `game-art` | Art direction — concept brief, style guide, PBR standards aligned with `3d-workflow` Phase 4 ranges, LOD design targets, asset spec sheet. Must complete before any 3D work begins. |
| `game-assets` | Production execution — runs the pipeline from `3d-workflow`. Owns blockout → sculpt → retopo → UV → PBR bake → rig → LOD → export. |
| `harness-3d` | Gated iteration with engine-import validation as the final gate. Calls `validate-mesh.mjs --full` before declaring complete. |

**Quality gates specific to game-asset:**
- Concept spec sheet filled (from `3d-workflow` Phase 0.1).
- LOD chain: minimum 3 levels (100%, 50%, 25%) — silhouette-checked per `3d-workflow` Phase 6.
- Texel density: uniform within ± 10% across UV islands.
- PBR albedo: within physical ranges (no pure black, no pure white).
- PBR materials: validated under canonical rig from `rig.md`.
- Rig (characters only): no skin weight issues, all joints named to engine convention.
- Engine import: FBX or glTF imports with no missing material errors.

---

## game-env

**Use for:** game levels, background environments, parallax scenes, terrain,
atmospheric environments, skyboxes.

**Skill load order:**

```
1. game-art
2. game-environment
3. harness-visual
```

**Per-skill responsibilities:**

| Skill | What it owns |
|---|---|
| `game-art` | Visual style — mood board, palette, lighting brief, asset list with poly budgets. |
| `game-environment` | Environment design and optimization — modular kitbashing, dynamic lighting (Lumen/Lightmass), terrain, sky, foliage, occlusion/culling, navmesh. |
| `harness-visual` | Render comparison — screenshot of environment vs. reference, scored diff. |

---

## motion

**Use for:** React/Next.js animations — page transitions, stagger reveals, exit
animations, scroll effects, micro-interactions, gesture-driven interfaces.

**Skill load order:**

```
1. motion-foundations
2. motion-patterns
3. motion-advanced      (add only if: drag & drop, gestures, text animations,
                         SVG path drawing, or useAnimate sequences are needed)
```

**Per-skill responsibilities:**

| Skill | What it owns |
|---|---|
| `motion-foundations` | Token layer — spring presets, timing tokens, `prefers-reduced-motion` enforcement, SSR safety, device adaptation. Must complete before any animation code is written. |
| `motion-patterns` | Production patterns — button, modal, toast, stagger, page transitions, exit, scroll, layout animation. All patterns use foundation tokens. |
| `motion-advanced` | Complex patterns — drag & drop, gestures, custom hooks, imperative `useAnimate` sequences, text animations, SVG path drawing. |

**Quality gates specific to motion:**
- No animation runs in < 16 ms frame budget (60 fps target).
- All animations have `prefers-reduced-motion` alternatives that are tested.
- No layout animations trigger unexpected CLS (Cumulative Layout Shift).
- SSR: no hydration mismatch caused by animation initial states.

---

## 2d-to-3d

**Use for:** converting a 2D image, concept art, reference photo, or video
into a game-ready 3D asset.

**Skill load order:**

```
1. omni3d
2. game-assets
3. harness-3d
```

**Per-skill responsibilities:**

| Skill | What it owns |
|---|---|
| `omni3d` | Image-to-3D conversion pipeline — frame sampling, voxel draft, quad retopology, auto-rig, motion retarget, engine validation. |
| `game-assets` | Production polish — UV cleanup, PBR rebake, LOD generation, export. |
| `harness-3d` | Final gated validation and engine import check. |

---

## typography

**Use for:** type systems, font pairings, type scales, specimens, display type
as a primary design element.

**Skill load order:**

```
1. frontend-design
2. web-implementation   (for variable fonts, font subsetting, FOUT/FOIT mitigation)
3. impeccable           (for contrast audit and hierarchy audit)
```

**Quality gates specific to typography:**
- All text sizes pass WCAG AA contrast (4.5:1 for body, 3:1 for large text).
- Optical sizes verified at all 3 hierarchy levels at target viewport widths.
- Font loading: no FOUT (Flash of Unstyled Text) in production build.
- Variable font axes (if used): named instances tested at extreme values.

---

## illustration / icon

**Use for:** SVG icons, data visualisation SVGs, illustrations, infographics,
diagram systems.

**Skill load order:**

```
1. frontend-design
2. impeccable
3. harness-visual
```

**Notes:**
- All SVGs must have `aria-label` or `<title>` + `aria-labelledby`.
- All SVG stroke widths are relative (em or %) — never absolute pixel values for
  icons used at variable sizes.
- Icon sets maintain consistent optical weight across all icons in the set (validated
  by measuring stroke width at 24px render size).
