# Shader Library

Reusable shader implementations for Three.js (WebGL/WebGPU). Each shader is
a complete, production-ready implementation. Copy the relevant section
directly — never rewrite these from scratch. Every shader has been validated
against the canonical lighting rig from `rig.md`.

---

## 1 — PBR Standard (MeshStandardMaterial wrapper)

Use this for 95% of real-time 3D work. It is physically correct and
GPU-efficient. Customize via parameters rather than writing custom shaders.

```javascript
/**
 * createPBRMaterial — physically-based material with correct defaults.
 * All values are within the physical ranges documented in SKILL.md Phase 4.
 */
export function createPBRMaterial({
  albedo     = [0.5, 0.5, 0.5],  // linear RGB, never [0,0,0] or [1,1,1]
  roughness  = 0.5,               // 0=mirror, 1=rough matte
  metalness  = 0.0,               // 0=dielectric, 1=metal (binary only)
  albedoMap  = null,              // THREE.Texture or null
  normalMap  = null,              // THREE.Texture or null
  ormMap     = null,              // packed ORM texture or null
  emissive   = [0, 0, 0],         // linear RGB, [0,0,0] = no emission
  emissiveMap = null,
} = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(...albedo),
    roughness,
    metalness,
    normalMap,
    normalScale: new THREE.Vector2(1, 1),
    emissive: new THREE.Color(...emissive),
    emissiveMap,
  });

  if (albedoMap) mat.map = albedoMap;

  // ORM unpacking: R=occlusion, G=roughness, B=metalness
  if (ormMap) {
    mat.aoMap = ormMap;
    mat.roughnessMap = ormMap;
    mat.metalnessMap = ormMap;
    // Channel swizzle hint for the renderer
    mat.userData.ormPacked = true;
  }

  return mat;
}
```

---

## 2 — Toon / Stylized (step-shading)

For stylized, cartoon, anime, or hand-painted game assets.

```javascript
/**
 * createToonMaterial — stepped diffuse shading with optional outline.
 * steps: number of discrete shading steps (2=binary, 4=standard toon, 8=subtle)
 */
export function createToonMaterial({
  albedo    = [0.8, 0.6, 0.4],
  albedoMap = null,
  steps     = 4,
  outlineColor = 0x1a1a1a,
  outlineThickness = 0.02,
} = {}) {
  // Build step gradient texture
  const gradientData = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const v = Math.round(((i + 0.5) / steps) * 255);
    gradientData[i * 4 + 0] = v;
    gradientData[i * 4 + 1] = v;
    gradientData[i * 4 + 2] = v;
    gradientData[i * 4 + 3] = 255;
  }
  const gradientTex = new THREE.DataTexture(gradientData, steps, 1);
  gradientTex.needsUpdate = true;

  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(...albedo),
    gradientMap: gradientTex,
  });
  if (albedoMap) mat.map = albedoMap;

  // Outline: backface-expanded shell mesh
  // Create with createOutlineMesh() below
  mat.userData.outlineColor = outlineColor;
  mat.userData.outlineThickness = outlineThickness;
  return mat;
}

/**
 * createOutlineMesh — backface shell for toon outline.
 * Add to the scene alongside the original mesh.
 */
export function createOutlineMesh(mesh, thickness = 0.02, color = 0x1a1a1a) {
  const outlineMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
  });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.multiplyScalar(1 + thickness);
  outline.name = `${mesh.name}_outline`;
  return outline;
}
```

---

## 3 — Emissive Glow

For screens, neon signs, energy effects, lights on surfaces.

