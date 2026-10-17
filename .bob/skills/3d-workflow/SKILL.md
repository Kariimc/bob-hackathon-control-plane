---
name: 3d-workflow
description: >-
  Complete AAA 3D production workflow for agents. Covers every phase from
  concept spec through geometry, topology, UV, PBR materials, lighting rig,
  LOD generation, code architecture, and validated export. Mandatory for all
  3D work — models, scenes, game assets, real-time WebGL, Blender/bpy scripts,
  Three.js scenes, and procedural generation. Self-activates when the user asks
  to model, sculpt, create a 3D asset, build a scene, write a Blender script,
  set up Three.js, generate a mesh, rig a character, or bake textures.
---

# 3D Workflow — AAA Production Protocol

The authoritative production reference for all 3D work. Every numbered section
is a gate — work from the next section cannot begin until the current one is
complete and its artifact is documented.

---

## Phase 0 — Concept Specification (before any geometry exists)

This is the most important phase. It is also the most skipped. Never skip it.

### 0.1 — Asset spec sheet

Fill every field before opening any tool or writing any code:

```
ASSET SPEC
──────────────────────────────────────────────────────
Name:             [identifier, snake_case]
Type:             [character | prop | vehicle | environment | hero-mesh | scene]
Target engine:    [Blender/bpy | Three.js | Unity HDRP | Unity URP | Unreal 5 | web/glTF]
Style:            [realistic | stylized | toon | sci-fi | organic | hard-surface]
Poly budget:      [total tris for LOD 0 — be specific, e.g. 25,000]
Texture budget:   [max texture size, e.g. 2048×2048 albedo + 2048×2048 packed ORM]
LOD levels:       [e.g. 3 — LOD0 25k, LOD1 12k, LOD2 5k]
Rig required:     [yes/no — if yes: biped | quadruped | prop | facial]
Animation:        [none | in-place | root-motion | morph-targets]
Delivery format:  [FBX | glTF binary | glTF+bin | OBJ+MTL]
Reference images: [min 3 — silhouette ref, detail ref, material ref]
──────────────────────────────────────────────────────
```

**Hard gate:** Do not write a single vertex until every field above is filled.
If you do not have reference images, stop and find them (use taste library Phase 1).

### 0.2 — Silhouette study

Before any 3D work: sketch or describe the silhouette in text.

The silhouette test: if you fill the mesh with a flat color and view it at
thumbnail size, does the shape read instantly? If not, the design is wrong
before the geometry even exists.

State: primary silhouette gesture, 3 dominant shape contrasts (large/medium/small),
and where the visual weight center sits.

### 0.3 — Code module plan (for Blender/bpy or Three.js)

Map the code structure before writing it:

```
# Blender/bpy structure
build_base_mesh()       → returns bmesh
apply_subdivision()     → returns subdivided mesh
unwrap_uvs()            → no return, modifies active mesh
assign_materials()      → no return, assigns material slots
setup_lighting_rig()    → returns collection of light objects
setup_camera()          → returns camera object
export_glTF(path)       → no return, writes file

# Three.js structure
createGeometry()        → returns BufferGeometry
createMaterial(params)  → returns MeshStandardMaterial or custom
createMesh(geo, mat)    → returns Mesh
createLightingRig()     → returns Group
createScene()           → assembles and returns Scene
exportGLTF(scene, path) → returns Promise
```

No magic numbers in code. All constants are named at the top of the file.

---

## Phase 1 — Base Mesh (blockout)

### 1.1 — Blockout rules

The blockout must:
- Represent the correct proportions at ~10% of the final poly count
- Use only primitive shapes (boxes, cylinders, spheres) — no detail
- Be checked against the silhouette study from Phase 0.2 before proceeding
- Have zero overlapping geometry — every primitive is either merged or kept separate

**Blockout quality gate:** View the blockout as a flat-shaded solid from 8 angles
(front, back, left, right, top, bottom, +45°, -45°). Every angle must read the
form clearly. If any angle is ambiguous, fix the proportions before adding detail.

### 1.2 — Subdivision strategy

State the subdivision strategy before applying it:

| Target style | Strategy |
|---|---|
| Realistic organic | Multires sculpt → retopo → bake |
| Stylized hard-surface | SDS (subdivision surface) with creases |
| Realistic hard-surface | Boolean workflow → manual retopo → bake |
| Real-time game asset | Direct low-poly → manual detail pass |
| Procedural | Parametric generation → decimation |