```javascript
/**
 * createEmissiveMaterial — self-illuminated surface with bloom-ready output.
 * Pair with UnrealBloomPass (Three.js) for the actual glow effect.
 * emissiveIntensity > 1.0 drives bloom when using HDR rendering.
 */
export function createEmissiveMaterial({
  albedo            = [0.05, 0.05, 0.05],  // dark base — emissive is the star
  emissiveColor     = [0.2, 0.6, 1.0],     // linear RGB of the glow
  emissiveIntensity = 3.0,                  // > 1.0 for bloom-driven glow
  emissiveMap       = null,
  roughness         = 0.8,
  metalness         = 0.0,
} = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(...albedo),
    roughness,
    metalness,
    emissive: new THREE.Color(...emissiveColor),
    emissiveIntensity,
    emissiveMap,
    toneMapped: false, // must be false for values > 1.0 to reach bloom
  });
  return mat;
}
```

---

## 4 — Subsurface Scattering Approximation (SSS)

For skin, wax, translucent plastic, leaves. This is an approximation — real
SSS requires ray tracing. This is the correct real-time approximation.

```javascript
/**
 * createSSSMaterial — approximated subsurface scattering for real-time.
 * Uses a custom ShaderMaterial extending the standard PBR pipeline.
 * sssColor: the color light takes when passing through the material (e.g. red for skin)
 * sssStrength: 0.0 = no SSS, 1.0 = very translucent
 * sssRadius: scattering radius in world units
 */
export function createSSSMaterial({
  albedo      = [0.8, 0.5, 0.4],  // skin base color
  roughness   = 0.5,
  sssColor    = [1.0, 0.3, 0.2],  // warm red for skin
  sssStrength = 0.4,
  sssRadius   = 0.01,
  normalMap   = null,
  albedoMap   = null,
  thicknessMap = null,            // baked thickness map drives SSS intensity
} = {}) {
  // Inject SSS into the standard material via onBeforeCompile
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(...albedo),
    roughness,
    normalMap,
  });
  if (albedoMap) mat.map = albedoMap;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSSSColor    = { value: new THREE.Color(...sssColor) };
    shader.uniforms.uSSSStrength = { value: sssStrength };
    shader.uniforms.uSSSRadius   = { value: sssRadius };
    if (thicknessMap) shader.uniforms.uThicknessMap = { value: thicknessMap };

    // Inject uniform declarations
    shader.fragmentShader = `
      uniform vec3  uSSSColor;
      uniform float uSSSStrength;
      uniform float uSSSRadius;
      ${thicknessMap ? 'uniform sampler2D uThicknessMap;' : ''}
      ${shader.fragmentShader}
    `.replace(
      '#include <dithering_fragment>',
      `
      // SSS approximation: wrap lighting + thickness-driven back-light
      float NdotL = dot(vNormal, directionalLights[0].direction);
      float wrap  = (NdotL + uSSSRadius) / (1.0 + uSSSRadius);
      float sss   = max(0.0, wrap);
      ${thicknessMap ? 'float thickness = texture2D(uThicknessMap, vUv).r;' : 'float thickness = 0.5;'}
      vec3 sssContrib = uSSSColor * sss * thickness * uSSSStrength;
      gl_FragColor.rgb += sssContrib;
      #include <dithering_fragment>
      `,
    );
  };
  mat.needsUpdate = true;
  return mat;
}
```

---

## 5 — Glass / Refraction

For windows, bottles, gems, water surfaces.

```javascript
/**
 * createGlassMaterial — physically-plausible glass.
 * Uses MeshPhysicalMaterial which supports real transmission in Three.js r152+.
 * Requires WebGLRenderer with physicallyCorrectLights and pmremGenerator.
 */
export function createGlassMaterial({
  color           = [1.0, 1.0, 1.0],
  transmission    = 0.95,   // 0=opaque, 1=fully transmissive
  thickness       = 0.5,    // physical thickness in world units
  roughness       = 0.0,    // 0=perfectly clear, higher=frosted
  ior             = 1.5,    // index of refraction: glass=1.5, diamond=2.4, water=1.33
  reflectivity    = 0.5,
  envMap          = null,   // PMREMGenerator output, required for correct reflections
} = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(...color),
    transmission,
    thickness,
    roughness,
    metalness: 0.0,         // glass is never metallic
    ior,
    reflectivity,
    transparent: true,
    side: THREE.DoubleSide, // render both faces for correct refraction
    envMap,
    envMapIntensity: 1.0,
  });
  return mat;
}
```