Do not mix strategies mid-asset without a documented reason.

---

## Phase 2 — Topology

This is where most agent work fails. Topology is not "any valid mesh." It is a
specific mesh structure that deforms correctly, renders correctly, and bakes correctly.

### 2.1 — Topology rules (absolute)

**Quads everywhere except termination points:**
- All faces must be quads (4-sided polygons)
- Triangles are only permitted at: poles terminating edge loops, non-deforming
  hard-surface areas where they will never be subdivided, and the final LOD levels
- N-gons (5+ sided) are never permitted anywhere

**Edge loop discipline:**
- Edge loops must follow form/muscle lines on organic shapes
- On hard-surface: edge loops follow panel lines and structural edges
- Support loops for SDS must be placed 1–2 edges from every crease/corner
- No floating edge loops that terminate mid-surface (create T-poles)

**Pole rules:**
- 3-pole (3 edges meeting): acceptable at form terminations (fingertips, tips)
- 5-pole (5 edges meeting): acceptable at form junctions (shoulder meets torso)
- 6+-pole: never acceptable — always resolve before proceeding
- T-pole (edge terminates into face mid-loop): never acceptable

**Polygon density:**
- Consistent density across the mesh — no sudden density jumps without a seam
- High-curvature areas get 2× density of flat areas, not 10×
- The lowest-detail flat area sets the baseline density unit

**Numeric targets by style:**

| Surface | Loops per 10cm real-world | Tris per 10cm² at LOD0 |
|---|---|---|
| Realistic face | 8–12 | 400–600 |
| Stylized face | 4–6 | 150–300 |
| Hard-surface panel | 2–4 | 50–150 |
| Background prop | 1–2 | 20–60 |

### 2.2 — Topology quality gate

Run [`validate-mesh.mjs`](validate-mesh.mjs) after topology is complete:

```bash
node .bob/skills/3d-workflow/validate-mesh.mjs <path-to-exported-obj-or-glb>
```

**Must pass:**
- Zero non-manifold edges
- Zero non-manifold vertices
- Zero isolated vertices
- Quad ratio ≥ 90% (allow ≤ 10% tris at poles/terminations)
- N-gon count = 0

Do not proceed to UV until topology passes.

---

## Phase 3 — UV Unwrapping

### 3.1 — Seam placement rules

**Where to place seams:**
- Along natural material boundaries (leather meets metal, skin meets clothing)
- In recessed areas that are rarely visible (armpits, underside of shoes)
- Following edge loops — seams never cut across quads diagonally
- Mirrored assets: seam runs down the center line, UVs are mirrored for 2× texel efficiency

**Where seams are forbidden:**
- Across high-visibility surfaces (face, chest, hands)
- Through areas that will have strong normal map detail
- Anywhere that creates a visible texture seam at the target texel density

### 3.2 — UV island rules

- All islands are axis-aligned where possible (straight edges horizontal/vertical)
- Island padding: 4px at 2048, 8px at 4096 — prevents bleeding
- No overlapping islands (except intentional mirror overlap)
- All islands oriented consistently: up = toward the top of the UV space
- Pack islands to ≥ 85% UV space coverage

### 3.3 — Texel density

**Target texel densities (pixels per centimeter at target texture size):**

| Asset type | Texel density |
|---|---|
| Hero character face | 20–30 px/cm |
| Character body | 10–15 px/cm |
| Environment hero prop | 8–12 px/cm |
| Background prop | 4–6 px/cm |
| Ground/floor tile (tiling) | N/A — tiled UV |

All islands on a single texture sheet must be within ±10% of each other's
texel density. Density inconsistency is the most common cause of "looks wrong"
renders even when individual textures are technically correct.

### 3.4 — UV quality gate

Run `validate-mesh.mjs` with the `--uv` flag:

```bash
node .bob/skills/3d-workflow/validate-mesh.mjs <path> --uv
```

**Must pass:**
- UV coverage ≥ 85%
- Zero overlapping islands (outside intentional mirror areas)
- Zero UV islands outside 0–1 UV space
- Texel density variance ≤ 10% across islands

---

## Phase 4 — PBR Materials

### 4.1 — Physical value ranges

These are physical reality ranges. Values outside them are physically wrong and
will look wrong under any correct lighting setup.

**Base Color (Albedo):**

| Material | Linear RGB range | Notes |
|---|---|---|
| Metals (all) | (0.5–1.0, 0.5–1.0, 0.5–1.0) | Never below 0.5 for polished metal |
| Dielectrics (non-metals) | (0.03–0.6, 0.03–0.6, 0.03–0.6) | Never above 0.6 for any real dielectric |
| Coal / dark asphalt | (0.02–0.05) | Darkest real dielectric |
| Fresh snow | (0.8–0.9) | Brightest real dielectric |
| Skin (light) | (0.7–0.8, 0.4–0.5, 0.3–0.4) sRGB | High red, moderate green, low blue |
| Skin (dark) | (0.25–0.40, 0.12–0.20, 0.08–0.14) sRGB | |
| Wood | (0.15–0.35) desaturated brown | |
| Concrete | (0.3–0.5) grey | |
| Painted surface | varies, but never > 0.7 | Paint absorbs, never perfect reflector |

**Never use pure black (0,0,0) or pure white (1,1,1) in albedo.** These do not
exist in physical reality and will immediately look artificial.

**Roughness:**

| Material | Roughness range |
|---|---|
| Polished chrome / mirror | 0.0–0.05 |
| Brushed metal | 0.3–0.5 |
| Matte metal / anodized | 0.6–0.8 |
| Glossy plastic | 0.1–0.3 |
| Matte plastic | 0.6–0.9 |
| Skin (face) | 0.4–0.6 |
| Rough stone | 0.85–1.0 |
| Leather | 0.5–0.75 |
| Fabric | 0.75–1.0 |

**Metallic:**
- Binary: 0.0 for all dielectrics, 1.0 for pure metals
- 0.0–0.1 only for: rust, oxidation, worn paint revealing metal (edge gradient)
- Never a mid-value (0.5 metallic) on a uniform surface — that is not physical

**Normal map:**
- Must be baked from a high-poly source — procedural normals are last resort
- Neutral value is (0.5, 0.5, 1.0) in linear / (128, 128, 255) in 8-bit
- Y-axis convention must match target engine (OpenGL = Y+, DirectX = Y-)
- Bake at 2× the target texture resolution, then downsample

### 4.2 — Material channel packing

Pack channels to minimize texture samples:

```
Texture 1: Albedo (RGB) + Opacity (A)        — "albedo_opacity"
Texture 2: Roughness (R) + Metallic (G) + AO (B)  — "orm" (Occlusion/Roughness/Metallic)
Texture 3: Normal map (RGB)                   — "normal"
Texture 4: Emissive (RGB) — only if needed    — "emissive"
```

This is the Unity/Unreal standard packing. Three.js MeshStandardMaterial uses
the same layout. Always use this convention unless the target engine specifies otherwise.

### 4.3 — Baking workflow

High-poly to low-poly baking order:

1. **Normal map** — bake first, highest priority
2. **AO (Ambient Occlusion)** — bake with cage, not ray distance
3. **Curvature** — used to drive edge wear in roughness
4. **Thickness** — drives SSS intensity on organic assets
5. **Color ID** — for masking material regions in substance

Bake settings that matter:
- Ray distance: set to the actual distance between high and low poly (measure it)
- Cage: always use a cage, never ray-distance-only baking
- Sampling: minimum 512 samples for final bake, 64 is fine for review
- Output bit depth: 16-bit for normal maps, 8-bit for everything else

### 4.4 — PBR quality gate

Validate materials under the canonical lighting rig from `rig.md`:

**Checks:**
- Albedo: no pure black or pure white values (min 0.02, max 0.95 linear)
- Roughness: within material-appropriate range (see table above)
- Metallic: binary only (values between 0.1–0.9 require documentation)
- Normal map: no seam at UV island borders visible at 1m distance
- AO: no light leaking (dark areas in physically impossible locations)
- All channels: no artifacting from compression (use lossless PNG for source)

---

## Phase 5 — Lighting Rig

Use the canonical rig defined in `rig.md`. Never deviate from it for validation
passes — consistent lighting is what makes score comparisons meaningful.