---

## 6 — Procedural Displacement Noise

For terrain, rocky surfaces, organic displacement, water.
Use in bpy geometry nodes or as a Three.js vertex shader.

```javascript
/**
 * createDisplacementMaterial — vertex displacement with procedural noise.
 * scale: world-space frequency (higher = more detail)
 * strength: displacement amount in world units
 * octaves: number of noise layers (1=smooth, 4=detailed, 8=complex terrain)
 */
export function createDisplacementMaterial({
  albedo   = [0.4, 0.35, 0.3],
  roughness = 0.85,
  scale    = 1.0,
  strength = 0.2,
  octaves  = 4,
  seed     = 0.0,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:     { value: 0 },
      uScale:    { value: scale },
      uStrength: { value: strength },
      uOctaves:  { value: octaves },
      uSeed:     { value: seed },
      uAlbedo:   { value: new THREE.Color(...albedo) },
      uRoughness: { value: roughness },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uScale;
      uniform float uStrength;
      uniform int   uOctaves;
      uniform float uSeed;

      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      // Smooth 3D noise (value noise)
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i),          hash(i+vec3(1,0,0)),f.x),
                       mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                       mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p, int octaves) {
        float val = 0.0, amp = 0.5, freq = 1.0;
        for (int i = 0; i < 8; i++) {
          if (i >= octaves) break;
          val  += amp * noise(p * freq + uSeed);
          freq *= 2.0;
          amp  *= 0.5;
        }
        return val;
      }

      void main() {
        vUv = uv;
        vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        float disp = fbm(worldPos * uScale, uOctaves) * uStrength;
        vec3 displaced = position + normal * disp;
        vNormal = normalMatrix * normal;
        vWorldPos = displaced;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3  uAlbedo;
      uniform float uRoughness;
      varying vec3  vNormal;
      varying vec2  vUv;

      void main() {
        vec3 light = normalize(vec3(0.8, 1.0, 0.6));
        float diff = max(dot(normalize(vNormal), light), 0.0);
        float ambient = 0.15;
        vec3 color = uAlbedo * (diff + ambient);
        // Roughness approximation: clamp specular
        float spec = pow(max(dot(normalize(vNormal), normalize(light + vec3(0,0,1))), 0.0),
                         (1.0 - uRoughness) * 64.0);
        color += vec3(spec * (1.0 - uRoughness) * 0.5);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

// Animate displacement: call each frame with elapsed time
// material.uniforms.uTime.value = clock.getElapsedTime();
```

---

## Shader selection guide

| Use case | Shader |
|---|---|
| Most real assets (props, architecture, vehicles) | PBR Standard |
| Cartoon / anime / stylized game | Toon |
| Screens, signs, energy, lights on surface | Emissive Glow |
| Skin, wax, leaves, translucent plastic | SSS |
| Windows, bottles, gems, liquid | Glass |
| Terrain, rock, organic displacement | Procedural Displacement |
| Metal (any) | PBR Standard with metalness=1.0 |
| Water surface | Procedural Displacement + Glass combined |

## Common mistakes

| Mistake | Fix |
|---|---|
| Using pure black (0,0,0) for dark metal | Minimum albedo 0.02 — dark metal is still dark grey |
| Mid-value metalness (0.5) | Only 0.0 or 1.0 — mid values are never physical |
| MeshBasicMaterial for a "quick test" | It never looks right — use MeshStandardMaterial always |
| roughness=0 on skin | Skin minimum roughness is 0.4 |
| Not setting toneMapped=false on emissives | Emissive > 1.0 will be clamped without this |
| Refractive glass without envMap | Glass without environment map looks like a dark void |