Key parameters (full spec in `rig.md`):
- Key light: 45°H / 45°V, 1.0 intensity, color temp 5500K (neutral daylight)
- Fill light: -45°H / 20°V, 0.35 intensity, color temp 6500K (slightly cool)
- Rim light: 180°H / 45°V, 0.6 intensity, color temp 4500K (warm)
- HDRI environment: neutral grey, 0.2 exposure
- Camera: 50mm equivalent FOV, placed at asset center distance × 2.5

Lighting rig setup code for Blender/bpy is in `rig.md`.
Lighting rig setup code for Three.js is in `rig.md`.

---

## Phase 6 — LOD Generation

### 6.1 — LOD targets

| LOD level | Poly count | Transition distance | Use |
|---|---|---|---|
| LOD 0 | 100% (spec budget) | 0–5m | Close-up hero |
| LOD 1 | 50% | 5–15m | Mid-range |
| LOD 2 | 25% | 15–40m | Far distance |
| LOD 3 | 10% | 40m+ | Crowd/background |
| Impostor/billboard | < 200 tris | 80m+ | Extreme distance |

### 6.2 — LOD generation rules

**Never use auto-decimation alone.** The decimation algorithm has no concept of
silhouette preservation — it will destroy the outline at LOD 1 if left unattended.

LOD generation protocol:
1. Apply `decimate` modifier at 50% ratio → preview → **manually fix** any
   silhouette-breaking edges before accepting
2. Apply again at 50% of LOD 1 → preview → fix silhouette
3. Strip internal faces, faces never visible from normal viewing angles
4. Merge vertices that are within 0.1% of the model's bounding box diagonal
5. Verify: LOD N silhouette reads as clearly as LOD 0 at its transition distance

### 6.3 — LOD quality gate

Run `validate-mesh.mjs --lod` which checks:
- Each LOD level has the correct poly count (within ±5% of target)
- No LOD level introduces new non-manifold geometry
- Silhouette area comparison: LOD N silhouette area ≥ 90% of LOD 0 area
  when viewed from the 8 canonical angles

---

## Phase 7 — Code Architecture

### 7.1 — Blender/bpy script structure

Every bpy script follows this exact structure, no exceptions:

```python
"""
Asset: [name from spec sheet]
Spec:  [path to spec sheet or inline reference]
Gates: run validate_mesh() before export
"""

import bpy
import bmesh
import mathutils
from pathlib import Path

# ── Constants ────────────────────────────────────────────────────────────────
ASSET_NAME       = "asset_name"
TARGET_TRIS_LOD0 = 25_000
TARGET_TRIS_LOD1 = 12_500
TARGET_TRIS_LOD2 =  6_250
TEXTURE_SIZE     = 2048
EXPORT_PATH      = Path(__file__).parent / "export"

# ── Geometry ──────────────────────────────────────────────────────────────────
def build_base_mesh(name: str) -> bpy.types.Object:
    """Returns the base mesh object. No materials, no UVs."""
    ...

def apply_subdivision(obj: bpy.types.Object, levels: int) -> bpy.types.Object:
    """Applies subdivision modifier and returns the object."""
    ...

# ── UV ────────────────────────────────────────────────────────────────────────
def unwrap_uvs(obj: bpy.types.Object) -> None:
    """Marks seams and smart-unwraps. Mutates active mesh."""
    ...

# ── Materials ─────────────────────────────────────────────────────────────────
def create_pbr_material(
    name: str,
    albedo: tuple[float, float, float],
    roughness: float,
    metallic: float = 0.0,
    normal_map_path: Path | None = None,
) -> bpy.types.Material:
    """Creates and returns a physically-based material."""
    ...

# ── Lighting ──────────────────────────────────────────────────────────────────
def setup_lighting_rig() -> bpy.types.Collection:
    """Creates canonical 3-point rig. Returns collection. See rig.md."""
    ...

# ── Validation ────────────────────────────────────────────────────────────────
def validate_mesh(obj: bpy.types.Object) -> dict:
    """
    Returns {
        "non_manifold_edges": int,
        "non_manifold_verts": int,
        "n_gons": int,
        "tri_ratio": float,    # 0.0–1.0, target <= 0.10
        "poly_count": int,
    }
    Raises ValueError if any hard gate is violated.
    """
    ...

# ── LOD ───────────────────────────────────────────────────────────────────────
def generate_lod(obj: bpy.types.Object, ratio: float, name_suffix: str) -> bpy.types.Object:
    """Decimates to ratio, returns new object. Manual silhouette fix required after."""
    ...

# ── Export ────────────────────────────────────────────────────────────────────
def export_glTF(filepath: Path, lod_objects: list[bpy.types.Object]) -> None:
    """Exports all LOD objects as a single glTF with LOD suffix naming."""
    ...

# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    mesh = build_base_mesh(ASSET_NAME)
    # ... build pipeline
    result = validate_mesh(mesh)
    if result["non_manifold_edges"] > 0:
        raise ValueError(f"Topology gate failed: {result}")
    # ... continue

if __name__ == "__main__":
    main()
```

### 7.2 — Three.js scene structure

Every Three.js 3D scene follows this exact structure:

```javascript
// ── Constants ─────────────────────────────────────────────────────────────
const ASSET_NAME   = 'asset_name';
const POLY_BUDGET  = 25_000;
const TEXTURE_SIZE = 2048;

// ── Geometry ──────────────────────────────────────────────────────────────
function createGeometry(params = {}) {
  // Returns BufferGeometry. No material, no scene attachment.
}

// ── Material ──────────────────────────────────────────────────────────────
function createMaterial(params = {}) {
  // Returns MeshStandardMaterial (or custom ShaderMaterial from shaders.md).
  // params: { albedo, roughness, metalness, normalMap, ormMap }
}

// ── Mesh ──────────────────────────────────────────────────────────────────
function createMesh(geometry, material) {
  // Returns Mesh with correct castShadow / receiveShadow settings.
}

// ── Lighting ──────────────────────────────────────────────────────────────
function createLightingRig() {
  // Returns Group. Exact spec in rig.md Three.js section.
}

// ── Validation ────────────────────────────────────────────────────────────
function validateGeometry(geometry) {
  // Returns { triCount, hasNonManifold, uvCoverage }.
  // Logs warnings if outside spec. Call after createGeometry().
}

// ── Scene Assembly ────────────────────────────────────────────────────────
function createScene() {
  const scene    = new THREE.Scene();
  const geometry = createGeometry();
  const material = createMaterial({ roughness: 0.5, metalness: 0.0 });
  const mesh     = createMesh(geometry, material);
  const lights   = createLightingRig();
  scene.add(mesh, lights);
  validateGeometry(geometry);
  return scene;
}

// ── Export ────────────────────────────────────────────────────────────────
async function exportGLTF(scene, outputPath) {
  // Returns Promise. Uses GLTFExporter.
}
```

---

## Phase 8 — Export & Validation

### 8.1 — Export settings

**glTF binary (.glb) — preferred for web delivery:**
- Apply all modifiers before export
- Include: normals, UVs, vertex colors (if used), materials
- Exclude: armature (export as separate .glb if rig is needed by engine separately)
- Texture format: JPEG 90% for albedo (3-channel), PNG lossless for normal/ORM
- Compression: use Draco for geometry if > 10k tris, KTX2 for textures if > 2048px

**FBX — for Unity/Unreal:**
- FBX 2020 binary format
- Scale: 1 unit = 1 meter (Blender default) — Unity/Unreal both import at 1:100,
  set "Import Scale" to 0.01 in engine to correct, OR export at 0.01 scale
- Smooth groups: by normals (not by hard/soft edges)
- Triangulate: let the engine do it (do not bake triangulation into the export)

### 8.2 — Final export quality gate

Run the full validation pass:

```bash
node .bob/skills/3d-workflow/validate-mesh.mjs <path> --full
```

**Full gate checks:**
- Topology: manifold, quad ratio, no N-gons
- UV: coverage ≥ 85%, no overlaps, density variance ≤ 10%
- LOD: all levels present, poly counts within spec
- Materials: at least 1 material assigned, no missing texture references
- Scale: bounding box within expected dimensions (from spec sheet)
- File size: under budget (≤ 5MB for web hero asset, ≤ 20MB for game asset)

---

## Quality gates summary

| Gate | When | Command |
|---|---|---|
| Topology | After Phase 2 | `validate-mesh.mjs <path>` |
| UV | After Phase 3 | `validate-mesh.mjs <path> --uv` |
| LOD | After Phase 6 | `validate-mesh.mjs <path> --lod` |
| Full export | After Phase 8 | `validate-mesh.mjs <path> --full` |

All gates must pass before delivering the asset. No exceptions.
